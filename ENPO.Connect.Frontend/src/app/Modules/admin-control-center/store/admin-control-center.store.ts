import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  ControlCenterContextState,
  ControlCenterState,
  ControlCenterStepDefinition,
  ControlCenterStepKey,
  ControlCenterStepTransitionResult
} from '../domain/models/admin-control-center.models';
import { AdminControlCenterWorkflowEngine } from '../domain/workflow/admin-control-center-workflow.engine';

export interface ControlCenterPublishResult {
  success: boolean;
  message: string;
}

type MutableContextPatch = {
  -readonly [K in keyof ControlCenterContextState]?: ControlCenterContextState[K];
};

@Injectable()
export class AdminControlCenterStore {
  private readonly stateSubject: BehaviorSubject<ControlCenterState>;
  readonly state$: Observable<ControlCenterState>;

  constructor(private readonly workflowEngine: AdminControlCenterWorkflowEngine) {
    this.stateSubject = new BehaviorSubject<ControlCenterState>(this.workflowEngine.createInitialState());
    this.state$ = this.stateSubject.asObservable();
  }

  get snapshot(): ControlCenterState {
    return this.stateSubject.value;
  }

  getStepDefinitions(): ReadonlyArray<ControlCenterStepDefinition> {
    return this.workflowEngine.getDefinitions();
  }

  initialize(rawStepKey?: string | null): void {
    const current = this.workflowEngine.recalculateState(this.stateSubject.value);
    const safeStepKey = this.workflowEngine.resolveSafeStepKey(current, rawStepKey ?? current.activeStepKey);
    this.stateSubject.next(
      this.workflowEngine.recalculateState({
        ...current,
        activeStepKey: safeStepKey
      })
    );
  }

  patchContext(patch: Partial<ControlCenterContextState>): void {
    const current = this.workflowEngine.recalculateState(this.stateSubject.value);
    const contextPatch = this.normalizeContextPatch(patch);
    const nextContext: ControlCenterContextState = {
      ...current.context,
      ...contextPatch
    };

    this.stateSubject.next(
      this.workflowEngine.recalculateState({
        ...current,
        context: nextContext
      })
    );
  }

  evaluateStepTransition(rawStepKey: string | null | undefined): ControlCenterStepTransitionResult {
    return this.workflowEngine.evaluateStepTransition(this.stateSubject.value, rawStepKey);
  }

  setActiveStep(rawStepKey: string | null | undefined): boolean {
    const transition = this.workflowEngine.evaluateStepTransition(this.stateSubject.value, rawStepKey);
    if (!transition.allowed) {
      return false;
    }

    const current = this.workflowEngine.recalculateState(this.stateSubject.value);
    this.stateSubject.next(
      this.workflowEngine.recalculateState({
        ...current,
        activeStepKey: transition.resolvedStepKey
      })
    );

    return true;
  }

  upsertFieldValue(stepKey: ControlCenterStepKey, fieldKey: string, value: unknown): void {
    const normalizedFieldKey = String(fieldKey ?? '').trim();
    if (normalizedFieldKey.length === 0) {
      return;
    }

    const current = this.workflowEngine.recalculateState(this.stateSubject.value);
    const stepExists = current.steps.some(step => step.key === stepKey);
    if (!stepExists) {
      return;
    }

    const sanitizedValue = this.sanitizeValue(value);
    const nextSteps = current.steps.map(step => {
      if (step.key !== stepKey) {
        return step;
      }

      const nextValues = { ...step.values };
      if (sanitizedValue == null) {
        delete nextValues[normalizedFieldKey];
      } else {
        nextValues[normalizedFieldKey] = sanitizedValue;
      }

      return {
        ...step,
        values: nextValues,
        isVisited: true
      };
    });

    const contextPatch = this.deriveContextPatchFromFieldChange(stepKey, normalizedFieldKey, sanitizedValue);

    this.stateSubject.next(
      this.workflowEngine.recalculateState({
        ...current,
        context: {
          ...current.context,
          ...contextPatch
        },
        steps: nextSteps,
        isPublished: false,
        lastPublishedAt: null
      })
    );
  }

  saveDraft(): string {
    const current = this.workflowEngine.recalculateState(this.stateSubject.value);
    const now = new Date().toISOString();
    this.stateSubject.next(
      this.workflowEngine.recalculateState({
        ...current,
        lastSavedAt: now
      })
    );

    return now;
  }

  publish(): ControlCenterPublishResult {
    const current = this.workflowEngine.recalculateState(this.stateSubject.value);
    if (current.blockingIssues.length > 0) {
      return {
        success: false,
        message: 'تعذر النشر. توجد متطلبات إلزامية غير مكتملة في خطوات الإعداد.'
      };
    }

    const now = new Date().toISOString();
    this.stateSubject.next(
      this.workflowEngine.recalculateState({
        ...current,
        isPublished: true,
        lastPublishedAt: now,
        lastSavedAt: now
      })
    );

    return {
      success: true,
      message: 'تم اعتماد الإعدادات ونشر الإصدار بنجاح.'
    };
  }

  canAccessStep(rawStepKey: string | null | undefined): boolean {
    return this.workflowEngine.canAccessStep(this.stateSubject.value, rawStepKey);
  }

  resolveSafeStepKey(rawStepKey: string | null | undefined): ControlCenterStepKey {
    return this.workflowEngine.resolveSafeStepKey(this.stateSubject.value, rawStepKey);
  }

  getNextStepKey(rawStepKey: string | null | undefined): ControlCenterStepKey | null {
    return this.workflowEngine.getNextStepKey(this.stateSubject.value, rawStepKey);
  }

  getPreviousStepKey(rawStepKey: string | null | undefined): ControlCenterStepKey | null {
    return this.workflowEngine.getPreviousStepKey(rawStepKey);
  }

  private deriveContextPatchFromFieldChange(
    stepKey: ControlCenterStepKey,
    fieldKey: string,
    value: unknown
  ): Partial<ControlCenterContextState> {
    if (stepKey === 'scope-definition') {
      if (fieldKey === 'applicationId') {
        return {
          applicationId: this.normalizeString(value)
        };
      }

      if (fieldKey === 'categoryId') {
        return {
          categoryId: this.normalizePositiveInt(value)
        };
      }

      if (fieldKey === 'requestMode') {
        return {
          requestMode: this.normalizeString(value)
        };
      }

      if (fieldKey === 'documentDirection') {
        return {
          documentDirection: this.normalizeDirection(value)
        };
      }

      if (fieldKey === 'routeKeyPrefix') {
        return {
          routeKeyPrefix: this.normalizeString(value)
        };
      }

      if (fieldKey === 'primaryConfigRouteKey') {
        return {
          primaryConfigRouteKey: this.normalizeString(value)
        };
      }

      if (fieldKey === 'createUnitScope') {
        return {
          createUnitScope: this.normalizeString(value)
        };
      }

      if (fieldKey === 'readUnitScope') {
        return {
          readUnitScope: this.normalizeString(value)
        };
      }

      if (fieldKey === 'creatorUnitDefault') {
        return {
          creatorUnitDefault: this.normalizeString(value)
        };
      }

      if (fieldKey === 'targetUnitDefault') {
        return {
          targetUnitDefault: this.normalizeString(value)
        };
      }

      if (fieldKey === 'runtimeContextJson') {
        return {
          runtimeContextJson: this.normalizeString(value)
        };
      }

      if (fieldKey === 'localizationProfile') {
        return {
          localizationProfile: this.normalizeString(value)
        };
      }

      if (fieldKey === 'uiPreset') {
        return {
          uiPreset: this.normalizeString(value)
        };
      }
    }

    return {};
  }

  private normalizeContextPatch(patch: Partial<ControlCenterContextState>): Partial<ControlCenterContextState> {
    const hasOwn = (key: keyof ControlCenterContextState): boolean =>
      Object.prototype.hasOwnProperty.call(patch, key);

    const normalized: MutableContextPatch = {};

    if (hasOwn('applicationId')) {
      normalized.applicationId = this.normalizeString(patch.applicationId);
    }
    if (hasOwn('categoryId')) {
      normalized.categoryId = this.normalizePositiveInt(patch.categoryId);
    }
    if (hasOwn('routeKeyPrefix')) {
      normalized.routeKeyPrefix = this.normalizeString(patch.routeKeyPrefix);
    }
    if (hasOwn('documentDirection')) {
      normalized.documentDirection = this.normalizeDirection(patch.documentDirection);
    }
    if (hasOwn('requestMode')) {
      normalized.requestMode = this.normalizeString(patch.requestMode);
    }
    if (hasOwn('primaryConfigRouteKey')) {
      normalized.primaryConfigRouteKey = this.normalizeString(patch.primaryConfigRouteKey);
    }
    if (hasOwn('createUnitScope')) {
      normalized.createUnitScope = this.normalizeString(patch.createUnitScope);
    }
    if (hasOwn('readUnitScope')) {
      normalized.readUnitScope = this.normalizeString(patch.readUnitScope);
    }
    if (hasOwn('creatorUnitDefault')) {
      normalized.creatorUnitDefault = this.normalizeString(patch.creatorUnitDefault);
    }
    if (hasOwn('targetUnitDefault')) {
      normalized.targetUnitDefault = this.normalizeString(patch.targetUnitDefault);
    }
    if (hasOwn('runtimeContextJson')) {
      normalized.runtimeContextJson = this.normalizeString(patch.runtimeContextJson);
    }
    if (hasOwn('localizationProfile')) {
      normalized.localizationProfile = this.normalizeString(patch.localizationProfile);
    }
    if (hasOwn('uiPreset')) {
      normalized.uiPreset = this.normalizeString(patch.uiPreset);
    }

    return normalized as Partial<ControlCenterContextState>;
  }

  private sanitizeValue(value: unknown): unknown {
    if (value == null) {
      return null;
    }

    if (typeof value === 'string') {
      const normalized = value.trim();
      return normalized.length > 0 ? normalized : null;
    }

    if (Array.isArray(value)) {
      return value.length > 0 ? value : null;
    }

    return value;
  }

  private normalizeString(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : null;
  }

  private normalizePositiveInt(value: unknown): number | null {
    const normalized = Number(value ?? 0);
    if (!Number.isFinite(normalized) || normalized <= 0) {
      return null;
    }

    return Math.trunc(normalized);
  }

  private normalizeDirection(value: unknown): 'incoming' | 'outgoing' | null {
    const normalized = this.normalizeString(value);
    if (normalized === 'incoming' || normalized === 'outgoing') {
      return normalized;
    }

    return null;
  }
}
