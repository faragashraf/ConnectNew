import { FormBuilder } from '@angular/forms';
import { of } from 'rxjs';
import { BoundFieldItem } from '../../domain/models/field-library-binding.models';
import { FieldLibraryBindingEngine } from '../../domain/field-library-binding/field-library-binding.engine';
import { FieldLibraryBindingPageComponent } from './field-library-binding-page.component';

describe('FieldLibraryBindingPageComponent - Custom Reference Components Editor', () => {
  let component: FieldLibraryBindingPageComponent;

  const getComponentTypes = (): string[] =>
    (component as any)
      .getNormalizedReferenceComponents()
      .map((item: { type: string }) => item.type);

  const getSerialized = (): Array<{ type: string; value?: string; fieldKey?: string }> =>
    (component as any).serializeReferenceComponents((component as any).getNormalizedReferenceComponents());

  beforeEach(() => {
    component = new FieldLibraryBindingPageComponent(
      new FormBuilder(),
      {} as any,
      {} as any,
      new FieldLibraryBindingEngine(),
      {} as any,
      {} as any
    );

    (component as any).setReferenceComponents(
      [
        {
          id: 'base-sequence',
          type: 'sequence'
        }
      ],
      false
    );
  });

  it('should keep month component in FormArray and include it in save payload', () => {
    component.referencePolicyForm.patchValue({
      referencePolicyEnabled: true,
      referenceMode: 'custom',
      referenceSeparator: '-',
      referenceSequencePaddingLength: 5
    });

    component.onAddReferenceComponent();
    component.onReferenceComponentTypeChanged(0, 'year');

    component.onAddReferenceComponent();
    component.onReferenceComponentTypeChanged(1, 'month');

    expect(getComponentTypes()).toEqual(['year', 'month', 'sequence']);

    const request = (component as any).buildSubjectTypeUpsertRequest(null, []);
    const payloadTypes = (request.referenceComponents ?? []).map((item: { type: string }) => item.type);

    expect(request.referenceMode).toBe('custom');
    expect(payloadTypes).toEqual(['year', 'month', 'sequence']);
    expect(request.sequencePaddingLength).toBe(5);
  });

  it('should add static/year/month/day components and keep exact order in payload', () => {
    component.referencePolicyForm.patchValue({ referenceMode: 'custom' });

    component.onAddReferenceComponent();
    component.onReferenceComponentTypeChanged(0, 'static_text');
    component.referenceComponentRows[0].get('value')?.setValue('SAFE2');
    component.onReferenceComponentValueChanged();

    component.onAddReferenceComponent();
    component.onReferenceComponentTypeChanged(1, 'year');

    component.onAddReferenceComponent();
    component.onReferenceComponentTypeChanged(2, 'month');

    component.onAddReferenceComponent();
    component.onReferenceComponentTypeChanged(3, 'day');

    expect(getComponentTypes()).toEqual(['static_text', 'year', 'month', 'day', 'sequence']);

    const serialized = getSerialized();
    expect(serialized.map(item => item.type)).toEqual(['static_text', 'year', 'month', 'day', 'sequence']);
    expect(serialized[0].value).toBe('SAFE2');
  });

  it('should support reorder/delete while keeping sequence as the final component', () => {
    component.referencePolicyForm.patchValue({ referenceMode: 'custom' });

    component.onAddReferenceComponent();
    component.onReferenceComponentTypeChanged(0, 'year');

    component.onAddReferenceComponent();
    component.onReferenceComponentTypeChanged(1, 'month');

    component.onMoveReferenceComponentUp(1);
    expect(getComponentTypes()).toEqual(['month', 'year', 'sequence']);

    component.onMoveReferenceComponentDown(0);
    expect(getComponentTypes()).toEqual(['year', 'month', 'sequence']);

    component.onDeleteReferenceComponent(2);
    expect(getComponentTypes()).toEqual(['year', 'month', 'sequence']);
    expect(component.stepMessage).toContain('لا يمكن حذف');
  });

  it('should delete middle component and keep deleted part out of save payload', () => {
    component.referencePolicyForm.patchValue({ referenceMode: 'custom' });

    component.onAddReferenceComponent();
    component.onReferenceComponentTypeChanged(0, 'year');

    component.onAddReferenceComponent();
    component.onReferenceComponentTypeChanged(1, 'month');

    component.onAddReferenceComponent();
    component.onReferenceComponentTypeChanged(2, 'day');

    expect(getComponentTypes()).toEqual(['year', 'month', 'day', 'sequence']);

    component.onDeleteReferenceComponent(1);
    expect(getComponentTypes()).toEqual(['year', 'day', 'sequence']);

    const payloadTypes = getSerialized().map(item => item.type);
    expect(payloadTypes).toEqual(['year', 'day', 'sequence']);
    expect(payloadTypes.includes('month')).toBeFalse();
  });

  it('should persist static text edit and reordered structure in payload', () => {
    component.referencePolicyForm.patchValue({ referenceMode: 'custom' });

    component.onAddReferenceComponent();
    component.onReferenceComponentTypeChanged(0, 'static_text');
    component.referenceComponentRows[0].get('value')?.setValue('A');
    component.onReferenceComponentValueChanged();

    component.onAddReferenceComponent();
    component.onReferenceComponentTypeChanged(1, 'year');

    component.onAddReferenceComponent();
    component.onReferenceComponentTypeChanged(2, 'month');

    component.onMoveReferenceComponentUp(2);
    expect(getComponentTypes()).toEqual(['static_text', 'month', 'year', 'sequence']);

    component.referenceComponentRows[0].get('value')?.setValue('SAFE3');
    component.onReferenceComponentValueChanged();

    const serialized = getSerialized();
    expect(serialized.map(item => item.type)).toEqual(['static_text', 'month', 'year', 'sequence']);
    expect(serialized[0].value).toBe('SAFE3');
  });

  it('should support delete then add another component without bringing old deleted item back', () => {
    component.referencePolicyForm.patchValue({ referenceMode: 'custom' });

    component.onAddReferenceComponent();
    component.onReferenceComponentTypeChanged(0, 'month');

    component.onAddReferenceComponent();
    component.onReferenceComponentTypeChanged(1, 'day');

    expect(getComponentTypes()).toEqual(['month', 'day', 'sequence']);

    component.onDeleteReferenceComponent(0);
    expect(getComponentTypes()).toEqual(['day', 'sequence']);

    component.onAddReferenceComponent();
    component.onReferenceComponentTypeChanged(1, 'year');

    const payloadTypes = getSerialized().map(item => item.type);
    expect(payloadTypes).toEqual(['day', 'year', 'sequence']);
    expect(payloadTypes.includes('month')).toBeFalse();
  });

  it('should rebuild editor rows from loaded custom policy components including month', () => {
    (component as any).patchReferencePolicyFormFromAdminType({
      referenceMode: 'custom',
      referenceSeparator: '-',
      referenceStartingValue: 1,
      sequencePaddingLength: 5,
      sequenceResetScope: 'none',
      referenceComponents: [
        { type: 'static_text', value: 'SAFE2' },
        { type: 'month' },
        { type: 'year' },
        { type: 'sequence' }
      ]
    });

    const raw = component.referencePolicyForm.getRawValue();
    expect(raw['referenceMode']).toBe('custom');
    expect(raw['referenceSequencePaddingLength']).toBe(5);
    expect(getComponentTypes()).toEqual(['static_text', 'month', 'year', 'sequence']);

    const preview = component.referencePreview;
    expect(preview).toContain('SAFE2');

    const serialized = (component as any).serializeReferenceComponents((component as any).getNormalizedReferenceComponents());
    const serializedTypes = serialized.map((item: { type: string }) => item.type);
    expect(serializedTypes).toEqual(['static_text', 'month', 'year', 'sequence']);
  });

  it('should replace FormArray on reload and not append stale components', () => {
    (component as any).patchReferencePolicyFormFromAdminType({
      referenceMode: 'custom',
      referenceSeparator: '-',
      referenceStartingValue: 1,
      sequencePaddingLength: 5,
      sequenceResetScope: 'none',
      referenceComponents: [
        { type: 'static_text', value: 'OLD' },
        { type: 'month' },
        { type: 'sequence' }
      ]
    });

    expect(getComponentTypes()).toEqual(['static_text', 'month', 'sequence']);

    (component as any).patchReferencePolicyFormFromAdminType({
      referenceMode: 'custom',
      referenceSeparator: '-',
      referenceStartingValue: 1,
      sequencePaddingLength: 7,
      sequenceResetScope: 'monthly',
      referenceComponents: [
        { type: 'static_text', value: 'NEW' },
        { type: 'year' },
        { type: 'day' },
        { type: 'sequence' }
      ]
    });

    expect(getComponentTypes()).toEqual(['static_text', 'year', 'day', 'sequence']);
    const serialized = getSerialized();
    expect(serialized.map(item => item.type)).toEqual(['static_text', 'year', 'day', 'sequence']);
    expect(serialized.some(item => item.type === 'month')).toBeFalse();
    expect(serialized[0].value).toBe('NEW');
    expect(component.referencePolicyForm.getRawValue()['referenceSequencePaddingLength']).toBe(7);
  });
});

describe('FieldLibraryBindingPageComponent - Dynamic Integration Builder', () => {
  let component: FieldLibraryBindingPageComponent;

  const createBinding = (): BoundFieldItem => ({
    bindingId: 'bind-doc-source',
    sourceFieldId: 'field-doc-source',
    fieldKey: 'docSource',
    label: 'مصدر المستند',
    type: 'Dropdown',
    displayOrder: 1,
    visible: true,
    required: false,
    readonly: false,
    defaultValue: '',
    dynamicRuntimeJson: ''
  });

  beforeEach(() => {
    component = new FieldLibraryBindingPageComponent(
      new FormBuilder(),
      {} as any,
      {} as any,
      new FieldLibraryBindingEngine(),
      {} as any,
      {} as any
    );
  });

  it('should build and restore powerbi optionLoader contract through builder flow', () => {
    const binding = createBinding();
    component.bindings = [binding];

    component.onOpenDynamicRuntimeBuilder(binding);
    component.onApplyDynamicRuntimePowerBiOptionLoaderPreset();

    component.dynamicRuntimeBuilderModel.statementId = 65;
    component.dynamicRuntimeBuilderModel.parameters = [
      {
        name: 'direction',
        source: 'static',
        staticValue: 'incoming',
        fieldKey: '',
        claimKey: '',
        fallbackValue: ''
      }
    ];
    component.dynamicRuntimeBuilderModel.responseListPath = 'data';
    component.dynamicRuntimeBuilderModel.responseValuePath = 'id';
    component.dynamicRuntimeBuilderModel.responseLabelPath = 'name';

    component.onSaveDynamicRuntimeBuilder();

    const savedRuntimeJson = component.bindings[0].dynamicRuntimeJson ?? '';
    expect(savedRuntimeJson.length).toBeGreaterThan(0);

    const parsed = JSON.parse(savedRuntimeJson);
    expect(parsed.optionLoader.trigger).toBe('init');
    expect(parsed.optionLoader.integration.sourceType).toBe('powerbi');
    expect(parsed.optionLoader.integration.statementId).toBe(65);
    expect(parsed.optionLoader.integration.parameters).toEqual([
      {
        name: 'direction',
        value: {
          source: 'static',
          staticValue: 'incoming'
        }
      }
    ]);

    component.onOpenDynamicRuntimeBuilder(component.bindings[0]);
    expect(component.dynamicRuntimeBuilderModel.behaviorType).toBe('optionLoader');
    expect(component.dynamicRuntimeBuilderModel.sourceType).toBe('powerbi');
    expect(component.dynamicRuntimeBuilderModel.statementId).toBe(65);
    expect(component.dynamicRuntimeBuilderModel.parameters[0].name).toBe('direction');
    expect(component.dynamicRuntimeBuilderModel.parameters[0].source).toBe('static');
    expect(component.dynamicRuntimeBuilderModel.parameters[0].staticValue).toBe('incoming');
  });

  it('should build and restore external asyncValidation contract through builder flow', () => {
    const binding = createBinding();
    component.bindings = [binding];

    component.onOpenDynamicRuntimeBuilder(binding);
    component.onApplyDynamicRuntimeExternalAsyncValidationPreset();

    component.dynamicRuntimeBuilderModel.fullUrl = 'https://example.test/api/validate';
    component.dynamicRuntimeBuilderModel.method = 'POST';
    component.dynamicRuntimeBuilderModel.query = [];
    component.dynamicRuntimeBuilderModel.body = [
      {
        name: 'value',
        source: 'field',
        staticValue: '',
        fieldKey: 'nationalId',
        claimKey: '',
        fallbackValue: ''
      }
    ];
    component.dynamicRuntimeBuilderModel.responseValidPath = 'result.valid';
    component.dynamicRuntimeBuilderModel.responseMessagePath = 'result.message';
    component.dynamicRuntimeBuilderModel.defaultErrorMessage = 'تعذر التحقق من صحة القيمة.';
    component.dynamicRuntimeBuilderModel.debounceMs = 250;
    component.dynamicRuntimeBuilderModel.minValueLength = 5;

    component.onSaveDynamicRuntimeBuilder();

    const savedRuntimeJson = component.bindings[0].dynamicRuntimeJson ?? '';
    expect(savedRuntimeJson.length).toBeGreaterThan(0);

    const parsed = JSON.parse(savedRuntimeJson);
    expect(parsed.asyncValidation.trigger).toBe('blur');
    expect(parsed.asyncValidation.integration.sourceType).toBe('external');
    expect(parsed.asyncValidation.integration.fullUrl).toBe('https://example.test/api/validate');
    expect(parsed.asyncValidation.integration.method).toBe('POST');
    expect(parsed.asyncValidation.integration.body).toEqual([
      {
        name: 'value',
        value: {
          source: 'field',
          fieldKey: 'nationalId'
        }
      }
    ]);
    expect(parsed.asyncValidation.responseValidPath).toBe('result.valid');
    expect(parsed.asyncValidation.responseMessagePath).toBe('result.message');

    component.onOpenDynamicRuntimeBuilder(component.bindings[0]);
    expect(component.dynamicRuntimeBuilderModel.behaviorType).toBe('asyncValidation');
    expect(component.dynamicRuntimeBuilderModel.trigger).toBe('blur');
    expect(component.dynamicRuntimeBuilderModel.sourceType).toBe('external');
    expect(component.dynamicRuntimeBuilderModel.fullUrl).toBe('https://example.test/api/validate');
    expect(component.dynamicRuntimeBuilderModel.method).toBe('POST');
    expect(component.dynamicRuntimeBuilderModel.body[0].name).toBe('value');
    expect(component.dynamicRuntimeBuilderModel.body[0].source).toBe('field');
    expect(component.dynamicRuntimeBuilderModel.body[0].fieldKey).toBe('nationalId');
  });

  it('hydrates builder from displaySettingsJson when dynamicRuntimeJson is empty', () => {
    const binding: BoundFieldItem = {
      bindingId: 'bind-doc-source',
      sourceFieldId: 'field-doc-source',
      fieldKey: 'DOC_SOURCE',
      label: 'مصدر المستند',
      type: 'Dropdown',
      displayOrder: 1,
      visible: true,
      required: false,
      readonly: false,
      defaultValue: '',
      dynamicRuntimeJson: '',
      displaySettingsJson: JSON.stringify({
        readonly: false,
        isReadonly: false,
        dynamicRuntime: {
          optionLoader: {
            trigger: 'init',
            integration: {
              sourceType: 'powerbi',
              requestFormat: 'json',
              statementId: 65,
              parameters: [
                {
                  name: 'direction',
                  value: { source: 'static', staticValue: 'incoming' }
                }
              ]
            },
            responseListPath: 'data',
            responseValuePath: 'id',
            responseLabelPath: 'name'
          }
        }
      })
    };

    component.onOpenDynamicRuntimeBuilder(binding);

    expect(component.dynamicRuntimeBuilderModel.behaviorType).toBe('optionLoader');
    expect(component.dynamicRuntimeBuilderModel.sourceType).toBe('powerbi');
    expect(component.dynamicRuntimeBuilderModel.statementId).toBe(65);
    expect(component.dynamicRuntimeBuilderModel.parameters[0].name).toBe('direction');
    expect(component.dynamicRuntimeBuilderModel.parameters[0].source).toBe('static');
    expect(component.dynamicRuntimeBuilderModel.parameters[0].staticValue).toBe('incoming');
  });

  it('hydrates builder when dynamicRuntimeJson contains wrapped dynamicRuntime payload', () => {
    const wrappedRuntimeJson = JSON.stringify({
      dynamicRuntime: {
        optionLoader: {
          trigger: 'init',
          integration: {
            sourceType: 'powerbi',
            requestFormat: 'json',
            statementId: 91,
            parameters: [
              {
                name: 'direction',
                value: { source: 'static', staticValue: 'incoming' }
              }
            ]
          },
          responseListPath: 'data',
          responseValuePath: 'id',
          responseLabelPath: 'name'
        }
      }
    });

    const binding: BoundFieldItem = {
      bindingId: 'bind-doc-source',
      sourceFieldId: 'field-doc-source',
      fieldKey: 'DOC_SOURCE',
      label: 'مصدر المستند',
      type: 'Dropdown',
      displayOrder: 1,
      visible: true,
      required: false,
      readonly: false,
      defaultValue: '',
      dynamicRuntimeJson: wrappedRuntimeJson,
      displaySettingsJson: undefined
    };

    component.onOpenDynamicRuntimeBuilder(binding);

    expect(component.dynamicRuntimeBuilderModel.behaviorType).toBe('optionLoader');
    expect(component.dynamicRuntimeBuilderModel.sourceType).toBe('powerbi');
    expect(component.dynamicRuntimeBuilderModel.statementId).toBe(91);
    expect(component.dynamicRuntimeBuilderModel.parameters[0].name).toBe('direction');
    expect(component.dynamicRuntimeBuilderModel.parameters[0].source).toBe('static');
    expect(component.dynamicRuntimeBuilderModel.parameters[0].staticValue).toBe('incoming');
  });

  it('hydrates builder from displaySettingsJson when dynamicRuntime is persisted as JSON string', () => {
    const binding: BoundFieldItem = {
      bindingId: 'bind-doc-source',
      sourceFieldId: 'field-doc-source',
      fieldKey: 'DOC_SOURCE',
      label: 'مصدر المستند',
      type: 'Dropdown',
      displayOrder: 1,
      visible: true,
      required: false,
      readonly: false,
      defaultValue: '',
      dynamicRuntimeJson: '',
      displaySettingsJson: JSON.stringify({
        readonly: false,
        dynamicRuntime: JSON.stringify({
          optionLoader: {
            trigger: 'init',
            integration: {
              sourceType: 'powerbi',
              requestFormat: 'json',
              statementId: 77,
              parameters: [
                {
                  name: 'direction',
                  value: { source: 'static', staticValue: 'incoming' }
                }
              ]
            },
            responseListPath: 'data',
            responseValuePath: 'id',
            responseLabelPath: 'name'
          }
        })
      })
    };

    component.onOpenDynamicRuntimeBuilder(binding);

    expect(component.dynamicRuntimeBuilderModel.behaviorType).toBe('optionLoader');
    expect(component.dynamicRuntimeBuilderModel.sourceType).toBe('powerbi');
    expect(component.dynamicRuntimeBuilderModel.statementId).toBe(77);
    expect(component.dynamicRuntimeBuilderModel.parameters[0].name).toBe('direction');
    expect(component.dynamicRuntimeBuilderModel.parameters[0].source).toBe('static');
    expect(component.dynamicRuntimeBuilderModel.parameters[0].staticValue).toBe('incoming');
  });

  it('keeps builder contract valid when raw runtime json is malformed but display settings has valid runtime', () => {
    const binding: BoundFieldItem = {
      bindingId: 'bind-doc-source',
      sourceFieldId: 'field-doc-source',
      fieldKey: 'DOC_SOURCE',
      label: 'مصدر المستند',
      type: 'Dropdown',
      displayOrder: 1,
      visible: true,
      required: false,
      readonly: false,
      defaultValue: '',
      dynamicRuntimeJson: '{ malformed json',
      displaySettingsJson: JSON.stringify({
        readonly: false,
        dynamicRuntime: {
          optionLoader: {
            trigger: 'init',
            integration: {
              sourceType: 'powerbi',
              requestFormat: 'json',
              statementId: 65
            },
            responseListPath: 'data',
            responseValuePath: 'id',
            responseLabelPath: 'name'
          }
        }
      })
    };

    component.bindings = [binding];
    component.onBindingChanged();

    const normalizedRuntimeJson = component.bindings[0]?.dynamicRuntimeJson ?? '';
    expect(normalizedRuntimeJson).toContain('"optionLoader"');
    expect(normalizedRuntimeJson).not.toContain('malformed');
    expect(component.validation.blockingIssues.some(issue =>
      issue.includes('تهيئة السلوك الديناميكي'))).toBeFalse();
  });

  it('keeps builder state valid when advanced raw draft is invalid and not applicable', () => {
    const binding = createBinding();
    component.bindings = [binding];

    component.onOpenDynamicRuntimeBuilder(binding);
    component.onApplyDynamicRuntimePowerBiOptionLoaderPreset();
    component.dynamicRuntimeBuilderModel.statementId = 65;
    component.dynamicRuntimeBuilderModel.responseListPath = 'data';
    component.dynamicRuntimeBuilderModel.responseValuePath = 'id';
    component.dynamicRuntimeBuilderModel.responseLabelPath = 'name';
    component.onSaveDynamicRuntimeBuilder();

    const firstBinding = component.bindings[0];
    expect(firstBinding.dynamicRuntimeJson).toContain('"optionLoader"');
    expect(component.validation.blockingIssues.some(issue =>
      issue.includes('تهيئة السلوك الديناميكي'))).toBeFalse();

    component.toggleDynamicRuntimeAdvancedMode(firstBinding);
    component.onDynamicRuntimeAdvancedDraftChange(firstBinding, '{ invalid json from advanced mode');
    component.onBindingChanged();

    const normalizedAfterDraft = component.bindings[0];
    expect(normalizedAfterDraft.dynamicRuntimeJson).toContain('"optionLoader"');
    expect(component.validation.blockingIssues.some(issue =>
      issue.includes('تهيئة السلوك الديناميكي'))).toBeFalse();

    component.onApplyDynamicRuntimeAdvancedDraft(normalizedAfterDraft);
    expect(component.bindings[0].dynamicRuntimeJson).toContain('"optionLoader"');
    expect(component.validation.blockingIssues.some(issue =>
      issue.includes('تهيئة السلوك الديناميكي'))).toBeFalse();
    expect(component.stepMessageSeverity).toBe('warn');
  });
});

describe('FieldLibraryBindingPageComponent - DOC_SOURCE Save/Read Round Trip', () => {
  const createResponse = <T>(data: T) => ({
    isSuccess: true,
    errors: [],
    data,
    totalCount: 0,
    pageNumber: 0,
    pageSize: 0,
    totalPages: 0
  } as any);

  afterEach(() => {
    localStorage.removeItem('connect:field-library-binding:APP-UNIT:100');
  });

  it('persists DOC_SOURCE optionLoader through backend payload and restores it after reload', async () => {
    let latestDisplaySettingsJson = JSON.stringify({
      readonly: false,
      isReadonly: false
    });
    let docSourcePayloadDisplaySettingsJson = '';
    let backendStoredDisplaySettingsJson = '';

    const categoryId = 100;
    const appId = 'APP-UNIT';
    const fieldKey = 'DOC_SOURCE';
    const draftStorageKey = `connect:field-library-binding:${appId}:${categoryId}`;

    const dynamicSubjectsController = jasmine.createSpyObj('DynamicSubjectsController', [
      'getAdminFields',
      'getAdminCategoryFieldLinks',
      'getSubjectTypesAdminConfig',
      'updateAdminField',
      'createAdminField',
      'upsertAdminCategoryFieldLinks',
      'upsertSubjectTypeAdminConfig'
    ]);
    const adminCatalogController = jasmine.createSpyObj('DynamicSubjectsAdminCatalogController', [
      'getGroupsByCategory'
    ]);

    dynamicSubjectsController.getAdminFields.and.returnValue(of(createResponse([
      {
        cdmendSql: 501,
        fieldKey,
        fieldType: 'Dropdown',
        fieldLabel: 'مصدر المستند',
        defaultValue: '',
        required: false,
        requiredTrue: false,
        email: false,
        pattern: false,
        isActive: true,
        width: 0,
        height: 0,
        isDisabledInit: false,
        isSearchable: true,
        linkedCategoriesCount: 1,
        applicationId: appId
      }
    ])));

    adminCatalogController.getGroupsByCategory.and.returnValue(of(createResponse([
      {
        groupId: 1,
        categoryId,
        applicationId: appId,
        groupName: 'البيانات الأساسية',
        groupDescription: '',
        parentGroupId: null,
        displayOrder: 1,
        isActive: true,
        children: []
      }
    ])));

    dynamicSubjectsController.getAdminCategoryFieldLinks.and.callFake(() => of(createResponse([
      {
        mendSql: 7001,
        categoryId,
        fieldKey,
        fieldLabel: 'مصدر المستند',
        fieldType: 'Dropdown',
        groupId: 1,
        groupName: 'البيانات الأساسية',
        isActive: true,
        displayOrder: 1,
        isVisible: true,
        displaySettingsJson: latestDisplaySettingsJson,
        applicationId: appId
      }
    ])));

    dynamicSubjectsController.getSubjectTypesAdminConfig.and.returnValue(of(createResponse([
      {
        categoryId,
        parentCategoryId: 0,
        categoryName: 'طلب تجريبي',
        applicationId: appId,
        catMend: '',
        catWorkFlow: 0,
        catSms: false,
        catMailNotification: false,
        isActive: true,
        hasDynamicFields: true,
        canCreate: true,
        displayOrder: 1,
        referencePolicyEnabled: true,
        referenceMode: 'default',
        referenceSeparator: '-',
        referenceStartingValue: 1,
        includeYear: false,
        useSequence: true,
        sequencePaddingLength: 6,
        sequenceResetScope: 'none',
        defaultDisplayMode: 'Standard',
        allowUserToChangeDisplayMode: false
      }
    ])));

    dynamicSubjectsController.updateAdminField.and.returnValue(of(createResponse({
      cdmendSql: 501,
      fieldKey,
      fieldType: 'Dropdown',
      fieldLabel: 'مصدر المستند',
      defaultValue: '',
      required: false,
      requiredTrue: false,
      email: false,
      pattern: false,
      isActive: true,
      width: 0,
      height: 0,
      isDisabledInit: false,
      isSearchable: true,
      linkedCategoriesCount: 1,
      applicationId: appId
    })));

    dynamicSubjectsController.createAdminField.and.returnValue(of(createResponse({
      cdmendSql: 501,
      fieldKey,
      fieldType: 'Dropdown',
      fieldLabel: 'مصدر المستند',
      defaultValue: '',
      required: false,
      requiredTrue: false,
      email: false,
      pattern: false,
      isActive: true,
      width: 0,
      height: 0,
      isDisabledInit: false,
      isSearchable: true,
      linkedCategoriesCount: 1,
      applicationId: appId
    })));

    dynamicSubjectsController.upsertAdminCategoryFieldLinks.and.callFake((_catId: number, request: any) => {
      const docSourcePayload = (request?.links ?? []).find((link: any) => link?.fieldKey === fieldKey);
      docSourcePayloadDisplaySettingsJson = String(docSourcePayload?.displaySettingsJson ?? '');
      latestDisplaySettingsJson = docSourcePayload?.displaySettingsJson ?? latestDisplaySettingsJson;
      backendStoredDisplaySettingsJson = latestDisplaySettingsJson;
      return of(createResponse([
        {
          mendSql: 7001,
          categoryId,
          fieldKey,
          fieldLabel: 'مصدر المستند',
          fieldType: 'Dropdown',
          groupId: 1,
          groupName: 'البيانات الأساسية',
          isActive: true,
          displayOrder: 1,
          isVisible: true,
          displaySettingsJson: latestDisplaySettingsJson,
          applicationId: appId
        }
      ]));
    });

    dynamicSubjectsController.upsertSubjectTypeAdminConfig.and.returnValue(of(createResponse({
      categoryId,
      parentCategoryId: 0,
      categoryName: 'طلب تجريبي',
      applicationId: appId,
      catMend: '',
      catWorkFlow: 0,
      catSms: false,
      catMailNotification: false,
      isActive: true,
      hasDynamicFields: true,
      canCreate: true,
      displayOrder: 1,
      referencePolicyEnabled: true,
      referenceMode: 'default',
      referenceSeparator: '-',
      referenceStartingValue: 1,
      includeYear: false,
      useSequence: true,
      sequencePaddingLength: 6,
      sequenceResetScope: 'none',
      defaultDisplayMode: 'Standard',
      allowUserToChangeDisplayMode: false
    })));

    const component = new FieldLibraryBindingPageComponent(
      new FormBuilder(),
      { paramMap: of({} as any), queryParamMap: of({} as any), snapshot: { queryParamMap: {} } } as any,
      { navigate: () => Promise.resolve(true) } as any,
      new FieldLibraryBindingEngine(),
      dynamicSubjectsController,
      adminCatalogController
    );

    (component as any).setReferenceComponents([
      {
        id: 'sequence-1',
        type: 'sequence'
      }
    ], false);
    (component as any).currentCategoryId = categoryId;
    (component as any).currentApplicationId = appId;
    localStorage.setItem(draftStorageKey, JSON.stringify({
      bindingPayload: 'stale-draft'
    }));

    await (component as any).loadBackendWorkspace(categoryId, appId);

    const targetBinding = component.bindings.find(item => item.fieldKey === fieldKey);
    expect(targetBinding).toBeTruthy();
    if (!targetBinding) {
      return;
    }

    component.onOpenDynamicRuntimeBuilder(targetBinding);
    component.onApplyDynamicRuntimePowerBiOptionLoaderPreset();
    expect(component.isDynamicRuntimeBuilderReadyToApply).toBeFalse();
    expect(component.dynamicRuntimeBuilderInlineValidationIssues.some(issue =>
      issue.includes('معرّف العبارة'))).toBeTrue();
    component.onSaveDynamicRuntimeBuilder();
    expect(component.bindings[0].dynamicRuntimeJson).toBe('');
    expect(component.dynamicRuntimeBuilderVisible).toBeTrue();

    component.dynamicRuntimeBuilderModel.statementId = 65;
    component.dynamicRuntimeBuilderModel.parameters = [
      {
        name: 'direction',
        source: 'static',
        staticValue: 'incoming',
        fieldKey: '',
        claimKey: '',
        fallbackValue: ''
      }
    ];
    component.dynamicRuntimeBuilderModel.responseListPath = 'data';
    component.dynamicRuntimeBuilderModel.responseValuePath = 'id';
    component.dynamicRuntimeBuilderModel.responseLabelPath = 'name';
    component.onSaveDynamicRuntimeBuilder();
    expect(component.dynamicRuntimeBuilderVisible).toBeFalse();
    expect(component.bindings[0].dynamicRuntimeJson).toContain('"optionLoader"');
    expect(component.bindings[0].dynamicRuntimeJson).toContain('"statementId": 65');
    expect(String(component.bindings[0].displaySettingsJson ?? '')).toContain('"dynamicRuntime"');
    expect(String(component.bindings[0].displaySettingsJson ?? '')).toContain('"statementId":65');

    // Simulate invalid advanced JSON draft without applying it.
    component.toggleDynamicRuntimeAdvancedMode(component.bindings[0]);
    component.onDynamicRuntimeAdvancedDraftChange(component.bindings[0], '{ invalid json from raw textarea');
    component.onBindingChanged();
    expect(component.validation.isValid).toBeTrue();

    // Trace point #1: row model right before Save All.
    const rowBeforeSave = {
      dynamicRuntimeJson: '',
      displaySettingsJson: String(component.bindings[0].displaySettingsJson ?? '')
    };
    // Simulate a transient drift where raw runtime mirror is empty while displaySettings still holds dynamicRuntime.
    component.bindings[0] = {
      ...component.bindings[0],
      dynamicRuntimeJson: ''
    };
    rowBeforeSave.dynamicRuntimeJson = String(component.bindings[0].dynamicRuntimeJson ?? '');

    await component.onSaveToBackend();

    expect(dynamicSubjectsController.upsertAdminCategoryFieldLinks).toHaveBeenCalledTimes(1);
    const upsertRequest = dynamicSubjectsController.upsertAdminCategoryFieldLinks.calls.mostRecent().args[1];
    const sentDisplaySettings = String(upsertRequest?.links?.[0]?.displaySettingsJson ?? '');
    expect(sentDisplaySettings).toContain('"dynamicRuntime"');
    expect(sentDisplaySettings).toContain('"optionLoader"');
    expect(sentDisplaySettings).toContain('"statementId":65');
    expect(sentDisplaySettings).toContain('"sourceType":"powerbi"');
    // Trace point #2: backend payload + stored backend value.
    expect(docSourcePayloadDisplaySettingsJson).toContain('"dynamicRuntime"');
    expect(docSourcePayloadDisplaySettingsJson).toContain('"statementId":65');
    expect(backendStoredDisplaySettingsJson).toContain('"dynamicRuntime"');
    expect(backendStoredDisplaySettingsJson).toContain('"statementId":65');
    // Ensure we did not lose runtime even when row.dynamicRuntimeJson was transiently empty.
    expect(rowBeforeSave.dynamicRuntimeJson).toBe('');
    expect(rowBeforeSave.displaySettingsJson).toContain('"dynamicRuntime"');

    const reloadedBinding = component.bindings.find(item => item.fieldKey === fieldKey);
    expect(reloadedBinding).toBeTruthy();
    if (!reloadedBinding) {
      return;
    }

    component.onOpenDynamicRuntimeBuilder(reloadedBinding);
    expect(component.dynamicRuntimeBuilderModel.behaviorType).toBe('optionLoader');
    expect(component.dynamicRuntimeBuilderModel.sourceType).toBe('powerbi');
    expect(component.dynamicRuntimeBuilderModel.statementId).toBe(65);
    expect(component.dynamicRuntimeBuilderModel.parameters[0].name).toBe('direction');
    expect(component.dynamicRuntimeBuilderModel.parameters[0].source).toBe('static');
    expect(component.dynamicRuntimeBuilderModel.parameters[0].staticValue).toBe('incoming');
    // Trace point #3: hydrated row after backend reload.
    expect(String(reloadedBinding.displaySettingsJson ?? '')).toContain('"dynamicRuntime"');
    expect(String(reloadedBinding.dynamicRuntimeJson ?? '')).toContain('"optionLoader"');
    expect(String(reloadedBinding.dynamicRuntimeJson ?? '')).toContain('"statementId": 65');
    expect(localStorage.getItem(draftStorageKey)).toBeNull();
  });
});
