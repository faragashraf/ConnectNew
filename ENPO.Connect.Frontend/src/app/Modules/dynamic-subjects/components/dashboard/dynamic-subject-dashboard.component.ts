import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { DynamicSubjectsController } from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.service';
import {
  DynamicSubjectRealtimeEventDto,
  SubjectDashboardDto,
  SubjectDashboardQueryDto,
  SubjectListItemDto,
  SubjectTimelineEventDto
} from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.dto';
import { AppNotificationService } from 'src/app/shared/services/notifications/app-notification.service';
import { DynamicSubjectsRealtimeService } from '../../services/dynamic-subjects-realtime.service';

@Component({
  selector: 'app-dynamic-subject-dashboard',
  templateUrl: './dynamic-subject-dashboard.component.html',
  styleUrls: ['./dynamic-subject-dashboard.component.scss']
})
export class DynamicSubjectDashboardComponent implements OnInit, OnDestroy {
  dashboard: SubjectDashboardDto | null = null;
  query: SubjectDashboardQueryDto = { onlyMyItems: false };
  loading = false;

  private readonly subscriptions: Subscription[] = [];

  constructor(
    private readonly dynamicSubjectsController: DynamicSubjectsController,
    private readonly realtimeService: DynamicSubjectsRealtimeService,
    private readonly appNotification: AppNotificationService
  ) {}

  ngOnInit(): void {
    this.loadDashboard();
    this.subscriptions.push(
      this.realtimeService.events$().subscribe(eventItem => {
        this.applyRealtimeUpdate(eventItem);
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  loadDashboard(): void {
    this.loading = true;
    this.dynamicSubjectsController.getDashboard(this.query).subscribe({
      next: response => {
        if (response?.errors?.length) {
          this.appNotification.showApiErrors(response.errors, 'تعذر تحميل لوحة المتابعة.');
          this.dashboard = null;
          return;
        }

        this.dashboard = response?.data ?? null;
        (this.dashboard?.recentSubjects ?? []).forEach(item => {
          item.statusLabel = this.toArabicStatusLabel(item.status, item.statusLabel);
        });
        this.updateStatusCards();
      },
      error: () => {
        this.appNotification.error('حدث خطأ أثناء تحميل لوحة المتابعة.');
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  toggleOnlyMyItems(): void {
    this.query.onlyMyItems = !this.query.onlyMyItems;
    this.loadDashboard();
  }

  private applyRealtimeUpdate(eventItem: DynamicSubjectRealtimeEventDto): void {
    if (!this.dashboard) {
      return;
    }

    const updates: SubjectTimelineEventDto[] = this.dashboard.recentUpdates ?? [];
    const timelineRecord: SubjectTimelineEventDto = {
      timelineEventId: Date.now(),
      eventType: eventItem.eventType,
      eventTitle: eventItem.summary || this.toArabicEventType(eventItem.eventType),
      eventPayloadJson: JSON.stringify(eventItem.data ?? {}),
      statusFrom: undefined,
      statusTo: eventItem.status,
      createdBy: eventItem.actorUserId || 'SYSTEM',
      createdAtUtc: eventItem.timestampUtc
    };
    this.dashboard.recentUpdates = [timelineRecord, ...updates].slice(0, 20);

    if (eventItem.eventType === 'SubjectCreated') {
      this.dashboard.totalSubjects += 1;
      this.incrementStatusCount(eventItem.status);
      this.dashboard.recentSubjects = [this.toSubjectListItem(eventItem), ...(this.dashboard.recentSubjects ?? [])].slice(0, 15);
    }

    if (eventItem.eventType === 'SubjectStatusChanged' || eventItem.eventType === 'SubjectUpdated') {
      const existing = (this.dashboard.recentSubjects ?? []).find(item => item.messageId === eventItem.messageId);
      if (existing) {
        existing.status = eventItem.status ?? existing.status;
        existing.statusLabel = this.toArabicStatusLabel(eventItem.status, eventItem.statusLabel || existing.statusLabel);
      }
    }

    if (eventItem.eventType === 'EnvelopeCreated') {
      this.dashboard.totalEnvelopes += 1;
    }

    if (eventItem.eventType === 'TaskUpdated') {
      this.dashboard.openTasksCount += 1;
    }

    this.updateStatusCards();
  }

  private incrementStatusCount(status: number | undefined): void {
    switch (status) {
      case 10: this.dashboard!.draftCount += 1; break;
      case 11: this.dashboard!.submittedCount += 1; break;
      case 12: this.dashboard!.underReviewCount += 1; break;
      case 13: this.dashboard!.pendingCompletionCount += 1; break;
      case 14: this.dashboard!.inProgressCount += 1; break;
      case 15: this.dashboard!.completedCount += 1; break;
      case 16: this.dashboard!.rejectedCount += 1; break;
      case 17: this.dashboard!.archivedCount += 1; break;
      default: break;
    }
  }

  private updateStatusCards(): void {
    if (!this.dashboard) {
      return;
    }

    this.dashboard.statusCards = [
      { key: 'draft', label: 'مسودة', count: this.dashboard.draftCount },
      { key: 'submitted', label: 'مقدم', count: this.dashboard.submittedCount },
      { key: 'underReview', label: 'قيد المراجعة', count: this.dashboard.underReviewCount },
      { key: 'pending', label: 'بانتظار الاستكمال', count: this.dashboard.pendingCompletionCount },
      { key: 'inProgress', label: 'قيد التنفيذ', count: this.dashboard.inProgressCount },
      { key: 'completed', label: 'مكتمل', count: this.dashboard.completedCount },
      { key: 'rejected', label: 'مرفوض', count: this.dashboard.rejectedCount },
      { key: 'archived', label: 'مؤرشف', count: this.dashboard.archivedCount }
    ];
  }

  private toSubjectListItem(eventItem: DynamicSubjectRealtimeEventDto): SubjectListItemDto {
    return {
      messageId: eventItem.messageId || eventItem.entityId,
      requestRef: eventItem.referenceNumber,
      subject: eventItem.summary || eventItem.data?.['subject'] || 'موضوع جديد',
      description: '',
      categoryId: eventItem.categoryId || 0,
      status: eventItem.status || 10,
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

  toArabicEventType(eventType?: string): string {
    switch (String(eventType ?? '').trim()) {
      case 'SubjectCreated': return 'إنشاء موضوع/طلب';
      case 'SubjectUpdated': return 'تحديث موضوع/طلب';
      case 'SubjectStatusChanged': return 'تغيير حالة الموضوع/الطلب';
      case 'AttachmentAdded': return 'إضافة مرفق';
      case 'AttachmentRemoved': return 'حذف مرفق';
      case 'StakeholderAssigned': return 'إسناد جهة معنية';
      case 'TaskUpdated': return 'تحديث مهمة';
      case 'EnvelopeLinked': return 'ربط ظرف وارد';
      case 'EnvelopeUnlinked': return 'فك ارتباط الظرف';
      case 'EnvelopeCreated': return 'إنشاء ظرف وارد';
      case 'EnvelopeUpdated': return 'تحديث ظرف وارد';
      case 'SubjectTypeConfigUpdated': return 'تحديث إعدادات نوع الموضوع';
      default: return 'تحديث';
    }
  }

  toArabicTimelineTitle(eventType?: string, eventTitle?: string): string {
    const raw = String(eventTitle ?? '').trim();
    if (!raw) {
      return this.toArabicEventType(eventType);
    }

    if (/[\u0600-\u06FF]/.test(raw)) {
      return raw;
    }

    const normalized = raw.toLowerCase();
    if (normalized.includes('subject created')) return 'تم إنشاء الموضوع/الطلب.';
    if (normalized.includes('subject updated')) return 'تم تحديث بيانات الموضوع/الطلب.';
    if (normalized.includes('status changed')) return 'تم تغيير الحالة.';
    if (normalized.includes('attachment')) return 'تم تحديث المرفقات.';
    if (normalized.includes('envelope linked')) return 'تم ربط الموضوع بظرف وارد.';
    if (normalized.includes('envelope')) return 'تم تحديث بيانات الظرف الوارد.';
    if (normalized.includes('task')) return 'تم تحديث المهام.';

    return this.toArabicEventType(eventType);
  }
}
