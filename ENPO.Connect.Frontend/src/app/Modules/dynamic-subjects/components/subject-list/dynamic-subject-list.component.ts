import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { DynamicSubjectsController } from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.service';
import {
  DynamicSubjectRealtimeEventDto,
  SubjectListItemDto,
  SubjectListQueryDto
} from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.dto';
import { AppNotificationService } from 'src/app/shared/services/notifications/app-notification.service';
import { DynamicSubjectsRealtimeService } from '../../services/dynamic-subjects-realtime.service';
import { DynamicSubjectAccessService } from '../../services/dynamic-subject-access.service';

@Component({
  selector: 'app-dynamic-subject-list',
  templateUrl: './dynamic-subject-list.component.html',
  styleUrls: ['./dynamic-subject-list.component.scss']
})
export class DynamicSubjectListComponent implements OnInit, OnDestroy {
  items: SubjectListItemDto[] = [];
  totalCount = 0;
  loading = false;
  statusFilter?: number;

  query: SubjectListQueryDto = {
    onlyMyItems: false,
    pageNumber: 1,
    pageSize: 20
  };
  private allowedCategoryIds = new Set<number>();
  private accessReady = false;

  private readonly subscriptions: Subscription[] = [];

  constructor(
    private readonly dynamicSubjectsController: DynamicSubjectsController,
    private readonly dynamicSubjectAccess: DynamicSubjectAccessService,
    private readonly realtimeService: DynamicSubjectsRealtimeService,
    private readonly appNotification: AppNotificationService
  ) {}

  ngOnInit(): void {
    this.bootstrapAccess();
    this.subscriptions.push(
      this.realtimeService.events$().subscribe(eventItem => {
        this.applyRealtime(eventItem);
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  load(): void {
    if (!this.accessReady) {
      return;
    }

    this.loading = true;
    this.query.status = this.statusFilter;

    this.dynamicSubjectsController.listSubjects(this.query).subscribe({
      next: response => {
        if (response?.errors?.length) {
          this.items = [];
          this.totalCount = 0;
          this.appNotification.showApiErrors(response.errors, 'تعذر تحميل قائمة الموضوعات والطلبات.');
          return;
        }

        const rawItems = response?.data?.items ?? [];
        const scopedItems = rawItems
          .filter(item => this.allowedCategoryIds.has(Number(item.categoryId ?? 0)));

        this.items = scopedItems;
        this.items.forEach(item => {
          item.statusLabel = this.toArabicStatusLabel(item.status, item.statusLabel);
        });
        const serverTotal = Number(response?.data?.totalCount ?? 0);
        this.totalCount = scopedItems.length === rawItems.length ? serverTotal : scopedItems.length;
      },
      error: () => {
        this.appNotification.error('حدث خطأ أثناء تحميل قائمة الموضوعات والطلبات.');
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  toggleOnlyMine(): void {
    this.query.onlyMyItems = !this.query.onlyMyItems;
    this.query.pageNumber = 1;
    this.load();
  }

  applySearch(searchText: string): void {
    this.query.searchText = searchText?.trim() || undefined;
    this.query.pageNumber = 1;
    this.load();
  }

  onStatusFilterChanged(value: string): void {
    const parsed = Number(value);
    this.statusFilter = Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
    this.query.pageNumber = 1;
    this.load();
  }

  nextPage(): void {
    if (this.items.length < this.query.pageSize) {
      return;
    }

    this.query.pageNumber += 1;
    this.load();
  }

  previousPage(): void {
    if (this.query.pageNumber <= 1) {
      return;
    }

    this.query.pageNumber -= 1;
    this.load();
  }

  private applyRealtime(eventItem: DynamicSubjectRealtimeEventDto): void {
    if (!eventItem) {
      return;
    }

    const eventCategoryId = Number(eventItem.categoryId ?? eventItem.data?.['categoryId'] ?? 0);
    if (eventCategoryId > 0 && !this.allowedCategoryIds.has(eventCategoryId)) {
      this.items = this.items.filter(item => item.messageId !== Number(eventItem.messageId ?? eventItem.entityId ?? 0));
      this.totalCount = this.items.length;
      return;
    }

    if (eventItem.eventType === 'SubjectCreated') {
      const created = this.toListItem(eventItem);
      this.items = [created, ...this.items.filter(item => item.messageId !== created.messageId)].slice(0, this.query.pageSize);
      this.totalCount += 1;
      return;
    }

    const messageId = Number(eventItem.messageId ?? eventItem.entityId ?? 0);
    if (!messageId) {
      return;
    }

    const existing = this.items.find(item => item.messageId === messageId);
    if (!existing) {
      return;
    }

    existing.status = eventItem.status ?? existing.status;
    existing.statusLabel = this.toArabicStatusLabel(existing.status, eventItem.statusLabel ?? existing.statusLabel);
    existing.subject = eventItem.summary ?? existing.subject;
    existing.lastModifiedDate = eventItem.timestampUtc || existing.lastModifiedDate;
    existing.attachmentsCount = Number(eventItem.data?.['attachmentsCount'] ?? existing.attachmentsCount);
    existing.envelopesCount = Number(eventItem.data?.['envelopesCount'] ?? existing.envelopesCount);
  }

  private toListItem(eventItem: DynamicSubjectRealtimeEventDto): SubjectListItemDto {
    return {
      messageId: Number(eventItem.messageId ?? eventItem.entityId ?? 0),
      requestRef: eventItem.referenceNumber,
      subject: eventItem.summary || eventItem.data?.['subject'] || '',
      description: '',
      categoryId: Number(eventItem.categoryId ?? 0),
      status: Number(eventItem.status ?? 10),
      statusLabel: this.toArabicStatusLabel(eventItem.status, eventItem.statusLabel),
      createdBy: eventItem.actorUserId,
      assignedUnitId: eventItem.data?.['assignedUnitId'],
      createdDate: eventItem.timestampUtc,
      lastModifiedDate: eventItem.timestampUtc,
      attachmentsCount: Number(eventItem.data?.['attachmentsCount'] ?? 0),
      stakeholdersCount: 0,
      tasksCount: 0,
      envelopesCount: Number(eventItem.data?.['envelopesCount'] ?? 0)
    };
  }

  toArabicStatusLabel(status?: number, label?: string): string {
    const byCode: Record<number, string> = {
      10: 'مسودة',
      11: 'مقدم',
      12: 'قيد المراجعة',
      13: 'بانتظار الاستكمال',
      14: 'قيد التنفيذ',
      15: 'مكتمل',
      16: 'مرفوض',
      17: 'مؤرشف'
    };

    if (status && byCode[status]) {
      return byCode[status];
    }

    const normalized = String(label ?? '').trim().toLowerCase();
    if (normalized === 'draft') return 'مسودة';
    if (normalized === 'submitted') return 'مقدم';
    if (normalized === 'under review') return 'قيد المراجعة';
    if (normalized === 'pending completion') return 'بانتظار الاستكمال';
    if (normalized === 'in progress') return 'قيد التنفيذ';
    if (normalized === 'completed') return 'مكتمل';
    if (normalized === 'rejected') return 'مرفوض';
    if (normalized === 'archived') return 'مؤرشف';

    return label || 'غير محدد';
  }

  private bootstrapAccess(): void {
    this.dynamicSubjectsController.getCategoryTree(this.dynamicSubjectAccess.getApplicationId()).subscribe({
      next: response => {
        if (response?.errors?.length) {
          this.allowedCategoryIds = new Set<number>();
          this.accessReady = true;
          this.appNotification.showApiErrors(response.errors, 'تعذر تحميل صلاحيات عرض الطلبات.');
          return;
        }

        const scopedTree = this.dynamicSubjectAccess.filterByTopParent(response?.data ?? []);
        this.allowedCategoryIds = this.dynamicSubjectAccess.collectCategoryIds(scopedTree);
        this.accessReady = true;
        this.load();
      },
      error: () => {
        this.allowedCategoryIds = new Set<number>();
        this.accessReady = true;
        this.appNotification.error('تعذر تحميل صلاحيات عرض الطلبات.');
      }
    });
  }
}
