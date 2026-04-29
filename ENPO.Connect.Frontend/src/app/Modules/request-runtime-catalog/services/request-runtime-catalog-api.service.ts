import { HttpBackend, HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { PowerBiController } from 'src/app/shared/services/BackendServices/PowerBi/PowerBi.service';
import { environment } from 'src/environments/environment';
import {
  RequestRuntimeAdminGroupTreeNodeDto,
  RequestRuntimeCatalogDto,
  RequestRuntimeDynamicResolvedExternalRequest,
  RequestRuntimeDynamicHttpRequestConfig,
  RequestRuntimeDynamicHttpMethod,
  RequestRuntimeDynamicResolvedPowerBiRequest,
  RequestRuntimeDynamicRequestFormat,
  RequestRuntimeEnvelopeDetailDto,
  RequestRuntimeEnvelopeUpsertRequestDto,
  RequestRuntimeFormDefinitionDto,
  RequestRuntimePagedEnvelopeListDto,
  RequestRuntimeSubjectUpsertRequestDto,
  RequestRuntimeSubjectDetailDto,
  RuntimeApiResponse
} from '../models/request-runtime-catalog.models';

@Injectable()
export class RequestRuntimeCatalogApiService {
  private readonly runtimeCatalogBaseUrl = `${environment.ConnectApiURL}/api/RequestRuntimeCatalog`;
  private readonly dynamicSubjectsBaseUrl = `${environment.ConnectApiURL}/api/DynamicSubjects`;
  private readonly dynamicSubjectsAdminCatalogBaseUrl = `${environment.ConnectApiURL}/api/DynamicSubjectsAdminCatalog`;
  private readonly rawHttp: HttpClient;

  constructor(
    private readonly http: HttpClient,
    httpBackend: HttpBackend,
    private readonly powerBiController: PowerBiController
  ) {
    this.rawHttp = new HttpClient(httpBackend);
  }

  getRegistrationTree(appId?: string | null): Observable<RuntimeApiResponse<RequestRuntimeCatalogDto>> {
    let params = new HttpParams();
    const normalizedAppId = String(appId ?? '').trim();
    if (normalizedAppId.length > 0) {
      params = params.set('appId', normalizedAppId);
    }

    return this.http.get<RuntimeApiResponse<RequestRuntimeCatalogDto>>(`${this.runtimeCatalogBaseUrl}/RegistrationTree`, { params });
  }

  getFormDefinition(
    categoryId: number,
    context?: { stageId?: number | null; documentDirection?: string | null; appId?: string | null }
  ): Observable<RuntimeApiResponse<RequestRuntimeFormDefinitionDto>> {
    let params = new HttpParams();
    const normalizedStageId = Number(context?.stageId ?? 0);
    const normalizedDirection = String(context?.documentDirection ?? '').trim();
    const normalizedAppId = String(context?.appId ?? '').trim();

    if (normalizedStageId > 0) {
      params = params.set('stageId', String(normalizedStageId));
    }

    if (normalizedDirection.length > 0) {
      params = params.set('documentDirection', normalizedDirection);
    }

    if (normalizedAppId.length > 0) {
      params = params.set('appId', normalizedAppId);
    }

    return this.http.get<RuntimeApiResponse<RequestRuntimeFormDefinitionDto>>(
      `${this.dynamicSubjectsBaseUrl}/FormDefinition/${categoryId}`,
      { params }
    );
  }

  getCategoryGroups(categoryId: number): Observable<RuntimeApiResponse<RequestRuntimeAdminGroupTreeNodeDto[]>> {
    return this.http.get<RuntimeApiResponse<RequestRuntimeAdminGroupTreeNodeDto[]>>(
      `${this.dynamicSubjectsAdminCatalogBaseUrl}/Categories/${categoryId}/Groups`
    );
  }

  listEnvelopes(query?: {
    searchText?: string | null;
    pageNumber?: number | null;
    pageSize?: number | null;
  }): Observable<RuntimeApiResponse<RequestRuntimePagedEnvelopeListDto>> {
    let params = new HttpParams()
      .set('pageNumber', String(Number(query?.pageNumber ?? 1) > 0 ? Number(query?.pageNumber ?? 1) : 1))
      .set('pageSize', String(Number(query?.pageSize ?? 100) > 0 ? Number(query?.pageSize ?? 100) : 100));

    const normalizedSearch = String(query?.searchText ?? '').trim();
    if (normalizedSearch.length > 0) {
      params = params.set('searchText', normalizedSearch);
    }

    return this.http.get<RuntimeApiResponse<RequestRuntimePagedEnvelopeListDto>>(
      `${this.dynamicSubjectsBaseUrl}/Envelopes`,
      { params }
    );
  }

  createEnvelope(
    request: RequestRuntimeEnvelopeUpsertRequestDto
  ): Observable<RuntimeApiResponse<RequestRuntimeEnvelopeDetailDto>> {
    return this.http.post<RuntimeApiResponse<RequestRuntimeEnvelopeDetailDto>>(
      `${this.dynamicSubjectsBaseUrl}/Envelopes`,
      request
    );
  }

  createSubject(request: RequestRuntimeSubjectUpsertRequestDto): Observable<RuntimeApiResponse<RequestRuntimeSubjectDetailDto>> {
    const formData = new FormData();
    formData.append('categoryId', String(request.categoryId));

    const normalizedDocumentDirection = String(request.documentDirection ?? '').trim();
    if (normalizedDocumentDirection.length > 0) {
      formData.append('documentDirection', normalizedDocumentDirection);
    }

    if (Number(request.stageId ?? 0) > 0) {
      formData.append('stageId', String(request.stageId));
    }

    formData.append('subject', String(request.subject ?? ''));
    formData.append('description', String(request.description ?? ''));
    formData.append('saveAsDraft', String(request.saveAsDraft === true));
    formData.append('submit', String(request.submit === true));

    if (Number(request.envelopeId ?? 0) > 0) {
      formData.append('envelopeId', String(request.envelopeId));
    }

    formData.append('dynamicFieldsJson', JSON.stringify(request.dynamicFields ?? []));
    formData.append('stakeholdersJson', JSON.stringify(request.stakeholders ?? []));
    formData.append('tasksJson', JSON.stringify(request.tasks ?? []));

    return this.http.post<RuntimeApiResponse<RequestRuntimeSubjectDetailDto>>(
      `${this.dynamicSubjectsBaseUrl}/Subjects`,
      formData
    );
  }

  executeDynamicRequest(request: RequestRuntimeDynamicHttpRequestConfig): Observable<unknown> {
    return this.executeDynamicExternalRequest({
      fullUrl: request.url,
      method: this.normalizeHttpMethod(request.method),
      requestFormat: 'json',
      authMode: 'bearerCurrent',
      query: request.query,
      headers: request.headers,
      body: request.body
    });
  }

  executeDynamicExternalRequest(request: RequestRuntimeDynamicResolvedExternalRequest): Observable<unknown> {
    const url = this.resolveDynamicRequestUrl(request.fullUrl);
    const method = this.normalizeHttpMethod(request.method);
    const params = this.buildHttpParams(request.query);
    const headers = this.buildHttpHeaders(request.headers, request.requestFormat);
    const client = request.authMode === 'bearerCurrent'
      ? this.http
      : this.rawHttp;

    return client.request(method, url, {
      params,
      headers,
      body: request.body,
      responseType: 'json'
    });
  }

  executeDynamicPowerBiRequest(request: RequestRuntimeDynamicResolvedPowerBiRequest): Observable<unknown> {
    const statementId = Number(request.statementId ?? 0);
    if (!Number.isFinite(statementId) || statementId <= 0) {
      return of(undefined);
    }

    const parametersPayload = JSON.stringify(request.parameters ?? {});
    return this.powerBiController.excuteGenericStatmentById(Math.trunc(statementId), parametersPayload).pipe(
      map(response => this.parsePowerBiResponseData(response?.data))
    );
  }

  private buildHttpParams(record: Record<string, string> | undefined): HttpParams {
    let params = new HttpParams();
    Object.entries(record ?? {}).forEach(([key, value]) => {
      const normalizedKey = String(key ?? '').trim();
      if (!normalizedKey) {
        return;
      }

      params = params.set(normalizedKey, String(value ?? ''));
    });

    return params;
  }

  private buildHttpHeaders(
    record: Record<string, string> | undefined,
    requestFormat: RequestRuntimeDynamicRequestFormat
  ): HttpHeaders {
    let headers = new HttpHeaders();
    const normalizedRecord = record ?? {};
    Object.entries(normalizedRecord).forEach(([key, value]) => {
      const normalizedKey = String(key ?? '').trim();
      if (!normalizedKey) {
        return;
      }

      headers = headers.set(normalizedKey, String(value ?? ''));
    });

    if (!this.hasHeader(normalizedRecord, 'Accept')) {
      headers = headers.set('Accept', requestFormat === 'xml' ? 'application/xml, text/plain, */*' : 'application/json');
    }

    return headers;
  }

  private hasHeader(headers: Record<string, string>, targetName: string): boolean {
    const normalizedTarget = String(targetName ?? '').trim().toLowerCase();
    return Object.keys(headers ?? {}).some(key => String(key ?? '').trim().toLowerCase() === normalizedTarget);
  }

  private parsePowerBiResponseData(payload: unknown): unknown {
    const normalized = String(payload ?? '').trim();
    if (!normalized) {
      return undefined;
    }

    try {
      return JSON.parse(normalized);
    } catch {
      return payload;
    }
  }

  private resolveDynamicRequestUrl(value: string): string {
    const normalized = String(value ?? '').trim();
    if (!normalized) {
      return environment.ConnectApiURL;
    }

    if (/^https?:\/\//i.test(normalized)) {
      return normalized;
    }

    if (normalized.startsWith('/')) {
      return `${environment.ConnectApiURL}${normalized}`;
    }

    return `${environment.ConnectApiURL}/${normalized}`;
  }

  private normalizeHttpMethod(value: unknown): RequestRuntimeDynamicHttpMethod {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (normalized === 'POST' || normalized === 'PUT' || normalized === 'PATCH') {
      return normalized;
    }

    return 'GET';
  }
}
