import { FormBuilder } from '@angular/forms';
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
});
