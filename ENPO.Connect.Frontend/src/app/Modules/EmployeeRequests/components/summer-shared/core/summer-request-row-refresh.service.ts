import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import {
  SummerAdminRequestsQuery,
  SummerRequestSummaryDto
} from 'src/app/shared/services/BackendServices/SummerWorkflow/SummerWorkflow.dto';
import { SummerWorkflowController } from 'src/app/shared/services/BackendServices/SummerWorkflow/SummerWorkflow.service';

@Injectable({
  providedIn: 'root'
})
export class SummerRequestRowRefreshService {
  constructor(private readonly summerWorkflowController: SummerWorkflowController) {}

  refreshOwnerRow(seasonYear: number, messageId: number): Observable<SummerRequestSummaryDto | null> {
    const targetId = Number(messageId ?? 0);
    if (!Number.isFinite(targetId) || targetId <= 0) {
      return of(null);
    }

    return this.summerWorkflowController.getMyRequests(seasonYear, targetId).pipe(
      map(response => {
        const records = response?.isSuccess && Array.isArray(response?.data) ? response.data : [];
        return records.find(item => Number(item?.messageId ?? 0) === targetId) ?? null;
      }),
      catchError(() => of(null))
    );
  }

  refreshAdminRow(
    seasonYear: number,
    messageId: number,
    filters: {
      categoryId?: number | null;
      waveCode?: string;
      status?: string;
      paymentState?: string;
      employeeId?: string;
      search?: string;
    }
  ): Observable<SummerRequestSummaryDto | null> {
    const targetId = Number(messageId ?? 0);
    if (!Number.isFinite(targetId) || targetId <= 0) {
      return of(null);
    }

    const query: SummerAdminRequestsQuery = {
      seasonYear,
      messageId: targetId,
      categoryId: filters.categoryId ?? null,
      waveCode: String(filters.waveCode ?? '').trim(),
      status: String(filters.status ?? '').trim(),
      paymentState: String(filters.paymentState ?? '').trim(),
      employeeId: String(filters.employeeId ?? '').trim(),
      search: String(filters.search ?? '').trim(),
      pageNumber: 1,
      pageSize: 1
    };

    return this.summerWorkflowController.getAdminRequests(query).pipe(
      map(response => {
        const records = response?.isSuccess && Array.isArray(response?.data) ? response.data : [];
        return records.find(item => Number(item?.messageId ?? 0) === targetId) ?? null;
      }),
      catchError(() => of(null))
    );
  }
}
