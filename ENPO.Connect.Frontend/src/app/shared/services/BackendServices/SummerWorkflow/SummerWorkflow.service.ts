import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { FileParameter } from '../dto-shared';
import {
  SummerAdminActionRequest,
  SummerAdminDashboardDto,
  SummerAdminRequestsQuery,
  SummerCancelFormRequest,
  SummerPayFormRequest,
  SummerRequestSummaryDto,
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

  getWaveCapacity(categoryId: number, waveCode: string): Observable<SummerWorkflowCommonResponse<SummerWaveCapacityDto[]>> {
    const params = new HttpParams()
      .set('categoryId', String(categoryId))
      .set('waveCode', waveCode);
    return this.http.get<SummerWorkflowCommonResponse<SummerWaveCapacityDto[]>>(`${this.baseUrl}/GetWaveCapacity`, { params });
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

  private appendFiles(formData: FormData, files?: FileParameter[]): void {
    (files ?? []).forEach(file => {
      formData.append('files', file.data, file.fileName || file.data.name || 'attachment');
    });
  }
}
