import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';

export interface CentralAdminContextState {
  selectedApplicationId: string | null;
  selectedCategoryId: number | null;
  selectedSubjectTypeName: string | null;
  routeKeyPrefix: string | null;
  selectedFieldsCount: number | null;
  selectedConfigRouteKey: string | null;
  filteredConfigsCount: number | null;
}

const INITIAL_CONTEXT_STATE: CentralAdminContextState = {
  selectedApplicationId: null,
  selectedCategoryId: null,
  selectedSubjectTypeName: null,
  routeKeyPrefix: null,
  selectedFieldsCount: null,
  selectedConfigRouteKey: null,
  filteredConfigsCount: null
};

@Injectable({ providedIn: 'root' })
export class CentralAdminContextService {
  private readonly stateSubject = new BehaviorSubject<CentralAdminContextState>(INITIAL_CONTEXT_STATE);

  readonly state$: Observable<CentralAdminContextState> = this.stateSubject.asObservable();
  readonly selectedApplicationId$ = this.state$.pipe(
    map(state => state.selectedApplicationId),
    distinctUntilChanged()
  );
  readonly selectedCategoryId$ = this.state$.pipe(
    map(state => state.selectedCategoryId),
    distinctUntilChanged()
  );
  readonly routeKeyPrefix$ = this.state$.pipe(
    map(state => state.routeKeyPrefix),
    distinctUntilChanged()
  );

  get snapshot(): CentralAdminContextState {
    return this.stateSubject.value;
  }

  patchContext(patch: Partial<CentralAdminContextState>): void {
    const current = this.stateSubject.value;
    const normalizedPatch = this.normalizePatch(patch);
    const next: CentralAdminContextState = {
      ...current,
      ...normalizedPatch
    };

    if (this.isSameState(current, next)) {
      return;
    }

    this.stateSubject.next(next);
  }

  updateFromDeepLink(input: { applicationId?: unknown; categoryId?: unknown; routeKeyPrefix?: unknown }): void {
    this.patchContext({
      selectedApplicationId: this.normalizeString(input.applicationId),
      selectedCategoryId: this.normalizePositiveInt(input.categoryId),
      routeKeyPrefix: this.normalizeString(input.routeKeyPrefix)
    });
  }

  clearContext(): void {
    this.stateSubject.next(INITIAL_CONTEXT_STATE);
  }

  toQueryParams(): Record<string, string | null> {
    const state = this.snapshot;
    return {
      applicationId: state.selectedApplicationId ?? null,
      categoryId: state.selectedCategoryId != null ? String(state.selectedCategoryId) : null,
      routeKeyPrefix: state.routeKeyPrefix ?? null
    };
  }

  private normalizePatch(patch: Partial<CentralAdminContextState>): Partial<CentralAdminContextState> {
    const hasOwn = (key: keyof CentralAdminContextState): boolean =>
      Object.prototype.hasOwnProperty.call(patch, key);

    const normalized: Partial<CentralAdminContextState> = {};
    if (hasOwn('selectedApplicationId')) {
      normalized.selectedApplicationId = this.normalizeString(patch.selectedApplicationId);
    }
    if (hasOwn('selectedCategoryId')) {
      normalized.selectedCategoryId = this.normalizePositiveInt(patch.selectedCategoryId);
    }
    if (hasOwn('selectedSubjectTypeName')) {
      normalized.selectedSubjectTypeName = this.normalizeString(patch.selectedSubjectTypeName);
    }
    if (hasOwn('routeKeyPrefix')) {
      normalized.routeKeyPrefix = this.normalizeString(patch.routeKeyPrefix);
    }
    if (hasOwn('selectedFieldsCount')) {
      normalized.selectedFieldsCount = this.normalizeNonNegativeInt(patch.selectedFieldsCount);
    }
    if (hasOwn('selectedConfigRouteKey')) {
      normalized.selectedConfigRouteKey = this.normalizeString(patch.selectedConfigRouteKey);
    }
    if (hasOwn('filteredConfigsCount')) {
      normalized.filteredConfigsCount = this.normalizeNonNegativeInt(patch.filteredConfigsCount);
    }

    return normalized;
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

  private normalizeNonNegativeInt(value: unknown): number | null {
    const normalized = Number(value ?? 0);
    if (!Number.isFinite(normalized) || normalized < 0) {
      return null;
    }

    return Math.trunc(normalized);
  }

  private isSameState(left: CentralAdminContextState, right: CentralAdminContextState): boolean {
    return left.selectedApplicationId === right.selectedApplicationId
      && left.selectedCategoryId === right.selectedCategoryId
      && left.selectedSubjectTypeName === right.selectedSubjectTypeName
      && left.routeKeyPrefix === right.routeKeyPrefix
      && left.selectedFieldsCount === right.selectedFieldsCount
      && left.selectedConfigRouteKey === right.selectedConfigRouteKey
      && left.filteredConfigsCount === right.filteredConfigsCount;
  }
}
