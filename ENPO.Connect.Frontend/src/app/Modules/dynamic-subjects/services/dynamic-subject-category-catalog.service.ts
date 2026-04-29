import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { SubjectCategoryTreeNodeDto } from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.dto';
import { DynamicSubjectsController } from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.service';
import { DynamicSubjectAccessService } from './dynamic-subject-access.service';

export interface DynamicSubjectCategoryCatalogEntry {
  readonly categoryId: number;
  readonly parentCategoryId: number;
  readonly categoryName: string;
  readonly applicationId: string | null;
  readonly canCreate: boolean;
  readonly hasDynamicFields: boolean;
  readonly isActive: boolean;
  readonly displayOrder: number;
  readonly depth: number;
  readonly pathIds: ReadonlyArray<number>;
  readonly pathLabels: ReadonlyArray<string>;
  readonly pathLabel: string;
}

interface DynamicSubjectCategoryCatalog {
  readonly appId: string;
  readonly tree: ReadonlyArray<SubjectCategoryTreeNodeDto>;
  readonly entries: ReadonlyArray<DynamicSubjectCategoryCatalogEntry>;
  readonly creatableEntries: ReadonlyArray<DynamicSubjectCategoryCatalogEntry>;
  readonly byId: ReadonlyMap<number, DynamicSubjectCategoryCatalogEntry>;
}

@Injectable({ providedIn: 'root' })
export class DynamicSubjectCategoryCatalogService {
  private readonly cache = new Map<string, Observable<DynamicSubjectCategoryCatalog>>();

  constructor(
    private readonly dynamicSubjectsController: DynamicSubjectsController,
    private readonly dynamicSubjectAccess: DynamicSubjectAccessService
  ) {}

  getCatalog(appId?: string | null): Observable<DynamicSubjectCategoryCatalog> {
    const normalizedAppId = this.normalizeAppId(appId);
    const cached = this.cache.get(normalizedAppId);
    if (cached) {
      return cached;
    }

    const stream$ = this.dynamicSubjectsController.getCategoryTree(normalizedAppId).pipe(
      map(response => {
        if (response?.errors?.length) {
          return this.createEmptyCatalog(normalizedAppId);
        }

        const rawTree = Array.isArray(response?.data) ? response.data : [];
        const scopedTree = this.dynamicSubjectAccess.filterByTopParent(rawTree);
        return this.buildCatalog(normalizedAppId, scopedTree);
      }),
      catchError(() => of(this.createEmptyCatalog(normalizedAppId))),
      shareReplay({ bufferSize: 1, refCount: false })
    );

    this.cache.set(normalizedAppId, stream$);
    return stream$;
  }

  listCreatableCategories(appId?: string | null): Observable<ReadonlyArray<DynamicSubjectCategoryCatalogEntry>> {
    return this.getCatalog(appId).pipe(
      map(catalog => catalog.creatableEntries)
    );
  }

  resolveCategory(
    categoryId: number,
    appId?: string | null
  ): Observable<DynamicSubjectCategoryCatalogEntry | null> {
    const normalizedCategoryId = Number(categoryId ?? 0);
    if (!Number.isFinite(normalizedCategoryId) || normalizedCategoryId <= 0) {
      return of(null);
    }

    return this.getCatalog(appId).pipe(
      map(catalog => catalog.byId.get(Math.trunc(normalizedCategoryId)) ?? null)
    );
  }

  invalidate(appId?: string | null): void {
    const normalizedAppId = this.normalizeAppId(appId);
    this.cache.delete(normalizedAppId);
  }

  private buildCatalog(appId: string, tree: ReadonlyArray<SubjectCategoryTreeNodeDto>): DynamicSubjectCategoryCatalog {
    const entries: DynamicSubjectCategoryCatalogEntry[] = [];
    const byId = new Map<number, DynamicSubjectCategoryCatalogEntry>();

    const walk = (
      nodes: ReadonlyArray<SubjectCategoryTreeNodeDto>,
      pathIds: number[],
      pathLabels: string[],
      depth: number
    ): void => {
      for (const node of nodes ?? []) {
        const categoryId = Number(node.categoryId ?? 0);
        const categoryName = String(node.categoryName ?? '').trim();
        if (categoryId <= 0 || categoryName.length === 0) {
          continue;
        }

        const nextPathIds = [...pathIds, categoryId];
        const nextPathLabels = [...pathLabels, categoryName];

        const entry: DynamicSubjectCategoryCatalogEntry = {
          categoryId,
          parentCategoryId: Number(node.parentCategoryId ?? 0),
          categoryName,
          applicationId: this.normalizeNullable(node.applicationId),
          canCreate: node.canCreate === true,
          hasDynamicFields: node.hasDynamicFields === true,
          isActive: node.isActive !== false,
          displayOrder: Number(node.displayOrder ?? 0),
          depth,
          pathIds: nextPathIds,
          pathLabels: nextPathLabels,
          pathLabel: nextPathLabels.join(' / ')
        };

        entries.push(entry);
        byId.set(entry.categoryId, entry);

        if (Array.isArray(node.children) && node.children.length > 0) {
          walk(node.children, nextPathIds, nextPathLabels, depth + 1);
        }
      }
    };

    walk(tree ?? [], [], [], 0);

    const sortedEntries = [...entries].sort((left, right) =>
      left.pathLabel.localeCompare(right.pathLabel, 'ar')
      || left.displayOrder - right.displayOrder
      || left.categoryId - right.categoryId
    );

    const creatableEntries = sortedEntries.filter(item => item.canCreate);

    return {
      appId,
      tree: tree ?? [],
      entries: sortedEntries,
      creatableEntries,
      byId
    };
  }

  private createEmptyCatalog(appId: string): DynamicSubjectCategoryCatalog {
    return {
      appId,
      tree: [],
      entries: [],
      creatableEntries: [],
      byId: new Map<number, DynamicSubjectCategoryCatalogEntry>()
    };
  }

  private normalizeAppId(value: unknown): string {
    const normalized = String(value ?? '').trim();
    if (normalized.length > 0) {
      return normalized;
    }

    return this.dynamicSubjectAccess.getApplicationId();
  }

  private normalizeNullable(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : null;
  }
}
