import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import {
  RequestRuntimeApplicationOption,
  RequestRuntimeCatalogApplicationDto,
  RequestRuntimeCatalogDto,
  RequestRuntimeCatalogNodeDto,
  RequestRuntimeTreeNode,
  REQUEST_RUNTIME_ALL_APPLICATIONS_VALUE,
  RuntimeApiResponse,
  createEmptyRuntimeCatalog
} from '../models/request-runtime-catalog.models';
import { RequestRuntimeCatalogApiService } from './request-runtime-catalog-api.service';

@Injectable()
export class RequestRuntimeCatalogFacadeService {
  constructor(private readonly api: RequestRuntimeCatalogApiService) {}

  loadCatalog(appId?: string | null): Observable<RuntimeApiResponse<RequestRuntimeCatalogDto>> {
    return this.api.getRegistrationTree(appId).pipe(
      map(response => ({
        data: response?.data ?? createEmptyRuntimeCatalog(),
        errors: response?.errors ?? []
      })),
      catchError(() => of({
        data: createEmptyRuntimeCatalog(),
        errors: [{ message: 'تعذر تحميل شجرة الطلبات المتاحة في الوقت الحالي.' }]
      }))
    );
  }

  buildApplicationOptions(catalog: RequestRuntimeCatalogDto): RequestRuntimeApplicationOption[] {
    const appOptions = (catalog?.applications ?? [])
      .map(app => ({
        label: this.normalizeApplicationLabel(app),
        value: this.normalizeApplicationId(app.applicationId)
      }))
      .sort((left, right) => left.label.localeCompare(right.label, 'ar'));

    return [
      { label: 'كل التطبيقات', value: REQUEST_RUNTIME_ALL_APPLICATIONS_VALUE },
      ...appOptions
    ];
  }

  buildTreeNodes(
    catalog: RequestRuntimeCatalogDto,
    selectedApplicationId: string,
    searchText: string
  ): RequestRuntimeTreeNode[] {
    const selectedApplications = this.resolveSelectedApplications(catalog, selectedApplicationId);

    const mappedTree = selectedApplications.flatMap(application =>
      (application.categories ?? [])
        .map(category => this.mapNode(category, this.normalizeApplicationId(application.applicationId)))
        .filter((node): node is RequestRuntimeTreeNode => node != null)
    );

    return this.applySearchFilter(mappedTree, searchText);
  }

  countVisibleStartableRequests(nodes: RequestRuntimeTreeNode[]): number {
    let total = 0;

    const walk = (items: RequestRuntimeTreeNode[]): void => {
      (items ?? []).forEach(item => {
        if (item?.data?.canStart) {
          total += 1;
        }

        walk((item.children ?? []) as RequestRuntimeTreeNode[]);
      });
    };

    walk(nodes ?? []);
    return total;
  }

  countTotalStartableRequests(catalog: RequestRuntimeCatalogDto, selectedApplicationId: string): number {
    const selectedApplications = this.resolveSelectedApplications(catalog, selectedApplicationId);
    return selectedApplications.reduce((sum, application) => sum + Number(application.totalAvailableRequests ?? 0), 0);
  }

  private resolveSelectedApplications(
    catalog: RequestRuntimeCatalogDto,
    selectedApplicationId: string
  ): RequestRuntimeCatalogApplicationDto[] {
    const applications = catalog?.applications ?? [];
    const normalizedSelected = this.normalizeSelectionValue(selectedApplicationId);

    if (normalizedSelected === REQUEST_RUNTIME_ALL_APPLICATIONS_VALUE) {
      return applications;
    }

    return applications.filter(application =>
      this.normalizeApplicationId(application.applicationId) === normalizedSelected
    );
  }

  private mapNode(node: RequestRuntimeCatalogNodeDto, applicationId: string): RequestRuntimeTreeNode | null {
    const categoryId = Number(node?.categoryId ?? 0);
    const label = String(node?.categoryName ?? '').trim();
    if (categoryId <= 0 || label.length === 0) {
      return null;
    }

    const children = (node.children ?? [])
      .map(child => this.mapNode(child, applicationId))
      .filter((child): child is RequestRuntimeTreeNode => child != null);

    if (!node.canStart && children.length === 0) {
      return null;
    }

    const startStageName = this.normalizeNullable(node.startStage?.stageName);
    const organizationalScopeLabel = this.normalizeNullable(node.organizationalUnitScope?.scopeLabel);

    return {
      key: `${applicationId}-${categoryId}`,
      label,
      expanded: true,
      selectable: node.canStart,
      styleClass: node.canStart ? 'runtime-startable-node' : 'runtime-parent-node',
      data: {
        categoryId,
        categoryName: label,
        canStart: node.canStart === true,
        isRequestType: node.isRequestType === true,
        applicationId,
        startStageName,
        organizationalScopeLabel,
        reasons: Array.isArray(node.availabilityReasons) ? node.availabilityReasons : []
      },
      children
    };
  }

  private applySearchFilter(nodes: RequestRuntimeTreeNode[], searchText: string): RequestRuntimeTreeNode[] {
    const normalizedSearch = this.normalizeNullable(searchText)?.toLowerCase();
    if (!normalizedSearch) {
      return nodes;
    }

    const filterNode = (node: RequestRuntimeTreeNode): RequestRuntimeTreeNode | null => {
      const children = ((node.children ?? []) as RequestRuntimeTreeNode[])
        .map(child => filterNode(child))
        .filter((child): child is RequestRuntimeTreeNode => child != null);

      const matchesNode = this.matchesSearch(node, normalizedSearch);
      if (!matchesNode && children.length === 0) {
        return null;
      }

      return {
        ...node,
        expanded: true,
        children
      };
    };

    return (nodes ?? [])
      .map(node => filterNode(node))
      .filter((node): node is RequestRuntimeTreeNode => node != null);
  }

  private matchesSearch(node: RequestRuntimeTreeNode, normalizedSearch: string): boolean {
    const label = String(node.label ?? '').toLowerCase();
    const stageName = String(node.data?.startStageName ?? '').toLowerCase();
    const scopeLabel = String(node.data?.organizationalScopeLabel ?? '').toLowerCase();

    return label.includes(normalizedSearch)
      || stageName.includes(normalizedSearch)
      || scopeLabel.includes(normalizedSearch);
  }

  private normalizeApplicationLabel(application: RequestRuntimeCatalogApplicationDto): string {
    return this.normalizeNullable(application?.applicationName)
      ?? this.normalizeNullable(application?.applicationId)
      ?? 'بدون تطبيق';
  }

  private normalizeSelectionValue(value: string): string {
    const normalized = String(value ?? '').trim();
    if (normalized.length === 0) {
      return REQUEST_RUNTIME_ALL_APPLICATIONS_VALUE;
    }

    return normalized;
  }

  private normalizeApplicationId(value: unknown): string {
    return String(value ?? '').trim();
  }

  private normalizeNullable(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : null;
  }
}
