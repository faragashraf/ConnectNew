import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  RequestRuntimeCatalogDto,
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

  constructor(private readonly http: HttpClient) {}

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
    context?: { stageId?: number | null; documentDirection?: string | null }
  ): Observable<RuntimeApiResponse<RequestRuntimeFormDefinitionDto>> {
    let params = new HttpParams();
    const normalizedStageId = Number(context?.stageId ?? 0);
    const normalizedDirection = String(context?.documentDirection ?? '').trim();

    if (normalizedStageId > 0) {
      params = params.set('stageId', String(normalizedStageId));
    }

    if (normalizedDirection.length > 0) {
      params = params.set('documentDirection', normalizedDirection);
    }

    return this.http.get<RuntimeApiResponse<RequestRuntimeFormDefinitionDto>>(
      `${this.dynamicSubjectsBaseUrl}/FormDefinition/${categoryId}`,
      { params }
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
}
