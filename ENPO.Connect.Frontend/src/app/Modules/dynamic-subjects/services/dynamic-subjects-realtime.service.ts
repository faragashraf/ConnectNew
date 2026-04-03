import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject, Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { SignalRService } from 'src/app/shared/services/SignalRServices/SignalR.service';
import { DYNAMIC_SUBJECT_EVENT_KIND, DynamicSubjectRealtimeEventDto } from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.dto';

@Injectable({ providedIn: 'root' })
export class DynamicSubjectsRealtimeService implements OnDestroy {
  private readonly eventSubject = new Subject<DynamicSubjectRealtimeEventDto>();
  private readonly subscriptions: Subscription[] = [];
  private readonly seenEventIds = new Map<string, number>();
  private readonly joinedGroups = new Set<string>();

  constructor(private readonly signalRService: SignalRService) {
    this.subscriptions.push(
      this.signalRService.Notification$.subscribe(notification => {
        const parsed = this.parseNotificationPayload(notification);
        if (!parsed) {
          return;
        }

        if (this.isDuplicate(parsed.eventId)) {
          return;
        }

        this.eventSubject.next(parsed);
      })
    );

    this.subscriptions.push(
      this.signalRService.hubConnectionState$
        .pipe(filter(state => String(state ?? '').toLowerCase() === 'online' || String(state ?? '').toLowerCase() === 'connection started'))
        .subscribe(() => {
          this.rejoinGroups();
        })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  events$(): Observable<DynamicSubjectRealtimeEventDto> {
    return this.eventSubject.asObservable();
  }

  subscribeByEntity(entityType: string, entityId: number): Observable<DynamicSubjectRealtimeEventDto> {
    return this.events$().pipe(
      filter(eventItem =>
        String(eventItem.entityType ?? '').toLowerCase() === String(entityType ?? '').toLowerCase()
        && Number(eventItem.entityId) === Number(entityId))
    );
  }

  async joinSubjectGroup(messageId: number): Promise<void> {
    if (!messageId || messageId <= 0) {
      return;
    }

    await this.joinGroup(`SUBJECT:${messageId}`);
  }

  async joinEnvelopeGroup(envelopeId: number): Promise<void> {
    if (!envelopeId || envelopeId <= 0) {
      return;
    }

    await this.joinGroup(`ENVELOPE:${envelopeId}`);
  }

  async joinCategoryGroup(categoryId: number): Promise<void> {
    if (!categoryId || categoryId <= 0) {
      return;
    }

    await this.joinGroup(`SUBJECT_CATEGORY:${categoryId}`);
  }

  private async joinGroup(groupName: string): Promise<void> {
    const normalized = String(groupName ?? '').trim();
    if (normalized.length === 0) {
      return;
    }

    this.joinedGroups.add(normalized);
    await this.signalRService.AddUserTogroup(normalized);
  }

  private rejoinGroups(): void {
    Array.from(this.joinedGroups).forEach(groupName => {
      this.signalRService.AddUserTogroup(groupName);
    });
  }

  private parseNotificationPayload(notification: any): DynamicSubjectRealtimeEventDto | null {
    const payload = String(notification?.notification ?? notification?.Notification ?? '').trim();
    if (!payload) {
      return null;
    }

    try {
      const parsed = JSON.parse(payload) as DynamicSubjectRealtimeEventDto;
      if (!parsed || parsed.kind !== DYNAMIC_SUBJECT_EVENT_KIND || !parsed.eventType) {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  private isDuplicate(eventId: string): boolean {
    const normalized = String(eventId ?? '').trim();
    if (!normalized) {
      return false;
    }

    const now = Date.now();
    this.seenEventIds.forEach((timestamp, key) => {
      if (now - timestamp > 120000) {
        this.seenEventIds.delete(key);
      }
    });

    if (this.seenEventIds.has(normalized)) {
      return true;
    }

    this.seenEventIds.set(normalized, now);
    return false;
  }
}
