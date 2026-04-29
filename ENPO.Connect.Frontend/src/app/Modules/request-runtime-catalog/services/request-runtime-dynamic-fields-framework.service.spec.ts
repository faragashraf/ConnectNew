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
    facade = jasmine.createSpyObj<RequestRuntimeCatalogFacadeService>('RequestRuntimeCatalogFacadeService', [
      'executeDynamicRequest',
      'executeDynamicExternalRequest',
      'executeDynamicPowerBiRequest'
    ]);
    service = new RequestRuntimeDynamicFieldsFrameworkService(facade);
  });

  afterEach(() => {
    localStorage.removeItem('ConnectToken');
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

  it('executes typed asyncValidation integration end-to-end and syncs form validity', fakeAsync(() => {
    const forms = buildGenericFormsStub();
    const dynamicControls = new FormGroup({
      'nationalId|0': new FormControl('')
    });

    const controlMap = new Map<string, { fieldKey: string; instanceGroupId: number }>([
      ['nationalId|0', { fieldKey: 'nationalId', instanceGroupId: 1 }]
    ]);

    const fields: RequestRuntimeFieldDefinitionDto[] = [
      createRuntimeField('nationalId', {
        asyncValidation: {
          trigger: 'blur',
          debounceMs: 20,
          integration: {
            sourceType: 'external',
            fullUrl: 'https://example.test/api/validate',
            method: 'POST',
            body: [
              { name: 'value', value: { source: 'field', fieldKey: 'nationalId' } }
            ]
          },
          responseValidPath: 'result.valid',
          responseMessagePath: 'result.message',
          defaultErrorMessage: 'تعذر التحقق من صحة القيمة.'
        }
      })
    ];

    facade.executeDynamicExternalRequest.and.callFake((request: any) => {
      const value = String(request?.body?.value ?? '');
      if (value === '111111') {
        return of({
          data: {
            result: {
              valid: false,
              message: 'القيمة غير صالحة'
            }
          }
        } as any);
      }

      return of({
        data: {
          result: {
            valid: true
          }
        }
      } as any);
    });

    service.bind({
      dynamicControls,
      genericFormService: forms as unknown as GenericFormsService,
      fieldDefinitions: fields,
      controlMap
    });

    const control = dynamicControls.get('nationalId|0');
    expect(control).toBeTruthy();

    control?.setValue('111111');
    service.handleGenericEvent({ controlFullName: 'nationalId|0', eventType: 'change' });
    control?.updateValueAndValidity({ emitEvent: false });
    tick(25);
    expect(facade.executeDynamicExternalRequest).toHaveBeenCalledTimes(0);

    service.handleGenericEvent({ controlFullName: 'nationalId|0', eventType: 'blur' });
    control?.updateValueAndValidity({ emitEvent: false });
    tick(25);

    expect(facade.executeDynamicExternalRequest).toHaveBeenCalledTimes(1);
    expect(facade.executeDynamicExternalRequest).toHaveBeenCalledWith({
      fullUrl: 'https://example.test/api/validate',
      method: 'POST',
      requestFormat: 'json',
      authMode: 'bearerCurrent',
      query: undefined,
      headers: undefined,
      body: {
        value: '111111'
      }
    });
    expect(control?.errors?.['runtimeExternalValidation']).toBe('القيمة غير صالحة');
    expect(dynamicControls.invalid).toBeTrue();

    service.handleGenericEvent({ controlFullName: 'nationalId|0', eventType: 'blur' });
    control?.updateValueAndValidity({ emitEvent: false });
    tick(25);
    expect(facade.executeDynamicExternalRequest).toHaveBeenCalledTimes(1);

    control?.setValue('222222');
    service.handleGenericEvent({ controlFullName: 'nationalId|0', eventType: 'blur' });
    control?.updateValueAndValidity({ emitEvent: false });
    tick(25);

    expect(facade.executeDynamicExternalRequest).toHaveBeenCalledTimes(2);
    expect(control?.errors).toBeNull();
    expect(dynamicControls.valid).toBeTrue();
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

  it('resolves powerbi integration bindings from static/field/claim sources', () => {
    localStorage.setItem('ConnectToken', buildToken({ uid: 'U-1' }));

    const forms = buildGenericFormsStub();
    const dynamicControls = new FormGroup({
      'customerCode|0': new FormControl('C-9'),
      'target|0': new FormControl('')
    });

    const controlMap = new Map<string, { fieldKey: string; instanceGroupId: number }>([
      ['customerCode|0', { fieldKey: 'customerCode', instanceGroupId: 1 }],
      ['target|0', { fieldKey: 'target', instanceGroupId: 1 }]
    ]);

    const fields: RequestRuntimeFieldDefinitionDto[] = [
      createRuntimeField('target', {
        optionLoader: {
          trigger: 'init',
          integration: {
            sourceType: 'powerbi',
            statementId: 15,
            parameters: [
              { name: 'mode', value: { source: 'static', staticValue: 'lookup' } },
              { name: 'code', value: { source: 'field', fieldKey: 'customerCode' } },
              { name: 'userId', value: { source: 'claim', claimKey: 'uid' } }
            ]
          },
          responseListPath: 'items',
          responseValuePath: 'id',
          responseLabelPath: 'name'
        }
      })
    ];

    facade.executeDynamicPowerBiRequest.and.returnValue(of({
      data: { items: [{ id: '1', name: 'خيار' }] },
      errors: []
    } as any));

    service.bind({
      dynamicControls,
      genericFormService: forms as unknown as GenericFormsService,
      fieldDefinitions: fields,
      controlMap
    });

    expect(facade.executeDynamicPowerBiRequest).toHaveBeenCalledTimes(1);
    expect(facade.executeDynamicPowerBiRequest).toHaveBeenCalledWith({
      statementId: 15,
      requestFormat: 'json',
      parameters: {
        mode: 'lookup',
        code: 'C-9',
        userId: 'U-1'
      }
    });
    expect(forms.setRuntimeSelectionForField).toHaveBeenCalledWith('target', [{ key: '1', name: 'خيار' }]);
  });

  it('resolves external integration auth mode and custom headers', () => {
    const forms = buildGenericFormsStub();
    const dynamicControls = new FormGroup({
      'source|0': new FormControl('AA')
    });

    const controlMap = new Map<string, { fieldKey: string; instanceGroupId: number }>([
      ['source|0', { fieldKey: 'source', instanceGroupId: 1 }]
    ]);

    const fields: RequestRuntimeFieldDefinitionDto[] = [
      createRuntimeField('source', {
        optionLoader: {
          trigger: 'blur',
          integration: {
            sourceType: 'external',
            fullUrl: 'https://example.test/api/options',
            method: 'GET',
            auth: {
              mode: 'custom',
              customHeaders: [
                { name: 'x-tenant', value: { source: 'static', staticValue: 'TEN' } }
              ]
            },
            query: [
              { name: 'q', value: { source: 'field', fieldKey: 'source' } }
            ]
          },
          responseListPath: 'items',
          responseValuePath: 'key',
          responseLabelPath: 'name'
        }
      })
    ];

    facade.executeDynamicExternalRequest.and.returnValue(of({
      data: {
        items: [
          { key: '1', name: 'وارد' },
          { key: '2', name: 'صادر' }
        ]
      }
    }));

    service.bind({
      dynamicControls,
      genericFormService: forms as unknown as GenericFormsService,
      fieldDefinitions: fields,
      controlMap
    });

    service.handleGenericEvent({ controlFullName: 'source|0', eventType: 'blur' });

    expect(facade.executeDynamicExternalRequest).toHaveBeenCalledTimes(1);
    expect(facade.executeDynamicExternalRequest).toHaveBeenCalledWith({
      fullUrl: 'https://example.test/api/options',
      method: 'GET',
      requestFormat: 'json',
      authMode: 'custom',
      query: { q: 'AA' },
      headers: { 'x-tenant': 'TEN' },
      body: undefined
    });
    expect(forms.setRuntimeSelectionForField).toHaveBeenCalledWith('source', [
      { key: '1', name: 'وارد' },
      { key: '2', name: 'صادر' }
    ]);
  });

  it('resolves external integration token auth mode to bearer authorization header', () => {
    const forms = buildGenericFormsStub();
    const dynamicControls = new FormGroup({
      'source|0': new FormControl('AA')
    });

    const controlMap = new Map<string, { fieldKey: string; instanceGroupId: number }>([
      ['source|0', { fieldKey: 'source', instanceGroupId: 1 }]
    ]);

    const fields: RequestRuntimeFieldDefinitionDto[] = [
      createRuntimeField('source', {
        optionLoader: {
          trigger: 'blur',
          integration: {
            sourceType: 'external',
            fullUrl: 'https://example.test/api/options',
            method: 'GET',
            auth: {
              mode: 'token',
              token: { source: 'static', staticValue: 'abc123' }
            },
            query: [
              { name: 'q', value: { source: 'field', fieldKey: 'source' } }
            ]
          },
          responseListPath: 'items',
          responseValuePath: 'key',
          responseLabelPath: 'name'
        }
      })
    ];

    facade.executeDynamicExternalRequest.and.returnValue(of({
      data: {
        items: [
          { key: '1', name: 'وارد' }
        ]
      }
    }));

    service.bind({
      dynamicControls,
      genericFormService: forms as unknown as GenericFormsService,
      fieldDefinitions: fields,
      controlMap
    });

    service.handleGenericEvent({ controlFullName: 'source|0', eventType: 'blur' });

    expect(facade.executeDynamicExternalRequest).toHaveBeenCalledTimes(1);
    expect(facade.executeDynamicExternalRequest).toHaveBeenCalledWith({
      fullUrl: 'https://example.test/api/options',
      method: 'GET',
      requestFormat: 'json',
      authMode: 'token',
      query: { q: 'AA' },
      headers: { Authorization: 'Bearer abc123' },
      body: undefined
    });
  });

  it('resolves external integration basic auth mode to basic authorization header', () => {
    const forms = buildGenericFormsStub();
    const dynamicControls = new FormGroup({
      'source|0': new FormControl('AA')
    });

    const controlMap = new Map<string, { fieldKey: string; instanceGroupId: number }>([
      ['source|0', { fieldKey: 'source', instanceGroupId: 1 }]
    ]);

    const fields: RequestRuntimeFieldDefinitionDto[] = [
      createRuntimeField('source', {
        optionLoader: {
          trigger: 'blur',
          integration: {
            sourceType: 'external',
            fullUrl: 'https://example.test/api/options',
            method: 'GET',
            auth: {
              mode: 'basic',
              username: { source: 'static', staticValue: 'runtime_user' },
              password: { source: 'static', staticValue: 'runtime_pass' }
            },
            query: [
              { name: 'q', value: { source: 'field', fieldKey: 'source' } }
            ]
          },
          responseListPath: 'items',
          responseValuePath: 'key',
          responseLabelPath: 'name'
        }
      })
    ];

    facade.executeDynamicExternalRequest.and.returnValue(of({
      data: {
        items: [
          { key: '1', name: 'وارد' }
        ]
      }
    }));

    service.bind({
      dynamicControls,
      genericFormService: forms as unknown as GenericFormsService,
      fieldDefinitions: fields,
      controlMap
    });

    service.handleGenericEvent({ controlFullName: 'source|0', eventType: 'blur' });

    expect(facade.executeDynamicExternalRequest).toHaveBeenCalledTimes(1);
    expect(facade.executeDynamicExternalRequest).toHaveBeenCalledWith({
      fullUrl: 'https://example.test/api/options',
      method: 'GET',
      requestFormat: 'json',
      authMode: 'basic',
      query: { q: 'AA' },
      headers: { Authorization: 'Basic cnVudGltZV91c2VyOnJ1bnRpbWVfcGFzcw==' },
      body: undefined
    });
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

function buildToken(payload: Record<string, unknown>): string {
  const base64UrlEncode = (value: unknown): string =>
    btoa(JSON.stringify(value))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');

  return `${base64UrlEncode({ alg: 'none', typ: 'JWT' })}.${base64UrlEncode(payload)}.sig`;
}
