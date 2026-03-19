import { ChangeDetectorRef, Component, OnDestroy, OnInit, AfterViewInit } from '@angular/core';
import { WindowsNotificationService } from './shared/services/helper/windowsNotification.service';
import { SpinnerService } from './shared/services/helper/spinner.service';
import { Router } from '@angular/router';
import { JwtHelperService } from '@auth0/angular-jwt';
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
  _sticky: boolean = true
  spinnerLoading: string = 'Loading ...'
  IndexedDBCompatibility: boolean = false;
  instructionVisible: boolean = false;
  // isAuth: boolean = false;
  connectionLifetimeTooltip: string = '';
  private lifetimeInterval: any;

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
    if (this.lifetimeInterval) {
      clearInterval(this.lifetimeInterval);
      this.lifetimeInterval = null;
    }
  }
  isRamadan = false;
  private isRamadanDate = false;
  authObjectSubscription!: Subscription
  authOfflineSubscription!: Subscription
  DomainSubscription!: Subscription
  spinnerLoadingSubscription!: Subscription
  notificationSubscription!: Subscription
  gropNameSubscription!: Subscription
  fixNotificationSubscription!: Subscription
  hubConnectionStateSubscription!: Subscription;
  ramadanPrefSubscription!: Subscription;

  gropName: any; // Add this if not already present
  gropName$ = new Subject<string>();//s if not already present

  // jnjhjj
  ngOnInit(): void {

    window.onblur = () => {
      document.title = '🔴 بوابتك للخدمات الداخلية';
    }

    window.onfocus = () => {
      document.title = 'Connect | بوابتك للخدمات الداخلية';
    }

    this.checkRamadanDate();
    this.currentYear = new Date().getFullYear();

    // Subscribe to Ramadan Preference
    this.ramadanPrefSubscription = this.authService.isRamadanCelebrationEnabled$.subscribe(enabled => {
        this.isRamadan = this.isRamadanDate && enabled;
        this.cdr.detectChanges();
    });

    // component snippet
    this.broadcastService.onMessage().subscribe(msg => {
      if (msg.type === 'USER_SIGNOUT') {
        this.authService.authObject$.next(false);
        this.authService.SignOut();
      }
      else if (msg.type === 'USER_SIGNIN') {
        this.authService.authObject$.next(true);
        this.authService.populateNaBarItems();
        this.spinnerService.show('جاري الإتصال بالـ HubSync');
        this.signalRService.startConnection();
      }
    });


    this.hubConnectionStateSubscription = assignSubscription(
      this.hubConnectionStateSubscription,
      this.signalRService.hubConnectionState$,
      (state: string) => {
        this.signalRService.hubConnectionState = state;
      }
    );



    this.authObjectSubscription = assignSubscription(this.authObjectSubscription, this.authService.authObject$, auth => {
      this.authService.isAuthenticated = auth

      // To Close HubServer Connection when isAuthenticated == false
      if (!this.authService.isAuthenticated && this.signalRService.hubConnection.state == signalR.HubConnectionState.Connected) {
        this.signalRService.hubConnection ? this.signalRService.hubConnection.stop().catch(error => console.log(error)) : null
      }
    });

    this.authOfflineSubscription = assignSubscription(this.authOfflineSubscription, this.authService.offlineAuthenticatedt$, auth => {
      this.authService.isOfflineAuthenticated = auth;
    });

    this.DomainSubscription = assignSubscription(this.DomainSubscription, this.authService.DomainAuthenticated$, auth => {
      this.authService.isDomainAuthenticated = auth
    });


    this.spinnerLoadingSubscription = assignSubscription(this.spinnerLoadingSubscription, this.spinnerService.spinnerLoading$, spinnerLoading => {
      this.spinnerLoading = spinnerLoading
    })

    const token = localStorage.getItem('ConnectToken');
    const ConnectFunctions = localStorage.getItem('ConnectFunctions');
    const UserId = localStorage.getItem('UserId');
    const Picture = localStorage.getItem('Picture');
    const AuthObject = this.authService.getAuthObject();

    if (token != null && token.length > 0
      // && !this.jwtHelper.isTokenExpired(token)
      && ConnectFunctions && UserId && AuthObject
    ) {
      // this.authService.offlineAuthenticatedt$.next(false);
      // this.authService.DomainAuthenticated$.next(true);
      this.authService.authObject$.next(true);
      this.authService.populateNaBarItems();
      this.spinnerService.show('جاري الإتصال بالـ HubSync');
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
      })
    }
    this.NotificationService.requestNotificationPermission();

    this.notificationSubscription = assignSubscription(this.notificationSubscription, this.signalRService.Notification$, (notification: any) => {
      let sev = notification.type == 1 ? 'info' : notification.type == 2 ? 'success' : 'warn'
      this.signalRService.Notification.push(notification)

      this.signalRService.primMsg.add({
        severity: sev,
        summary: `${notification.sender} - ${notification.title}`,
        detail: ` ${this.conditionalDate.transform(notification.time, "full")} :  ${notification.notification}`,
        sticky: false,
        life: 5000 // notification will disappear after 5 seconds
      })
      this.signalRService.primMsgCount++
      this.NotificationService.showNotification(notification.notification, 'assets/imges/Online.jpg', notification.title);
      this.cdr.detectChanges(); // Manually trigger change detection

    });

    this.gropNameSubscription = assignSubscription(this.gropNameSubscription, this.gropName$, (group: string) => {
      if (group.length > 0) {
        this.gropName = group;
        this.signalRService.AddUserTogroup(this.gropName);
      }
    });

    this.fixNotificationSubscription = assignSubscription(this.fixNotificationSubscription, this.signalRService.fixNotificationOnRecieve$, (Isfix) => {
      this._sticky = Isfix;
    });
  }
  
  ngAfterViewInit(): void {
    this.lifetimeInterval = setInterval(() => {
      this.connectionLifetimeTooltip = this.signalRService.getConnectionLifetime();
      try {
        this.cdr.detectChanges();
      } catch (e) {
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


  // Add this to your component class

  checkRamadanDate() {
    const today = new Date();
    // Set actual Ramadan start/end dates for current year
    const ramadanStart = new Date('2026-02-14');
    const ramadanEnd = new Date('2026-03-20');
    // Using instance variable isRamadanDate
    this.isRamadanDate = today >= ramadanStart && today <= ramadanEnd;
    
    // Initial sync
    const enabled = this.authService.isRamadanCelebrationEnabled$.value;
    this.isRamadan = this.isRamadanDate && enabled;
  }

  onMascotClose() {
      // Logic per user request: "Confirmation that closing the character also hides Ramadan vibes"
      // We disable the global setting.
      this.authService.setRamadanPreference(false);
  }
}
