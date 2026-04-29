import { WindowsNotificationService } from './windowsNotification.service';

type NotificationMockInstance = {
  title: string;
  options?: NotificationOptions;
};

function createNotificationMock(
  initialPermission: NotificationPermission = 'default',
  permissionAfterRequest: NotificationPermission = 'granted'
) {
  class NotificationMock {
    static permission: NotificationPermission = initialPermission;
    static instances: NotificationMockInstance[] = [];
    static requestPermission = jasmine.createSpy('requestPermission').and.callFake(async () => {
      NotificationMock.permission = permissionAfterRequest;
      return permissionAfterRequest;
    });

    onclick: ((this: Notification, ev: Event) => any) | null = null;

    constructor(public title: string, public options?: NotificationOptions) {
      NotificationMock.instances.push({ title, options });
    }
  }

  return NotificationMock;
}

describe('WindowsNotificationService', () => {
  let service: WindowsNotificationService;

  beforeEach(() => {
    service = new WindowsNotificationService();
  });

  it('requests permission and sends manual test notification when granted', async () => {
    const notificationMock = createNotificationMock('default', 'granted');
    spyOn<any>(service, 'getNotificationCtor').and.returnValue(notificationMock);
    spyOn<any>(service, 'ensureServiceWorkerRegistration').and.resolveTo(null);

    const result = await service.runManualNotificationTest();

    expect(result).toBeTrue();
    expect(notificationMock.requestPermission).toHaveBeenCalled();
    expect(notificationMock.instances.length).toBe(1);
    expect(notificationMock.instances[0].title).toBe('Test Notification');
  });

  it('does not show notification when permission is denied', async () => {
    const notificationMock = createNotificationMock('denied', 'denied');
    spyOn<any>(service, 'getNotificationCtor').and.returnValue(notificationMock);
    spyOn<any>(service, 'ensureServiceWorkerRegistration').and.resolveTo(null);

    const result = await service.showNotification('Denied body', 'assets/imges/Online.jpg', 'Denied');

    expect(result).toBeFalse();
    expect(notificationMock.instances.length).toBe(0);
  });

  it('uses service worker notification channel when registration is available', async () => {
    const notificationMock = createNotificationMock('granted', 'granted');
    const swShowNotificationSpy = jasmine.createSpy('showNotification').and.resolveTo();

    const registration = {
      scope: 'https://localhost/',
      showNotification: swShowNotificationSpy
    } as unknown as ServiceWorkerRegistration;

    spyOn<any>(service, 'getNotificationCtor').and.returnValue(notificationMock);
    spyOn<any>(service, 'ensureServiceWorkerRegistration').and.resolveTo(registration);

    const result = await service.showNotification(
      'Body from SignalR',
      'assets/imges/Online.jpg',
      'SignalR Title',
      { tag: 'signalr-test' },
      'signalr'
    );

    expect(result).toBeTrue();
    expect(swShowNotificationSpy).toHaveBeenCalled();
    expect(notificationMock.instances.length).toBe(0);
  });
});
