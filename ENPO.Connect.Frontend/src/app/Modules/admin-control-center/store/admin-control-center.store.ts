import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  ControlCenterContextState,
  ControlCenterState,
  ControlCenterStepDefinition,
  ControlCenterStepKey,
  ControlCenterStepTransitionResult,
  isControlCenterStepKey
} from '../domain/models/admin-control-center.models';
import { AdminControlCenterWorkflowEngine } from '../domain/workflow/admin-control-center-workflow.engine';
import {
  AdminControlCenterDraftStorageService,
  ControlCenterDraftPersistResult,
  PersistedControlCenterDraftState
} from '../services/admin-control-center-draft-storage.service';
import { AdminControlCenterDemoScopeService } from '../services/admin-control-center-demo-scope.service';
import { PreviewSimulationArtifactEngine } from '../domain/preview-simulation/preview-simulation-artifact.engine';

export interface ControlCenterPublishResult {
  success: boolean;
  message: string;
}

export interface ControlCenterDraftSaveResult {
  success: boolean;
  message: string;
  savedAt: string | null;
}

export interface ControlCenterStateActionResult {
  success: boolean;
  message: string;
  targetStepKey: ControlCenterStepKey;
}

type MutableContextPatch = {
  -readonly [K in keyof ControlCenterContextState]?: ControlCenterContextState[K];
};

@Injectable()
export class AdminControlCenterStore implements OnDestroy {
  private readonly stateSubject: BehaviorSubject<ControlCenterState>;
  readonly state$: Observable<ControlCenterState>;

  private readonly autoSaveDelayMs = 900;
  private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private didHydrateFromStorage = false;

  constructor(
    private readonly workflowEngine: AdminControlCenterWorkflowEngine,
    private readonly draftStorage: AdminControlCenterDraftStorageService,
    private readonly demoScopeService: AdminControlCenterDemoScopeService,
    private readonly previewArtifactEngine: PreviewSimulationArtifactEngine
  ) {
    this.stateSubject = new BehaviorSubject<ControlCenterState>(
      this.recalculateState(this.workflowEngine.createInitialState())
    );
    this.state$ = this.stateSubject.asObservable();
  }

  ngOnDestroy(): void {
    this.clearAutoSaveTimer();
  }

  get snapshot(): ControlCenterState {
    return this.stateSubject.value;
  }

  getStepDefinitions(): ReadonlyArray<ControlCenterStepDefinition> {
    return this.workflowEngine.getDefinitions();
  }

  initialize(rawStepKey?: string | null): void {
    if (!this.didHydrateFromStorage) {
      this.didHydrateFromStorage = true;
      this.stateSubject.next(this.restoreInitialState(rawStepKey));
      return;
    }

    const current = this.recalculateState(this.stateSubject.value);
    const safeStepKey = this.workflowEngine.resolveSafeStepKey(current, rawStepKey ?? current.activeStepKey);

    this.stateSubject.next(
      this.recalculateState({
        ...current,
        activeStepKey: safeStepKey
      })
    );
  }

  patchContext(patch: Partial<ControlCenterContextState>): void {
    const current = this.recalculateState(this.stateSubject.value);
    const contextPatch = this.normalizeContextPatch(patch);
    const nextContext: ControlCenterContextState = {
      ...current.context,
      ...contextPatch
    };

    this.pushState(
      {
        ...current,
        context: nextContext
      },
      { markUnsaved: true, scheduleAutoSave: true }
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

    const current = this.recalculateState(this.stateSubject.value);
    this.pushState(
      {
        ...current,
        activeStepKey: transition.resolvedStepKey
      },
      { markUnsaved: false, scheduleAutoSave: false }
    );

    return true;
  }

  upsertFieldValue(stepKey: ControlCenterStepKey, fieldKey: string, value: unknown): void {
    const normalizedFieldKey = String(fieldKey ?? '').trim();
    if (normalizedFieldKey.length === 0) {
      return;
    }

    const current = this.recalculateState(this.stateSubject.value);
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

    this.pushState(
      {
        ...current,
        context: {
          ...current.context,
          ...contextPatch
        },
        steps: nextSteps,
        isPublished: false,
        lastPublishedAt: null
      },
      { markUnsaved: true, scheduleAutoSave: true }
    );
  }

  saveDraft(): ControlCenterDraftSaveResult {
    this.clearAutoSaveTimer();

    const current = this.recalculateState(this.stateSubject.value);
    const persisted = this.persistState(current, new Date().toISOString());
    if (!persisted.success) {
      this.stateSubject.next(
        this.recalculateState({
          ...current,
          hasUnsavedChanges: true,
          draftErrorMessage: persisted.message
        })
      );

      return {
        success: false,
        message: persisted.message,
        savedAt: null
      };
    }

    const savedAt = persisted.savedAt ?? new Date().toISOString();
    this.stateSubject.next(
      this.recalculateState({
        ...current,
        lastSavedAt: savedAt,
        hasUnsavedChanges: false,
        draftErrorMessage: null
      })
    );

    return {
      success: true,
      message: 'تم حفظ المسودة محليًا بنجاح ويمكن استعادتها بعد تحديث الصفحة.',
      savedAt
    };
  }

  clearDraft(rawStepKey?: string | null): ControlCenterStateActionResult {
    this.clearAutoSaveTimer();

    const clearResult = this.draftStorage.clearDraft();
    const safeStep = this.workflowEngine.resolveSafeStepKey(this.stateSubject.value, rawStepKey);

    if (!clearResult.success) {
      const current = this.recalculateState(this.stateSubject.value);
      this.stateSubject.next(
        this.recalculateState({
          ...current,
          draftErrorMessage: clearResult.message
        })
      );

      return {
        success: false,
        message: clearResult.message,
        targetStepKey: safeStep
      };
    }

    const fresh = this.recalculateState({
      ...this.workflowEngine.createInitialState(safeStep),
      hasUnsavedChanges: false,
      draftRestoredAt: null,
      draftErrorMessage: null,
      lastSavedAt: null
    });

    this.stateSubject.next(fresh);

    return {
      success: true,
      message: 'تم مسح المسودة المحلية والبدء بحالة فارغة.',
      targetStepKey: fresh.activeStepKey
    };
  }

  startNewScope(rawStepKey?: string | null): ControlCenterStateActionResult {
    this.clearAutoSaveTimer();

    const clearResult = this.draftStorage.clearDraft();
    const current = this.recalculateState(this.stateSubject.value);
    const safeStep = this.workflowEngine.resolveSafeStepKey(current, rawStepKey);

    const fresh = this.recalculateState({
      ...this.workflowEngine.createInitialState(safeStep),
      hasUnsavedChanges: false,
      draftRestoredAt: null,
      draftErrorMessage: clearResult.success ? null : clearResult.message,
      lastSavedAt: null
    });

    this.stateSubject.next(fresh);

    return {
      success: clearResult.success,
      message: clearResult.success
        ? 'تم إنشاء نطاق جديد فارغ بنجاح.'
        : 'تم إنشاء نطاق جديد، لكن تعذر مسح المسودة السابقة من التخزين المحلي.',
      targetStepKey: fresh.activeStepKey
    };
  }

  loadDemoScope(rawStepKey?: string | null): ControlCenterStateActionResult {
    this.clearAutoSaveTimer();

    const demoDraft = this.demoScopeService.createDemoDraftState();
    const restoredAt = new Date().toISOString();
    const withDemo = this.buildStateFromPersistedDraft(demoDraft, rawStepKey ?? demoDraft.activeStepKey, restoredAt, null);

    const persisted = this.persistState(withDemo, restoredAt);
    if (!persisted.success) {
      this.stateSubject.next(
        this.recalculateState({
          ...withDemo,
          hasUnsavedChanges: true,
          draftErrorMessage: persisted.message
        })
      );

      return {
        success: false,
        message: 'تم تحميل النطاق التجريبي داخل الجلسة، لكن تعذر حفظه محليًا.',
        targetStepKey: withDemo.activeStepKey
      };
    }

    const savedAt = persisted.savedAt ?? restoredAt;
    this.stateSubject.next(
      this.recalculateState({
        ...withDemo,
        lastSavedAt: savedAt,
        hasUnsavedChanges: false,
        draftErrorMessage: null
      })
    );

    return {
      success: true,
      message: 'تم إنشاء نطاق تجريبي جاهز للاختبار وحفظه محليًا.',
      targetStepKey: withDemo.activeStepKey
    };
  }

  publish(): ControlCenterPublishResult {
    this.clearAutoSaveTimer();

    const current = this.recalculateState(this.stateSubject.value);
    if (current.blockingIssues.length > 0) {
      return {
        success: false,
        message: 'تعذر النشر. توجد متطلبات إلزامية غير مكتملة في خطوات الإعداد.'
      };
    }

    const now = new Date().toISOString();
    const persisted = this.persistState(
      {
        ...current,
        isPublished: true,
        lastPublishedAt: now,
        lastSavedAt: now,
        hasUnsavedChanges: false,
        draftErrorMessage: null
      },
      now
    );

    const nextState = this.recalculateState({
      ...current,
      isPublished: true,
      lastPublishedAt: now,
      lastSavedAt: persisted.success ? now : current.lastSavedAt,
      hasUnsavedChanges: !persisted.success,
      draftErrorMessage: persisted.success ? null : persisted.message
    });

    this.stateSubject.next(nextState);

    return {
      success: true,
      message: persisted.success
        ? 'تم اعتماد الإعدادات ونشر الإصدار بنجاح.'
        : 'تم اعتماد الإعدادات، لكن تعذر تحديث المسودة المحلية بعد النشر.'
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

  private recalculateState(state: ControlCenterState): ControlCenterState {
    const withDerivedPreview = this.previewArtifactEngine.applyDerivedArtifactToState(state);
    return this.workflowEngine.recalculateState(withDerivedPreview);
  }

  private restoreInitialState(rawStepKey?: string | null): ControlCenterState {
    const loadResult = this.draftStorage.loadDraft();
    if (loadResult.status === 'loaded' && loadResult.state) {
      return this.buildStateFromPersistedDraft(
        loadResult.state,
        rawStepKey ?? loadResult.state.activeStepKey,
        new Date().toISOString(),
        null
      );
    }

    const initial = this.workflowEngine.createInitialState();
    const safeStep = this.workflowEngine.resolveSafeStepKey(initial, rawStepKey ?? initial.activeStepKey);
    return this.recalculateState({
      ...initial,
      activeStepKey: safeStep,
      hasUnsavedChanges: false,
      draftRestoredAt: null,
      draftErrorMessage: loadResult.status === 'invalid' ? loadResult.message : null
    });
  }

  private buildStateFromPersistedDraft(
    persisted: PersistedControlCenterDraftState,
    rawStepKey: string | null | undefined,
    restoredAt: string | null,
    draftErrorMessage: string | null
  ): ControlCenterState {
    const initial = this.workflowEngine.createInitialState();
    const persistedStepMap = new Map<ControlCenterStepKey, PersistedControlCenterDraftState['steps'][number]>(
      persisted.steps
        .filter(step => isControlCenterStepKey(step.key))
        .map(step => [step.key, step] as const)
    );

    const mergedSteps = initial.steps.map(step => {
      const persistedStep = persistedStepMap.get(step.key);
      if (!persistedStep) {
        return step;
      }

      const nextValues = this.normalizeValuesRecord(persistedStep.values);
      return {
        ...step,
        values: nextValues,
        isVisited: persistedStep.isVisited || this.hasAnyValue(nextValues)
      };
    });

    const recalculated = this.recalculateState({
      ...initial,
      context: {
        ...initial.context,
        ...this.normalizeContextPatch(persisted.context)
      },
      steps: mergedSteps,
      activeStepKey: persisted.activeStepKey,
      isPublished: persisted.isPublished,
      hasUnsavedChanges: false,
      draftRestoredAt: restoredAt,
      draftErrorMessage,
      lastSavedAt: this.normalizeIsoDate(persisted.lastSavedAt),
      lastPublishedAt: this.normalizeIsoDate(persisted.lastPublishedAt)
    });

    const safeStep = this.workflowEngine.resolveSafeStepKey(recalculated, rawStepKey ?? persisted.activeStepKey);
    if (safeStep === recalculated.activeStepKey) {
      return recalculated;
    }

    return this.recalculateState({
      ...recalculated,
      activeStepKey: safeStep
    });
  }

  private pushState(
    nextState: ControlCenterState,
    options: { markUnsaved: boolean; scheduleAutoSave: boolean }
  ): void {
    const recalculated = this.recalculateState(nextState);
    const finalState = this.recalculateState({
      ...recalculated,
      hasUnsavedChanges: options.markUnsaved ? true : recalculated.hasUnsavedChanges,
      draftErrorMessage: options.markUnsaved ? null : recalculated.draftErrorMessage
    });

    this.stateSubject.next(finalState);

    if (options.scheduleAutoSave) {
      this.scheduleAutoSave();
    }
  }

  private scheduleAutoSave(): void {
    this.clearAutoSaveTimer();
    this.autoSaveTimer = setTimeout(() => {
      this.flushAutoSave();
    }, this.autoSaveDelayMs);
  }

  private flushAutoSave(): void {
    this.autoSaveTimer = null;

    const current = this.recalculateState(this.stateSubject.value);
    if (!current.hasUnsavedChanges) {
      return;
    }

    const persisted = this.persistState(current, new Date().toISOString());
    if (!persisted.success) {
      this.stateSubject.next(
        this.recalculateState({
          ...current,
          draftErrorMessage: persisted.message,
          hasUnsavedChanges: true
        })
      );
      return;
    }

    const savedAt = persisted.savedAt ?? new Date().toISOString();
    this.stateSubject.next(
      this.recalculateState({
        ...current,
        lastSavedAt: savedAt,
        hasUnsavedChanges: false,
        draftErrorMessage: null
      })
    );
  }

  private persistState(state: ControlCenterState, savedAt: string | null): ControlCenterDraftPersistResult {
    return this.draftStorage.saveDraft(this.toPersistedDraftState(state), savedAt);
  }

  private toPersistedDraftState(state: ControlCenterState): PersistedControlCenterDraftState {
    return {
      context: {
        ...state.context
      },
      steps: state.steps.map(step => ({
        key: step.key,
        values: this.normalizeValuesRecord(step.values),
        isVisited: step.isVisited
      })),
      activeStepKey: state.activeStepKey,
      isPublished: state.isPublished,
      lastPublishedAt: this.normalizeIsoDate(state.lastPublishedAt),
      lastSavedAt: this.normalizeIsoDate(state.lastSavedAt)
    };
  }

  private clearAutoSaveTimer(): void {
    if (!this.autoSaveTimer) {
      return;
    }

    clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = null;
  }

  private normalizeValuesRecord(values: Record<string, unknown> | null | undefined): Record<string, unknown> {
    if (!values || typeof values !== 'object') {
      return {};
    }

    return { ...values };
  }

  private hasAnyValue(values: Record<string, unknown>): boolean {
    return Object.values(values).some(value => {
      if (value == null) {
        return false;
      }

      if (typeof value === 'string') {
        return value.trim().length > 0;
      }

      if (Array.isArray(value)) {
        return value.length > 0;
      }

      if (typeof value === 'number') {
        return Number.isFinite(value);
      }

      if (typeof value === 'boolean') {
        return true;
      }

      return true;
    });
  }

  private normalizeIsoDate(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    if (!normalized) {
      return null;
    }

    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed.toISOString();
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
