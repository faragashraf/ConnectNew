import { SummerNotificationDisplayMapperService } from './summer-notification-display-mapper.service';
import { SummerNotificationEventNormalizerService } from './summer-notification-event-normalizer.service';

describe('SummerNotificationDisplayMapperService', () => {
  let normalizer: SummerNotificationEventNormalizerService;
  let mapper: SummerNotificationDisplayMapperService;

  beforeEach(() => {
    normalizer = new SummerNotificationEventNormalizerService();
    mapper = new SummerNotificationDisplayMapperService(normalizer);
  });

  it('formats capacity updates using destination name and batch number from structured payload', () => {
    const payload = JSON.stringify({
      event: 'SUMMER_CAPACITY_UPDATED',
      destinationId: 147,
      destinationName: 'الاسكندرية',
      waveCode: 'W3',
      batchNumber: '3',
      action: 'EDIT',
      emittedAt: '2026-03-30T12:00:00Z'
    });

    const display = mapper.toDisplayNotification({
      sender: 'Connect',
      title: 'إدارة طلبات المصايف',
      notification: payload,
      type: 'Info',
      time: new Date('2026-03-30T12:00:00Z')
    });

    expect(display.title).toBe('إدارة طلبات المصايف');
    expect(display.notification).toBe('تم تحديث سعة الفوج رقم (3) بمصيف (الاسكندرية)، يرجى مراجعة التفاصيل.');
  });

  it('keeps capacity message descriptive when only legacy tokens are present', () => {
    const display = mapper.toDisplayNotification({
      sender: 'Connect',
      title: 'تحديث سعات المصايف',
      notification: 'SUMMER_CAPACITY_UPDATED|147|W2|EDIT|2026-03-30T12:00:00Z',
      type: 'Info'
    });

    expect(display.notification).toContain('تم تحديث سعة الفوج رقم');
    expect(display.notification).toContain('مصيف');
    expect(display.notification).not.toBe('تم تحديث سعة الفوج.');
  });

  it('builds toast summary from the same mapped message', () => {
    const display = mapper.toDisplayNotification({
      sender: 'Connect',
      title: 'إدارة طلبات المصايف',
      notification: 'SUMMER_CAPACITY_UPDATED|147|W7|EDIT|2026-03-30T12:00:00Z',
      type: 'Info'
    });

    const summary = mapper.buildToastSummary(display);

    expect(summary).toContain(display.title);
    expect(summary).toContain(display.notification);
  });

  it('keeps request update notifications mapped as before', () => {
    const display = mapper.toDisplayNotification({
      sender: 'Connect',
      title: 'إدارة طلبات المصايف',
      notification: 'SUMMER_REQUEST_UPDATED|9001|UPDATE',
      type: 'Info'
    });

    expect(display.title).toBe('إدارة طلبات المصايف');
    expect(display.notification).toBe('تم تحديث طلب المصيف.');
  });
});
