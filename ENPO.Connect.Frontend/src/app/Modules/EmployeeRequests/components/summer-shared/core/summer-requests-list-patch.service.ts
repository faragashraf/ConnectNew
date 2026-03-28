import { Injectable } from '@angular/core';
import { SummerRequestSummaryDto } from 'src/app/shared/services/BackendServices/SummerWorkflow/SummerWorkflow.dto';

export type SummerListPatchChange = 'none' | 'inserted' | 'updated' | 'removed';

export interface SummerListPatchResult {
  items: SummerRequestSummaryDto[];
  change: SummerListPatchChange;
}

@Injectable({
  providedIn: 'root'
})
export class SummerRequestsListPatchService {
  upsertOwnerRequests(
    current: SummerRequestSummaryDto[],
    incoming: SummerRequestSummaryDto
  ): SummerListPatchResult {
    const targetId = Number(incoming?.messageId ?? 0);
    if (!Number.isFinite(targetId) || targetId <= 0) {
      return { items: [...(current ?? [])], change: 'none' };
    }

    const next = [...(current ?? [])];
    const index = next.findIndex(item => Number(item?.messageId ?? 0) === targetId);
    const change: SummerListPatchChange = index >= 0 ? 'updated' : 'inserted';

    if (index >= 0) {
      next[index] = incoming;
    } else {
      next.unshift(incoming);
    }

    next.sort((a, b) => this.toEpoch(b.createdAt) - this.toEpoch(a.createdAt) || Number(b.messageId ?? 0) - Number(a.messageId ?? 0));
    return { items: next, change };
  }

  upsertAdminCurrentPage(
    current: SummerRequestSummaryDto[],
    incoming: SummerRequestSummaryDto,
    pageNumber: number,
    pageSize: number
  ): SummerListPatchResult {
    const targetId = Number(incoming?.messageId ?? 0);
    if (!Number.isFinite(targetId) || targetId <= 0) {
      return { items: [...(current ?? [])], change: 'none' };
    }

    const next = [...(current ?? [])];
    const index = next.findIndex(item => Number(item?.messageId ?? 0) === targetId);
    if (index >= 0) {
      next[index] = incoming;
      return { items: next, change: 'updated' };
    }

    if (Number(pageNumber ?? 1) !== 1) {
      return { items: next, change: 'none' };
    }

    next.unshift(incoming);
    next.sort((a, b) => this.toEpoch(b.createdAt) - this.toEpoch(a.createdAt) || Number(b.messageId ?? 0) - Number(a.messageId ?? 0));

    const normalizedPageSize = Math.max(1, Number(pageSize ?? 1) || 1);
    if (next.length > normalizedPageSize) {
      next.splice(normalizedPageSize);
    }

    return { items: next, change: 'inserted' };
  }

  removeByMessageId(current: SummerRequestSummaryDto[], messageId: number): SummerListPatchResult {
    const targetId = Number(messageId ?? 0);
    if (!Number.isFinite(targetId) || targetId <= 0) {
      return { items: [...(current ?? [])], change: 'none' };
    }

    const exists = (current ?? []).some(item => Number(item?.messageId ?? 0) === targetId);
    if (!exists) {
      return { items: [...(current ?? [])], change: 'none' };
    }

    return {
      items: (current ?? []).filter(item => Number(item?.messageId ?? 0) !== targetId),
      change: 'removed'
    };
  }

  private toEpoch(value?: string): number {
    if (!value) {
      return 0;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }
}
