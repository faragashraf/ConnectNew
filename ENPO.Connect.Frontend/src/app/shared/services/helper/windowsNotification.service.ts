import { Injectable } from "@angular/core";
import { Subject } from "rxjs";

type DispatchNotificationPayload = {
    title: string;
    body: string;
    icon: string;
    options?: NotificationOptions;
    source: string;
};

@Injectable({
    providedIn: 'root'
})
export class WindowsNotificationService {
    PauseWindowsNotification$ = new Subject<boolean>();
    WindowsNotification: boolean = true;
    private readonly serviceWorkerPath = '/service-worker.js';
    private serviceWorkerRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

    constructor() {
        this.PauseWindowsNotification$.subscribe((value) => {
            this.WindowsNotification = value;
            console.log('[Notifications] Runtime toggle changed:', value ? 'enabled' : 'paused');
        });
    }

    initializeNotificationInfra(): void {
        this.logPermissionState('app-init');
        this.logSecureContextState('app-init');
        void this.ensureServiceWorkerRegistration();
    }

    requestNotificationPermission(source: string = 'manual'): Promise<NotificationPermission> {
        const notificationCtor = this.getNotificationCtor();
        if (!notificationCtor) {
            console.warn('[Notifications] Notification API is not supported in this browser.');
            return Promise.resolve('denied');
        }

        console.log(`[Notifications] Requesting permission from "${source}". Current state:`, notificationCtor.permission);
        return notificationCtor.requestPermission()
            .then((permission) => {
                this.logPermissionState(`permission-request:${source}`, permission);
                return permission;
            })
            .catch((error) => {
                console.error('[Notifications] Permission request failed:', error);
                return 'denied';
            });
    }

    async runManualNotificationTest(): Promise<boolean> {
        const permission = this.getCurrentPermission();
        const resolvedPermission = permission === 'granted'
            ? permission
            : await this.requestNotificationPermission('manual-test');

        if (resolvedPermission !== 'granted') {
            console.warn(`[Notifications] Manual test canceled. Permission is "${resolvedPermission}".`);
            return false;
        }

        const now = new Date();
        const time = now.toLocaleString();
        return this.showNotification(
            `If you see this, OS notifications are working. Time: ${time}`,
            'assets/imges/Online.jpg',
            'Test Notification',
            {
                tag: `connect-manual-test-${now.getTime()}`,
                requireInteraction: true
            },
            'manual-test'
        );
    }

    async showNotification(
        body: string,
        _icon?: string,
        title?: string,
        options?: NotificationOptions,
        source: string = 'runtime'
    ): Promise<boolean> {
        const icon = _icon ?? 'assets/imges/Corresponding.png';
        const normalizedTitle = String(title ?? '').trim() || 'Connect | بوابتك للخدمات الداخلية';
        const normalizedBody = String(body ?? '').trim();
        const currentPermission = this.getCurrentPermission();

        if (!normalizedBody) {
            console.warn('[Notifications] Skipping OS notification because the body is empty.', { source, normalizedTitle });
            return false;
        }

        if (!this.WindowsNotification) {
            console.log('[Notifications] Skipping OS notification because runtime toggle is disabled.');
            return false;
        }

        if (!this.getNotificationCtor()) {
            console.warn('[Notifications] Notification API is unavailable.');
            return false;
        }

        console.log('[Notifications] Notification trigger requested:', {
            source,
            permission: currentPermission,
            title: normalizedTitle,
            body: normalizedBody
        });

        if (currentPermission !== 'granted') {
            console.warn(`[Notifications] Permission is "${currentPermission}". Notification was not displayed.`);
            return false;
        }

        return this.dispatchNotification({
            title: normalizedTitle,
            body: normalizedBody,
            icon,
            options,
            source
        });
    }

    private async dispatchNotification(payload: DispatchNotificationPayload): Promise<boolean> {
        const mergedOptions: NotificationOptions = {
            ...payload.options,
            body: payload.body,
            icon: payload.icon,
            badge: payload.options?.badge ?? payload.icon
        };

        try {
            const registration = await this.ensureServiceWorkerRegistration();
            if (registration?.showNotification) {
                await registration.showNotification(payload.title, mergedOptions);
                console.log('[Notifications] OS notification dispatched through service worker.', {
                    source: payload.source,
                    scope: registration.scope,
                    title: payload.title
                });
                return true;
            }

            const NotificationCtor = this.getNotificationCtor();
            if (!NotificationCtor) {
                console.warn('[Notifications] Could not dispatch notification; Notification API became unavailable.');
                return false;
            }

            const notification = new NotificationCtor(payload.title, mergedOptions);
            notification.onclick = () => {
                console.log('[Notifications] OS notification clicked:', payload.title);
            };
            console.log('[Notifications] OS notification dispatched through window.Notification.', {
                source: payload.source,
                title: payload.title
            });
            return true;
        } catch (error) {
            console.error('[Notifications] Failed to dispatch notification.', {
                source: payload.source,
                title: payload.title,
                error
            });
            return false;
        }
    }

    private async ensureServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
        if (!this.isServiceWorkerSupported()) {
            console.log('[Notifications] Service worker is not supported in this browser.');
            return null;
        }

        if (!this.isServiceWorkerContextAllowed()) {
            console.warn('[Notifications] Service worker registration skipped. HTTPS (or localhost) is required.');
            return null;
        }

        if (this.serviceWorkerRegistrationPromise) {
            return this.serviceWorkerRegistrationPromise;
        }

        this.serviceWorkerRegistrationPromise = (async () => {
            const serviceWorker = this.getServiceWorkerContainer();
            if (!serviceWorker) {
                return null;
            }

            try {
                const currentRegistration = await serviceWorker.getRegistration();
                if (currentRegistration?.active?.scriptURL?.includes(this.serviceWorkerPath)) {
                    this.logServiceWorkerStatus('already-registered', currentRegistration);
                    return currentRegistration;
                }

                const registration = await serviceWorker.register(this.serviceWorkerPath);
                const readyRegistration = await serviceWorker.ready;
                const resolvedRegistration = readyRegistration ?? registration;
                this.logServiceWorkerStatus('registered', resolvedRegistration);
                return resolvedRegistration;
            } catch (error) {
                console.error('[Notifications] Service worker registration failed:', error);
                this.serviceWorkerRegistrationPromise = null;
                return null;
            }
        })();

        return this.serviceWorkerRegistrationPromise;
    }

    private getCurrentPermission(): NotificationPermission | 'unsupported' {
        const NotificationCtor = this.getNotificationCtor();
        if (!NotificationCtor) {
            return 'unsupported';
        }
        return NotificationCtor.permission;
    }

    private logPermissionState(context: string, permissionOverride?: NotificationPermission): void {
        const permission = permissionOverride ?? this.getCurrentPermission();
        console.log('[Notifications] Notification permission:', permission, `context=${context}`);
        if (permission === 'default') {
            console.warn('[Notifications] Permission is "default". User must grant permission through an explicit click.');
        } else if (permission === 'denied') {
            console.warn('[Notifications] Permission is "denied". Enable notifications from browser/site settings.');
        }
    }

    private logSecureContextState(context: string): void {
        if (typeof window === 'undefined') {
            return;
        }

        const host = window.location?.hostname ?? '';
        console.log('[Notifications] Secure context check:', {
            context,
            protocol: window.location?.protocol ?? 'unknown',
            host,
            isSecureContext: window.isSecureContext,
            localhostFallback: this.isLocalHost(host)
        });
    }

    private logServiceWorkerStatus(context: string, registration: ServiceWorkerRegistration): void {
        console.log('[Notifications] Service worker status:', {
            context,
            scope: registration.scope,
            installing: registration.installing?.state ?? null,
            waiting: registration.waiting?.state ?? null,
            active: registration.active?.state ?? null
        });
    }

    private isServiceWorkerContextAllowed(): boolean {
        if (typeof window === 'undefined') {
            return false;
        }
        const host = window.location?.hostname ?? '';
        return window.isSecureContext || this.isLocalHost(host);
    }

    private isServiceWorkerSupported(): boolean {
        return !!this.getServiceWorkerContainer();
    }

    private isLocalHost(host: string): boolean {
        return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
    }

    private getServiceWorkerContainer(): ServiceWorkerContainer | null {
        if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
            return null;
        }
        return navigator.serviceWorker;
    }

    private getNotificationCtor(): typeof Notification | null {
        if (typeof window === 'undefined' || !('Notification' in window)) {
            return null;
        }
        return Notification;
    }
}
