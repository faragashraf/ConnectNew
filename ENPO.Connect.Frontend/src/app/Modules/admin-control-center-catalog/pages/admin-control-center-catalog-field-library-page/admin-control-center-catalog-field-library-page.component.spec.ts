import { FormBuilder } from '@angular/forms';
import { of } from 'rxjs';
import { AdminControlCenterCatalogFieldLibraryPageComponent } from './admin-control-center-catalog-field-library-page.component';

describe('AdminControlCenterCatalogFieldLibraryPageComponent - API Smart Settings', () => {
  let component: AdminControlCenterCatalogFieldLibraryPageComponent;
  let dynamicSubjectsController: jasmine.SpyObj<any>;
  let adminCatalogController: jasmine.SpyObj<any>;

  const createResponse = <T>(data: T) => ({
    isSuccess: true,
    errors: [],
    data,
    totalCount: 0,
    pageNumber: 0,
    pageSize: 0,
    totalPages: 0
  } as any);

  beforeEach(() => {
    dynamicSubjectsController = jasmine.createSpyObj('DynamicSubjectsController', [
      'getAdminCategoryFieldLinks',
      'upsertAdminCategoryFieldLinks'
    ]);
    adminCatalogController = jasmine.createSpyObj('DynamicSubjectsAdminCatalogController', [
      'getField'
    ]);

    component = new AdminControlCenterCatalogFieldLibraryPageComponent(
      new FormBuilder(),
      { queryParamMap: of({} as any) } as any,
      adminCatalogController,
      dynamicSubjectsController
    );
  });

  it('generates internal runtime JSON from form with token authentication', () => {
    component.apiSettingsForm.patchValue({
      sourceType: 'powerbi',
      trigger: 'change',
      requestFormat: 'json',
      statementId: 65,
      authMode: 'token',
      tokenValue: 'TOKEN_123',
      responseListPath: 'data',
      responseValuePath: 'id',
      responseLabelPath: 'name'
    });

    component.onGenerateApiRuntimeJsonFromForm();

    const runtime = JSON.parse(component.apiSettingsRuntimeJsonDraft);
    expect(runtime.optionLoader.integration.sourceType).toBe('powerbi');
    expect(runtime.optionLoader.integration.statementId).toBe(65);
    expect(runtime.optionLoader.integration.auth.mode).toBe('token');
    expect(runtime.optionLoader.integration.auth.token.staticValue).toBe('TOKEN_123');
  });

  it('applies external/basic JSON draft to smart form fields', () => {
    component.onApiSettingsRuntimeJsonDraftChanged(JSON.stringify({
      optionLoader: {
        trigger: 'blur',
        integration: {
          sourceType: 'external',
          requestFormat: 'json',
          fullUrl: 'https://example.test/api/options',
          method: 'POST',
          auth: {
            mode: 'basic',
            username: {
              source: 'static',
              staticValue: 'api_user'
            },
            password: {
              source: 'static',
              staticValue: 'api_password'
            }
          }
        },
        responseListPath: 'payload.items',
        responseValuePath: 'code',
        responseLabelPath: 'label'
      }
    }));

    component.onApplyApiRuntimeJsonToForm();

    expect(component.apiSettingsForm.get('sourceType')?.value).toBe('external');
    expect(component.apiSettingsForm.get('trigger')?.value).toBe('blur');
    expect(component.apiSettingsForm.get('fullUrl')?.value).toBe('https://example.test/api/options');
    expect(component.apiSettingsForm.get('method')?.value).toBe('POST');
    expect(component.apiSettingsForm.get('authMode')?.value).toBe('basic');
    expect(component.apiSettingsForm.get('username')?.value).toBe('api_user');
    expect(component.apiSettingsForm.get('password')?.value).toBe('api_password');
  });

  it('applies wrapped dynamicRuntime payload JSON into smart form', () => {
    component.onApiSettingsRuntimeJsonDraftChanged(JSON.stringify({
      dynamicRuntime: JSON.stringify({
        optionLoader: {
          trigger: 'init',
          integration: {
            sourceType: 'powerbi',
            requestFormat: 'json',
            statementId: 77,
            auth: {
              mode: 'bearerCurrent'
            }
          },
          responseListPath: 'data',
          responseValuePath: 'id',
          responseLabelPath: 'name'
        }
      })
    }));

    component.onApplyApiRuntimeJsonToForm();

    expect(component.apiSettingsForm.get('sourceType')?.value).toBe('powerbi');
    expect(component.apiSettingsForm.get('statementId')?.value).toBe(77);
    expect(component.apiSettingsForm.get('authMode')?.value).toBe('bearerCurrent');
  });

  it('blocks save when external API URL is missing', () => {
    component.editingIdentity = { applicationId: 'APP-UNIT', fieldKey: 'DOC_SOURCE' };
    component.contextCategoryId = 124;

    component.apiSettingsForm.patchValue({
      sourceType: 'external',
      fullUrl: '',
      method: 'GET',
      authMode: 'none',
      responseListPath: 'data',
      responseValuePath: 'id',
      responseLabelPath: 'name'
    });

    component.onSaveApiSettingsToCategoryLink();

    expect(dynamicSubjectsController.getAdminCategoryFieldLinks).not.toHaveBeenCalled();
    expect(component.apiSettingsMessage).toContain('مطلوب');
  });

  it('saves generated runtime to category link displaySettingsJson', () => {
    component.editingIdentity = { applicationId: 'APP-UNIT', fieldKey: 'DOC_SOURCE' };
    component.contextCategoryId = 124;

    component.onApiSettingsRuntimeJsonDraftChanged(JSON.stringify({
      optionLoader: {
        trigger: 'change',
        integration: {
          sourceType: 'external',
          requestFormat: 'json',
          fullUrl: 'https://example.test/api/options',
          method: 'GET',
          auth: {
            mode: 'token',
            token: {
              source: 'static',
              staticValue: 'TOKEN_456'
            }
          }
        },
        responseListPath: 'data',
        responseValuePath: 'id',
        responseLabelPath: 'name'
      }
    }));

    dynamicSubjectsController.getAdminCategoryFieldLinks.and.returnValue(of(createResponse([
      {
        mendSql: 7001,
        categoryId: 124,
        fieldKey: 'DOC_SOURCE',
        fieldLabel: 'مصدر المستند',
        fieldType: 'Dropdown',
        groupId: 1,
        groupName: 'البيانات الأساسية',
        isActive: true,
        displayOrder: 1,
        isVisible: true,
        displaySettingsJson: JSON.stringify({ readonly: false, isReadonly: false }),
        applicationId: 'APP-UNIT'
      }
    ])));

    dynamicSubjectsController.upsertAdminCategoryFieldLinks.and.returnValue(of(createResponse([
      {
        mendSql: 7001,
        categoryId: 124,
        fieldKey: 'DOC_SOURCE',
        groupId: 1,
        isActive: true,
        displayOrder: 1,
        isVisible: true,
        displaySettingsJson: JSON.stringify({ readonly: false }),
        applicationId: 'APP-UNIT'
      }
    ])));

    component.onSaveApiSettingsToCategoryLink();

    expect(dynamicSubjectsController.upsertAdminCategoryFieldLinks).toHaveBeenCalledTimes(1);
    const request = dynamicSubjectsController.upsertAdminCategoryFieldLinks.calls.mostRecent().args[1];
    const sentDisplaySettings = JSON.parse(String(request?.links?.[0]?.displaySettingsJson ?? '{}'));

    expect(sentDisplaySettings.dynamicRuntime.optionLoader.integration.sourceType).toBe('external');
    expect(sentDisplaySettings.dynamicRuntime.optionLoader.integration.fullUrl).toBe('https://example.test/api/options');
    expect(sentDisplaySettings.dynamicRuntime.optionLoader.integration.auth.mode).toBe('token');
    expect(sentDisplaySettings.dynamicRuntime.optionLoader.integration.auth.token.staticValue).toBe('TOKEN_456');
    expect(component.apiSettingsMessage).toContain('تم حفظ إعدادات API');
  });

  it('normalizes duplicated display order before saving API settings payload', () => {
    component.editingIdentity = { applicationId: 'APP-UNIT', fieldKey: 'DOC_SOURCE' };
    component.contextCategoryId = 124;

    component.onApiSettingsRuntimeJsonDraftChanged(JSON.stringify({
      optionLoader: {
        trigger: 'change',
        integration: {
          sourceType: 'powerbi',
          requestFormat: 'json',
          statementId: 65,
          auth: {
            mode: 'bearerCurrent'
          }
        },
        responseListPath: 'data',
        responseValuePath: 'id',
        responseLabelPath: 'name'
      }
    }));

    dynamicSubjectsController.getAdminCategoryFieldLinks.and.returnValue(of(createResponse([
      {
        mendSql: 7002,
        categoryId: 124,
        fieldKey: 'DOC_SOURCE',
        fieldLabel: 'مصدر المستند',
        fieldType: 'Dropdown',
        groupId: 1,
        groupName: 'البيانات الأساسية',
        isActive: true,
        displayOrder: 1,
        isVisible: true,
        displaySettingsJson: JSON.stringify({ readonly: false, isReadonly: false }),
        applicationId: 'APP-UNIT'
      },
      {
        mendSql: 7001,
        categoryId: 124,
        fieldKey: 'TOPICDIRECTION',
        fieldLabel: 'اتجاه الموضوع',
        fieldType: 'Dropdown',
        groupId: 1,
        groupName: 'البيانات الأساسية',
        isActive: true,
        displayOrder: 1,
        isVisible: true,
        displaySettingsJson: JSON.stringify({ readonly: false }),
        applicationId: 'APP-UNIT'
      }
    ])));

    dynamicSubjectsController.upsertAdminCategoryFieldLinks.and.returnValue(of(createResponse([])));

    component.onSaveApiSettingsToCategoryLink();

    expect(dynamicSubjectsController.upsertAdminCategoryFieldLinks).toHaveBeenCalledTimes(1);
    const request = dynamicSubjectsController.upsertAdminCategoryFieldLinks.calls.mostRecent().args[1];
    const links = request?.links ?? [];
    const displayOrders = links.map((item: any) => Number(item?.displayOrder ?? 0));

    expect(displayOrders.length).toBe(2);
    expect(new Set(displayOrders).size).toBe(2);
    expect(displayOrders).toContain(1);
    expect(displayOrders).toContain(2);

    const docSourceLink = links.find((item: any) => item?.fieldKey === 'DOC_SOURCE');
    const docSourceDisplaySettings = JSON.parse(String(docSourceLink?.displaySettingsJson ?? '{}'));
    expect(docSourceDisplaySettings.dynamicRuntime.optionLoader.integration.sourceType).toBe('powerbi');
    expect(docSourceDisplaySettings.dynamicRuntime.optionLoader.integration.statementId).toBe(65);
  });

  it('keeps valid unique display orders unchanged while saving API settings payload', () => {
    component.editingIdentity = { applicationId: 'APP-UNIT', fieldKey: 'DOC_SOURCE' };
    component.contextCategoryId = 124;

    component.onApiSettingsRuntimeJsonDraftChanged(JSON.stringify({
      optionLoader: {
        trigger: 'change',
        integration: {
          sourceType: 'powerbi',
          requestFormat: 'json',
          statementId: 65,
          auth: {
            mode: 'bearerCurrent'
          }
        },
        responseListPath: 'data',
        responseValuePath: 'id',
        responseLabelPath: 'name'
      }
    }));

    dynamicSubjectsController.getAdminCategoryFieldLinks.and.returnValue(of(createResponse([
      {
        mendSql: 7002,
        categoryId: 124,
        fieldKey: 'DOC_SOURCE',
        fieldLabel: 'مصدر المستند',
        fieldType: 'Dropdown',
        groupId: 1,
        groupName: 'البيانات الأساسية',
        isActive: true,
        displayOrder: 3,
        isVisible: true,
        displaySettingsJson: JSON.stringify({ readonly: false, isReadonly: false }),
        applicationId: 'APP-UNIT'
      },
      {
        mendSql: 7001,
        categoryId: 124,
        fieldKey: 'TOPICDIRECTION',
        fieldLabel: 'اتجاه الموضوع',
        fieldType: 'Dropdown',
        groupId: 1,
        groupName: 'البيانات الأساسية',
        isActive: true,
        displayOrder: 7,
        isVisible: true,
        displaySettingsJson: JSON.stringify({ readonly: false }),
        applicationId: 'APP-UNIT'
      }
    ])));

    dynamicSubjectsController.upsertAdminCategoryFieldLinks.and.returnValue(of(createResponse([])));

    component.onSaveApiSettingsToCategoryLink();

    expect(dynamicSubjectsController.upsertAdminCategoryFieldLinks).toHaveBeenCalledTimes(1);
    const request = dynamicSubjectsController.upsertAdminCategoryFieldLinks.calls.mostRecent().args[1];
    const links = request?.links ?? [];
    const displayOrders = links.map((item: any) => Number(item?.displayOrder ?? 0));

    expect(displayOrders.length).toBe(2);
    expect(new Set(displayOrders).size).toBe(2);
    expect(displayOrders).toContain(3);
    expect(displayOrders).toContain(7);
  });

  it('opens API settings dialog from row action without opening field editor dialog', () => {
    component.contextCategoryId = 124;

    adminCatalogController.getField.and.returnValue(of(createResponse({
      applicationId: '60',
      fieldKey: 'TOPICDIRECTION',
      fieldLabel: 'اتجاه الموضوع',
      fieldType: 'Dropdown',
      dataType: 'string',
      isActive: true,
      placeholder: '',
      defaultValue: '',
      width: 0,
      height: 0,
      isDisabledInit: false,
      isSearchable: true,
      required: false,
      requiredTrue: false,
      email: false,
      pattern: false,
      minValue: '',
      maxValue: '',
      mask: '',
      cdmendTbl: '',
      cdmendSql: 1001
    })));
    dynamicSubjectsController.getAdminCategoryFieldLinks.and.returnValue(of(createResponse([
      {
        mendSql: 9001,
        categoryId: 124,
        fieldKey: 'TOPICDIRECTION',
        fieldLabel: 'اتجاه الموضوع',
        fieldType: 'Dropdown',
        groupId: 1,
        groupName: 'البيانات الأساسية',
        isActive: true,
        displayOrder: 3,
        isVisible: true,
        displaySettingsJson: JSON.stringify({ readonly: false }),
        applicationId: '60'
      }
    ])));

    component.onEditFieldApiSettings({ applicationId: '60', fieldKey: 'TOPICDIRECTION', fieldType: 'Dropdown' } as any);

    expect(adminCatalogController.getField).toHaveBeenCalledWith('60', 'TOPICDIRECTION');
    expect(component.dialogVisible).toBeFalse();
    expect(component.apiSettingsDialogVisible).toBeTrue();
  });

  it('does not auto open dialogs from editFieldKey unless explicit open flags are provided', () => {
    (component as any).pendingRouteEditFieldKey = 'TOPICDIRECTION';
    (component as any).pendingRouteEditApplicationId = '60';
    (component as any).pendingRouteOpenFieldEditor = false;
    (component as any).pendingRouteOpenApiSettings = false;

    (component as any).tryOpenPendingRouteFieldEditor();

    expect(adminCatalogController.getField).not.toHaveBeenCalled();
    expect(component.dialogVisible).toBeFalse();
    expect(component.apiSettingsDialogVisible).toBeFalse();
  });

  it('allows API settings only for dropdown, radiobutton, and tree dropdown field types', () => {
    expect(component.canOpenApiSettingsForFieldType('Dropdown')).toBeTrue();
    expect(component.canOpenApiSettingsForFieldType('RadioButton')).toBeTrue();
    expect(component.canOpenApiSettingsForFieldType('treeDropdown')).toBeTrue();
    expect(component.canOpenApiSettingsForFieldType('InputText')).toBeFalse();
  });

  it('blocks API settings action for unsupported field type from row action', () => {
    component.onEditFieldApiSettings({
      applicationId: '60',
      fieldKey: 'FREE_TEXT',
      fieldType: 'InputText'
    } as any);

    expect(adminCatalogController.getField).not.toHaveBeenCalled();
    expect(component.apiSettingsDialogVisible).toBeFalse();
    expect(component.messageSeverity).toBe('warn');
    expect(component.message).toContain('Dropdown');
  });
});
