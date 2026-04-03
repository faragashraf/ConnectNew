import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { DynamicSubjectsController } from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.service';
import { SubjectDetailDto } from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.dto';
import { AppNotificationService } from 'src/app/shared/services/notifications/app-notification.service';
import { DynamicSubjectsRealtimeService } from '../../services/dynamic-subjects-realtime.service';

@Component({
  selector: 'app-dynamic-subject-detail',
  templateUrl: './dynamic-subject-detail.component.html',
  styleUrls: ['./dynamic-subject-detail.component.scss']
})
export class DynamicSubjectDetailComponent implements OnInit, OnDestroy {
  subject: SubjectDetailDto | null = null;
  messageId = 0;
  loading = false;
  statusToApply?: number;

  private readonly subscriptions: Subscription[] = [];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly dynamicSubjectsController: DynamicSubjectsController,
    private readonly realtimeService: DynamicSubjectsRealtimeService,
    private readonly appNotification: AppNotificationService
  ) {}

  ngOnInit(): void {
    this.messageId = Number(this.route.snapshot.paramMap.get('id') ?? 0);
    if (this.messageId <= 0) {
      return;
    }

    this.realtimeService.joinSubjectGroup(this.messageId);
    this.loadSubject();

    this.subscriptions.push(
      this.realtimeService.subscribeByEntity('subject', this.messageId).subscribe(() => {
        this.loadSubject();
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  loadSubject(): void {
    this.loading = true;
    this.dynamicSubjectsController.getSubject(this.messageId).subscribe({
      next: response => {
        if (response?.errors?.length) {
          this.subject = null;
          this.appNotification.showApiErrors(response.errors, 'تعذر تحميل تفاصيل الموضوع/الطلب.');
          return;
        }

        this.subject = response?.data ?? null;
        if (this.subject) {
          this.subject.statusLabel = this.toArabicStatusLabel(this.subject.status, this.subject.statusLabel);
        }
        this.statusToApply = this.subject?.status;
        (this.subject?.linkedEnvelopes ?? []).forEach(envelope => {
          this.realtimeService.joinEnvelopeGroup(envelope.envelopeId);
        });
      },
      error: () => {
        this.appNotification.error('حدث خطأ أثناء تحميل تفاصيل الموضوع/الطلب.');
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  applyStatus(): void {
    if (!this.subject || !this.statusToApply || this.statusToApply === this.subject.status) {
      return;
    }

    this.dynamicSubjectsController.changeStatus(this.subject.messageId, {
      newStatus: this.statusToApply,
      notes: 'تم تغيير الحالة من شاشة التفاصيل.'
    }).subscribe({
      next: response => {
        if (response?.errors?.length) {
          this.appNotification.showApiErrors(response.errors, 'تعذر تحديث الحالة الحالية.');
          return;
        }

        this.appNotification.success('تم تحديث الحالة بنجاح.');
        this.loadSubject();
      },
      error: () => {
        this.appNotification.error('حدث خطأ أثناء تحديث الحالة.');
      }
    });
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
      default: return 'تحديث';
    }
  }

  toArabicPartyType(partyType?: string): string {
    const normalized = String(partyType ?? '').trim().toLowerCase();
    if (normalized === 'viewer') {
      return 'مشاهد';
    }

    if (normalized === 'assignee') {
      return 'مكلف';
    }

    return partyType || 'غير محدد';
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
