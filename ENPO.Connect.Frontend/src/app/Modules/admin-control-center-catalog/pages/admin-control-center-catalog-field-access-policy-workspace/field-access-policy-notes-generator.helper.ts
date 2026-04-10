export type FieldAccessNoteOption = {
  label: string;
  value: string | number | null | undefined;
};

export type FieldAccessNoteTargetLookup = {
  id: number;
  label: string;
  targetLevel: string;
};

export type FieldAccessNoteStageLookup = {
  id: number;
  label: string;
};

export type FieldAccessNoteActionLookup = {
  id: number;
  stageId: number;
  label: string;
};

export type FieldAccessNotesContext = {
  targetLevelOptions: ReadonlyArray<FieldAccessNoteOption>;
  permissionTypeOptions: ReadonlyArray<FieldAccessNoteOption>;
  subjectTypeOptions: ReadonlyArray<FieldAccessNoteOption>;
  effectOptions: ReadonlyArray<FieldAccessNoteOption>;
  lockModeOptions: ReadonlyArray<FieldAccessNoteOption>;
  targets: ReadonlyArray<FieldAccessNoteTargetLookup>;
  stages: ReadonlyArray<FieldAccessNoteStageLookup>;
  actions: ReadonlyArray<FieldAccessNoteActionLookup>;
};

export type RuleNotesInput = {
  targetLevel?: string;
  targetId?: number;
  stageId?: number;
  actionId?: number;
  permissionType?: string;
  subjectType?: string;
  subjectId?: string;
  effect?: string;
  priority?: number;
  isActive?: boolean;
};

export type LockNotesInput = {
  targetLevel?: string;
  targetId?: number;
  stageId?: number;
  actionId?: number;
  lockMode?: string;
  allowedOverrideSubjectType?: string;
  allowedOverrideSubjectId?: string;
  isActive?: boolean;
};

export class FieldAccessPolicyNotesGenerator {
  buildRuleNotes(input: RuleNotesInput, context: FieldAccessNotesContext): string {
    const targetLevel = this.normalizeText(input.targetLevel);
    const targetLabel = this.resolveTargetLabel(context, targetLevel, input.targetId);
    const targetLevelLabel = this.resolveOptionLabel(context.targetLevelOptions, targetLevel, 'هدف');
    const stageActionPhrase = this.buildStageActionPhrase(context, input.stageId, input.actionId);
    const subjectPhrase = this.buildRuleSubjectPhrase(
      context,
      this.normalizeText(input.subjectType),
      this.normalizeText(input.subjectId)
    );
    const permissionType = this.normalizeText(input.permissionType);
    const permissionLabel = this.resolveOptionLabel(context.permissionTypeOptions, permissionType, 'صلاحية غير محددة');
    const effect = this.normalizeText(input.effect);
    const effectLabel = this.resolveOptionLabel(context.effectOptions, effect, 'أثر غير محدد');
    const impactPhrase = this.buildRuleImpactPhrase(permissionType, permissionLabel, effect);
    const statusPhrase = input.isActive === false
      ? 'الحالة الحالية: غير نشطة.'
      : 'الحالة الحالية: نشطة.';
    const priorityPhrase = Number.isFinite(input.priority)
      ? `الأولوية الحالية: ${Math.floor(input.priority ?? 0)}.`
      : 'الأولوية الحالية: غير محددة بعد.';

    return `ستُطبّق هذه القاعدة على ${targetLevelLabel} (${targetLabel}) ${stageActionPhrase}، وتستهدف ${subjectPhrase}. الصلاحية: ${permissionLabel} بتأثير ${effectLabel}. الأثر المتوقع: ${impactPhrase} ${statusPhrase} ${priorityPhrase}`;
  }

  buildLockNotes(input: LockNotesInput, context: FieldAccessNotesContext): string {
    const targetLevel = this.normalizeText(input.targetLevel);
    const targetLabel = this.resolveTargetLabel(context, targetLevel, input.targetId);
    const targetLevelLabel = this.resolveOptionLabel(context.targetLevelOptions, targetLevel, 'هدف');
    const stageActionPhrase = this.buildStageActionPhrase(context, input.stageId, input.actionId);
    const lockMode = this.normalizeText(input.lockMode);
    const lockModeLabel = this.resolveOptionLabel(context.lockModeOptions, lockMode, 'نمط قفل غير محدد');
    const overridePhrase = this.buildLockOverridePhrase(
      context,
      this.normalizeText(input.allowedOverrideSubjectType),
      this.normalizeText(input.allowedOverrideSubjectId)
    );
    const impactPhrase = this.buildLockImpactPhrase(lockMode, lockModeLabel);
    const statusPhrase = input.isActive === false
      ? 'الحالة الحالية: غير نشط.'
      : 'الحالة الحالية: نشط.';

    return `سيتم تطبيق ${lockModeLabel} على ${targetLevelLabel} (${targetLabel}) ${stageActionPhrase}. ${overridePhrase} الأثر المتوقع: ${impactPhrase} ${statusPhrase}`;
  }

  private buildRuleSubjectPhrase(
    context: FieldAccessNotesContext,
    subjectType: string | undefined,
    subjectId: string | undefined
  ): string {
    if (!subjectType) {
      return 'جهة سيتم تحديدها لاحقًا';
    }

    const subjectLabel = this.resolveOptionLabel(context.subjectTypeOptions, subjectType, 'جهة غير محددة');
    if (!this.requiresSubjectId(subjectType)) {
      return subjectLabel;
    }

    if (!subjectId) {
      return `${subjectLabel} مع انتظار إدخال المعرّف`;
    }

    return `${subjectLabel} بالمعرف (${subjectId})`;
  }

  private buildStageActionPhrase(context: FieldAccessNotesContext, stageId?: number, actionId?: number): string {
    const stageLabel = this.resolveStageLabel(context, stageId);
    const actionLabel = this.resolveActionLabel(context, actionId);

    if (stageId && actionId) {
      return `خلال مرحلة (${stageLabel}) وعند الإجراء (${actionLabel})`;
    }

    if (stageId) {
      return `خلال مرحلة (${stageLabel})`;
    }

    if (actionId) {
      return `مع إجراء (${actionLabel}) عند استكمال اختيار المرحلة`;
    }

    return 'على مستوى جميع المراحل والإجراءات';
  }

  private buildRuleImpactPhrase(permissionType: string | undefined, permissionLabel: string, effect: string | undefined): string {
    if (effect === 'Deny') {
      return `منع تطبيق صلاحية (${permissionLabel}) على الهدف.`;
    }

    if (permissionType === 'Editable') {
      return 'إتاحة التعديل على الهدف.';
    }

    if (permissionType === 'ReadOnly') {
      return 'جعل الهدف للقراءة فقط.';
    }

    if (permissionType === 'Hidden') {
      return 'إخفاء الهدف عن الجهة المستهدفة.';
    }

    if (permissionType === 'RequiredInput') {
      return 'جعل إدخال القيمة إلزاميًا.';
    }

    return 'تطبيق الصلاحية المحددة على الهدف.';
  }

  private buildLockOverridePhrase(
    context: FieldAccessNotesContext,
    overrideSubjectType: string | undefined,
    overrideSubjectId: string | undefined
  ): string {
    if (!overrideSubjectType && !overrideSubjectId) {
      return 'لا توجد جهة مستثناة؛ القفل يطبّق على جميع الجهات.';
    }

    if (!overrideSubjectType && overrideSubjectId) {
      return `تم إدخال معرف استثناء (${overrideSubjectId}) بدون تحديد نوع جهة الاستثناء.`;
    }

    const subjectLabel = this.resolveOptionLabel(context.subjectTypeOptions, overrideSubjectType, 'جهة غير محددة');
    if (overrideSubjectType && !this.requiresSubjectId(overrideSubjectType)) {
      return `يسمح بتجاوز القفل لجهة الاستثناء: ${subjectLabel}.`;
    }

    if (!overrideSubjectId) {
      return `تم اختيار جهة استثناء (${subjectLabel}) مع انتظار إدخال المعرّف.`;
    }

    return `يسمح بتجاوز القفل فقط لجهة الاستثناء ${subjectLabel} بالمعرف (${overrideSubjectId}).`;
  }

  private buildLockImpactPhrase(lockMode: string | undefined, lockModeLabel: string): string {
    if (lockMode === 'NoEdit') {
      return 'منع تعديل القيمة.';
    }

    if (lockMode === 'NoInput') {
      return 'منع إدخال القيمة.';
    }

    if (lockMode === 'FullLock') {
      return 'قفل الهدف بالكامل.';
    }

    return `تطبيق نمط القفل (${lockModeLabel}).`;
  }

  private resolveTargetLabel(context: FieldAccessNotesContext, targetLevel: string | undefined, targetId?: number): string {
    if (!targetId) {
      return 'هدف لم يتم تحديده بعد';
    }

    const normalizedLevel = this.normalizeText(targetLevel);
    const target = context.targets.find(item => item.id === targetId && this.normalizeText(item.targetLevel) === normalizedLevel)
      ?? context.targets.find(item => item.id === targetId);

    return target?.label ?? `المعرف ${targetId}`;
  }

  private resolveStageLabel(context: FieldAccessNotesContext, stageId?: number): string {
    if (!stageId) {
      return 'مرحلة غير محددة';
    }

    const stage = context.stages.find(item => item.id === stageId);
    return stage?.label ?? `المرحلة ${stageId}`;
  }

  private resolveActionLabel(context: FieldAccessNotesContext, actionId?: number): string {
    if (!actionId) {
      return 'إجراء غير محدد';
    }

    const action = context.actions.find(item => item.id === actionId);
    return action?.label ?? `الإجراء ${actionId}`;
  }

  private resolveOptionLabel(
    options: ReadonlyArray<FieldAccessNoteOption>,
    value: string | undefined,
    fallback: string
  ): string {
    const normalizedValue = this.normalizeText(value);
    if (!normalizedValue) {
      return fallback;
    }

    const item = options.find(option => this.normalizeText(option.value) === normalizedValue);
    return item?.label ?? fallback;
  }

  private requiresSubjectId(subjectType: string): boolean {
    return subjectType === 'OrgUnit' || subjectType === 'Position' || subjectType === 'User';
  }

  private normalizeText(value: unknown): string | undefined {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : undefined;
  }
}
