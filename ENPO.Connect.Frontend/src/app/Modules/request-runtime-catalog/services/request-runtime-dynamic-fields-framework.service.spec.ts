import { fakeAsync, tick } from '@angular/core/testing';
import { AbstractControl, FormControl, FormGroup } from '@angular/forms';
import { of, Subject } from 'rxjs';
import { GenericFormsService, selection } from 'src/app/Modules/GenericComponents/GenericForms.service';
import { RequestRuntimeFieldDefinitionDto } from '../models/request-runtime-catalog.models';
import { RequestRuntimeCatalogFacadeService } from './request-runtime-catalog-facade.service';
import { RequestRuntimeDynamicFieldsFrameworkService } from './request-runtime-dynamic-fields-framework.service';

interface GenericFormsStub {
  GetControl: (form: FormGroup, controlName: string) => AbstractControl | null;
  setRuntimeSelectionForField: jasmine.Spy<(fieldKey: string, items: selection[]) => void>;
  clearRuntimeSelectionForField: jasmine.Spy<(fieldKey: string) => void>;
}

describe('RequestRuntimeDynamicFieldsFrameworkService', () => {
  let service: RequestRuntimeDynamicFieldsFrameworkService;
  let facade: jasmine.SpyObj<RequestRuntimeCatalogFacadeService>;

  beforeEach(() => {
    facade = jasmine.createSpyObj<RequestRuntimeCatalogFacadeService>('RequestRuntimeCatalogFacadeService', ['executeDynamicRequest']);
    service = new RequestRuntimeDynamicFieldsFrameworkService(facade);
  });

  it('hardens optionLoader with trigger normalization, dedupe, and stale-response guard', () => {
    const forms = buildGenericFormsStub();
    const dynamicControls = new FormGroup({
      'source|0': new FormControl(''),
      'target|0': new FormControl('')
    });

    const controlMap = new Map<string, { fieldKey: string; instanceGroupId: number }>([
      ['source|0', { fieldKey: 'source', instanceGroupId: 1 }],
      ['target|0', { fieldKey: 'target', instanceGroupId: 1 }]
    ]);

    const fields: RequestRuntimeFieldDefinitionDto[] = [
      createRuntimeField('target', {
        optionLoader: {
          sourceFieldKey: 'source',
          trigger: 'change',
          request: { url: '/api/mock/options', query: { q: '{{value}}' } },
          responseListPath: 'items',
          responseValuePath: 'id',
          responseLabelPath: 'name'
        }
      })
    ];

    const firstResponse$ = new Subject<any>();
    const secondResponse$ = new Subject<any>();
    let callCount = 0;
    facade.executeDynamicRequest.and.callFake(() => {
      callCount += 1;
      return (callCount === 1 ? firstResponse$ : secondResponse$).asObservable();
    });

    service.bind({
      dynamicControls,
      genericFormService: forms as unknown as GenericFormsService,
      fieldDefinitions: fields,
      controlMap
    });

    dynamicControls.get('source|0')?.setValue('A');
    service.handleGenericEvent({ controlFullName: 'source|0', eventType: 'change' });
    service.handleGenericEvent({ controlFullName: 'source|0', eventType: 'input' });

    expect(facade.executeDynamicRequest).toHaveBeenCalledTimes(1);

    dynamicControls.get('source|0')?.setValue('AB');
    service.handleGenericEvent({ controlFullName: 'source|0', eventType: 'onChange' });
    expect(facade.executeDynamicRequest).toHaveBeenCalledTimes(2);

    secondResponse$.next({ data: { items: [{ id: '2', name: 'القيمة الأحدث' }] } });
    secondResponse$.complete();

    firstResponse$.next({ data: { items: [{ id: '1', name: 'قيمة قديمة' }] } });
    firstResponse$.complete();

    expect(forms.setRuntimeSelectionForField).toHaveBeenCalledTimes(1);
    const [targetFieldKey, items] = forms.setRuntimeSelectionForField.calls.mostRecent().args;
    expect(targetFieldKey).toBe('target');
    expect(items).toEqual([{ key: '2', name: 'القيمة الأحدث' }]);
  });

  it('hardens asyncValidation with blur trigger, dedupe, and synced validation state', fakeAsync(() => {
    const forms = buildGenericFormsStub();
    const dynamicControls = new FormGroup({
      'code|0': new FormControl('')
    });

    const controlMap = new Map<string, { fieldKey: string; instanceGroupId: number }>([
      ['code|0', { fieldKey: 'code', instanceGroupId: 1 }]
    ]);

    const fields: RequestRuntimeFieldDefinitionDto[] = [
      createRuntimeField('code', {
        asyncValidation: {
          trigger: 'blur',
          debounceMs: 20,
          request: { url: '/api/mock/validate', query: { value: '{{value}}' } },
          responseValidPath: 'isValid',
          responseMessagePath: 'message'
        }
      })
    ];

    facade.executeDynamicRequest.and.callFake((request: any) => {
      const value = String(request?.query?.value ?? '');
      if (value === '111') {
        return of({ data: { isValid: false, message: 'قيمة غير صالحة' } });
      }

      return of({ data: { isValid: true } });
    });

    service.bind({
      dynamicControls,
      genericFormService: forms as unknown as GenericFormsService,
      fieldDefinitions: fields,
      controlMap
    });

    const control = dynamicControls.get('code|0');
    expect(control).toBeTruthy();

    control?.setValue('111');
    service.handleGenericEvent({ controlFullName: 'code|0', eventType: 'input' });
    control?.updateValueAndValidity({ emitEvent: false });
    tick(25);
    expect(facade.executeDynamicRequest).toHaveBeenCalledTimes(0);

    service.handleGenericEvent({ controlFullName: 'code|0', eventType: 'blur' });
    control?.updateValueAndValidity({ emitEvent: false });
    tick(25);

    expect(facade.executeDynamicRequest).toHaveBeenCalledTimes(1);
    expect(control?.errors?.['runtimeExternalValidation']).toBe('قيمة غير صالحة');

    service.handleGenericEvent({ controlFullName: 'code|0', eventType: 'blur' });
    control?.updateValueAndValidity({ emitEvent: false });
    tick(25);

    expect(facade.executeDynamicRequest).toHaveBeenCalledTimes(1);
    expect(control?.errors?.['runtimeExternalValidation']).toBe('قيمة غير صالحة');

    control?.setValue('222');
    service.handleGenericEvent({ controlFullName: 'code|0', eventType: 'blur' });
    control?.updateValueAndValidity({ emitEvent: false });
    tick(25);

    expect(facade.executeDynamicRequest).toHaveBeenCalledTimes(2);
    expect(control?.errors).toBeNull();
  }));

  it('hardens actions/autofill with dedupe, stale-response guard, and loop-safe patching', () => {
    const forms = buildGenericFormsStub();
    const dynamicControls = new FormGroup({
      'lookup|0': new FormControl(''),
      'customerName|0': new FormControl('')
    });

    const targetControl = dynamicControls.get('customerName|0') as FormControl;
    const patchSpy = spyOn(targetControl, 'patchValue').and.callThrough();

    const controlMap = new Map<string, { fieldKey: string; instanceGroupId: number }>([
      ['lookup|0', { fieldKey: 'lookup', instanceGroupId: 1 }],
      ['customerName|0', { fieldKey: 'customerName', instanceGroupId: 1 }]
    ]);

    const fields: RequestRuntimeFieldDefinitionDto[] = [
      createRuntimeField('lookup', {
        actions: [
          {
            trigger: 'change',
            request: { url: '/api/mock/customer', query: { code: '{{value}}' } },
            patches: [{ targetFieldKey: 'customerName', valuePath: 'name', clearWhenMissing: true }]
          }
        ]
      })
    ];

    const firstResponse$ = new Subject<any>();
    const secondResponse$ = new Subject<any>();
    let callCount = 0;
    facade.executeDynamicRequest.and.callFake(() => {
      callCount += 1;
      return (callCount === 1 ? firstResponse$ : secondResponse$).asObservable();
    });

    service.bind({
      dynamicControls,
      genericFormService: forms as unknown as GenericFormsService,
      fieldDefinitions: fields,
      controlMap
    });

    dynamicControls.get('lookup|0')?.setValue('A');
    service.handleGenericEvent({ controlFullName: 'lookup|0', eventType: 'change' });

    dynamicControls.get('lookup|0')?.setValue('B');
    service.handleGenericEvent({ controlFullName: 'lookup|0', eventType: 'select' });
    service.handleGenericEvent({ controlFullName: 'lookup|0', eventType: 'input' });

    expect(facade.executeDynamicRequest).toHaveBeenCalledTimes(2);

    secondResponse$.next({ data: { name: 'الاسم الصحيح' } });
    secondResponse$.complete();

    firstResponse$.next({ data: { name: 'اسم قديم' } });
    firstResponse$.complete();

    expect(targetControl.value).toBe('الاسم الصحيح');
    expect(patchSpy).toHaveBeenCalledTimes(1);
  });
});

function createRuntimeField(fieldKey: string, dynamicRuntime: unknown): RequestRuntimeFieldDefinitionDto {
  return {
    fieldKey,
    displaySettingsJson: JSON.stringify({ dynamicRuntime })
  } as RequestRuntimeFieldDefinitionDto;
}

function buildGenericFormsStub(): GenericFormsStub {
  return {
    GetControl: (form: FormGroup, controlName: string) => form.get(controlName),
    setRuntimeSelectionForField: jasmine.createSpy('setRuntimeSelectionForField'),
    clearRuntimeSelectionForField: jasmine.createSpy('clearRuntimeSelectionForField')
  };
}
