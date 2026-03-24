import { ChangeDetectorRef, Component, OnDestroy, OnInit, AfterViewInit, HostListener } from '@angular/core';
import { WindowsNotificationService } from './shared/services/helper/windowsNotification.service';
import { SpinnerService } from './shared/services/helper/spinner.service';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { AuthObjectsService } from './shared/services/helper/auth-objects.service';
import { SignalRService } from './shared/services/SignalRServices/SignalR.service';
import { ConditionalDate } from './shared/Pipe/Conditional-date.pipe';
import * as signalR from '@microsoft/signalr';
import { assignSubscription } from './shared/services/SignalRServices/AdminCerObjectHub.service';
import { Subject, Subscription } from 'rxjs';
import { BroadcastService } from './shared/services/helper/broadcast.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  animations: [
    trigger('shadowAnimation', [
      state('small', style({
        boxShadow: '0 0 20px rgba(33, 150, 243, 0.5)'
      })),
      state('big', style({
        boxShadow: '0 0 100px rgba(33, 150, 243, 0.7)',
      })),
      transition('small <=> big', animate('1s ease-in-out'))
    ])
  ]
})
export class AppComponent implements OnInit, OnDestroy, AfterViewInit {
  currentYear: number = 0;
  _sticky: boolean = true;
  spinnerLoading: string = 'Loading ...';
  IndexedDBCompatibility: boolean = false;
  instructionVisible: boolean = false;
  connectionLifetimeTooltip: string = '';
  private lifetimeInterval: any;
  signalRBannerVisible = false;
  signalRBannerMessage = '';
  signalRBannerType: 'offline' | 'online' = 'offline';
  private signalRRecoveredTimer: any;
  private wasSignalROnline = false;

  constructor(
    public authService: AuthObjectsService,
    public signalRService: SignalRService,
    private spinnerService: SpinnerService,
    public conditionalDate: ConditionalDate,
    private NotificationService: WindowsNotificationService,
    private cdr: ChangeDetectorRef,
    private broadcastService: BroadcastService
  ) {
  }

  ngOnDestroy(): void {
    if (this.authObjectSubscription) this.authObjectSubscription.unsubscribe();
    if (this.authOfflineSubscription) this.authOfflineSubscription.unsubscribe();
    if (this.DomainSubscription) this.DomainSubscription.unsubscribe();
    if (this.spinnerLoadingSubscription) this.spinnerLoadingSubscription.unsubscribe();
    if (this.notificationSubscription) this.notificationSubscription.unsubscribe();
    if (this.fixNotificationSubscription) this.fixNotificationSubscription.unsubscribe();
    if (this.hubConnectionStateSubscription) this.hubConnectionStateSubscription.unsubscribe();
    if (this.signalRRecoveredTimer) clearTimeout(this.signalRRecoveredTimer);
    if (this.lifetimeInterval) {
      clearInterval(this.lifetimeInterval);
      this.lifetimeInterval = null;
    }
  }

  isRamadan = false;
  private isRamadanDate = false;
  authObjectSubscription!: Subscription;
  authOfflineSubscription!: Subscription;
  DomainSubscription!: Subscription;
  spinnerLoadingSubscription!: Subscription;
  notificationSubscription!: Subscription;
  gropNameSubscription!: Subscription;
  fixNotificationSubscription!: Subscription;
  hubConnectionStateSubscription!: Subscription;
  ramadanPrefSubscription!: Subscription;

  gropName: any;
  gropName$ = new Subject<string>();

  ngOnInit(): void {
    window.onblur = () => {
      document.title = '🔴 بوابتك للخدمات الداخلية';
    };

    window.onfocus = () => {
      document.title = 'Connect | بوابتك للخدمات الداخلية';
    };

    this.checkRamadanDate();
    this.currentYear = new Date().getFullYear();

    this.ramadanPrefSubscription = this.authService.isRamadanCelebrationEnabled$.subscribe(enabled => {
      this.isRamadan = this.isRamadanDate && enabled;
      this.cdr.detectChanges();
    });

    this.broadcastService.onMessage().subscribe(msg => {
      if (msg.type === 'USER_SIGNOUT') {
        this.authService.authObject$.next(false);
        this.authService.SignOut();
      }
      else if (msg.type === 'USER_SIGNIN') {
        this.authService.authObject$.next(true);
        this.authService.populateNaBarItems();
        this.spinnerService.show('جاري الاتصال بالـ HubSync');
        this.signalRService.startConnection();
      }
    });

    this.hubConnectionStateSubscription = assignSubscription(
      this.hubConnectionStateSubscription,
      this.signalRService.hubConnectionState$,
      (state: string) => {
        this.signalRService.hubConnectionState = state;
        this.updateSignalRBannerState(state);
      }
    );

    this.authObjectSubscription = assignSubscription(this.authObjectSubscription, this.authService.authObject$, auth => {
      this.authService.isAuthenticated = auth;

      if (!this.authService.isAuthenticated && this.signalRService.hubConnection.state == signalR.HubConnectionState.Connected) {
        this.signalRService.hubConnection ? this.signalRService.hubConnection.stop().catch(error => console.log(error)) : null;
      }
    });

    this.authOfflineSubscription = assignSubscription(this.authOfflineSubscription, this.authService.offlineAuthenticatedt$, auth => {
      this.authService.isOfflineAuthenticated = auth;
    });

    this.DomainSubscription = assignSubscription(this.DomainSubscription, this.authService.DomainAuthenticated$, auth => {
      this.authService.isDomainAuthenticated = auth;
    });

    this.spinnerLoadingSubscription = assignSubscription(this.spinnerLoadingSubscription, this.spinnerService.spinnerLoading$, spinnerLoading => {
      this.spinnerLoading = spinnerLoading;
    });

    const token = localStorage.getItem('ConnectToken');
    const connectFunctions = localStorage.getItem('ConnectFunctions');
    const userId = localStorage.getItem('UserId');
    const authObject = this.authService.getAuthObject();

    if (token != null && token.length > 0 && connectFunctions && userId && authObject) {
      this.authService.authObject$.next(true);
      this.authService.populateNaBarItems();
      this.spinnerService.show('جاري الاتصال بالـ HubSync');
      this.signalRService.startConnection();
    }
    else {
      this.authService.authObject$.next(false);
      this.authService.offlineAuthenticatedt$.next(false);
      this.authService.DomainAuthenticated$.next(false);
      this.authService.SignOut();
    }

    if ('Notification' in window) {
      Notification.requestPermission().then((permission) => {
        if (permission !== 'granted') {
          if ('Notification' in window && Notification.permission !== 'granted') {
            this.instructionVisible = true;
          }
        }
      });
    }
    this.NotificationService.requestNotificationPermission();

    this.notificationSubscription = assignSubscription(this.notificationSubscription, this.signalRService.Notification$, (notification: any) => {
      const notificationBody = String(notification?.notification ?? notification?.Notification ?? '');
      const notificationTitle = String(notification?.title ?? notification?.Title ?? '');
      const notificationSender = String(notification?.sender ?? 'Connect');
      const isCapacitySignal = `${notificationTitle} ${notificationBody}`.toUpperCase().includes('SUMMER_CAPACITY_UPDATED|');

      if (isCapacitySignal) {
        const capacityNotification = {
          ...notification,
          title: 'تحديث سعات المصايف',
          notification: 'تم تحديث السعات المتاحة للحجز.'
        };
        this.signalRService.Notification.push(capacityNotification);
        this.signalRService.primMsgCount++;
        this.cdr.detectChanges();
        return;
      }

      const sev = notification.type == 1 ? 'info' : notification.type == 2 ? 'success' : 'warn';
      this.signalRService.Notification.push(notification);

      this.signalRService.primMsg.add({
        severity: sev,
        summary: `${notificationSender} - ${notificationTitle}`,
        detail: ` ${this.conditionalDate.transform(notification.time, 'full')} :  ${notificationBody}`,
        sticky: false,
        life: 5000
      });
      this.signalRService.primMsgCount++;
      this.NotificationService.showNotification(notificationBody, 'assets/imges/Online.jpg', notificationTitle);
      this.cdr.detectChanges();
    });

    this.gropNameSubscription = assignSubscription(this.gropNameSubscription, this.gropName$, (group: string) => {
      if (group.length > 0) {
        this.gropName = group;
        this.signalRService.AddUserTogroup(this.gropName);
      }
    });

    this.fixNotificationSubscription = assignSubscription(this.fixNotificationSubscription, this.signalRService.fixNotificationOnRecieve$, (isFix) => {
      this._sticky = isFix;
    });
  }

  ngAfterViewInit(): void {
    this.syncSignalRBannerOffset();
    setTimeout(() => this.syncSignalRBannerOffset(), 0);

    this.lifetimeInterval = setInterval(() => {
      this.connectionLifetimeTooltip = this.signalRService.getConnectionLifetime();
      try {
        this.cdr.detectChanges();
      } catch {
        // ignore if view already destroyed
      }
    }, 1000);
  }

  shadowState = 'small';
  animateShadow() {
    setInterval(() => {
      this.shadowState = (this.shadowState === 'small') ? 'big' : 'small';
    }, 1000);
  }

  checkRamadanDate() {
    const today = new Date();
    const ramadanStart = new Date('2026-02-14');
    const ramadanEnd = new Date('2026-03-20');
    this.isRamadanDate = today >= ramadanStart && today <= ramadanEnd;

    const enabled = this.authService.isRamadanCelebrationEnabled$.value;
    this.isRamadan = this.isRamadanDate && enabled;
  }

  onMascotClose() {
    this.authService.setRamadanPreference(false);
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.syncSignalRBannerOffset();
  }

  private syncSignalRBannerOffset(): void {
    const nav = document.querySelector('.p-megamenu') as HTMLElement | null;
    const navHeight = Math.max(Number(nav?.offsetHeight ?? 74), 60);
    document.documentElement.style.setProperty('--main-navbar-height', `${navHeight}px`);
  }

  private updateSignalRBannerState(state: string): void {
    this.syncSignalRBannerOffset();

    const normalized = String(state ?? '').trim().toLowerCase();
    const isOnline = normalized === 'online' || normalized === 'connection started';
    const shouldTrack = this.authService.isAuthenticated && !this.authService.isOfflineAuthenticated;

    if (!shouldTrack) {
      this.signalRBannerVisible = false;
      this.wasSignalROnline = false;
      return;
    }

    if (!isOnline) {
      this.signalRBannerType = 'offline';
      this.signalRBannerMessage = 'اتصال التحديث اللحظي (SignalR) غير مستقر أو مقطوع حالياً. قد تتأخر التحديثات حتى عودة الاتصال.';
      this.signalRBannerVisible = true;
      this.wasSignalROnline = false;
      if (this.signalRRecoveredTimer) clearTimeout(this.signalRRecoveredTimer);
      return;
    }

    if (!this.wasSignalROnline) {
      this.signalRBannerType = 'online';
      this.signalRBannerMessage = 'تمت إعادة اتصال التحديث اللحظي (SignalR) بنجاح.';
      this.signalRBannerVisible = true;
      if (this.signalRRecoveredTimer) clearTimeout(this.signalRRecoveredTimer);
      this.signalRRecoveredTimer = setTimeout(() => {
        this.signalRBannerVisible = false;
      }, 5000);
    }

    this.wasSignalROnline = true;
  }
}
