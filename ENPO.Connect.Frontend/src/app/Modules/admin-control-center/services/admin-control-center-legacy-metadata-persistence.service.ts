import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { RequestPolicyResolverService } from 'src/app/Modules/admins/services/request-policy-resolver.service';
import {
  CommonResponse,
  RequestPolicyConditionDto,
  RequestPolicyDefinitionDto,
  RequestPolicyFieldPatchDto,
  RequestPolicyPresentationRuleDto,
  SubjectAdminFieldDto,
  SubjectAdminFieldUpsertRequestDto,
  SubjectAdminGroupDto,
  SubjectCategoryFieldLinkAdminDto,
  SubjectCategoryFieldLinkUpsertItemDto,
  SubjectTypeAdminDto,
  SubjectTypeAdminUpdateRequestDto,
  SubjectTypeAdminUpsertRequestDto
} from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.dto';
import { DynamicSubjectsController } from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.service';
import { FieldLibraryBindingEngine } from '../domain/field-library-binding/field-library-binding.engine';
import { BoundFieldItem } from '../domain/models/field-library-binding.models';
import { FormCompositionContainer } from '../domain/models/form-composition.models';
import { ValidationRulesEngine } from '../domain/validation-rules/validation-rules.engine';
import { FormCompositionEngine } from '../domain/form-composition/form-composition.engine';
import { ControlCenterState, ControlCenterStepKey } from '../domain/models/admin-control-center.models';
import { DynamicSubjectCategoryCatalogService } from 'src/app/Modules/dynamic-subjects/services/dynamic-subject-category-catalog.service';

interface ResolvedBinding {
  readonly binding: BoundFieldItem;
  readonly normalizedFieldKey: string;
  readonly groupName: string;
  readonly displayOrder: number;
  readonly isVisible: boolean;
  readonly isRequired: boolean;
  readonly container: FormCompositionContainer | null;
}

interface PublishContext {
  readonly applicationId: string | null;
  readonly categoryId: number;
  readonly scopeValues: Record<string, unknown>;
  readonly structureValues: Record<string, unknown>;
  readonly bindingValues: Record<string, unknown>;
  readonly compositionValues: Record<string, unknown>;
  readonly workflowValues: Record<string, unknown>;
  readonly accessValues: Record<string, unknown>;
  readonly validationValues: Record<string, unknown>;
}

export interface AdminControlCenterLegacyPublishResult {
  readonly success: boolean;
  readonly message: string;
  readonly warnings: ReadonlyArray<string>;
  readonly categoryId: number | null;
  readonly applicationId: string | null;
  readonly parentCategoryId: number | null;
  readonly persistedFieldsCount: number;
  readonly persistedGroupsCount: number;
  readonly persistedLinksCount: number;
}

@Injectable()
export class AdminControlCenterLegacyMetadataPersistenceService {
  constructor(
    private readonly dynamicSubjectsController: DynamicSubjectsController,
    private readonly bindingEngine: FieldLibraryBindingEngine,
    private readonly compositionEngine: FormCompositionEngine,
    private readonly validationRulesEngine: ValidationRulesEngine,
    private readonly requestPolicyResolver: RequestPolicyResolverService,
    private readonly categoryCatalogService: DynamicSubjectCategoryCatalogService
  ) {}

  async publish(state: ControlCenterState): Promise<AdminControlCenterLegacyPublishResult> {
    const warnings: string[] = [];

    try {
      const context = this.resolvePublishContext(state);
      if (context == null) {
        return {
          success: false,
          message: 'تعذر النشر: يجب تحديد Application Id و Category Id صالحين داخل Scope Definition.',
          warnings,
          categoryId: null,
          applicationId: null,
          parentCategoryId: null,
          persistedFieldsCount: 0,
          persistedGroupsCount: 0,
          persistedLinksCount: 0
        };
      }

      const applicationId = context.applicationId;
      const categoryId = context.categoryId;

      const subjectTypesResponse = await firstValueFrom(
        this.dynamicSubjectsController.getSubjectTypesAdminConfig(applicationId ?? undefined)
      );
      const subjectTypes = this.ensureData(
        subjectTypesResponse,
        'تعذر تحميل إعدادات الأنواع من المصدر القديم.'
      );

      const targetType = subjectTypes.find(item => Number(item.categoryId ?? 0) === categoryId) ?? null;
      if (!targetType) {
        return {
          success: false,
          message: 'تعذر النشر: النوع المحدد غير موجود داخل شجرة metadata القديمة.',
          warnings,
          categoryId,
          applicationId,
          parentCategoryId: null,
          persistedFieldsCount: 0,
          persistedGroupsCount: 0,
          persistedLinksCount: 0
        };
      }

      const categoryEntry = await firstValueFrom(
        this.categoryCatalogService.resolveCategory(categoryId, applicationId)
      );
      if (!categoryEntry) {
        warnings.push('النوع المحدد غير ظاهر ضمن الشجرة الأم الحالية للتطبيق، لكن سيتم المتابعة بالحفظ على metadata القديمة مباشرة.');
      }

      await this.applyCategoryStructureUpdates(context, targetType, warnings);

      const requiredRulesBundle = this.validationRulesEngine.parseConditionalPayload(
        context.validationValues['conditionalRulesPayload']
      );
      const requiredByField = new Map<string, boolean>(
        requiredRulesBundle.requiredRules.map(rule => [this.normalizeFieldKey(rule.fieldKey), rule.isRequired] as const)
      );

      const bindings = this.bindingEngine
        .parseBindingsPayload(context.bindingValues['bindingPayload'])
        .filter(item => this.normalizeFieldKey(item.fieldKey).length > 0)
        .sort((left, right) => left.displayOrder - right.displayOrder);
      if (bindings.length === 0) {
        return {
          success: false,
          message: 'تعذر النشر: لا توجد Field Library bindings صالحة للحفظ في المصدر القديم.',
          warnings,
          categoryId,
          applicationId,
          parentCategoryId: Number(targetType.parentCategoryId ?? 0) || null,
          persistedFieldsCount: 0,
          persistedGroupsCount: 0,
          persistedLinksCount: 0
        };
      }

      const containers = this.compositionEngine
        .parseContainersPayload(context.compositionValues['compositionLayoutPayload'])
        .sort((left, right) => left.displayOrder - right.displayOrder);
      const defaultGroupLabel = this.normalizeString(context.compositionValues['defaultGroupLabel'])
        ?? 'المجموعة الأساسية';

      const resolvedBindings = this.resolveBindings(bindings, containers, defaultGroupLabel, requiredByField);

      const fieldsResponse = await firstValueFrom(
        this.dynamicSubjectsController.getAdminFields(applicationId ?? undefined)
      );
      const existingFields = this.ensureData(fieldsResponse, 'تعذر تحميل مكتبة الحقول القديمة قبل الحفظ.');
      const fieldMap = new Map<string, SubjectAdminFieldDto>(
        existingFields.map(item => [this.normalizeFieldKey(item.fieldKey), item] as const)
      );

      for (const item of resolvedBindings) {
        const existingField = fieldMap.get(item.normalizedFieldKey) ?? null;
        const request = this.buildFieldUpsertRequest(item, existingField, applicationId);

        if (existingField) {
          const updateResponse = await firstValueFrom(
            this.dynamicSubjectsController.updateAdminField(existingField.fieldKey, request)
          );
          const updated = this.ensureData(updateResponse, `تعذر تحديث الحقل ${existingField.fieldKey}.`);
          fieldMap.set(item.normalizedFieldKey, updated);
        } else {
          const createResponse = await firstValueFrom(
            this.dynamicSubjectsController.createAdminField(request)
          );
          const created = this.ensureData(createResponse, `تعذر إنشاء الحقل ${item.binding.fieldKey}.`);
          fieldMap.set(item.normalizedFieldKey, created);
        }
      }

      const groupsByNormalizedName = await this.ensureGroups(resolvedBindings, context.compositionValues, warnings);

      const linksResponse = await firstValueFrom(
        this.dynamicSubjectsController.getAdminCategoryFieldLinks(categoryId)
      );
      const existingLinks = this.ensureData(linksResponse, 'تعذر تحميل روابط الحقول الحالية قبل الحفظ.');
      const existingLinksByKey = new Map<string, SubjectCategoryFieldLinkAdminDto>();
      for (const link of existingLinks) {
        const key = this.normalizeFieldKey(link.fieldKey);
        if (!key || existingLinksByKey.has(key)) {
          continue;
        }

        existingLinksByKey.set(key, link);
      }

      const linkPayload: SubjectCategoryFieldLinkUpsertItemDto[] = resolvedBindings.map(item => {
        const existing = existingLinksByKey.get(item.normalizedFieldKey);
        const existingMendSql = Number(existing?.mendSql ?? 0);
        const groupId = groupsByNormalizedName.get(this.normalizeFieldKey(item.groupName));
        if (!groupId || groupId <= 0) {
          throw new Error(`تعذر تحديد Group Id صالح للحقل ${item.binding.fieldKey}.`);
        }

        return {
          mendSql: existingMendSql > 0 ? existingMendSql : undefined,
          fieldKey: item.binding.fieldKey,
          groupId,
          isActive: true,
          displayOrder: item.displayOrder,
          isVisible: item.isVisible,
          displaySettingsJson: this.mergeDisplaySettings(
            existing?.displaySettingsJson,
            context,
            item
          )
        };
      });

      const upsertLinksResponse = await firstValueFrom(
        this.dynamicSubjectsController.upsertAdminCategoryFieldLinks(categoryId, { links: linkPayload })
      );
      const persistedLinks = this.ensureData(
        upsertLinksResponse,
        'تعذر حفظ روابط الحقول داخل metadata القديمة.'
      );

      const policyBuild = this.buildRequestPolicy(context, resolvedBindings, requiredRulesBundle.conditionalRules, warnings);

      const sourceFieldKeys = this.buildSourceFieldKeys(resolvedBindings, targetType.sourceFieldKeys);
      const prefixFromStep = this.normalizeString(context.structureValues['subjectPrefix']);
      const referencePolicyEnabled = this.toBoolean(context.bindingValues['referencePolicyEnabled'])
        ?? targetType.referencePolicyEnabled;
      const referencePrefix = this.normalizeString(context.bindingValues['referencePrefix'])
        ?? prefixFromStep
        ?? targetType.referencePrefix
        ?? `SUBJ${categoryId}`;
      const referenceSeparator = this.normalizeString(context.bindingValues['referenceSeparator'])
        ?? targetType.referenceSeparator
        ?? '-';
      const includeYear = this.toBoolean(context.bindingValues['referenceIncludeYear'])
        ?? targetType.includeYear;
      const useSequence = this.toBoolean(context.bindingValues['referenceUseSequence'])
        ?? targetType.useSequence;
      const sequenceName = this.normalizeString(context.bindingValues['referenceSequenceName'])
        ?? targetType.sequenceName
        ?? undefined;
      const sequencePaddingLength = this.toNonNegativeInt(context.bindingValues['referenceSequencePaddingLength'])
        ?? this.toNonNegativeInt(targetType.sequencePaddingLength)
        ?? 0;
      const sequenceResetScope = this.normalizeSequenceResetScope(context.bindingValues['referenceSequenceResetScope'])
        ?? this.normalizeSequenceResetScope(targetType.sequenceResetScope)
        ?? 'none';

      const subjectTypeRequest: SubjectTypeAdminUpsertRequestDto = {
        isActive: true,
        referencePolicyEnabled,
        referencePrefix,
        referenceSeparator,
        sourceFieldKeys,
        includeYear,
        useSequence,
        sequenceName,
        sequencePaddingLength,
        sequenceResetScope,
        requestPolicy: policyBuild
      };

      const upsertSubjectTypeResponse = await firstValueFrom(
        this.dynamicSubjectsController.upsertSubjectTypeAdminConfig(categoryId, subjectTypeRequest)
      );
      this.ensureData(
        upsertSubjectTypeResponse,
        'تعذر حفظ إعدادات النوع (Request Policy / Reference Policy) في المصدر القديم.'
      );

      this.categoryCatalogService.invalidate(applicationId ?? undefined);

      return {
        success: true,
        message: 'تم نشر التكوين مباشرة في metadata القديمة بنجاح، وأصبح runtime الحالي يقرأ نفس التعريفات.',
        warnings,
        categoryId,
        applicationId,
        parentCategoryId: Number(targetType.parentCategoryId ?? 0) || null,
        persistedFieldsCount: resolvedBindings.length,
        persistedGroupsCount: groupsByNormalizedName.size,
        persistedLinksCount: persistedLinks.length
      };
    } catch (error) {
      return {
        success: false,
        message: this.toErrorMessage(error, 'حدث خطأ غير متوقع أثناء النشر المباشر في metadata القديمة.'),
        warnings,
        categoryId: null,
        applicationId: null,
        parentCategoryId: null,
        persistedFieldsCount: 0,
        persistedGroupsCount: 0,
        persistedLinksCount: 0
      };
    }
  }

  private resolvePublishContext(state: ControlCenterState): PublishContext | null {
    const scopeValues = this.getStepValues(state, 'scope-definition');
    const structureValues = this.getStepValues(state, 'subject-structure');
    const bindingValues = this.getStepValues(state, 'field-library-binding');
    const compositionValues = this.getStepValues(state, 'form-composition');
    const workflowValues = this.getStepValues(state, 'workflow-routing');
    const accessValues = this.getStepValues(state, 'access-visibility');
    const validationValues = this.getStepValues(state, 'validation-rules');

    const applicationId = this.normalizeString(scopeValues['applicationId'])
      ?? this.normalizeString(state.context.applicationId);
    const categoryId = this.toPositiveInt(scopeValues['categoryId'])
      ?? this.toPositiveInt(state.context.categoryId)
      ?? 0;

    if (categoryId <= 0) {
      return null;
    }

    return {
      applicationId,
      categoryId,
      scopeValues,
      structureValues,
      bindingValues,
      compositionValues,
      workflowValues,
      accessValues,
      validationValues
    };
  }

  private getStepValues(state: ControlCenterState, key: ControlCenterStepKey): Record<string, unknown> {
    const step = state.steps.find(item => item.key === key);
    if (!step || !step.values || typeof step.values !== 'object') {
      return {};
    }

    return { ...step.values };
  }

  private async applyCategoryStructureUpdates(
    context: PublishContext,
    targetType: SubjectTypeAdminDto,
    warnings: string[]
  ): Promise<void> {
    const rootSubjectLabel = this.normalizeString(context.structureValues['rootSubjectLabel']);
    const categoryNameCandidate = rootSubjectLabel ?? this.normalizeString(targetType.categoryName);
    if (!categoryNameCandidate) {
      return;
    }

    if (categoryNameCandidate.length > 50) {
      warnings.push('قيمة Root Subject Label أطول من 50 حرفًا، لذلك لم يتم تطبيقها على اسم الفئة في الشجرة القديمة.');
      return;
    }

    const targetName = this.normalizeString(targetType.categoryName) ?? '';
    const targetAppId = this.normalizeString(targetType.applicationId);
    const requestedAppId = context.applicationId;

    const shouldUpdateName = categoryNameCandidate !== targetName;
    const shouldUpdateApp = requestedAppId != null && requestedAppId !== targetAppId;
    if (!shouldUpdateName && !shouldUpdateApp) {
      return;
    }

    const updateRequest: SubjectTypeAdminUpdateRequestDto = {
      categoryName: categoryNameCandidate,
      applicationId: requestedAppId ?? targetType.applicationId ?? undefined,
      catMend: targetType.catMend ?? undefined,
      catWorkFlow: Number(targetType.catWorkFlow ?? 0),
      catSms: targetType.catSms === true,
      catMailNotification: targetType.catMailNotification === true,
      to: targetType.to ?? undefined,
      cc: targetType.cc ?? undefined,
      isActive: targetType.isActive !== false
    };

    const updateResponse = await firstValueFrom(
      this.dynamicSubjectsController.updateAdminCategory(targetType.categoryId, updateRequest)
    );
    this.ensureData(updateResponse, 'تعذر تحديث بيانات الفئة الأساسية داخل الشجرة القديمة.');
  }

  private resolveBindings(
    bindings: ReadonlyArray<BoundFieldItem>,
    containers: ReadonlyArray<FormCompositionContainer>,
    defaultGroupLabel: string,
    requiredByField: ReadonlyMap<string, boolean>
  ): ResolvedBinding[] {
    const bindingMap = new Map<string, BoundFieldItem>();
    for (const binding of bindings) {
      const key = this.normalizeFieldKey(binding.fieldKey);
      if (!key || bindingMap.has(key)) {
        continue;
      }

      bindingMap.set(key, binding);
    }

    const sortedContainers = [...containers].sort((left, right) => left.displayOrder - right.displayOrder);
    const containerByField = new Map<string, FormCompositionContainer>();
    for (const container of sortedContainers) {
      for (const fieldKey of container.fieldKeys ?? []) {
        const normalizedFieldKey = this.normalizeFieldKey(fieldKey);
        if (!normalizedFieldKey || containerByField.has(normalizedFieldKey)) {
          continue;
        }

        containerByField.set(normalizedFieldKey, container);
      }
    }

    const displayOrderByField = new Map<string, number>();
    let runningOrder = 1;

    for (const container of sortedContainers) {
      for (const fieldKey of container.fieldKeys ?? []) {
        const normalizedFieldKey = this.normalizeFieldKey(fieldKey);
        if (!normalizedFieldKey || !bindingMap.has(normalizedFieldKey) || displayOrderByField.has(normalizedFieldKey)) {
          continue;
        }

        displayOrderByField.set(normalizedFieldKey, runningOrder++);
      }
    }

    const sortedBindings = [...bindingMap.values()].sort((left, right) => left.displayOrder - right.displayOrder);
    for (const binding of sortedBindings) {
      const normalizedFieldKey = this.normalizeFieldKey(binding.fieldKey);
      if (!normalizedFieldKey || displayOrderByField.has(normalizedFieldKey)) {
        continue;
      }

      displayOrderByField.set(normalizedFieldKey, runningOrder++);
    }

    return sortedBindings.map((binding, index) => {
      const normalizedFieldKey = this.normalizeFieldKey(binding.fieldKey);
      const container = containerByField.get(normalizedFieldKey) ?? null;
      const groupName = this.normalizeGroupName(container?.title)
        ?? this.normalizeGroupName(defaultGroupLabel)
        ?? `مجموعة ${index + 1}`;
      const containerVisible = container?.visible !== false;
      const isVisible = binding.visible && containerVisible;
      const requiredFromRules = requiredByField.get(normalizedFieldKey);
      const isRequired = (requiredFromRules ?? binding.required) && isVisible;

      return {
        binding,
        normalizedFieldKey,
        groupName,
        displayOrder: displayOrderByField.get(normalizedFieldKey) ?? index + 1,
        isVisible,
        isRequired,
        container
      };
    });
  }

  private buildFieldUpsertRequest(
    item: ResolvedBinding,
    existing: SubjectAdminFieldDto | null,
    applicationId: string | null
  ): SubjectAdminFieldUpsertRequestDto {
    const fieldKey = item.binding.fieldKey.trim();
    if (fieldKey.length === 0 || fieldKey.length > 50) {
      throw new Error(`Field Key غير صالح: ${item.binding.fieldKey}`);
    }

    const fieldLabel = this.truncateToMax(item.binding.label, 50) ?? fieldKey;
    const fieldType = this.mapBindingTypeToFieldType(item.binding.type, existing?.fieldType);
    const dataType = this.mapBindingTypeToDataType(item.binding.type, existing?.dataType);

    return {
      cdmendSql: existing?.cdmendSql,
      fieldKey,
      fieldType,
      fieldLabel,
      placeholder: existing?.placeholder ?? undefined,
      defaultValue: this.normalizeString(item.binding.defaultValue)
        ?? existing?.defaultValue
        ?? undefined,
      optionsPayload: this.resolveOptionsPayload(item.binding, existing),
      dataType,
      required: item.isRequired,
      requiredTrue: item.binding.type === 'Checkbox' ? item.isRequired : false,
      email: existing?.email === true,
      pattern: existing?.pattern === true,
      minValue: existing?.minValue ?? undefined,
      maxValue: existing?.maxValue ?? undefined,
      mask: existing?.mask ?? undefined,
      isActive: true,
      width: Number(existing?.width ?? 0),
      height: Number(existing?.height ?? 0),
      isDisabledInit: item.binding.readonly,
      isSearchable: existing?.isSearchable === true,
      applicationId: applicationId ?? existing?.applicationId ?? undefined
    };
  }

  private async ensureGroups(
    resolvedBindings: ReadonlyArray<ResolvedBinding>,
    compositionValues: Record<string, unknown>,
    warnings: string[]
  ): Promise<Map<string, number>> {
    const groupsResponse = await firstValueFrom(this.dynamicSubjectsController.getAdminGroups());
    const groups = this.ensureData(groupsResponse, 'تعذر تحميل الجروبات من المصدر القديم.');

    const groupsByName = new Map<string, SubjectAdminGroupDto>();
    for (const group of groups) {
      const normalizedName = this.normalizeFieldKey(group.groupName);
      if (!normalizedName || groupsByName.has(normalizedName)) {
        continue;
      }

      groupsByName.set(normalizedName, group);
    }

    const result = new Map<string, number>();
    const uniqueGroupNames = Array.from(new Set(resolvedBindings.map(item => this.normalizeGroupName(item.groupName)).filter(Boolean))) as string[];
    const compositionNotes = this.truncateToMax(this.normalizeString(compositionValues['compositionNotes']), 255);

    for (const groupName of uniqueGroupNames) {
      const normalizedName = this.normalizeFieldKey(groupName);
      const existingGroup = groupsByName.get(normalizedName) ?? null;
      if (existingGroup) {
        result.set(normalizedName, existingGroup.groupId);
        continue;
      }

      const createResponse = await firstValueFrom(
        this.dynamicSubjectsController.createAdminGroup({
          groupName,
          groupDescription: compositionNotes ?? `Generated by Admin Control Center (${groupName})`,
          isExtendable: false,
          groupWithInRow: 12
        })
      );
      const created = this.ensureData(createResponse, `تعذر إنشاء المجموعة ${groupName}.`);
      result.set(normalizedName, created.groupId);
      warnings.push(`تم إنشاء مجموعة جديدة في metadata القديمة: ${groupName}.`);
    }

    return result;
  }

  private buildRequestPolicy(
    context: PublishContext,
    resolvedBindings: ReadonlyArray<ResolvedBinding>,
    conditionalRules: ReadonlyArray<{ leftFieldKey: string; operator: string; rightValue: string; effect: string }>,
    warnings: string[]
  ): RequestPolicyDefinitionDto {
    const baseFieldPatches: RequestPolicyFieldPatchDto[] = resolvedBindings.map(item => ({
      fieldKey: item.binding.fieldKey,
      label: this.truncateToMax(item.binding.label, 50) ?? item.binding.fieldKey,
      visible: item.isVisible,
      required: item.isRequired,
      readonly: item.binding.readonly,
      placeholder: undefined,
      helpText: undefined
    }));

    const presentationRules: RequestPolicyPresentationRuleDto[] = [];
    if (baseFieldPatches.length > 0) {
      presentationRules.push({
        ruleId: 'acc-runtime-base',
        isEnabled: true,
        priority: 10,
        conditions: [
          {
            variable: 'categoryId',
            operator: 'exists',
            value: undefined,
            values: []
          } as RequestPolicyConditionDto
        ],
        fieldPatches: baseFieldPatches
      });
    }

    for (const rule of conditionalRules ?? []) {
      const effect = String(rule.effect ?? '').trim().toLowerCase();
      const operator = String(rule.operator ?? '').trim().toLowerCase();

      if (effect === 'block-submit') {
        warnings.push(`قاعدة block-submit للحقل ${rule.leftFieldKey} لا تملك تمثيلًا مباشرًا في request policy وتم تخطيها.`);
        continue;
      }

      if (operator === 'gt' || operator === 'lt') {
        warnings.push(`المعامل ${operator} للحقل ${rule.leftFieldKey} غير مدعوم في request policy وتم تخطي القاعدة.`);
        continue;
      }

      const patch: RequestPolicyFieldPatchDto = {
        fieldKey: String(rule.leftFieldKey ?? '').trim(),
        visible: effect === 'hidden' ? false : undefined,
        required: effect === 'required' ? true : undefined,
        readonly: effect === 'readonly' ? true : undefined
      };
      if (!patch.fieldKey) {
        continue;
      }

      const hasAnyOperation = patch.visible != null || patch.required != null || patch.readonly != null;
      if (!hasAnyOperation) {
        continue;
      }

      const condition: RequestPolicyConditionDto = {
        variable: patch.fieldKey,
        operator: operator === 'contains' ? 'contains' : (operator === 'neq' ? 'neq' : 'eq'),
        value: String(rule.rightValue ?? '').trim() || undefined,
        values: []
      };

      presentationRules.push({
        ruleId: `acc-conditional-${patch.fieldKey}-${effect}`,
        isEnabled: true,
        priority: 100 + presentationRules.length,
        conditions: [condition],
        fieldPatches: [patch]
      });
    }

    const createScopeFromStep = this.parseScopeIds(context.scopeValues['createUnitScope']);
    const readScopeFromStep = this.parseScopeIds(context.scopeValues['readUnitScope']);
    const createScope = this.parseScopeIds(context.accessValues['createScope'], createScopeFromStep);
    const readScope = this.parseScopeIds(context.accessValues['readScope'], readScopeFromStep);
    const workScope = this.parseScopeIds(context.accessValues['workScope']);

    const rawRequestMode = this.normalizeString(context.scopeValues['requestMode'])?.toLowerCase();
    let createMode: 'single' | 'multi' = rawRequestMode === 'multi' ? 'multi' : 'single';
    if (createMode === 'single' && createScope.length > 1) {
      createMode = 'multi';
      warnings.push('تم تحويل createMode تلقائيًا إلى multi لأن Create Scope يحتوي أكثر من جهة.');
    }

    const scopeDirection = this.normalizeDirection(context.scopeValues['documentDirection']);

    const rawRoutingMode = this.normalizeString(context.workflowValues['routingMode'])?.toLowerCase();
    let workflowMode: 'static' | 'manual' | 'hybrid' = rawRoutingMode === 'static'
      ? 'static'
      : (rawRoutingMode === 'hybrid' ? 'hybrid' : 'manual');

    let allowManualSelection = context.workflowValues['allowManualSelection'] !== false;
    let manualTargetFieldKey = this.resolveManualTargetFieldKey(resolvedBindings);
    let defaultTargetUnitId = this.normalizeString(context.workflowValues['defaultTargetUnit'])
      ?? this.normalizeString(context.scopeValues['targetUnitDefault']);

    const staticTargetUnitIds = this.uniqueStrings([
      defaultTargetUnitId
    ]);

    if ((workflowMode === 'manual' || (workflowMode === 'hybrid' && allowManualSelection)) && !manualTargetFieldKey) {
      if (workflowMode === 'manual') {
        workflowMode = 'hybrid';
        allowManualSelection = false;
        warnings.push('تم تحويل workflow mode من manual إلى hybrid لأن حقل التوجيه اليدوي غير موجود ضمن الحقول المرتبطة.');
      } else {
        allowManualSelection = false;
        warnings.push('تم تعطيل Allow Manual Selection لأن حقل التوجيه اليدوي غير متوفر ضمن الحقول المرتبطة.');
      }
    }

    if (workflowMode === 'static' && staticTargetUnitIds.length === 0) {
      const fallbackTarget = createScope[0] ?? readScope[0] ?? null;
      if (fallbackTarget) {
        staticTargetUnitIds.push(fallbackTarget);
        defaultTargetUnitId = defaultTargetUnitId ?? fallbackTarget;
        warnings.push('تم اعتماد fallback target unit تلقائيًا لدعم وضع التوجيه الثابت.');
      }
    }

    if (workflowMode === 'hybrid' && !allowManualSelection && staticTargetUnitIds.length === 0) {
      const fallbackTarget = defaultTargetUnitId ?? createScope[0] ?? readScope[0] ?? null;
      if (fallbackTarget) {
        staticTargetUnitIds.push(fallbackTarget);
        defaultTargetUnitId = fallbackTarget;
        warnings.push('تم إضافة fallback target unit لدعم وضع التوجيه الهجين بدون اختيار يدوي.');
      }
    }

    if (!allowManualSelection) {
      manualTargetFieldKey = undefined;
    }

    const policyCandidate: RequestPolicyDefinitionDto = {
      version: 1,
      presentationRules,
      accessPolicy: {
        createMode,
        createScope: { unitIds: createScope, roleIds: [], groupIds: [] },
        readScope: { unitIds: readScope, roleIds: [], groupIds: [] },
        workScope: { unitIds: workScope, roleIds: [], groupIds: [] },
        inheritLegacyAccess: false
      },
      workflowPolicy: {
        mode: workflowMode,
        directionMode: scopeDirection ? 'fixed' : 'selectable',
        fixedDirection: scopeDirection ?? undefined,
        staticTargetUnitIds,
        allowManualSelection,
        manualTargetFieldKey,
        manualSelectionRequired: allowManualSelection,
        defaultTargetUnitId: defaultTargetUnitId ?? undefined
      }
    };

    return this.requestPolicyResolver.normalizePolicy(policyCandidate);
  }

  private buildSourceFieldKeys(resolvedBindings: ReadonlyArray<ResolvedBinding>, existing: string | undefined): string | undefined {
    const requiredKeys = resolvedBindings
      .filter(item => item.isRequired)
      .map(item => item.binding.fieldKey)
      .map(item => item.trim())
      .filter(Boolean);

    const normalized = this.uniqueStrings(requiredKeys);
    if (normalized.length === 0) {
      return this.normalizeString(existing) ?? undefined;
    }

    const payload = normalized.join(',');
    if (payload.length <= 500) {
      return payload;
    }

    return payload.slice(0, 500);
  }

  private resolveManualTargetFieldKey(resolvedBindings: ReadonlyArray<ResolvedBinding>): string | undefined {
    const explicitKeys = new Set<string>([
      'targetunit',
      'targetunitid',
      'assignedunit',
      'assignedunitid',
      'assignedtouserid',
      'assigneduserid',
      'domainuser',
      'unitid',
      'userid'
    ]);

    const hasSelectionType = (binding: BoundFieldItem): boolean => {
      const type = this.normalizeFieldKey(binding.type);
      return type.includes('drop') || type.includes('select') || type.includes('combo') || type.includes('radio') || type.includes('tree');
    };

    for (const item of resolvedBindings) {
      const normalizedKey = this.normalizeFieldKey(item.binding.fieldKey);
      if (explicitKeys.has(normalizedKey)) {
        return item.binding.fieldKey;
      }
    }

    for (const item of resolvedBindings) {
      const key = this.normalizeFieldKey(item.binding.fieldKey);
      const label = this.normalizeFieldKey(item.binding.label);
      const semantic = key.includes('target')
        || key.includes('unit')
        || key.includes('assign')
        || label.includes('جهة')
        || label.includes('وحدة')
        || label.includes('مسؤول');
      if (semantic && hasSelectionType(item.binding)) {
        return item.binding.fieldKey;
      }
    }

    for (const item of resolvedBindings) {
      if (hasSelectionType(item.binding)) {
        return item.binding.fieldKey;
      }
    }

    return undefined;
  }

  private mergeDisplaySettings(
    existingRaw: string | undefined,
    context: PublishContext,
    item: ResolvedBinding
  ): string | undefined {
    const root = this.parseJsonObject(existingRaw);
    const adminControlCenter = this.parseJsonObject(root['adminControlCenter']);

    const scopeRouteKeyPrefix = this.normalizeString(context.scopeValues['routeKeyPrefix']);
    const createConfigRouteKey = this.normalizeString(context.workflowValues['createConfigRouteKey']);
    const structureNodePayload = this.normalizeString(context.structureValues['structureNodesPayload']);

    adminControlCenter['version'] = 1;
    adminControlCenter['source'] = 'admin-control-center';
    adminControlCenter['fieldKey'] = item.binding.fieldKey;
    adminControlCenter['bindingId'] = item.binding.bindingId;
    adminControlCenter['sourceFieldId'] = item.binding.sourceFieldId;
    adminControlCenter['containerId'] = item.container?.id ?? null;
    adminControlCenter['containerType'] = item.container?.type ?? null;
    adminControlCenter['containerTitle'] = item.container?.title ?? null;
    adminControlCenter['containerVisible'] = item.container?.visible !== false;
    adminControlCenter['scopeRouteKeyPrefix'] = scopeRouteKeyPrefix ?? null;
    adminControlCenter['createConfigRouteKey'] = createConfigRouteKey ?? null;
    adminControlCenter['structurePayloadHash'] = structureNodePayload ? this.buildLightweightHash(structureNodePayload) : null;

    root['adminControlCenter'] = adminControlCenter;

    const serialized = JSON.stringify(root);
    return serialized.length > 0 ? serialized : undefined;
  }

  private parseJsonObject(raw: unknown): Record<string, unknown> {
    if (!raw) {
      return {};
    }

    if (typeof raw === 'object' && !Array.isArray(raw)) {
      return { ...(raw as Record<string, unknown>) };
    }

    const payload = String(raw ?? '').trim();
    if (!payload) {
      return {};
    }

    try {
      const parsed = JSON.parse(payload);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }

    return {};
  }

  private mapBindingTypeToFieldType(bindingType: BoundFieldItem['type'], fallback: string | undefined): string {
    if (bindingType === 'Checkbox') {
      return 'ToggleSwitch';
    }

    return bindingType || fallback || 'InputText';
  }

  private mapBindingTypeToDataType(bindingType: BoundFieldItem['type'], fallback: string | undefined): string {
    if (bindingType === 'Checkbox') {
      return 'boolean';
    }
    if (bindingType === 'Number') {
      return 'number';
    }
    if (bindingType === 'Date') {
      return 'date';
    }

    return fallback || 'string';
  }

  private resolveOptionsPayload(binding: BoundFieldItem, existing: SubjectAdminFieldDto | null): string | undefined {
    const existingPayload = this.normalizeString(existing?.optionsPayload);
    if (existingPayload) {
      return existingPayload;
    }

    if (binding.type !== 'Dropdown') {
      return undefined;
    }

    const defaultValue = this.normalizeString(binding.defaultValue);
    if (!defaultValue) {
      return undefined;
    }

    return JSON.stringify([
      {
        key: defaultValue,
        name: defaultValue
      }
    ]);
  }

  private parseScopeIds(value: unknown, fallback: string[] = []): string[] {
    const raw = this.normalizeString(value);
    if (!raw) {
      return [...fallback];
    }

    const unique = new Set<string>();
    raw.split(',')
      .map(item => item.trim())
      .filter(Boolean)
      .forEach(item => unique.add(item));

    return Array.from(unique);
  }

  private ensureData<T>(response: CommonResponse<T> | null | undefined, fallbackMessage: string): T {
    const errors = (response?.errors ?? [])
      .map(item => this.normalizeString(item?.message))
      .filter((item): item is string => item != null);
    if (errors.length > 0) {
      throw new Error(errors.join(' | '));
    }

    if (response == null || response.data == null) {
      throw new Error(fallbackMessage);
    }

    return response.data;
  }

  private normalizeFieldKey(value: unknown): string {
    return String(value ?? '').trim().toLowerCase();
  }

  private normalizeGroupName(value: unknown): string | null {
    const normalized = this.normalizeString(value);
    if (!normalized) {
      return null;
    }

    if (normalized.length <= 100) {
      return normalized;
    }

    return normalized.slice(0, 100);
  }

  private normalizeDirection(value: unknown): 'incoming' | 'outgoing' | null {
    const normalized = this.normalizeFieldKey(value);
    if (normalized === 'incoming' || normalized === 'inbound' || normalized === 'in') {
      return 'incoming';
    }
    if (normalized === 'outgoing' || normalized === 'outbound' || normalized === 'out') {
      return 'outgoing';
    }

    return null;
  }

  private normalizeString(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : null;
  }

  private toBoolean(value: unknown): boolean | null {
    if (typeof value === 'boolean') {
      return value;
    }

    const normalized = this.normalizeFieldKey(value);
    if (!normalized) {
      return null;
    }

    if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'y' || normalized === 'on') {
      return true;
    }

    if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'n' || normalized === 'off') {
      return false;
    }

    return null;
  }

  private toNonNegativeInt(value: unknown): number | null {
    const numeric = Number(value ?? Number.NaN);
    if (!Number.isFinite(numeric) || numeric < 0) {
      return null;
    }

    return Math.trunc(numeric);
  }

  private normalizeSequenceResetScope(value: unknown): 'none' | 'yearly' | 'monthly' | null {
    const normalized = this.normalizeFieldKey(value);
    if (!normalized || normalized === 'none') {
      return 'none';
    }

    if (normalized === 'yearly' || normalized === 'year' || normalized === 'annual') {
      return 'yearly';
    }

    if (normalized === 'monthly' || normalized === 'month') {
      return 'monthly';
    }

    return null;
  }

  private toPositiveInt(value: unknown): number | null {
    const numeric = Number(value ?? 0);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return null;
    }

    return Math.trunc(numeric);
  }

  private uniqueStrings(values: ReadonlyArray<string | null | undefined>): string[] {
    const unique = new Set<string>();
    for (const value of values) {
      const normalized = this.normalizeString(value);
      if (normalized) {
        unique.add(normalized);
      }
    }

    return Array.from(unique);
  }

  private truncateToMax(value: string | null, maxLength: number): string | undefined {
    if (!value) {
      return undefined;
    }

    if (value.length <= maxLength) {
      return value;
    }

    return value.slice(0, maxLength);
  }

  private buildLightweightHash(value: string): string {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = ((hash << 5) - hash) + value.charCodeAt(i);
      hash |= 0;
    }

    return `h${Math.abs(hash)}`;
  }

  private toErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error) {
      const message = this.normalizeString(error.message);
      if (message) {
        return message;
      }
    }

    const asText = this.normalizeString(error);
    if (asText) {
      return asText;
    }

    return fallback;
  }
}
