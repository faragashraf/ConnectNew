import { Injectable } from '@angular/core';
import { NotificationDto } from 'src/app/shared/services/SignalRServices/SignalR.service';
import {
  SummerCapacityRealtimeEvent,
  SummerRealtimeEvent,
  SummerRequestRealtimeEvent
} from './summer-realtime-event.models';

@Injectable({
  providedIn: 'root'
})
export class SummerNotificationEventNormalizerService {
  normalize(notification: unknown): SummerRealtimeEvent | null {
    const payload = notification as NotificationDto & {
      Notification?: string;
      Title?: string;
      Sender?: string;
    };

    const title = String(payload?.title ?? payload?.Title ?? '').trim();
    const body = String(payload?.notification ?? payload?.Notification ?? '').trim();
    const texts = [body, title].filter(text => text.length > 0);
    if (texts.length === 0) {
      return null;
    }

    const requestEvent = this.tryParseRequestEvent(texts);
    if (requestEvent) {
      return requestEvent;
    }

    const capacityEvent = this.tryParseCapacityEvent(texts);
    if (capacityEvent) {
      return capacityEvent;
    }

    return null;
  }

  private tryParseRequestEvent(texts: string[]): SummerRequestRealtimeEvent | null {
    const markers = ['SUMMER_REQUEST_UPDATED|', 'request|'];
    for (const text of texts) {
      const normalized = String(text ?? '').trim();
      if (!normalized) {
        continue;
      }

      const directParts = normalized.split('|');
      if (directParts.length >= 3) {
        const head = String(directParts[0] ?? '').trim().toLowerCase();
        if (head === 'summer_request_updated' || head === 'request') {
          const messageId = Number(directParts[1] ?? 0);
          if (Number.isFinite(messageId) && messageId > 0) {
            const action = String(directParts[2] ?? '').trim().toUpperCase();
            return {
              kind: 'request',
              messageId: Math.floor(messageId),
              action,
              raw: normalized,
              signature: `request|${Math.floor(messageId)}|${action}`,
              emittedAtEpochMs: Date.now()
            };
          }
        }
      }

      const lower = normalized.toLowerCase();
      for (const marker of markers) {
        const index = lower.indexOf(marker.toLowerCase());
        if (index < 0) {
          continue;
        }

        const payload = normalized.substring(index).trim();
        const parts = payload.split('|');
        if (parts.length < 3) {
          continue;
        }

        const messageId = Number(parts[1] ?? 0);
        if (!Number.isFinite(messageId) || messageId <= 0) {
          continue;
        }

        const action = String(parts[2] ?? '').trim().toUpperCase();
        return {
          kind: 'request',
          messageId: Math.floor(messageId),
          action,
          raw: payload,
          signature: `request|${Math.floor(messageId)}|${action}`,
          emittedAtEpochMs: Date.now()
        };
      }
    }

    return null;
  }

  private tryParseCapacityEvent(texts: string[]): SummerCapacityRealtimeEvent | null {
    const markers = ['SUMMER_CAPACITY_UPDATED|', 'capacity|'];
    for (const text of texts) {
      const normalized = String(text ?? '').trim();
      if (!normalized) {
        continue;
      }

      const directParts = normalized.split('|');
      if (directParts.length >= 4) {
        const head = String(directParts[0] ?? '').trim().toLowerCase();
        if (head === 'summer_capacity_updated' || head === 'capacity') {
          const categoryId = Number(directParts[1] ?? 0);
          const waveCode = String(directParts[2] ?? '').trim();
          const action = String(directParts[3] ?? '').trim().toUpperCase();
          if (Number.isFinite(categoryId) && categoryId > 0 && waveCode.length > 0) {
            return {
              kind: 'capacity',
              categoryId: Math.floor(categoryId),
              waveCode,
              action,
              raw: normalized,
              signature: `capacity|${Math.floor(categoryId)}|${waveCode}|${action}`,
              emittedAtEpochMs: Date.now()
            };
          }
        }
      }

      const lower = normalized.toLowerCase();
      for (const marker of markers) {
        const index = lower.indexOf(marker.toLowerCase());
        if (index < 0) {
          continue;
        }

        const payload = normalized.substring(index).trim();
        const parts = payload.split('|');
        if (parts.length < 4) {
          continue;
        }

        const categoryId = Number(parts[1] ?? 0);
        const waveCode = String(parts[2] ?? '').trim();
        const action = String(parts[3] ?? '').trim().toUpperCase();
        if (!Number.isFinite(categoryId) || categoryId <= 0 || waveCode.length === 0) {
          continue;
        }

        return {
          kind: 'capacity',
          categoryId: Math.floor(categoryId),
          waveCode,
          action,
          raw: payload,
          signature: `capacity|${Math.floor(categoryId)}|${waveCode}|${action}`,
          emittedAtEpochMs: Date.now()
        };
      }
    }

    return null;
  }
}
