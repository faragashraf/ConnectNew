import { Injectable } from '@angular/core';
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
    const payload = notification as {
      title?: string | null;
      notification?: string | null;
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

    const structuredCapacityEvent = this.tryParseStructuredCapacityEvent(texts);
    if (structuredCapacityEvent) {
      return structuredCapacityEvent;
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

  private tryParseStructuredCapacityEvent(texts: string[]): SummerCapacityRealtimeEvent | null {
    for (const text of texts) {
      const normalized = String(text ?? '').trim();
      if (!normalized.startsWith('{') || !normalized.endsWith('}')) {
        continue;
      }

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(normalized) as Record<string, unknown>;
      } catch {
        continue;
      }

      const eventToken = this.normalizeToken(parsed?.['event'] ?? parsed?.['eventType'] ?? parsed?.['kind']);
      if (eventToken !== 'SUMMER_CAPACITY_UPDATED' && eventToken !== 'CAPACITY') {
        continue;
      }

      const categoryId = this.parsePositiveInt(parsed?.['destinationId'] ?? parsed?.['categoryId']);
      const destinationName = String(parsed?.['destinationName'] ?? '').trim();
      const rawWaveCode = String(parsed?.['waveCode'] ?? '').trim();
      const batchNumber = this.resolveBatchNumber(parsed?.['batchNumber'], rawWaveCode);
      const waveCode = rawWaveCode.length > 0 ? rawWaveCode : batchNumber;
      const action = this.normalizeToken(parsed?.['action']) || 'UPDATE';
      const emittedAtIso = String(parsed?.['emittedAt'] ?? parsed?.['emittedAtIso'] ?? '').trim();
      const emittedAtEpochMs = this.resolveEpochMs(emittedAtIso);
      if (!Number.isFinite(categoryId) || categoryId <= 0 || waveCode.length === 0) {
        continue;
      }

      return {
        kind: 'capacity',
        categoryId,
        destinationId: categoryId,
        destinationName: destinationName || undefined,
        waveCode,
        batchNumber,
        action,
        sender: String(parsed?.['sender'] ?? '').trim() || undefined,
        title: String(parsed?.['title'] ?? '').trim() || undefined,
        emittedAtIso: emittedAtIso || undefined,
        raw: normalized,
        signature: `capacity|${categoryId}|${waveCode}|${action}`,
        emittedAtEpochMs
      };
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
          const emittedAtIso = String(directParts[4] ?? '').trim();
          if (Number.isFinite(categoryId) && categoryId > 0 && waveCode.length > 0) {
            return {
              kind: 'capacity',
              categoryId: Math.floor(categoryId),
              destinationId: Math.floor(categoryId),
              waveCode,
              batchNumber: this.resolveBatchNumber(undefined, waveCode),
              action,
              emittedAtIso: emittedAtIso || undefined,
              raw: normalized,
              signature: `capacity|${Math.floor(categoryId)}|${waveCode}|${action}`,
              emittedAtEpochMs: this.resolveEpochMs(emittedAtIso)
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
        const emittedAtIso = String(parts[4] ?? '').trim();
        if (!Number.isFinite(categoryId) || categoryId <= 0 || waveCode.length === 0) {
          continue;
        }

        return {
          kind: 'capacity',
          categoryId: Math.floor(categoryId),
          destinationId: Math.floor(categoryId),
          waveCode,
          batchNumber: this.resolveBatchNumber(undefined, waveCode),
          action,
          emittedAtIso: emittedAtIso || undefined,
          raw: payload,
          signature: `capacity|${Math.floor(categoryId)}|${waveCode}|${action}`,
          emittedAtEpochMs: this.resolveEpochMs(emittedAtIso)
        };
      }
    }

    return null;
  }

  private parsePositiveInt(value: unknown): number {
    const parsed = Number(value ?? 0);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 0;
    }
    return Math.floor(parsed);
  }

  private resolveBatchNumber(batchNumber: unknown, waveCode: string): string {
    const rawBatch = String(batchNumber ?? '').trim();
    if (rawBatch.length > 0) {
      return rawBatch;
    }

    const normalizedWaveCode = String(waveCode ?? '').trim();
    if (normalizedWaveCode.length === 0) {
      return '-';
    }

    const digitsOnly = normalizedWaveCode.replace(/\D+/g, '');
    return digitsOnly.length > 0 ? digitsOnly : normalizedWaveCode;
  }

  private resolveEpochMs(value: unknown): number {
    const parsedDate = new Date(String(value ?? '').trim());
    const epoch = parsedDate.getTime();
    return Number.isFinite(epoch) && epoch > 0 ? epoch : Date.now();
  }

  private normalizeToken(value: unknown): string {
    return String(value ?? '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_');
  }
}
