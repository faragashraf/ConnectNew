import { Injectable } from '@angular/core';
import { ParamMap } from '@angular/router';
import {
  SubjectFieldDefinitionDto,
  SubjectFieldValueDto,
  SubjectFormDefinitionDto,
  SubjectGroupDefinitionDto
} from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.dto';

const ADMIN_CONTROL_CENTER_DRAFT_STORAGE_KEY = 'enpo.admin-control-center.draft.v1';

interface BridgeBoundField {
  fieldKey: string;
  label: string;
  type: 'InputText' | 'Textarea' | 'Dropdown' | 'Number' | 'Date' | 'Checkbox';
  displayOrder: number;
  visible: boolean;
  required: boolean;
  readonly: boolean;
  defaultValue: string;
}

interface BridgeContainer {
  id: string;
  title: string;
  displayOrder: number;
  visible: boolean;
  fieldKeys: string[];
}

interface BridgeConditionalRule {
  leftFieldKey: string;
  operator: 'eq' | 'neq' | 'contains' | 'gt' | 'lt';
  rightValue: string;
  effect: 'required' | 'readonly' | 'hidden' | 'block-submit';
}

interface BridgeBlockingRule {
  name: string;
  conditionExpression: string;
  message: string;
}

export interface AdminControlCenterRuntimeBridgeContext {
  readonly source: 'admin-control-center';
  readonly categoryId: number;
  readonly documentDirection: 'incoming' | 'outgoing' | null;
  readonly submitBehavior: 'block' | 'confirm' | null;
  readonly routeKeyPrefix: string | null;
  readonly createConfigRouteKey: string | null;
  readonly fields: ReadonlyArray<BridgeBoundField>;
  readonly containers: ReadonlyArray<BridgeContainer>;
  readonly requiredFieldKeys: ReadonlyArray<string>;
  readonly conditionalRules: ReadonlyArray<BridgeConditionalRule>;
  readonly blockingRules: ReadonlyArray<BridgeBlockingRule>;
  readonly issues: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;
}

export interface RuntimeBridgeSubmissionEvaluation {
  readonly blockingIssues: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;
}

@Injectable({ providedIn: 'root' })
export class AdminControlCenterRuntimeBridgeService {
  resolveFromQueryParams(params: ParamMap): AdminControlCenterRuntimeBridgeContext | null {
    const source = String(params.get('source') ?? '').trim().toLowerCase();
    if (source !== 'admin-control-center') {
      return null;
    }

    const draftState = this.loadDraftState();
    if (!draftState) {
      return {
        source: 'admin-control-center',
        categoryId: this.normalizePositiveInt(params.get('categoryId')) ?? 0,
        documentDirection: this.normalizeDirection(params.get('documentDirection')),
        submitBehavior: null,
        routeKeyPrefix: null,
        createConfigRouteKey: null,
        fields: [],
        containers: [],
        requiredFieldKeys: [],
        conditionalRules: [],
        blockingRules: [],
        issues: ['تعذر تحميل مسودة Admin Control Center من التخزين المحلي.'],
        warnings: []
      };
    }

    const stepsRaw = Array.isArray(draftState['steps'])
      ? (draftState['steps'] as ReadonlyArray<unknown>)
      : [];
    const stepMap = new Map<string, Record<string, unknown>>(
      stepsRaw
        .map(item => {
          const asRecord = this.normalizeObject(item);
          const key = String(asRecord['key'] ?? '').trim();
          const values = this.normalizeObject(asRecord['values']);
          return [key, values] as const;
        })
        .filter(([key]) => key.length > 0)
    );

    const context = this.normalizeObject(draftState['context']);
    const queryCategoryId = this.normalizePositiveInt(params.get('categoryId'));
    const scopeCategoryId = this.normalizePositiveInt(context['categoryId']) ?? queryCategoryId ?? 0;

    const bindingStep = stepMap.get('field-library-binding') ?? {};
    const compositionStep = stepMap.get('form-composition') ?? {};
    const validationStep = stepMap.get('validation-rules') ?? {};
    const workflowStep = stepMap.get('workflow-routing') ?? {};

    const fields = this.parseBindings(bindingStep['bindingPayload']);
    const containers = this.parseContainers(compositionStep['compositionLayoutPayload']);
    const conditionalBundle = this.parseConditionalBundle(validationStep['conditionalRulesPayload']);
    const blockingRules = this.parseBlockingRules(validationStep['submissionBlockingPayload']);

    const requiredFieldKeys = conditionalBundle.requiredRules
      .filter(item => item.isRequired)
      .map(item => item.fieldKey);

    const issues: string[] = [];
    const warnings: string[] = [];

    if (scopeCategoryId <= 0) {
      issues.push('Category Id غير متوفر داخل النطاق التجريبي.');
    }

    if (!String(workflowStep['createConfigRouteKey'] ?? '').trim()) {
      issues.push('Create Config Route Key غير متوفر داخل إعدادات Workflow للنطاق التجريبي.');
    }

    if (fields.length === 0) {
      issues.push('Field bindings الخاصة بالنطاق التجريبي غير متوفرة.');
    }

    if (containers.filter(item => item.visible).length === 0) {
      warnings.push('Form composition لا يحتوي مجموعات مرئية؛ سيتم استخدام fallback groups من تعريف النموذج الحالي.');
    }

    const queryScopeCategoryId = this.normalizePositiveInt(params.get('scopeCategoryId'));
    if (queryScopeCategoryId && scopeCategoryId > 0 && queryScopeCategoryId !== scopeCategoryId) {
      warnings.push('Category Id في الرابط لا يطابق category الخاصة بالمسودة. سيتم اعتماد category المسودة.');
    }

    return {
      source: 'admin-control-center',
      categoryId: scopeCategoryId,
      documentDirection: this.normalizeDirection(params.get('documentDirection'))
        ?? this.normalizeDirection(context['documentDirection']),
      submitBehavior: this.normalizeSubmitBehavior(validationStep['submitBehavior']),
      routeKeyPrefix: this.normalizeNullable(context['routeKeyPrefix']),
      createConfigRouteKey: this.normalizeNullable(workflowStep['createConfigRouteKey']),
      fields,
      containers,
      requiredFieldKeys: this.uniqueNormalizedKeys(requiredFieldKeys),
      conditionalRules: conditionalBundle.conditionalRules,
      blockingRules,
      issues,
      warnings
    };
  }

  applyDefinitionOverrides(
    definition: SubjectFormDefinitionDto,
    bridge: AdminControlCenterRuntimeBridgeContext | null
  ): SubjectFormDefinitionDto {
    if (!bridge || bridge.issues.length > 0) {
      return definition;
    }

    if (Number(definition.categoryId ?? 0) !== Number(bridge.categoryId ?? 0)) {
      return definition;
    }

    const bindingMap = new Map<string, BridgeBoundField>(
      bridge.fields.map(item => [this.normalizeFieldKey(item.fieldKey), item] as const)
    );
    if (bindingMap.size === 0) {
      return definition;
    }

    const containerOrder = [...bridge.containers]
      .sort((left, right) => left.displayOrder - right.displayOrder)
      .filter(item => item.visible);

    const displayOrderByField = new Map<string, number>();
    const containerByField = new Map<string, BridgeContainer>();
    let runningOrder = 1;
    for (const container of containerOrder) {
      for (const fieldKeyRaw of container.fieldKeys) {
        const fieldKey = this.normalizeFieldKey(fieldKeyRaw);
        if (!fieldKey || displayOrderByField.has(fieldKey)) {
          continue;
        }

        displayOrderByField.set(fieldKey, runningOrder++);
        containerByField.set(fieldKey, container);
      }
    }

    const sortedBindings = [...bridge.fields].sort((left, right) => left.displayOrder - right.displayOrder);
    for (const binding of sortedBindings) {
      const fieldKey = this.normalizeFieldKey(binding.fieldKey);
      if (!fieldKey || displayOrderByField.has(fieldKey)) {
        continue;
      }

      displayOrderByField.set(fieldKey, runningOrder++);
    }

    const groups: SubjectGroupDefinitionDto[] = [];
    const groupByContainerId = new Map<string, SubjectGroupDefinitionDto>();
    let nextGroupId = 2000;

    for (const container of containerOrder) {
      const group: SubjectGroupDefinitionDto = {
        groupId: nextGroupId++,
        groupName: container.title || `مجموعة ${container.id}`,
        groupDescription: '',
        isExtendable: false,
        groupWithInRow: 12
      };
      groups.push(group);
      groupByContainerId.set(container.id, group);
    }

    let fallbackGroup: SubjectGroupDefinitionDto | null = null;
    const ensureFallbackGroup = (): SubjectGroupDefinitionDto => {
      if (fallbackGroup) {
        return fallbackGroup;
      }

      fallbackGroup = {
        groupId: nextGroupId++,
        groupName: 'حقول إضافية',
        groupDescription: 'حقول غير موزعة في Form Composition وتم إظهارها بنهاية النموذج.',
        isExtendable: false,
        groupWithInRow: 12
      };
      groups.push(fallbackGroup);
      return fallbackGroup;
    };

    const requiredSet = new Set<string>(bridge.requiredFieldKeys.map(item => this.normalizeFieldKey(item)));
    const processed = new Set<string>();
    const maxMendSql = Math.max(0, ...definition.fields.map(item => Number(item.mendSql ?? 0)));
    let syntheticMendSql = maxMendSql + 1;

    const overriddenFields: SubjectFieldDefinitionDto[] = [];
    for (const sourceField of definition.fields) {
      const fieldKey = this.normalizeFieldKey(sourceField.fieldKey);
      const binding = bindingMap.get(fieldKey);
      if (!binding) {
        overriddenFields.push({
          ...sourceField,
          isVisible: false,
          required: false,
          requiredTrue: false
        });
        continue;
      }

      processed.add(fieldKey);
      const group = this.resolveGroupForField(fieldKey, containerByField, groupByContainerId, ensureFallbackGroup);
      const required = requiredSet.has(fieldKey) || binding.required;

      overriddenFields.push({
        ...sourceField,
        fieldLabel: binding.label,
        fieldType: this.mapBindingTypeToFieldType(binding.type, sourceField.fieldType),
        defaultValue: binding.defaultValue,
        required,
        requiredTrue: required,
        isDisabledInit: binding.readonly,
        isVisible: binding.visible,
        displayOrder: displayOrderByField.get(fieldKey) ?? binding.displayOrder ?? sourceField.displayOrder,
        mendGroup: group.groupId,
        group: { ...group }
      });
    }

    for (const binding of sortedBindings) {
      const fieldKey = this.normalizeFieldKey(binding.fieldKey);
      if (!fieldKey || processed.has(fieldKey)) {
        continue;
      }

      const group = this.resolveGroupForField(fieldKey, containerByField, groupByContainerId, ensureFallbackGroup);
      const required = requiredSet.has(fieldKey) || binding.required;
      const syntheticType = this.mapBindingTypeToFieldType(binding.type, binding.type);

      overriddenFields.push({
        mendSql: syntheticMendSql++,
        categoryId: definition.categoryId,
        mendGroup: group.groupId,
        fieldKey: binding.fieldKey,
        fieldType: syntheticType,
        fieldLabel: binding.label,
        placeholder: '',
        defaultValue: binding.defaultValue,
        optionsPayload: this.buildSyntheticOptionsPayload(binding),
        dataType: this.mapBindingTypeToDataType(binding.type),
        required,
        requiredTrue: required,
        email: false,
        pattern: false,
        minValue: '',
        maxValue: '',
        mask: '',
        isDisabledInit: binding.readonly,
        isSearchable: false,
        width: 0,
        height: 0,
        applicationId: definition.applicationId,
        displayOrder: displayOrderByField.get(fieldKey) ?? binding.displayOrder,
        isVisible: binding.visible,
        displaySettingsJson: undefined,
        group: { ...group }
      });
    }

    const usedGroupIds = new Set<number>();
    overriddenFields
      .filter(item => item.isVisible !== false)
      .forEach(item => usedGroupIds.add(Number(item.mendGroup ?? 0)));

    const normalizedGroups = groups
      .filter(group => usedGroupIds.has(group.groupId))
      .sort((left, right) => left.groupId - right.groupId);

    return {
      ...definition,
      groups: normalizedGroups.length > 0 ? normalizedGroups : definition.groups,
      fields: overriddenFields
        .sort((left, right) =>
          Number(left.displayOrder ?? 0) - Number(right.displayOrder ?? 0)
          || String(left.fieldKey ?? '').localeCompare(String(right.fieldKey ?? ''))
        )
    };
  }

  evaluateSubmission(
    bridge: AdminControlCenterRuntimeBridgeContext | null,
    dynamicFields: ReadonlyArray<SubjectFieldValueDto>
  ): RuntimeBridgeSubmissionEvaluation {
    if (!bridge || bridge.issues.length > 0) {
      return { blockingIssues: [], warnings: [] };
    }

    const valueByField = new Map<string, string>(
      (dynamicFields ?? []).map(item => [
        this.normalizeFieldKey(item.fieldKey),
        String(item.value ?? '').trim()
      ] as const)
    );

    const labelByField = new Map<string, string>(
      bridge.fields.map(item => [this.normalizeFieldKey(item.fieldKey), item.label] as const)
    );

    const blockingIssues: string[] = [];
    const warnings: string[] = [];

    for (const requiredFieldKeyRaw of bridge.requiredFieldKeys) {
      const requiredFieldKey = this.normalizeFieldKey(requiredFieldKeyRaw);
      if (!requiredFieldKey) {
        continue;
      }

      const value = valueByField.get(requiredFieldKey) ?? '';
      if (!this.hasValue(value)) {
        blockingIssues.push(`الحقل الإلزامي "${labelByField.get(requiredFieldKey) ?? requiredFieldKey}" مطلوب قبل الإرسال.`);
      }
    }

    for (const rule of bridge.blockingRules) {
      if (!this.evaluateBlockingExpression(rule.conditionExpression, valueByField)) {
        continue;
      }

      blockingIssues.push(rule.message || `قاعدة منع الإرسال "${rule.name}" تحققت.`);
    }

    for (const rule of bridge.conditionalRules) {
      if (rule.effect !== 'block-submit') {
        continue;
      }

      const leftValue = valueByField.get(this.normalizeFieldKey(rule.leftFieldKey)) ?? '';
      if (this.evaluateConditionalRule(leftValue, rule.operator, rule.rightValue)) {
        blockingIssues.push(`قاعدة شرطية مانعة تحققت على الحقل "${rule.leftFieldKey}".`);
      }
    }

    if (bridge.submitBehavior === 'confirm' && blockingIssues.length > 0) {
      warnings.push('إعداد Validation يسمح بـ Confirm قبل الإرسال، لكن التطبيق الحالي يعامل المشكلات الحرجة كمنع كامل.');
    }

    return {
      blockingIssues,
      warnings
    };
  }

  private resolveGroupForField(
    fieldKey: string,
    containerByField: Map<string, BridgeContainer>,
    groupByContainerId: Map<string, SubjectGroupDefinitionDto>,
    ensureFallbackGroup: () => SubjectGroupDefinitionDto
  ): SubjectGroupDefinitionDto {
    const container = containerByField.get(fieldKey);
    if (container) {
      const group = groupByContainerId.get(container.id);
      if (group) {
        return group;
      }
    }

    return ensureFallbackGroup();
  }

  private mapBindingTypeToFieldType(bindingType: BridgeBoundField['type'], fallback: string): string {
    switch (bindingType) {
      case 'Checkbox':
        return 'ToggleSwitch';
      case 'Number':
        return 'Number';
      default:
        return bindingType || fallback;
    }
  }

  private mapBindingTypeToDataType(bindingType: BridgeBoundField['type']): string {
    switch (bindingType) {
      case 'Checkbox':
        return 'boolean';
      case 'Number':
        return 'number';
      case 'Date':
        return 'date';
      default:
        return 'string';
    }
  }

  private buildSyntheticOptionsPayload(binding: BridgeBoundField): string {
    if (binding.type !== 'Dropdown') {
      return '';
    }

    const defaultValue = String(binding.defaultValue ?? '').trim();
    if (!defaultValue) {
      return '';
    }

    return JSON.stringify([{ key: defaultValue, name: defaultValue }]);
  }

  private parseBindings(raw: unknown): BridgeBoundField[] {
    const parsed = this.parseJson(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(item => this.normalizeBinding(item))
      .filter((item): item is BridgeBoundField => item != null)
      .sort((left, right) => left.displayOrder - right.displayOrder);
  }

  private normalizeBinding(raw: unknown): BridgeBoundField | null {
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const item = raw as Record<string, unknown>;
    const fieldKey = String(item['fieldKey'] ?? '').trim();
    const label = String(item['label'] ?? '').trim();
    const type = String(item['type'] ?? '').trim();
    const displayOrder = Number(item['displayOrder'] ?? 0);
    if (!fieldKey || !label || !this.isBindingType(type) || !Number.isFinite(displayOrder)) {
      return null;
    }

    return {
      fieldKey,
      label,
      type,
      displayOrder: Math.max(1, Math.trunc(displayOrder)),
      visible: item['visible'] !== false,
      required: item['required'] === true,
      readonly: item['readonly'] === true,
      defaultValue: String(item['defaultValue'] ?? '').trim()
    };
  }

  private parseContainers(raw: unknown): BridgeContainer[] {
    const parsed = this.parseJson(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(item => this.normalizeContainer(item))
      .filter((item): item is BridgeContainer => item != null)
      .sort((left, right) => left.displayOrder - right.displayOrder);
  }

  private normalizeContainer(raw: unknown): BridgeContainer | null {
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const item = raw as Record<string, unknown>;
    const id = String(item['id'] ?? '').trim();
    const title = String(item['title'] ?? '').trim();
    const displayOrder = Number(item['displayOrder'] ?? 0);
    const fieldKeys = Array.isArray(item['fieldKeys'])
      ? item['fieldKeys'].map(value => String(value ?? '').trim()).filter(Boolean)
      : [];

    if (!id || !Number.isFinite(displayOrder)) {
      return null;
    }

    return {
      id,
      title,
      displayOrder: Math.max(1, Math.trunc(displayOrder)),
      visible: item['visible'] !== false,
      fieldKeys
    };
  }

  private parseConditionalBundle(raw: unknown): {
    requiredRules: Array<{ fieldKey: string; isRequired: boolean }>;
    conditionalRules: BridgeConditionalRule[];
  } {
    const parsed = this.parseJson(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { requiredRules: [], conditionalRules: [] };
    }

    const item = parsed as Record<string, unknown>;
    const requiredRules = Array.isArray(item['requiredRules'])
      ? item['requiredRules']
        .map(rule => this.normalizeRequiredRule(rule))
        .filter((rule): rule is { fieldKey: string; isRequired: boolean } => rule != null)
      : [];

    const conditionalRules = Array.isArray(item['conditionalRules'])
      ? item['conditionalRules']
        .map(rule => this.normalizeConditionalRule(rule))
        .filter((rule): rule is BridgeConditionalRule => rule != null)
      : [];

    return {
      requiredRules,
      conditionalRules
    };
  }

  private normalizeRequiredRule(raw: unknown): { fieldKey: string; isRequired: boolean } | null {
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const item = raw as Record<string, unknown>;
    const fieldKey = String(item['fieldKey'] ?? '').trim();
    if (!fieldKey) {
      return null;
    }

    return {
      fieldKey,
      isRequired: item['isRequired'] === true
    };
  }

  private normalizeConditionalRule(raw: unknown): BridgeConditionalRule | null {
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const item = raw as Record<string, unknown>;
    const leftFieldKey = String(item['leftFieldKey'] ?? '').trim();
    const operator = String(item['operator'] ?? '').trim();
    const rightValue = String(item['rightValue'] ?? '').trim();
    const effect = String(item['effect'] ?? '').trim();

    if (!leftFieldKey || !this.isConditionalOperator(operator) || !this.isConditionalEffect(effect)) {
      return null;
    }

    return {
      leftFieldKey,
      operator,
      rightValue,
      effect
    };
  }

  private parseBlockingRules(raw: unknown): BridgeBlockingRule[] {
    const parsed = this.parseJson(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(item => this.normalizeBlockingRule(item))
      .filter((item): item is BridgeBlockingRule => item != null);
  }

  private normalizeBlockingRule(raw: unknown): BridgeBlockingRule | null {
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const item = raw as Record<string, unknown>;
    const name = String(item['name'] ?? '').trim();
    const conditionExpression = String(item['conditionExpression'] ?? '').trim();
    const message = String(item['message'] ?? '').trim();

    if (!name || !conditionExpression) {
      return null;
    }

    return {
      name,
      conditionExpression,
      message
    };
  }

  private evaluateBlockingExpression(expression: string, valueByField: Map<string, string>): boolean {
    const normalized = String(expression ?? '').trim();
    if (!normalized) {
      return false;
    }

    const emptyMatch = normalized.match(/^isEmpty\(([^)]+)\)$/i);
    if (emptyMatch) {
      const fieldKey = this.normalizeFieldKey(emptyMatch[1]);
      const value = valueByField.get(fieldKey) ?? '';
      return !this.hasValue(value);
    }

    const notEmptyMatch = normalized.match(/^isNotEmpty\(([^)]+)\)$/i);
    if (notEmptyMatch) {
      const fieldKey = this.normalizeFieldKey(notEmptyMatch[1]);
      const value = valueByField.get(fieldKey) ?? '';
      return this.hasValue(value);
    }

    const eqMatch = normalized.match(/^eq\(([^,]+),(.+)\)$/i);
    if (eqMatch) {
      const fieldKey = this.normalizeFieldKey(eqMatch[1]);
      const target = String(eqMatch[2] ?? '').trim();
      const value = valueByField.get(fieldKey) ?? '';
      return value === target;
    }

    const neqMatch = normalized.match(/^neq\(([^,]+),(.+)\)$/i);
    if (neqMatch) {
      const fieldKey = this.normalizeFieldKey(neqMatch[1]);
      const target = String(neqMatch[2] ?? '').trim();
      const value = valueByField.get(fieldKey) ?? '';
      return value !== target;
    }

    return false;
  }

  private evaluateConditionalRule(
    leftValue: string,
    operator: BridgeConditionalRule['operator'],
    rightValue: string
  ): boolean {
    const left = String(leftValue ?? '').trim();
    const right = String(rightValue ?? '').trim();

    if (operator === 'eq') {
      return left === right;
    }
    if (operator === 'neq') {
      return left !== right;
    }
    if (operator === 'contains') {
      return left.includes(right);
    }

    const leftNumber = Number(left);
    const rightNumber = Number(right);
    if (!Number.isFinite(leftNumber) || !Number.isFinite(rightNumber)) {
      return false;
    }

    if (operator === 'gt') {
      return leftNumber > rightNumber;
    }
    if (operator === 'lt') {
      return leftNumber < rightNumber;
    }

    return false;
  }

  private uniqueNormalizedKeys(keys: ReadonlyArray<string>): string[] {
    const dedup = new Set<string>();
    for (const key of keys) {
      const normalized = this.normalizeFieldKey(key);
      if (normalized) {
        dedup.add(normalized);
      }
    }

    return Array.from(dedup);
  }

  private loadDraftState(): Record<string, unknown> | null {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }

    const raw = window.localStorage.getItem(ADMIN_CONTROL_CENTER_DRAFT_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = this.parseJson(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const envelope = parsed as Record<string, unknown>;
    const state = this.normalizeObject(envelope['state']);
    return Object.keys(state).length > 0 ? state : null;
  }

  private parseJson(raw: unknown): unknown {
    if (raw && typeof raw === 'object') {
      return raw;
    }

    const value = typeof raw === 'string' ? raw.trim() : String(raw ?? '').trim();
    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  private normalizeObject(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }

  private normalizeFieldKey(value: unknown): string {
    return String(value ?? '').trim().toLowerCase();
  }

  private normalizeNullable(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : null;
  }

  private normalizePositiveInt(value: unknown): number | null {
    const numeric = Number(value ?? 0);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return null;
    }

    return Math.trunc(numeric);
  }

  private normalizeDirection(value: unknown): 'incoming' | 'outgoing' | null {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (normalized === 'incoming' || normalized === 'outgoing') {
      return normalized;
    }

    return null;
  }

  private normalizeSubmitBehavior(value: unknown): 'block' | 'confirm' | null {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (normalized === 'block' || normalized === 'confirm') {
      return normalized;
    }

    return null;
  }

  private hasValue(value: unknown): boolean {
    if (value == null) {
      return false;
    }

    if (typeof value === 'string') {
      return value.trim().length > 0;
    }

    if (Array.isArray(value)) {
      return value.length > 0;
    }

    if (typeof value === 'boolean') {
      return true;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value);
    }

    return true;
  }

  private isBindingType(value: string): value is BridgeBoundField['type'] {
    return value === 'InputText'
      || value === 'Textarea'
      || value === 'Dropdown'
      || value === 'Number'
      || value === 'Date'
      || value === 'Checkbox';
  }

  private isConditionalOperator(value: string): value is BridgeConditionalRule['operator'] {
    return value === 'eq'
      || value === 'neq'
      || value === 'contains'
      || value === 'gt'
      || value === 'lt';
  }

  private isConditionalEffect(value: string): value is BridgeConditionalRule['effect'] {
    return value === 'required'
      || value === 'readonly'
      || value === 'hidden'
      || value === 'block-submit';
  }
}
