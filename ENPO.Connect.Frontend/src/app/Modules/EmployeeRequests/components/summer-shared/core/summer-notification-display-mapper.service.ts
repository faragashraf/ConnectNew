import { Injectable } from '@angular/core';
import { SummerNotificationEventNormalizerService } from './summer-notification-event-normalizer.service';
import { SummerRealtimeEvent, SummerRequestRealtimeEvent } from './summer-realtime-event.models';

type SummerNotificationLevel = 'Info' | 'Success' | 'Warn';

export interface SummerDisplayNotificationDto {
  sender: string;
  title: string;
  notification: string;
  type: SummerNotificationLevel;
  category?: unknown;
  time?: Date;
  readStatus?: boolean;
}

export interface SummerNotificationDisplayResult {
  title: string;
  message: string;
  type: SummerNotificationLevel;
  isSummerEvent: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class SummerNotificationDisplayMapperService {
  private readonly summerTitle = 'إدارة طلبات المصايف';

  constructor(
    private readonly normalizer: SummerNotificationEventNormalizerService
  ) {}

  toDisplayNotification(notification: unknown): SummerDisplayNotificationDto {
    const payload = notification as SummerDisplayNotificationDto & {
      Notification?: string;
      Title?: string;
      Sender?: string;
      Type?: string;
      Category?: string;
    };

    const sender = this.getText(payload?.sender ?? payload?.Sender, 'Connect');
    const rawTitle = this.getText(payload?.title ?? payload?.Title, '');
    const rawBody = this.getText(payload?.notification ?? payload?.Notification, '');
    const rawType = payload?.type ?? payload?.Type;
    const category = payload?.category ?? payload?.Category;
    const time = payload?.time ?? new Date();

    const display = this.toDisplayContent(notification, rawTitle, rawBody, rawType);
    const title = this.getText(display.title, this.summerTitle);
    const message = this.getText(display.message, 'تم استلام تحديث جديد.');

    return {
      sender,
      title,
      notification: message,
      type: display.type,
      category,
      time,
      readStatus: payload?.readStatus
    };
  }

  toDisplayContent(
    notification: unknown,
    rawTitle?: string,
    rawBody?: string,
    rawType?: unknown
  ): SummerNotificationDisplayResult {
    const event = this.normalizer.normalize(notification);
    if (event) {
      return this.mapEvent(event);
    }

    const containsMachineTokens = this.containsSummerMachineTokens(rawTitle, rawBody);
    if (containsMachineTokens) {
      return {
        title: this.summerTitle,
        message: 'تم تحديث بيانات طلبات المصايف.',
        type: 'Info',
        isSummerEvent: true
      };
    }

    const fallbackTitle = this.getText(rawTitle, 'تنبيه');
    const fallbackMessage = this.getText(rawBody, 'تم استلام إشعار جديد.');
    return {
      title: fallbackTitle,
      message: fallbackMessage,
      type: this.resolveNotificationType(rawType),
      isSummerEvent: false
    };
  }

  buildToastSummary(notification: SummerDisplayNotificationDto): string {
    const sender = this.getText(notification?.sender, 'Connect');
    const title = this.getText(notification?.title, this.summerTitle);
    const message = this.getText(notification?.notification, 'تم استلام تحديث جديد.');
    return `${sender} - ${title}: ${message}`;
  }

  private mapEvent(event: SummerRealtimeEvent): SummerNotificationDisplayResult {
    if (event.kind === 'capacity') {
      const destinationName = this.getText(
        event.destinationName,
        Number.isFinite(Number(event.destinationId ?? 0)) && Number(event.destinationId ?? 0) > 0
          ? `المصيف رقم ${Number(event.destinationId)}`
          : 'المصيف غير محدد'
      );
      const batchNumber = this.getText(event.batchNumber, this.getText(event.waveCode, '-'));
      return {
        title: this.summerTitle,
        message: `تم تحديث سعة الفوج رقم (${batchNumber}) بمصيف (${destinationName})، يرجى مراجعة التفاصيل.`,
        type: 'Info',
        isSummerEvent: true
      };
    }

    return this.mapRequestEvent(event);
  }

  private mapRequestEvent(event: SummerRequestRealtimeEvent): SummerNotificationDisplayResult {
    const action = this.normalizeToken(event.action);

    if (action === 'CREATE' || action === 'NEW' || action === 'INSERT') {
      return {
        title: this.summerTitle,
        message: 'تم تسجيل طلب المصيف بنجاح.',
        type: 'Success',
        isSummerEvent: true
      };
    }

    if (action === 'EDIT' || action === 'UPDATE') {
      return {
        title: this.summerTitle,
        message: 'تم تحديث طلب المصيف.',
        type: 'Info',
        isSummerEvent: true
      };
    }

    if (action === 'PAY') {
      return {
        title: this.summerTitle,
        message: 'تم تسجيل السداد على الطلب.',
        type: 'Success',
        isSummerEvent: true
      };
    }

    if (action === 'TRANSFER') {
      return {
        title: this.summerTitle,
        message: 'تم تحويل الطلب.',
        type: 'Info',
        isSummerEvent: true
      };
    }

    if (action === 'FINAL_APPROVE') {
      return {
        title: this.summerTitle,
        message: 'تم اعتماد الطلب نهائيًا.',
        type: 'Success',
        isSummerEvent: true
      };
    }

    if (action === 'MANUAL_CANCEL' || action === 'CANCEL' || action === 'AUTO_CANCEL' || action === 'ADMIN_CANCEL') {
      return {
        title: this.summerTitle,
        message: 'تم إلغاء الطلب.',
        type: 'Warn',
        isSummerEvent: true
      };
    }

    if (action === 'COMMENT' || action === 'REPLY') {
      return {
        title: this.summerTitle,
        message: 'تم إضافة تعليق على الطلب.',
        type: 'Info',
        isSummerEvent: true
      };
    }

    if (action === 'APPROVE_TRANSFER') {
      return {
        title: this.summerTitle,
        message: 'تم اعتماد تحويل الطلب.',
        type: 'Success',
        isSummerEvent: true
      };
    }

    return {
      title: this.summerTitle,
      message: 'تم تحديث طلب المصيف.',
      type: 'Info',
      isSummerEvent: true
    };
  }

  private containsSummerMachineTokens(title?: string, body?: string): boolean {
    const merged = `${this.getText(title, '')} ${this.getText(body, '')}`.toUpperCase();
    return merged.includes('SUMMER_REQUEST_UPDATED|')
      || merged.includes('SUMMER_CAPACITY_UPDATED|')
      || merged.includes('REQUEST|')
      || merged.includes('CAPACITY|');
  }

  private normalizeToken(value: unknown): string {
    return this.getText(value, '')
      .toUpperCase()
      .replace(/\s+/g, '_');
  }

  private getText(value: unknown, fallback: string): string {
    const text = String(value ?? '').trim();
    return text.length > 0 ? text : fallback;
  }

  private resolveNotificationType(type: unknown): SummerNotificationLevel {
    const normalized = this.getText(type, '').toUpperCase();
    if (normalized === '2' || normalized === 'SUCCESS') {
      return 'Success';
    }
    if (normalized === '3' || normalized === 'WARN' || normalized === 'WARNING') {
      return 'Warn';
    }
    return 'Info';
  }
}
