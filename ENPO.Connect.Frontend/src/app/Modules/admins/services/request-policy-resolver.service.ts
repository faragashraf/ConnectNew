import { Injectable } from '@angular/core';
import {
  RequestPolicyConditionDto,
  RequestPolicyDefinitionDto,
  RequestPolicyFieldPatchDto,
  SubjectFieldDefinitionDto
} from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.dto';

export interface RequestPolicyRuntimeContext {
  applicationId?: string | null;
  categoryId?: number | null;
  routeKeyPrefix?: string | null;
  documentDirection?: string | null;
  creatorUnitId?: string | null;
  targetUnitId?: string | null;
  requestMode?: string | null;
  variables?: Record<string, unknown> | null;
}

export interface ResolvedPresentationMetadata {
  label: string;
  visible: boolean;
  required: boolean;
  readonly: boolean;
  placeholder?: string;
  helpText?: string;
}

export interface ResolvedAccessPolicy {
  createMode: 'single' | 'multi';
  createUnitIds: string[];
  readUnitIds: string[];
  workUnitIds: string[];
  inheritLegacyAccess: boolean;
  canCreate: boolean;
  canRead: boolean;
  canWork: boolean;
}

export interface ResolvedWorkflowPolicy {
  mode: 'static' | 'manual' | 'hybrid';
  staticTargetUnitIds: string[];
  allowManualSelection: boolean;
  manualTargetFieldKey?: string;
  manualSelectionRequired: boolean;
  defaultTargetUnitId?: string;
  resolvedTargetUnitId?: string;
}

@Injectable({ providedIn: 'root' })
export class RequestPolicyResolverService {
  resolvePresentationMetadata(
    field: Pick<SubjectFieldDefinitionDto, 'fieldKey' | 'fieldLabel' | 'isVisible' | 'required' | 'isDisabledInit' | 'placeholder'>,
    context: RequestPolicyRuntimeContext,
    requestPolicy?: RequestPolicyDefinitionDto | null
  ): ResolvedPresentationMetadata {
    const normalizedPolicy = this.normalizePolicy(requestPolicy);
    const contextMap = this.buildContextMap(context);
    const normalizedFieldKey = this.normalizeFieldKey(field.fieldKey);

    const resolved: ResolvedPresentationMetadata = {
      label: String(field.fieldLabel ?? field.fieldKey ?? '').trim() || String(field.fieldKey ?? ''),
      visible: Boolean(field.isVisible),
      required: Boolean(field.required),
      readonly: Boolean(field.isDisabledInit),
      placeholder: this.normalizeString(field.placeholder) ?? undefined
    };

    normalizedPolicy.presentationRules
      .filter(rule => rule.isEnabled !== false)
      .sort((left, right) => Number(left.priority ?? 100) - Number(right.priority ?? 100))
      .forEach(rule => {
        if (!this.matchesAllConditions(rule.conditions ?? [], contextMap)) {
          return;
        }

        (rule.fieldPatches ?? []).forEach(patch => {
          if (this.normalizeFieldKey(patch.fieldKey) !== normalizedFieldKey) {
            return;
          }

          this.applyFieldPatch(resolved, patch);
        });
      });

    return resolved;
  }

  resolveAccessPolicy(
    requestPolicy: RequestPolicyDefinitionDto | null | undefined,
    context: RequestPolicyRuntimeContext
  ): ResolvedAccessPolicy {
    const normalized = this.normalizePolicy(requestPolicy);
    const access = normalized.accessPolicy;
    const createUnitIds = this.normalizeStringArray(access?.createScope?.unitIds ?? []);
    const readUnitIds = this.normalizeStringArray(access?.readScope?.unitIds ?? []);
    const workUnitIds = this.normalizeStringArray(access?.workScope?.unitIds ?? []);
    const creatorUnit = this.normalizeString(context.creatorUnitId);
    const targetUnit = this.normalizeString(context.targetUnitId);

    return {
      createMode: this.normalizeCreateMode(access?.createMode),
      createUnitIds,
      readUnitIds,
      workUnitIds,
      inheritLegacyAccess: access?.inheritLegacyAccess !== false,
      canCreate: createUnitIds.length === 0 || (creatorUnit != null && createUnitIds.includes(creatorUnit)),
      canRead: readUnitIds.length === 0
        || (creatorUnit != null && readUnitIds.includes(creatorUnit))
        || (targetUnit != null && readUnitIds.includes(targetUnit)),
      canWork: workUnitIds.length === 0
        || (targetUnit != null && workUnitIds.includes(targetUnit))
        || (creatorUnit != null && workUnitIds.includes(creatorUnit))
    };
  }

  resolveWorkflowPolicy(
    requestPolicy: RequestPolicyDefinitionDto | null | undefined,
    context: RequestPolicyRuntimeContext
  ): ResolvedWorkflowPolicy {
    const normalized = this.normalizePolicy(requestPolicy);
    const workflow = normalized.workflowPolicy;
    const staticTargets = this.normalizeStringArray(workflow?.staticTargetUnitIds ?? []);
    const defaultTargetUnitId = this.normalizeString(workflow?.defaultTargetUnitId);
    const requestedTarget = this.normalizeString(context.targetUnitId);
    const mode = this.normalizeWorkflowMode(workflow?.mode);
    const allowManualSelection = workflow?.allowManualSelection !== false;
    const manualTargetFieldKey = this.normalizeString(workflow?.manualTargetFieldKey) ?? undefined;
    const manualSelectionRequired = workflow?.manualSelectionRequired !== false;

    let resolvedTargetUnitId: string | undefined;
    if (mode === 'static') {
      resolvedTargetUnitId = staticTargets[0] ?? defaultTargetUnitId ?? undefined;
    } else if (mode === 'hybrid') {
      resolvedTargetUnitId = (allowManualSelection ? requestedTarget : undefined) ?? staticTargets[0] ?? defaultTargetUnitId ?? undefined;
    } else {
      resolvedTargetUnitId = (allowManualSelection ? requestedTarget : undefined) ?? defaultTargetUnitId ?? undefined;
    }

    return {
      mode,
      staticTargetUnitIds: staticTargets,
      allowManualSelection,
      manualTargetFieldKey,
      manualSelectionRequired,
      defaultTargetUnitId: defaultTargetUnitId ?? undefined,
      resolvedTargetUnitId
    };
  }

  normalizePolicy(requestPolicy: RequestPolicyDefinitionDto | null | undefined): RequestPolicyDefinitionDto {
    const normalizedWorkflowMode = this.normalizeWorkflowMode(requestPolicy?.workflowPolicy?.mode);
    const normalizedAllowManualSelection = normalizedWorkflowMode === 'manual'
      ? true
      : requestPolicy?.workflowPolicy?.allowManualSelection !== false;
    const normalizedManualSelectionRequired = normalizedWorkflowMode === 'static'
      ? false
      : requestPolicy?.workflowPolicy?.manualSelectionRequired !== false;

    return {
      version: Number(requestPolicy?.version ?? 1) > 0 ? Number(requestPolicy?.version ?? 1) : 1,
      presentationRules: (requestPolicy?.presentationRules ?? [])
        .map(rule => ({
          ruleId: this.normalizeString(rule?.ruleId) ?? '',
          isEnabled: rule?.isEnabled !== false,
          priority: Number(rule?.priority ?? 100),
          conditions: (rule?.conditions ?? []).map(condition => ({
            variable: this.normalizeVariable(condition?.variable),
            operator: this.normalizeString(condition?.operator) ?? 'eq',
            value: this.normalizeString(condition?.value) ?? undefined,
            values: this.normalizeStringArray(condition?.values ?? [])
          })),
          fieldPatches: (rule?.fieldPatches ?? [])
            .map(patch => ({
              fieldKey: this.normalizeString(patch?.fieldKey) ?? '',
              label: this.normalizeString(patch?.label) ?? undefined,
              visible: patch?.visible,
              required: patch?.required,
              readonly: patch?.readonly,
              placeholder: this.normalizeString(patch?.placeholder) ?? undefined,
              helpText: this.normalizeString(patch?.helpText) ?? undefined
            }))
            .filter(patch => patch.fieldKey.length > 0)
        }))
        .filter(rule => (rule.fieldPatches ?? []).length > 0),
      accessPolicy: {
        createMode: this.normalizeCreateMode(requestPolicy?.accessPolicy?.createMode),
        createScope: {
          unitIds: this.normalizeStringArray(requestPolicy?.accessPolicy?.createScope?.unitIds ?? []),
          roleIds: this.normalizeStringArray(requestPolicy?.accessPolicy?.createScope?.roleIds ?? []),
          groupIds: this.normalizeStringArray(requestPolicy?.accessPolicy?.createScope?.groupIds ?? [])
        },
        readScope: {
          unitIds: this.normalizeStringArray(requestPolicy?.accessPolicy?.readScope?.unitIds ?? []),
          roleIds: this.normalizeStringArray(requestPolicy?.accessPolicy?.readScope?.roleIds ?? []),
          groupIds: this.normalizeStringArray(requestPolicy?.accessPolicy?.readScope?.groupIds ?? [])
        },
        workScope: {
          unitIds: this.normalizeStringArray(requestPolicy?.accessPolicy?.workScope?.unitIds ?? []),
          roleIds: this.normalizeStringArray(requestPolicy?.accessPolicy?.workScope?.roleIds ?? []),
          groupIds: this.normalizeStringArray(requestPolicy?.accessPolicy?.workScope?.groupIds ?? [])
        },
        inheritLegacyAccess: requestPolicy?.accessPolicy?.inheritLegacyAccess !== false
      },
      workflowPolicy: {
        mode: normalizedWorkflowMode,
        staticTargetUnitIds: this.normalizeStringArray(requestPolicy?.workflowPolicy?.staticTargetUnitIds ?? []),
        allowManualSelection: normalizedAllowManualSelection,
        manualTargetFieldKey: normalizedAllowManualSelection
          ? (this.normalizeString(requestPolicy?.workflowPolicy?.manualTargetFieldKey) ?? undefined)
          : undefined,
        manualSelectionRequired: normalizedManualSelectionRequired,
        defaultTargetUnitId: this.normalizeString(requestPolicy?.workflowPolicy?.defaultTargetUnitId) ?? undefined
      }
    };
  }

  private applyFieldPatch(target: ResolvedPresentationMetadata, patch: RequestPolicyFieldPatchDto): void {
    if (patch.label != null) {
      target.label = patch.label;
    }
    if (patch.visible != null) {
      target.visible = Boolean(patch.visible);
    }
    if (patch.required != null) {
      target.required = Boolean(patch.required);
    }
    if (patch.readonly != null) {
      target.readonly = Boolean(patch.readonly);
    }
    if (patch.placeholder != null) {
      target.placeholder = patch.placeholder;
    }
    if (patch.helpText != null) {
      target.helpText = patch.helpText;
    }
  }

  private matchesAllConditions(conditions: RequestPolicyConditionDto[], contextMap: Record<string, string>): boolean {
    return (conditions ?? []).every(condition => this.matchesCondition(condition, contextMap));
  }

  private matchesCondition(condition: RequestPolicyConditionDto, contextMap: Record<string, string>): boolean {
    const variable = this.normalizeVariable(condition?.variable);
    if (!variable) {
      return false;
    }

    const operator = (this.normalizeString(condition?.operator) ?? 'eq').toLowerCase();
    const actualValue = this.normalizeString(contextMap[variable]);
    const conditionValue = this.normalizeString(condition?.value);
    const conditionValues = this.normalizeStringArray(condition?.values ?? []);
    if (conditionValue && !conditionValues.includes(conditionValue)) {
      conditionValues.push(conditionValue);
    }

    if (operator === 'eq') {
      return conditionValue != null && actualValue === conditionValue;
    }
    if (operator === 'neq') {
      return conditionValue == null || actualValue !== conditionValue;
    }
    if (operator === 'in') {
      return actualValue != null && conditionValues.includes(actualValue);
    }
    if (operator === 'notin') {
      return actualValue == null || !conditionValues.includes(actualValue);
    }
    if (operator === 'contains') {
      return actualValue != null && conditionValue != null && actualValue.includes(conditionValue);
    }
    if (operator === 'exists') {
      return actualValue != null;
    }
    if (operator === 'empty') {
      return actualValue == null;
    }

    return false;
  }

  private buildContextMap(context: RequestPolicyRuntimeContext): Record<string, string> {
    const map: Record<string, string> = {};
    const set = (key: string, value: unknown): void => {
      const normalizedKey = this.normalizeVariable(key);
      const normalizedValue = this.normalizeString(value);
      if (!normalizedKey || normalizedValue == null) {
        return;
      }

      map[normalizedKey] = normalizedValue;
    };

    set('applicationId', context.applicationId);
    set('categoryId', context.categoryId);
    set('routeKeyPrefix', context.routeKeyPrefix);
    set('documentDirection', context.documentDirection);
    set('creatorUnitId', context.creatorUnitId);
    set('targetUnitId', context.targetUnitId);
    set('requestMode', context.requestMode);

    Object.entries(context.variables ?? {}).forEach(([key, value]) => set(key, value));

    return map;
  }

  private normalizeWorkflowMode(mode: unknown): 'static' | 'manual' | 'hybrid' {
    const normalized = (this.normalizeString(mode) ?? 'manual').toLowerCase();
    if (normalized === 'static' || normalized === 'hybrid') {
      return normalized;
    }

    return 'manual';
  }

  private normalizeCreateMode(mode: unknown): 'single' | 'multi' {
    const normalized = (this.normalizeString(mode) ?? 'single').toLowerCase();
    return normalized === 'multi' ? 'multi' : 'single';
  }

  private normalizeFieldKey(value: unknown): string {
    return (this.normalizeString(value) ?? '').toLowerCase();
  }

  private normalizeVariable(value: unknown): string {
    return (this.normalizeString(value) ?? '')
      .replace(/^runtime\./i, '')
      .replace(/^context\./i, '')
      .toLowerCase();
  }

  private normalizeString(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : null;
  }

  private normalizeStringArray(values: unknown[]): string[] {
    const unique = new Set<string>();
    (values ?? []).forEach(value => {
      const normalized = this.normalizeString(value);
      if (normalized != null) {
        unique.add(normalized);
      }
    });

    return Array.from(unique);
  }
}
