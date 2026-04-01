import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { FileParameter } from '../dto-shared';
import {
  AdminUnitFreezeCreatePayload,
  AdminUnitFreezeListQuery,
  SummerAdminActionRequest,
  SummerAdminDashboardDto,
  SummerCreateEditTokenRequest,
  SummerEditTokenResolutionDto,
  SummerPricingCatalogDto,
  SummerPricingCatalogUpsertRequest,
  SummerAdminRequestsQuery,
  SummerUnitFreezeCreateRequest,
  SummerUnitFreezeDetailsDto,
  SummerUnitFreezeDto,
  SummerUnitFreezeQuery,
  SummerUnitFreezeReleaseRequest,
  SummerUnitsAvailableCountDto,
  SummerUnitsAvailableCountQuery,
  SummerCancelFormRequest,
  SummerPricingQuoteDto,
  SummerPricingQuoteRequest,
  SummerPayFormRequest,
  SummerRequestSummaryDto,
  SummerWaveBookingsPrintReportDto,
  SummerTransferFormRequest,
  SummerWaveCapacityDto,
  SummerWorkflowCommonResponse
} from './SummerWorkflow.dto';

@Injectable({ providedIn: 'root' })
export class SummerWorkflowController {
  private readonly baseUrl = `${environment.ConnectApiURL}/api/SummerWorkflow`;

  constructor(private readonly http: HttpClient) {}

  getMyRequests(seasonYear: number, messageId?: number | null): Observable<SummerWorkflowCommonResponse<SummerRequestSummaryDto[]>> {
    let params = new HttpParams().set('seasonYear', String(seasonYear));
    if (messageId && messageId > 0) {
      params = params.set('messageId', String(messageId));
    }
    return this.http.get<SummerWorkflowCommonResponse<SummerRequestSummaryDto[]>>(`${this.baseUrl}/GetMyRequests`, { params });
  }

  createEditToken(body: SummerCreateEditTokenRequest): Observable<SummerWorkflowCommonResponse<string>> {
    return this.http.post<SummerWorkflowCommonResponse<string>>(`${this.baseUrl}/CreateEditToken`, body);
  }

  resolveEditToken(token: string): Observable<SummerWorkflowCommonResponse<SummerEditTokenResolutionDto>> {
    const params = new HttpParams().set('token', token);
    return this.http.get<SummerWorkflowCommonResponse<SummerEditTokenResolutionDto>>(`${this.baseUrl}/ResolveEditToken`, { params });
  }

  getWaveCapacity(
    categoryId: number,
    waveCode: string,
    includeFrozenUnits = false
  ): Observable<SummerWorkflowCommonResponse<SummerWaveCapacityDto[]>> {
    const params = new HttpParams()
      .set('categoryId', String(categoryId))
      .set('waveCode', waveCode)
      .set('includeFrozenUnits', String(Boolean(includeFrozenUnits)));
    return this.http.get<SummerWorkflowCommonResponse<SummerWaveCapacityDto[]>>(`${this.baseUrl}/GetWaveCapacity`, { params });
  }

  getWaveBookingsPrintReport(
    categoryId: number,
    waveCode: string,
    seasonYear: number
  ): Observable<SummerWorkflowCommonResponse<SummerWaveBookingsPrintReportDto>> {
    const params = new HttpParams()
      .set('categoryId', String(categoryId))
      .set('waveCode', waveCode)
      .set('seasonYear', String(seasonYear));
    return this.http.get<SummerWorkflowCommonResponse<SummerWaveBookingsPrintReportDto>>(
      `${this.baseUrl}/GetWaveBookingsPrintReport`,
      { params }
    );
  }

  getPricingQuote(body: SummerPricingQuoteRequest): Observable<SummerWorkflowCommonResponse<SummerPricingQuoteDto>> {
    return this.http.post<SummerWorkflowCommonResponse<SummerPricingQuoteDto>>(`${this.baseUrl}/GetPricingQuote`, body);
  }

  getPricingCatalog(seasonYear: number): Observable<SummerWorkflowCommonResponse<SummerPricingCatalogDto>> {
    const params = new HttpParams()
      .set('seasonYear', String(seasonYear))
      .set('_ts', String(Date.now()));
    return this.http.get<SummerWorkflowCommonResponse<SummerPricingCatalogDto>>(`${this.baseUrl}/GetPricingCatalog`, { params });
  }

  savePricingCatalog(body: SummerPricingCatalogUpsertRequest): Observable<SummerWorkflowCommonResponse<SummerPricingCatalogDto>> {
    return this.http.post<SummerWorkflowCommonResponse<SummerPricingCatalogDto>>(`${this.baseUrl}/SavePricingCatalog`, body);
  }

  getAdminRequests(query: SummerAdminRequestsQuery): Observable<SummerWorkflowCommonResponse<SummerRequestSummaryDto[]>> {
    let params = new HttpParams()
      .set('seasonYear', String(query.seasonYear))
      .set('pageNumber', String(query.pageNumber))
      .set('pageSize', String(query.pageSize));

    if (query.messageId && query.messageId > 0) {
      params = params.set('messageId', String(query.messageId));
    }
    if (query.categoryId && query.categoryId > 0) {
      params = params.set('categoryId', String(query.categoryId));
    }
    if (query.waveCode) {
      params = params.set('waveCode', query.waveCode);
    }
    if (query.status) {
      params = params.set('status', query.status);
    }
    if (query.paymentState) {
      params = params.set('paymentState', query.paymentState);
    }
    if (query.employeeId) {
      params = params.set('employeeId', query.employeeId);
    }
    if (query.search) {
      params = params.set('search', query.search);
    }

    return this.http.get<SummerWorkflowCommonResponse<SummerRequestSummaryDto[]>>(`${this.baseUrl}/GetAdminRequests`, { params });
  }

  getAdminDashboard(
    seasonYear: number,
    categoryId?: number | null,
    waveCode?: string
  ): Observable<SummerWorkflowCommonResponse<SummerAdminDashboardDto>> {
    let params = new HttpParams().set('seasonYear', String(seasonYear));
    if (categoryId && categoryId > 0) {
      params = params.set('categoryId', String(categoryId));
    }
    if (waveCode) {
      params = params.set('waveCode', waveCode);
    }
    return this.http.get<SummerWorkflowCommonResponse<SummerAdminDashboardDto>>(`${this.baseUrl}/GetAdminDashboard`, { params });
  }

  cancel(body: SummerCancelFormRequest): Observable<SummerWorkflowCommonResponse<SummerRequestSummaryDto>> {
    const formData = new FormData();
    formData.append('MessageId', String(body.messageId));
    formData.append('Reason', body.reason ?? '');
    this.appendFiles(formData, body.files);
    return this.http.post<SummerWorkflowCommonResponse<SummerRequestSummaryDto>>(`${this.baseUrl}/Cancel`, formData);
  }

  pay(body: SummerPayFormRequest): Observable<SummerWorkflowCommonResponse<SummerRequestSummaryDto>> {
    const formData = new FormData();
    formData.append('MessageId', String(body.messageId));
    if (body.paidAtUtc) {
      formData.append('PaidAtUtc', body.paidAtUtc);
    }
    formData.append('ForceOverride', String(body.forceOverride));
    formData.append('Notes', body.notes ?? '');
    this.appendFiles(formData, body.files);
    return this.http.post<SummerWorkflowCommonResponse<SummerRequestSummaryDto>>(`${this.baseUrl}/Pay`, formData);
  }

  transfer(body: SummerTransferFormRequest): Observable<SummerWorkflowCommonResponse<SummerRequestSummaryDto>> {
    const formData = new FormData();
    formData.append('MessageId', String(body.messageId));
    formData.append('ToCategoryId', String(body.toCategoryId));
    formData.append('ToWaveCode', body.toWaveCode);
    if (body.newFamilyCount !== null && body.newFamilyCount !== undefined) {
      formData.append('NewFamilyCount', String(body.newFamilyCount));
    }
    if (body.newExtraCount !== null && body.newExtraCount !== undefined) {
      formData.append('NewExtraCount', String(body.newExtraCount));
    }
    formData.append('Notes', body.notes ?? '');
    this.appendFiles(formData, body.files);
    return this.http.post<SummerWorkflowCommonResponse<SummerRequestSummaryDto>>(`${this.baseUrl}/Transfer`, formData);
  }

  executeAdminAction(body: SummerAdminActionRequest): Observable<SummerWorkflowCommonResponse<SummerRequestSummaryDto>> {
    const formData = new FormData();
    formData.append('MessageId', String(body.messageId));
    formData.append('ActionCode', body.actionCode);
    formData.append('Comment', body.comment ?? '');
    formData.append('Force', String(Boolean(body.force)));
    if (body.toCategoryId !== null && body.toCategoryId !== undefined) {
      formData.append('ToCategoryId', String(body.toCategoryId));
    }
    if (body.toWaveCode) {
      formData.append('ToWaveCode', body.toWaveCode);
    }
    if (body.newFamilyCount !== null && body.newFamilyCount !== undefined) {
      formData.append('NewFamilyCount', String(body.newFamilyCount));
    }
    if (body.newExtraCount !== null && body.newExtraCount !== undefined) {
      formData.append('NewExtraCount', String(body.newExtraCount));
    }
    this.appendFiles(formData, body.files);
    return this.http.post<SummerWorkflowCommonResponse<SummerRequestSummaryDto>>(`${this.baseUrl}/ExecuteAdminAction`, formData);
  }

  getUnitFreezes(query: SummerUnitFreezeQuery): Observable<SummerWorkflowCommonResponse<SummerUnitFreezeDto[]>> {
    let params = new HttpParams();
    if (query?.categoryId && query.categoryId > 0) {
      params = params.set('categoryId', String(query.categoryId));
    }
    if (query?.waveCode) {
      params = params.set('waveCode', query.waveCode);
    }
    if (query?.familyCount && query.familyCount > 0) {
      params = params.set('familyCount', String(query.familyCount));
    }
    if (query?.isActive !== null && query?.isActive !== undefined) {
      params = params.set('isActive', String(query.isActive));
    }

    return this.http.get<SummerWorkflowCommonResponse<SummerUnitFreezeDto[]>>(`${this.baseUrl}/GetUnitFreezes`, { params });
  }

  getUnitFreezeDetails(freezeId: number): Observable<SummerWorkflowCommonResponse<SummerUnitFreezeDetailsDto>> {
    const params = new HttpParams().set('freezeId', String(freezeId));
    return this.http.get<SummerWorkflowCommonResponse<SummerUnitFreezeDetailsDto>>(`${this.baseUrl}/GetUnitFreezeDetails`, { params });
  }

  createUnitFreeze(body: SummerUnitFreezeCreateRequest): Observable<SummerWorkflowCommonResponse<SummerUnitFreezeDto>> {
    return this.http.post<SummerWorkflowCommonResponse<SummerUnitFreezeDto>>(`${this.baseUrl}/CreateUnitFreeze`, body);
  }

  releaseUnitFreeze(body: SummerUnitFreezeReleaseRequest): Observable<SummerWorkflowCommonResponse<SummerUnitFreezeDto>> {
    return this.http.post<SummerWorkflowCommonResponse<SummerUnitFreezeDto>>(`${this.baseUrl}/ReleaseUnitFreeze`, body);
  }

  getAdminAvailableCount(query: SummerUnitsAvailableCountQuery): Observable<SummerWorkflowCommonResponse<SummerUnitsAvailableCountDto>> {
    let params = new HttpParams()
      .set('resortId', String(query.resortId))
      .set('waveId', query.waveId)
      .set('capacity', String(query.capacity));
    if (query.includeFrozenUnits !== null && query.includeFrozenUnits !== undefined) {
      params = params.set('includeFrozenUnits', String(Boolean(query.includeFrozenUnits)));
    }
    return this.http.get<SummerWorkflowCommonResponse<SummerUnitsAvailableCountDto>>(`${environment.ConnectApiURL}/api/admin/units/available-count`, { params });
  }

  getAdminUnitFreezes(query: AdminUnitFreezeListQuery): Observable<SummerWorkflowCommonResponse<SummerUnitFreezeDto[]>> {
    let params = new HttpParams();
    if (query?.resortId && query.resortId > 0) {
      params = params.set('resortId', String(query.resortId));
    }
    if (query?.waveId) {
      params = params.set('waveId', query.waveId);
    }
    if (query?.capacity && query.capacity > 0) {
      params = params.set('capacity', String(query.capacity));
    }
    if (query?.isActive !== null && query?.isActive !== undefined) {
      params = params.set('isActive', String(Boolean(query.isActive)));
    }
    return this.http.get<SummerWorkflowCommonResponse<SummerUnitFreezeDto[]>>(`${environment.ConnectApiURL}/api/admin/unit-freeze`, { params });
  }

  createAdminUnitFreeze(body: AdminUnitFreezeCreatePayload): Observable<SummerWorkflowCommonResponse<SummerUnitFreezeDto>> {
    return this.http.post<SummerWorkflowCommonResponse<SummerUnitFreezeDto>>(`${environment.ConnectApiURL}/api/admin/unit-freeze`, body);
  }

  getAdminUnitFreezeDetails(freezeId: number): Observable<SummerWorkflowCommonResponse<SummerUnitFreezeDetailsDto>> {
    return this.http.get<SummerWorkflowCommonResponse<SummerUnitFreezeDetailsDto>>(`${environment.ConnectApiURL}/api/admin/unit-freeze/${freezeId}`);
  }

  releaseAdminUnitFreeze(freezeId: number): Observable<SummerWorkflowCommonResponse<SummerUnitFreezeDto>> {
    return this.http.post<SummerWorkflowCommonResponse<SummerUnitFreezeDto>>(`${environment.ConnectApiURL}/api/admin/unit-freeze/${freezeId}/release`, {});
  }

  private appendFiles(formData: FormData, files?: FileParameter[]): void {
    (files ?? []).forEach(file => {
      formData.append('files', file.data, file.fileName || file.data.name || 'attachment');
    });
  }
}
