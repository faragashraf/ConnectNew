import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { filter, map, share } from 'rxjs/operators';
import { SignalRService } from 'src/app/shared/services/SignalRServices/SignalR.service';
import { SummerNotificationEventNormalizerService } from './summer-notification-event-normalizer.service';
import {
  SummerCapacityRealtimeEvent,
  SummerRealtimeEvent,
  SummerRequestRealtimeEvent
} from './summer-realtime-event.models';

@Injectable({
  providedIn: 'root'
})
export class SummerRequestsRealtimeService {
  private readonly dedupeWindowMs = 1200;
  private readonly recentSignatures = new Map<string, number>();

  private readonly eventsInternal$: Observable<SummerRealtimeEvent> = this.signalRService.Notification$.pipe(
    map(notification => this.normalizer.normalize(notification)),
    filter((event): event is SummerRealtimeEvent => event !== null),
    filter(event => this.acceptEvent(event)),
    share()
  );

  readonly requestUpdates$: Observable<SummerRequestRealtimeEvent> = this.eventsInternal$.pipe(
    filter((event): event is SummerRequestRealtimeEvent => event.kind === 'request')
  );

  readonly capacityUpdates$: Observable<SummerCapacityRealtimeEvent> = this.eventsInternal$.pipe(
    filter((event): event is SummerCapacityRealtimeEvent => event.kind === 'capacity')
  );

  constructor(
    private readonly signalRService: SignalRService,
    private readonly normalizer: SummerNotificationEventNormalizerService
  ) {}

  private acceptEvent(event: SummerRealtimeEvent): boolean {
    const now = Date.now();

    this.recentSignatures.forEach((timestamp, key) => {
      if (now - timestamp > this.dedupeWindowMs) {
        this.recentSignatures.delete(key);
      }
    });

    const previous = this.recentSignatures.get(event.signature);
    this.recentSignatures.set(event.signature, now);
    return !(previous && (now - previous) <= this.dedupeWindowMs);
  }
}
