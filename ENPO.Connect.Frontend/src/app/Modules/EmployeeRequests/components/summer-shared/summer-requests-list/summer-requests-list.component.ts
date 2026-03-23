import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  SummerRequestSummaryDto,
  SummerRequestsPageChange,
  SummerRequestsPageData
} from 'src/app/shared/services/BackendServices/SummerWorkflow/SummerWorkflow.dto';

@Component({
  selector: 'app-summer-requests-list',
  templateUrl: './summer-requests-list.component.html',
  styleUrls: ['./summer-requests-list.component.scss']
})
export class SummerRequestsListComponent {
  @Input() variant: 'employee' | 'admin' = 'employee';
  @Input() loading = false;
  @Input() requests: SummerRequestSummaryDto[] = [];
  @Input() selectedRequestId: number | null = null;
  @Input() emptyMessage = 'لا توجد طلبات حالياً.';

  @Input() statusClassResolver: (request: SummerRequestSummaryDto) => string = () => 'status-neutral';
  @Input() statusTextResolver: (request: SummerRequestSummaryDto) => string =
    request => String(request?.statusLabel ?? request?.status ?? '-').trim() || '-';
  @Input() formatDateResolver: (value?: string) => string = () => '-';

  @Input() paymentOverdueResolver: (request: SummerRequestSummaryDto) => boolean = () => false;
  @Input() transferStateLabelResolver: (request: SummerRequestSummaryDto) => string = () => '-';
  @Input() transferStateClassResolver: (request: SummerRequestSummaryDto) => string = () => 'status-neutral';

  @Input() pageMode: 'client' | 'server' = 'client';
  @Input() pageData: Partial<SummerRequestsPageData> | null = null;

  @Output() requestSelected = new EventEmitter<number>();
  @Output() pageChange = new EventEmitter<SummerRequestsPageChange>();

  private readonly defaultClientRowsPerPageOptions = [5, 10, 25, 50];
  private readonly defaultServerRowsPerPageOptions = [5, 25, 50, 100, 250, 500];

  get isAdminVariant(): boolean {
    return this.variant === 'admin';
  }

  get resolvedFirst(): number {
    const first = Number(this.pageData?.first ?? NaN);
    if (Number.isFinite(first) && first >= 0) {
      return Math.floor(first);
    }

    const explicitPageNumber = Number(this.pageData?.pageNumber ?? NaN);
    if (Number.isFinite(explicitPageNumber) && explicitPageNumber > 0) {
      return (Math.floor(explicitPageNumber) - 1) * this.resolvedPageSize;
    }

    return 0;
  }

  get resolvedPageSize(): number {
    const pageSize = Number(this.pageData?.pageSize ?? this.pageData?.rows ?? NaN);
    if (Number.isFinite(pageSize) && pageSize > 0) {
      return Math.floor(pageSize);
    }

    return this.pageMode === 'server' ? 50 : 5;
  }

  get resolvedTotalCount(): number {
    const totalCount = Number(this.pageData?.totalCount ?? NaN);
    if (Number.isFinite(totalCount) && totalCount > 0) {
      return Math.floor(totalCount);
    }

    return 0;
  }

  get resolvedTotalPages(): number {
    const totalPages = Number(this.pageData?.totalPages ?? NaN);
    if (Number.isFinite(totalPages) && totalPages > 0) {
      return Math.floor(totalPages);
    }

    return Math.max(1, Math.ceil(this.resolvedTotalCount / this.resolvedPageSize));
  }

  get resolvedPageNumber(): number {
    const pageNumber = Number(this.pageData?.pageNumber ?? NaN);
    const candidate = Number.isFinite(pageNumber) && pageNumber > 0
      ? Math.floor(pageNumber)
      : Math.floor(this.resolvedFirst / this.resolvedPageSize) + 1;

    return Math.max(1, Math.min(candidate, this.resolvedTotalPages));
  }

  get resolvedRangeStart(): number {
    const rangeStart = Number(this.pageData?.rangeStart ?? NaN);
    if (Number.isFinite(rangeStart) && rangeStart >= 0) {
      return Math.floor(rangeStart);
    }

    if (this.resolvedTotalCount <= 0) {
      return 0;
    }

    return ((this.resolvedPageNumber - 1) * this.resolvedPageSize) + 1;
  }

  get resolvedRangeEnd(): number {
    const rangeEnd = Number(this.pageData?.rangeEnd ?? NaN);
    if (Number.isFinite(rangeEnd) && rangeEnd >= 0) {
      return Math.floor(rangeEnd);
    }

    if (this.resolvedTotalCount <= 0) {
      return 0;
    }

    return Math.min(this.resolvedPageNumber * this.resolvedPageSize, this.resolvedTotalCount);
  }

  get resolvedRowsPerPageOptions(): number[] {
    const source = Array.isArray(this.pageData?.rowsPerPageOptions) ? (this.pageData?.rowsPerPageOptions ?? []) : [];
    const parsed = source
      .map(value => Number(value))
      .filter(value => Number.isFinite(value) && value > 0)
      .map(value => Math.floor(value));

    const baseOptions = parsed.length > 0
      ? parsed
      : [...(this.pageMode === 'server' ? this.defaultServerRowsPerPageOptions : this.defaultClientRowsPerPageOptions)];

    if (baseOptions.includes(this.resolvedPageSize)) {
      return baseOptions;
    }

    return [...baseOptions, this.resolvedPageSize].sort((a, b) => a - b);
  }

  trackByRequest(_index: number, request: SummerRequestSummaryDto): number {
    return Number(request?.messageId ?? 0) || _index;
  }

  onSelectRequest(messageId: number): void {
    const normalizedId = Number(messageId || 0);
    if (normalizedId > 0) {
      this.requestSelected.emit(normalizedId);
    }
  }

  onClientPageChange(event: { first?: number; rows?: number }): void {
    const pageSize = Number(event?.rows ?? this.resolvedPageSize);
    const first = Number(event?.first ?? 0);
    if (!Number.isFinite(pageSize) || pageSize <= 0 || !Number.isFinite(first) || first < 0) {
      return;
    }

    const normalizedPageSize = Math.floor(pageSize);
    const normalizedFirst = Math.floor(first);
    const pageNumber = Math.floor(normalizedFirst / normalizedPageSize) + 1;

    this.pageChange.emit({
      pageNumber,
      pageSize: normalizedPageSize,
      first: normalizedFirst,
      rows: normalizedPageSize
    });
  }

  onServerPageSizeChanged(rawValue: string | number): void {
    const pageSize = Number(rawValue);
    if (Number.isFinite(pageSize) && pageSize > 0) {
      const normalizedPageSize = Math.floor(pageSize);
      this.pageChange.emit({
        pageNumber: 1,
        pageSize: normalizedPageSize,
        first: 0,
        rows: normalizedPageSize
      });
    }
  }

  goToServerPage(page: number): void {
    const target = Math.max(1, Math.min(Number(page) || 1, Math.max(1, this.resolvedTotalPages)));
    const pageSize = this.resolvedPageSize;

    this.pageChange.emit({
      pageNumber: target,
      pageSize,
      first: (target - 1) * pageSize,
      rows: pageSize
    });
  }

  resolveStatusClass(request: SummerRequestSummaryDto): string {
    try {
      return this.statusClassResolver(request);
    } catch {
      return 'status-neutral';
    }
  }

  resolveStatusText(request: SummerRequestSummaryDto): string {
    try {
      return this.statusTextResolver(request);
    } catch {
      return '-';
    }
  }

  resolveDate(value?: string): string {
    try {
      return this.formatDateResolver(value);
    } catch {
      return '-';
    }
  }

  isPaymentOverdue(request: SummerRequestSummaryDto): boolean {
    try {
      return this.paymentOverdueResolver(request);
    } catch {
      return false;
    }
  }

  resolveTransferStateLabel(request: SummerRequestSummaryDto): string {
    try {
      return this.transferStateLabelResolver(request);
    } catch {
      return '-';
    }
  }

  resolveTransferStateClass(request: SummerRequestSummaryDto): string {
    try {
      return this.transferStateClassResolver(request);
    } catch {
      return 'status-neutral';
    }
  }
}
