import { Injectable } from '@angular/core';
import { SummerNotificationDisplayMapperService } from 'src/app/Modules/EmployeeRequests/components/summer-shared/core/summer-notification-display-mapper.service';
import { DynamicSubjectRealtimeEventDto, DYNAMIC_SUBJECT_EVENT_KIND } from '../BackendServices/DynamicSubjects/DynamicSubjects.dto';

type NotificationTypeLevel = 'Info' | 'Success' | 'Warn';

export interface DisplayNotificationDto {
  type: NotificationTypeLevel;
  sender?: string | null;
  title: string;
  notification: string;
  category?: unknown;
  time?: Date;
  readStatus?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationDisplayMapperService {
  private readonly dynamicSubjectsTitle = 'إدارة الموضوعات والطلبات';

  constructor(
    private readonly summerNotificationMapper: SummerNotificationDisplayMapperService
  ) {}

  toDisplayNotification(notification: unknown): DisplayNotificationDto {
    const dynamicEvent = this.tryParseDynamicSubjectEvent(notification);
    if (dynamicEvent) {
      return this.mapDynamicSubjectNotification(notification, dynamicEvent);
    }

    return this.summerNotificationMapper.toDisplayNotification(notification) as unknown as DisplayNotificationDto;
  }

  buildToastSummary(notification: DisplayNotificationDto): string {
    const sender = this.getText((notification as any)?.sender, 'Connect');
    const title = this.getText((notification as any)?.title, 'تنبيه');
    const message = this.getText((notification as any)?.notification, 'تم استلام إشعار جديد.');
    return `${sender} - ${title}: ${message}`;
  }

  private mapDynamicSubjectNotification(sourceNotification: unknown, event: DynamicSubjectRealtimeEventDto): DisplayNotificationDto {
    const payload = sourceNotification as {
      sender?: string;
      Sender?: string;
      category?: unknown;
      Category?: unknown;
      time?: Date;
      readStatus?: boolean;
    };

    const statusLabel = this.toArabicStatusLabel(event.status, event.statusLabel);
    const message = this.resolveDynamicMessage(event, statusLabel);
    const severity = this.resolveDynamicSeverity(event);

    return {
      sender: this.getText(payload?.sender ?? payload?.Sender, 'Connect'),
      title: this.dynamicSubjectsTitle,
      notification: message,
      type: severity,
      category: payload?.category ?? payload?.Category,
      time: payload?.time ?? new Date(event.timestampUtc || Date.now()),
      readStatus: payload?.readStatus
    };
  }

  private resolveDynamicMessage(event: DynamicSubjectRealtimeEventDto, statusLabel: string): string {
    const reference = this.getText(event.referenceNumber, '');
    const refSuffix = reference ? ` (${reference})` : '';
    const summary = this.getText(event.summary, 'بدون عنوان');

    switch (event.eventType) {
      case 'SubjectCreated':
        return `تم إنشاء موضوع/طلب جديد${refSuffix}.`;
      case 'SubjectUpdated':
        return `تم تحديث بيانات الموضوع/الطلب "${summary}"${refSuffix}.`;
      case 'SubjectStatusChanged':
        return `تم تغيير حالة الموضوع/الطلب إلى "${statusLabel}"${refSuffix}.`;
      case 'AttachmentAdded':
        return `تمت إضافة مرفق جديد للموضوع/الطلب${refSuffix}.`;
      case 'AttachmentRemoved':
        return `تم حذف مرفق من الموضوع/الطلب${refSuffix}.`;
      case 'StakeholderAssigned':
        return `تم إسناد جهة معنية على الموضوع/الطلب${refSuffix}.`;
      case 'TaskUpdated':
        return `تم تحديث مهمة مرتبطة بالموضوع/الطلب${refSuffix}.`;
      case 'EnvelopeCreated':
        return 'تم إنشاء ظرف وارد جديد.';
      case 'EnvelopeUpdated':
        return 'تم تحديث بيانات الظرف الوارد.';
      case 'EnvelopeLinked':
        return `تم ربط الموضوع/الطلب بظرف وارد${refSuffix}.`;
      case 'EnvelopeUnlinked':
        return `تم إلغاء ربط الموضوع/الطلب من الظرف${refSuffix}.`;
      case 'SubjectTypeConfigUpdated':
        return 'تم تحديث إعدادات نوع الموضوع/الطلب من شاشة الإدارة.';
      default:
        return `تم استلام تحديث جديد على الموضوع/الطلب${refSuffix}.`;
    }
  }

  private resolveDynamicSeverity(event: DynamicSubjectRealtimeEventDto): NotificationTypeLevel {
    const eventType = this.getText(event.eventType, '').toLowerCase();
    if (eventType.includes('created') || eventType.includes('completed')) {
      return 'Success';
    }

    if (eventType.includes('removed') || eventType.includes('unlinked') || eventType.includes('rejected') || eventType.includes('archived')) {
      return 'Warn';
    }

    return 'Info';
  }

  private tryParseDynamicSubjectEvent(notification: unknown): DynamicSubjectRealtimeEventDto | null {
    const payload = notification as {
      notification?: string;
      Notification?: string;
    };

    const body = this.getText(payload?.notification ?? payload?.Notification, '');
    if (!body.startsWith('{') || !body.endsWith('}')) {
      return null;
    }

    try {
      const parsed = JSON.parse(body) as DynamicSubjectRealtimeEventDto;
      if (!parsed || parsed.kind !== DYNAMIC_SUBJECT_EVENT_KIND || !parsed.eventType) {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  private toArabicStatusLabel(status?: number, statusLabel?: string): string {
    const map: Record<number, string> = {
      10: 'مسودة',
      11: 'مقدم',
      12: 'قيد المراجعة',
      13: 'بانتظار الاستكمال',
      14: 'قيد التنفيذ',
      15: 'مكتمل',
      16: 'مرفوض',
      17: 'مؤرشف'
    };

    if (status && map[status]) {
      return map[status];
    }

    const normalized = this.getText(statusLabel, '').toLowerCase();
    if (normalized === 'draft') return 'مسودة';
    if (normalized === 'submitted') return 'مقدم';
    if (normalized === 'under review') return 'قيد المراجعة';
    if (normalized === 'pending completion') return 'بانتظار الاستكمال';
    if (normalized === 'in progress') return 'قيد التنفيذ';
    if (normalized === 'completed') return 'مكتمل';
    if (normalized === 'rejected') return 'مرفوض';
    if (normalized === 'archived') return 'مؤرشف';

    return this.getText(statusLabel, 'تم التحديث');
  }

  private getText(value: unknown, fallback: string): string {
    const text = String(value ?? '').trim();
    return text.length > 0 ? text : fallback;
  }
}
