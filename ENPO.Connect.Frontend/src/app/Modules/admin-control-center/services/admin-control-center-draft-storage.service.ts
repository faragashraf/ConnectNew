import { Injectable } from '@angular/core';
import {
  ADMIN_CONTROL_CENTER_DEFAULT_STEP,
  ControlCenterContextState,
  ControlCenterStepKey,
  INITIAL_ADMIN_CONTROL_CENTER_CONTEXT,
  isControlCenterStepKey
} from '../domain/models/admin-control-center.models';

export const ADMIN_CONTROL_CENTER_DRAFT_STORAGE_KEY = 'enpo.admin-control-center.draft.v1';
const ADMIN_CONTROL_CENTER_DRAFT_SCHEMA_VERSION = 1;

export interface PersistedControlCenterStepSnapshot {
  readonly key: ControlCenterStepKey;
  readonly values: Record<string, unknown>;
  readonly isVisited: boolean;
}

export interface PersistedControlCenterDraftState {
  readonly context: ControlCenterContextState;
  readonly steps: ReadonlyArray<PersistedControlCenterStepSnapshot>;
  readonly activeStepKey: ControlCenterStepKey;
  readonly isPublished: boolean;
  readonly lastPublishedAt: string | null;
  readonly lastSavedAt: string | null;
}

interface PersistedControlCenterDraftEnvelope {
  readonly version: number;
  readonly savedAt: string;
  readonly state: PersistedControlCenterDraftState;
}

export interface ControlCenterDraftLoadResult {
  readonly status: 'missing' | 'loaded' | 'invalid';
  readonly savedAt: string | null;
  readonly state: PersistedControlCenterDraftState | null;
  readonly message: string | null;
}

export interface ControlCenterDraftPersistResult {
  readonly success: boolean;
  readonly savedAt: string | null;
  readonly message: string;
}

@Injectable()
export class AdminControlCenterDraftStorageService {
  loadDraft(): ControlCenterDraftLoadResult {
    const storage = this.resolveStorage();
    if (!storage) {
      return {
        status: 'missing',
        savedAt: null,
        state: null,
        message: null
      };
    }

    const raw = storage.getItem(ADMIN_CONTROL_CENTER_DRAFT_STORAGE_KEY);
    if (!raw) {
      return {
        status: 'missing',
        savedAt: null,
        state: null,
        message: null
      };
    }

    try {
      const parsed = JSON.parse(raw);
      const envelope = this.normalizeEnvelope(parsed);
      if (!envelope) {
        this.removeDraftSilently(storage);
        return {
          status: 'invalid',
          savedAt: null,
          state: null,
          message: 'تعذر قراءة المسودة المحفوظة وتم تجاهل البيانات غير الصالحة.'
        };
      }

      return {
        status: 'loaded',
        savedAt: envelope.savedAt,
        state: envelope.state,
        message: null
      };
    } catch {
      this.removeDraftSilently(storage);
      return {
        status: 'invalid',
        savedAt: null,
        state: null,
        message: 'تعذر قراءة المسودة المحفوظة بسبب تنسيق غير صحيح.'
      };
    }
  }

  saveDraft(
    state: PersistedControlCenterDraftState,
    savedAt: string | null = null
  ): ControlCenterDraftPersistResult {
    const storage = this.resolveStorage();
    if (!storage) {
      return {
        success: false,
        savedAt: null,
        message: 'تعذر حفظ المسودة لأن التخزين المحلي غير متاح.'
      };
    }

    const normalizedState = this.normalizeState(state);
    const effectiveSavedAt = this.normalizeIso(savedAt) ?? new Date().toISOString();
    const envelope: PersistedControlCenterDraftEnvelope = {
      version: ADMIN_CONTROL_CENTER_DRAFT_SCHEMA_VERSION,
      savedAt: effectiveSavedAt,
      state: {
        ...normalizedState,
        lastSavedAt: effectiveSavedAt
      }
    };

    try {
      storage.setItem(ADMIN_CONTROL_CENTER_DRAFT_STORAGE_KEY, JSON.stringify(envelope));
      return {
        success: true,
        savedAt: effectiveSavedAt,
        message: 'تم حفظ المسودة محليًا بنجاح.'
      };
    } catch {
      return {
        success: false,
        savedAt: null,
        message: 'تعذر حفظ المسودة محليًا. قد تكون مساحة التخزين ممتلئة أو غير متاحة.'
      };
    }
  }

  clearDraft(): ControlCenterDraftPersistResult {
    const storage = this.resolveStorage();
    if (!storage) {
      return {
        success: false,
        savedAt: null,
        message: 'تعذر مسح المسودة لأن التخزين المحلي غير متاح.'
      };
    }

    this.removeDraftSilently(storage);
    return {
      success: true,
      savedAt: null,
      message: 'تم مسح المسودة المحلية.'
    };
  }

  private removeDraftSilently(storage: Storage): void {
    try {
      storage.removeItem(ADMIN_CONTROL_CENTER_DRAFT_STORAGE_KEY);
    } catch {
      // no-op
    }
  }

  private resolveStorage(): Storage | null {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }

    return window.localStorage;
  }

  private normalizeEnvelope(raw: unknown): PersistedControlCenterDraftEnvelope | null {
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const candidate = raw as Record<string, unknown>;
    const version = Number(candidate['version']);
    if (version !== ADMIN_CONTROL_CENTER_DRAFT_SCHEMA_VERSION) {
      return null;
    }

    const state = this.normalizeState(candidate['state']);
    if (!state) {
      return null;
    }

    const savedAt = this.normalizeIso(candidate['savedAt']) ?? state.lastSavedAt ?? new Date().toISOString();

    return {
      version,
      savedAt,
      state: {
        ...state,
        lastSavedAt: savedAt
      }
    };
  }

  private normalizeState(raw: unknown): PersistedControlCenterDraftState {
    const candidate = this.normalizeObject(raw);
    const contextCandidate = this.normalizeObject(candidate['context']);

    const context: ControlCenterContextState = {
      applicationId: this.normalizeString(contextCandidate['applicationId']),
      categoryId: this.normalizePositiveInt(contextCandidate['categoryId']),
      routeKeyPrefix: this.normalizeString(contextCandidate['routeKeyPrefix']),
      documentDirection: this.normalizeDirection(contextCandidate['documentDirection']),
      requestMode: this.normalizeString(contextCandidate['requestMode']),
      primaryConfigRouteKey: this.normalizeString(contextCandidate['primaryConfigRouteKey']),
      createUnitScope: this.normalizeString(contextCandidate['createUnitScope']),
      readUnitScope: this.normalizeString(contextCandidate['readUnitScope']),
      creatorUnitDefault: this.normalizeString(contextCandidate['creatorUnitDefault']),
      targetUnitDefault: this.normalizeString(contextCandidate['targetUnitDefault']),
      runtimeContextJson: this.normalizeString(contextCandidate['runtimeContextJson']),
      localizationProfile: this.normalizeString(contextCandidate['localizationProfile']),
      uiPreset: this.normalizeString(contextCandidate['uiPreset'])
    };

    const mergedContext: ControlCenterContextState = {
      ...INITIAL_ADMIN_CONTROL_CENTER_CONTEXT,
      ...context
    };

    const normalizedSteps = this.normalizeSteps(candidate['steps']);
    const rawActiveStepKey = String(candidate['activeStepKey'] ?? '').trim();
    const activeStepKey = isControlCenterStepKey(rawActiveStepKey)
      ? rawActiveStepKey
      : ADMIN_CONTROL_CENTER_DEFAULT_STEP;

    return {
      context: mergedContext,
      steps: normalizedSteps,
      activeStepKey,
      isPublished: candidate['isPublished'] === true,
      lastPublishedAt: this.normalizeIso(candidate['lastPublishedAt']),
      lastSavedAt: this.normalizeIso(candidate['lastSavedAt'])
    };
  }

  private normalizeSteps(raw: unknown): PersistedControlCenterStepSnapshot[] {
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw
      .map(item => this.normalizeStep(item))
      .filter((item): item is PersistedControlCenterStepSnapshot => item != null);
  }

  private normalizeStep(raw: unknown): PersistedControlCenterStepSnapshot | null {
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const candidate = raw as Record<string, unknown>;
    const key = String(candidate['key'] ?? '').trim();
    if (!isControlCenterStepKey(key)) {
      return null;
    }

    return {
      key,
      values: this.normalizeObject(candidate['values']),
      isVisited: candidate['isVisited'] === true
    };
  }

  private normalizeObject(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }

  private normalizeIso(value: unknown): string | null {
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
