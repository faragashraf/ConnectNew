import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import {
  RequestRuntimeAdminGroupTreeNodeDto,
  RequestRuntimeApplicationOption,
  RequestRuntimeCatalogApplicationDto,
  RequestRuntimeCatalogDto,
  RequestRuntimeCatalogNodeDto,
  RequestRuntimeDynamicHttpRequestConfig,
  RequestRuntimeEnvelopeDetailDto,
  RequestRuntimeEnvelopeUpsertRequestDto,
  RequestRuntimeFormDefinitionDto,
  RequestRuntimePagedEnvelopeListDto,
  RequestRuntimeSubjectDetailDto,
  RequestRuntimeSubjectUpsertRequestDto,
  RequestRuntimeTreeNode,
  resolveEnvelopeDisplayName,
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

  loadFormDefinition(
    categoryId: number,
    context?: { stageId?: number | null; documentDirection?: string | null; appId?: string | null }
  ): Observable<RuntimeApiResponse<RequestRuntimeFormDefinitionDto>> {
    return this.api.getFormDefinition(categoryId, context).pipe(
      switchMap(response => {
        const hasErrors = (response?.errors?.length ?? 0) > 0;
        const hasFields = Number(response?.data?.fields?.length ?? 0) > 0;
        const shouldRetryWithoutAppScope = (hasErrors || !hasFields) && String(context?.appId ?? '').trim().length > 0;

        if (!shouldRetryWithoutAppScope) {
          return of({
            data: response?.data as RequestRuntimeFormDefinitionDto,
            errors: response?.errors ?? []
          });
        }

        return this.api.getFormDefinition(categoryId, {
          stageId: context?.stageId,
          documentDirection: context?.documentDirection,
          appId: null
        }).pipe(
          map(fallbackResponse => ({
            data: fallbackResponse?.data as RequestRuntimeFormDefinitionDto,
            errors: fallbackResponse?.errors ?? []
          }))
        );
      }),
      catchError(() => of({
        data: undefined,
        errors: [{ message: 'تعذر تحميل نموذج الطلب في الوقت الحالي.' }]
      }))
    );
  }

  loadCategoryGroups(categoryId: number): Observable<RuntimeApiResponse<RequestRuntimeAdminGroupTreeNodeDto[]>> {
    return this.api.getCategoryGroups(categoryId).pipe(
      map(response => ({
        data: response?.data ?? [],
        errors: response?.errors ?? []
      })),
      catchError(() => of({
        data: [],
        errors: []
      }))
    );
  }

  loadEnvelopes(searchText?: string | null): Observable<RuntimeApiResponse<RequestRuntimePagedEnvelopeListDto>> {
    return this.api.listEnvelopes({
      searchText,
      pageNumber: 1,
      pageSize: 200
    }).pipe(
      map(response => ({
        data: response?.data ?? {
          totalCount: 0,
          pageNumber: 1,
          pageSize: 200,
          items: []
        },
        errors: response?.errors ?? []
      })),
      catchError(() => of({
        data: {
          totalCount: 0,
          pageNumber: 1,
          pageSize: 200,
          items: []
        },
        errors: [{ message: 'تعذر تحميل القائمة المطلوبة حاليًا.' }]
      }))
    );
  }

  createEnvelope(
    request: RequestRuntimeEnvelopeUpsertRequestDto
  ): Observable<RuntimeApiResponse<RequestRuntimeEnvelopeDetailDto>> {
    return this.api.createEnvelope(request).pipe(
      map(response => ({
        data: response?.data as RequestRuntimeEnvelopeDetailDto,
        errors: response?.errors ?? []
      })),
      catchError(() => of({
        data: undefined,
        errors: [{ message: 'تعذر تنفيذ عملية الإضافة في الوقت الحالي.' }]
      }))
    );
  }

  createSubject(
    request: RequestRuntimeSubjectUpsertRequestDto
  ): Observable<RuntimeApiResponse<RequestRuntimeSubjectDetailDto>> {
    return this.api.createSubject(request).pipe(
      map(response => ({
        data: response?.data as RequestRuntimeSubjectDetailDto,
        errors: response?.errors ?? []
      })),
      catchError(() => of({
        data: undefined,
        errors: [{ message: 'تعذر تسجيل الطلب في الوقت الحالي.' }]
      }))
    );
  }

  executeDynamicRequest(
    request: RequestRuntimeDynamicHttpRequestConfig
  ): Observable<RuntimeApiResponse<unknown>> {
    return this.api.executeDynamicRequest(request).pipe(
      map(response => ({
        data: response,
        errors: []
      })),
      catchError(() => of({
        data: undefined,
        errors: [{ message: 'تعذر تنفيذ التكامل الخارجي للحقل المطلوب.' }]
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
        startStageId: Number(node.startStage?.stageId ?? 0) > 0 ? Number(node.startStage?.stageId ?? 0) : null,
        startStageName,
        envelopeDisplayName: resolveEnvelopeDisplayName(node.envelopeDisplayName),
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
