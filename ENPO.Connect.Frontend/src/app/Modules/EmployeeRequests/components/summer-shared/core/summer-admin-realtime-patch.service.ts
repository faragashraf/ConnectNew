import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { SummerRequestSummaryDto } from 'src/app/shared/services/BackendServices/SummerWorkflow/SummerWorkflow.dto';
import { SummerRequestRealtimeEvent } from './summer-realtime-event.models';
import { SummerRequestRowRefreshService } from './summer-request-row-refresh.service';
import { SummerRequestsListPatchService } from './summer-requests-list-patch.service';

export interface SummerAdminRealtimePatchState {
  requests: SummerRequestSummaryDto[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  selectedRequestId: number | null;
}

export interface SummerAdminRealtimePatchFilters {
  categoryId?: number | null;
  waveCode?: string;
  status?: string;
  paymentState?: string;
  employeeId?: string;
  search?: string;
}

export interface SummerAdminRealtimePatchResult {
  requests: SummerRequestSummaryDto[];
  totalCount: number;
  selectedRequestId: number | null;
  selectedWasRemoved: boolean;
  selectedWasUpdated: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class SummerAdminRealtimePatchService {
  constructor(
    private readonly rowRefreshService: SummerRequestRowRefreshService,
    private readonly listPatchService: SummerRequestsListPatchService
  ) {}

  applyRequestUpdate(
    seasonYear: number,
    update: SummerRequestRealtimeEvent,
    state: SummerAdminRealtimePatchState,
    filters: SummerAdminRealtimePatchFilters
  ): Observable<SummerAdminRealtimePatchResult> {
    const targetMessageId = Number(update?.messageId ?? 0);
    if (!Number.isFinite(targetMessageId) || targetMessageId <= 0) {
      return of(this.toCurrentStateResult(state));
    }

    const existedInCurrentPage = (state.requests ?? [])
      .some(item => Number(item?.messageId ?? 0) === targetMessageId);

    return this.rowRefreshService.refreshAdminRow(seasonYear, targetMessageId, filters).pipe(
      map(matched => this.patchLocalState(state, update, targetMessageId, existedInCurrentPage, matched)),
      catchError(() => of(this.toCurrentStateResult(state)))
    );
  }

  private patchLocalState(
    state: SummerAdminRealtimePatchState,
    update: SummerRequestRealtimeEvent,
    targetMessageId: number,
    existedInCurrentPage: boolean,
    matched: SummerRequestSummaryDto | null
  ): SummerAdminRealtimePatchResult {
    let requests = [...(state.requests ?? [])];
    let totalCount = Math.max(0, Number(state.totalCount ?? 0) || 0);
    let selectedRequestId = state.selectedRequestId;
    let selectedWasRemoved = false;
    let selectedWasUpdated = false;

    if (matched) {
      const patched = this.listPatchService.upsertAdminCurrentPage(
        requests,
        matched,
        state.pageNumber,
        state.pageSize
      );
      requests = patched.items;

      if (patched.change === 'inserted') {
        totalCount += 1;
      } else if (patched.change === 'none' && this.isCreateAction(update.action) && !existedInCurrentPage) {
        totalCount += 1;
      }

      if (selectedRequestId && selectedRequestId === targetMessageId) {
        selectedWasUpdated = true;
      }
    } else {
      const patched = this.listPatchService.removeByMessageId(requests, targetMessageId);
      if (patched.change === 'removed') {
        requests = patched.items;
        totalCount = Math.max(0, totalCount - 1);
      }

      if (selectedRequestId && selectedRequestId === targetMessageId) {
        selectedRequestId = null;
        selectedWasRemoved = true;
      }
    }

    return {
      requests,
      totalCount,
      selectedRequestId,
      selectedWasRemoved,
      selectedWasUpdated
    };
  }

  private isCreateAction(action: unknown): boolean {
    const token = String(action ?? '').trim().toUpperCase();
    return token === 'CREATE' || token === 'NEW' || token === 'INSERT';
  }

  private toCurrentStateResult(state: SummerAdminRealtimePatchState): SummerAdminRealtimePatchResult {
    return {
      requests: [...(state.requests ?? [])],
      totalCount: Math.max(0, Number(state.totalCount ?? 0) || 0),
      selectedRequestId: state.selectedRequestId,
      selectedWasRemoved: false,
      selectedWasUpdated: false
    };
  }
}
