// Broadcast service (no filepath)
import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject } from 'rxjs';

export interface BroadcastMessage {
  type: string;
  payload?: any;
  origin?: string;
  timestamp?: number;
}

@Injectable({ providedIn: 'root' })
export class BroadcastService implements OnDestroy {
  private readonly channelName = 'enpo-correspondence';
  private readonly storageKey = `${this.channelName}:message`;
  private bc?: BroadcastChannel;
  private incoming$ = new Subject<BroadcastMessage>();
  private tabId: string;
  private storageListener = (ev: StorageEvent) => this.onStorageEvent(ev);

  constructor() {
    // stable tab id to avoid reacting to our own messages
    this.tabId = (window.crypto && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : `${Date.now()}-${Math.random()}`;

    if ('BroadcastChannel' in window) {
      try {
        this.bc = new BroadcastChannel(this.channelName);
        this.bc.addEventListener('message', (ev: MessageEvent) => this.handleIncoming(ev.data));
      } catch (e) {
        // fall through to storage fallback
        (window as any).addEventListener('storage', this.storageListener);
      }
    } else {
      // fallback using localStorage events (only fires in other tabs)
      (window as any).addEventListener('storage', this.storageListener);
    }
  }

  // subscribe to incoming messages
  onMessage(): Observable<BroadcastMessage> {
    return this.incoming$.asObservable();
  }

  // post a message to other tabs (do NOT include secrets or raw JWTs)
  post(message: Omit<BroadcastMessage, 'origin' | 'timestamp'>) {
    const envelope: BroadcastMessage = {
      ...message,
      origin: this.tabId,
      timestamp: Date.now()
    };

    if (this.bc) {
      try {
        this.bc.postMessage(envelope);
        return;
      } catch (e) {
        // fallback to storage write if postMessage fails
      }
    }

    this.emitViaStorage(envelope);
  }

  // close channel and cleanup
  close() {
    if (this.bc) {
      try { this.bc.close(); } catch { /* ignore */ }
      this.bc = undefined;
    }
    (window as any).removeEventListener('storage', this.storageListener);
    this.incoming$.complete();
  }

  ngOnDestroy(): void {
    this.close();
  }

  // -------------------------
  // Internal helpers
  // -------------------------
  private handleIncoming(msg: any) {
    if (!msg || typeof msg.type !== 'string') return;
    if (msg.origin === this.tabId) return; // ignore messages from same tab
    this.incoming$.next(msg as BroadcastMessage);
  }

  private emitViaStorage(msg: BroadcastMessage) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(msg));
      // remove quickly to keep localStorage clean; other tabs receive the event
      localStorage.removeItem(this.storageKey);
    } catch (e) {
      console.warn('BroadcastService: storage fallback failed', e);
    }
  }

  private onStorageEvent(ev: StorageEvent) {
    if (ev.key !== this.storageKey || !ev.newValue) return;
    try {
      const msg = JSON.parse(ev.newValue) as BroadcastMessage;
      if (!msg || msg.origin === this.tabId) return;
      this.incoming$.next(msg);
    } catch {
      // ignore malformed payloads
    }
  }
}