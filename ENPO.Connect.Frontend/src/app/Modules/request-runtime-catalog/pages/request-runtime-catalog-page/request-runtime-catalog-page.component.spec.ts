import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { of } from 'rxjs';
import { GenericFormsService } from 'src/app/Modules/GenericComponents/GenericForms.service';
import { AppNotificationService } from 'src/app/shared/services/notifications/app-notification.service';
import { RequestRuntimeCatalogFacadeService } from '../../services/request-runtime-catalog-facade.service';
import { RequestRuntimeDynamicFieldsFrameworkService } from '../../services/request-runtime-dynamic-fields-framework.service';
import { RequestRuntimeCatalogPageComponent } from './request-runtime-catalog-page.component';

describe('RequestRuntimeCatalogPageComponent - Submit Smoke', () => {
  it('keeps submit flow stable after selecting dynamic option value', () => {
    const facade = jasmine.createSpyObj<RequestRuntimeCatalogFacadeService>('RequestRuntimeCatalogFacadeService', [
      'createSubject'
    ]);
    facade.createSubject.and.returnValue(of({
      data: {
        messageId: 123,
        requestRef: 'REQ-123'
      },
      errors: []
    } as any));

    const appNotification = jasmine.createSpyObj<AppNotificationService>('AppNotificationService', [
      'warning',
      'error',
      'success',
      'showApiErrors'
    ]);

    const genericFormsService: Pick<GenericFormsService, 'GetControl'> = {
      GetControl: (form: FormGroup, controlName: string) => form.get(controlName)
    };

    const dynamicFramework = jasmine.createSpyObj<RequestRuntimeDynamicFieldsFrameworkService>(
      'RequestRuntimeDynamicFieldsFrameworkService',
      ['bind', 'reset', 'handleGenericEvent']
    );

    const component = new RequestRuntimeCatalogPageComponent(
      facade as unknown as RequestRuntimeCatalogFacadeService,
      appNotification,
      genericFormsService as unknown as GenericFormsService,
      new FormBuilder(),
      dynamicFramework
    );
    const reloadSpy = spyOn<any>(component, 'loadRuntimeWorkspace').and.stub();

    component.selectedRequestNode = {
      data: {
        canStart: true,
        categoryId: 77,
        startStageId: 9
      }
    } as any;

    component.dynamicControls = new FormGroup({
      'docSource|0': new FormControl('DOC-INTERNAL')
    });
    (component as any).controlMap.set('docSource|0', {
      fieldKey: 'docSource',
      instanceGroupId: 1
    });

    component.submitRequest();

    expect(facade.createSubject).toHaveBeenCalledTimes(1);
    const payload = facade.createSubject.calls.mostRecent().args[0];
    expect(payload.categoryId).toBe(77);
    expect(payload.stageId).toBe(9);
    expect(payload.submit).toBeTrue();
    expect(payload.dynamicFields).toEqual([
      {
        fieldKey: 'docSource',
        value: 'DOC-INTERNAL',
        instanceGroupId: 1
      }
    ]);
    expect(appNotification.success).toHaveBeenCalled();
    expect(reloadSpy).toHaveBeenCalledWith(false);
  });
});
