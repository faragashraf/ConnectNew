import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { environment } from 'src/environments/environment';
import { MessageService } from 'primeng/api';
import { JwtHelperService } from '@auth0/angular-jwt';
import { Router } from '@angular/router';
import { MsgsService } from '../helper/msgs.service';
import { BehaviorSubject, firstValueFrom, interval, Subject, Subscription, take, timeout } from 'rxjs';
import { ChatModel } from '../../models/ChatModel';
import { Message } from '../../models/Message';
import { WindowsNotificationService } from '../helper/windowsNotification.service';
import { SpinnerService } from '../helper/spinner.service';
import { AuthObjectsService } from '../helper/auth-objects.service';
import { ConditionalDate } from '../../Pipe/Conditional-date.pipe';
import { NotificationDisplayMapperService } from '../notifications/notification-display-mapper.service';

export enum NotificationType {
  info = 'Info',
  success = 'Success',
  warn = 'Warn'
}

export enum NotificationCategory {
  system = 'System',
  business = 'Business'
}

export interface NotificationDto {
  type: NotificationType;
  sender?: string | null;
  title: string;
  notification: string;
  category?: NotificationCategory | null;
  time?: Date;
  readStatus?: boolean;
}
export interface objectDto {
  action: string;
  object: any;
}

export interface UserDataDto {
  uniqId: string;
  connectionId: string;
  userip: string;
  userId: string;
  currentAplication: string;
  userName: string | null;
  department: string | null;
  groupMembers: string[];
  currentScreen: string;
  lastSeen: string;
  status: boolean;
  version: number;
  // Chat-related properties (optional for compatibility)
  chatInitiated?: boolean;
  unreadCount?: number;
}

type OrgUnitWithCountDto = {
  unitId?: number | string | null;
};

@Injectable({
  providedIn: 'root'
})
export class SignalRService {
  baseUrl: string = environment.SignalRHubServer
  public hubConnection: signalR.HubConnection = {} as signalR.HubConnection;
  userAuth: string = '';
  userRName: string = '';
  groupName: string = environment.OTPApplicationName; // <-- Make group name generic
  private readonly summerBroadcastGroups: string[] = ['CONNECT', 'CONNECT - TEST'];

  constructor(
    public authservice: AuthObjectsService,
    private notificationService: WindowsNotificationService,
    private jwtHelper: JwtHelperService,
    private msgsService: MsgsService, public primMsg: MessageService,
    private router: Router, private conditionalDate: ConditionalDate,
    private spinnerService: SpinnerService,
    private notificationDisplayMapper: NotificationDisplayMapperService) { }


  fixNotificationOnRecieve$ = new Subject<boolean>(); //Subscribe from app.component, and next from HubSync.component
  public onlineUsers: UserDataDto[] = []
  ChatListHistory$ = new Subject<UserDataDto[]>()
  OnLineUsers$ = new Subject<UserDataDto[]>();
  message$ = new Subject<Message>();
  messages$ = new Subject<Message[]>();
  expire$ = new Subject<any>();
  typingState$ = new Subject<boolean>();
  anyObject$ = new Subject<any>();

  Notification$ = new Subject<NotificationDto>();
  Notification: NotificationDto[] = []
  notificationList$ = new Subject<any[]>();
  primMsgList: any[] = [];
  primMsgCount: number = 0
  private refreshTokenResponse$ = new Subject<string>();
  private readonly notificationDedupeWindowMs = 2500;
  private readonly recentNotificationSignatures = new Map<string, number>();

  hubConnectionState$ = new BehaviorSubject<string>('Disconnected');
  hubConnectionState: string = '';

  showUpload$ = new Subject<any>();




  intervalSubscription: Subscription | null = null;
  sessionTimeout: any = null;
  encryptedText: string = ''
  decryptedText: string = ''

  // Helper: Set message flags based on sender
  private setMessageFlags(message: Message): Message {
    if (message.from === this.userAuth) {
      message.isMe = true;
      message.isRead = true;
    } else {
      message.isMe = false;
      message.isRead = false;
    }
    return message;
  }

  // Helper: Show notification for private messages
  private showPrivateMessageNotification(message: Message) {
    const msg =
      message.content.length > 70
        ? message.content.slice(0, 50) + '....'
        : message.content.slice(0, 50);
    this.notificationService.showNotification(
      msg,
      'assets/imges/Online.jpg',
      'رسالة من : ' + message.senderName
    );
  }

  // Helper: Start session expiration timer
  startSessionTimer(exp: number) {
    let sessionTime: number = exp;
    if (this.intervalSubscription && !this.intervalSubscription.closed) {
      this.intervalSubscription.unsubscribe();
    }
    // clear any existing one-shot timeout
    if (this.sessionTimeout) {
      clearTimeout(this.sessionTimeout);
      this.sessionTimeout = null;
    }
    this.intervalSubscription = interval(1000).subscribe(() => {
      sessionTime--;
      if (sessionTime >= 0) {
        this.expire$.next(sessionTime);
        // console.log('sessionTime', sessionTime);  
      } else {
        this.intervalSubscription?.unsubscribe();
      }
    });

    // One-shot timeout to run when session expires (exp seconds). Logs the exact time
    // and performs the sign-out and reload.
    this.sessionTimeout = setTimeout(() => {
      console.log('Session timer fired at', new Date().toISOString());
      try {
        this.expire$.next(0);
        this.authservice.SignOut();
        window.location.reload();
      } catch (e) {
        console.error('Error during session timeout handling', e);
      }
    }, exp * 1000);
  }
  private connectionStartTime: number = 0

  getConnectionLifetime(): string {
    if (!this.connectionStartTime) return '';

    const elapsed = Date.now() - this.connectionStartTime;
    const totalSeconds = Math.floor(elapsed / 1000);

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    // Format as hh:mm:ss or mm:ss
    if (hours > 0) {
      return `مدة الإتصال : ${hours.toString().padStart(2, '0')}:${minutes
        .toString()
        .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      return `مدة الإتصال : ${minutes.toString().padStart(2, '0')}:${seconds
        .toString()
        .padStart(2, '0')}`;
    }
  }

  private getUnitGroupNamesFromAuthObject(): string[] {
    const authObject = this.authservice.getAuthObject() as { vwOrgUnitsWithCounts?: OrgUnitWithCountDto[] } | null;
    const orgUnits = Array.isArray(authObject?.vwOrgUnitsWithCounts) ? authObject!.vwOrgUnitsWithCounts : [];
    const groups = new Set<string>();

    orgUnits.forEach(unit => {
      const groupName = String(unit?.unitId ?? '').trim();
      if (groupName.length > 0) {
        groups.add(groupName);
      }
    });

    return Array.from(groups);
  }

  private async registerUserGroups(): Promise<void> {
    const groups = new Set<string>();
    const defaultGroup = String(this.groupName ?? '').trim();
    if (defaultGroup.length > 0) {
      groups.add(defaultGroup);
    }

    this.summerBroadcastGroups
      .map(group => String(group ?? '').trim())
      .filter(group => group.length > 0)
      .forEach(group => groups.add(group));

    this.getUnitGroupNamesFromAuthObject().forEach(group => groups.add(group));
    await Promise.all(Array.from(groups).map(group => this.AddUserTogroup(group)));
  }

  startConnection() {
    this.userAuth = this.authservice.returnCurrentUser();
    this.userRName = this.authservice.returnCurrentUserName();
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(this.baseUrl + '/ChatHub'
        , { accessTokenFactory: () => localStorage.getItem('ConnectToken') as string ?? '' }
      )
      // .withHubProtocol(new signalR.JsonHubProtocol())
      .configureLogging(signalR.LogLevel.Debug)
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: retryContext => {
          const { previousRetryCount } = retryContext;
          let delay: number;

          if (previousRetryCount < 5) {
            delay = 3000; // 3 seconds for the first 5 attempts
          } else {
            delay = 10000; // 10 seconds for all subsequent attempts (infinite)
          }
          console.log(
            `SignalR reconnect attempt ${previousRetryCount + 1}, next elapsedMilliseconds in ${delay / 1000} seconds , next retryReason in ${retryContext.retryReason}`)
          return delay;
        }
      })
      .build();
    this.hubConnectionState$.next('Connecting')
    this.hubConnection
      .start()
      .then(async () => {
        this.connectionStartTime = Date.now(); // <-- Set start time here

        this.spinnerService.hide();
        await this.hubConnectionState$.next('Connection Started')
        await this.registerUserGroups();

        const token = localStorage.getItem('ConnectToken') as string;
        // console.log('RefreshToken',token)
        // await this.RefreshToken(token)
      })
      .catch((err) => {
        this.spinnerService.hide();
        // this.msgsService.msgError('خطأ بالإتصال بالـ HubSync', 'هناك خطأ ما', true)
        this.msgsService.msgConfirm(
          err.message == 'Failed to complete negotiation with the server: TypeError: Failed to fetch' ?
            'فشل بالإتصال بالـ <span style="color:blue">HubSync </span><br><span style="color:black">سيتم الاستمرار بدون اتصال حي "مباشر"</span>' : err.message, 'استمرار').then(async result => {
              if (result == true) {
                await this.hubConnectionState$.next('Ashraf');
                await this.authservice.offlineAuthenticatedt$.next(true)
              } else {
                this.router.navigate(['/Home']);
                await this.authservice.authObject$.next(false)
                await this.authservice.DomainAuthenticated$.next(false)
                await this.authservice.offlineAuthenticatedt$.next(false)
                this.hubConnectionState$.next('Error while starting connection')
              }
            })
      });


    this.hubConnection.onreconnecting(async () => {
      this.connectionStartTime = 0; // <-- Set start time here
      await this.hubConnectionState$.next('Connecting')
      await this.authservice.offlineAuthenticatedt$.next(false)
    });

    this.hubConnection.onclose(async () => {
      this.connectionStartTime = Date.now(); // <-- Set start time here
      this.spinnerService.hide();
    });

    this.hubConnection.onreconnected(async () => {
      this.connectionStartTime = Date.now(); // <-- Set start time here
      await this.hubConnectionState$.next('Online')
      await this.registerUserGroups();
    });

    this.hubConnection.on('Connected', async () => {
      this.connectionStartTime = Date.now(); // <-- Set start time here
      await this.hubConnectionState$.next('Online')
      await this.registerUserGroups();
      console.log('XXXXXXXXXXXX')
    });
    this.hubConnection.on('AddListedAppPatternAsync', async () => {
      await this.registerUserGroups();
    });
    this.hubConnection.on('ForceDisconnectRequest', (customUser, currentIp) => {
      let msg = '';
      if (currentIp == customUser.userip)
        msg = 'متصفح آخر';
      else
        msg = customUser.userip;
      this.msgsService.msgConfirm('تم اكتشاف تسجيل دخولك من خلال ' + msg + '<br><span style="color:black;font-weight: bold;font-size: medium;">' +
        'هل تريد تسجيل الخروج هناك؟' + '</span> ', 'تسجيل الخروج')
        .then(async result => {
          if (result == true) {
            await this.ForceDisconnectCurrentSession(this.userAuth)
            await this.hubConnectionState$.next('Disconnected')
            // this.router.navigate(['/Auth/Login']);
            this.notificationService.showNotification('تم تسجيل الخروج من الجهاز الآخر بنجاح، قم بتسجيل الدخول مرة أخرى', 'assets/imges/Online.jpg', "رسالة تأكيد")
            await this.msgsService.msgSuccess('<span style="color:green;font-size: large">تم تسجيل الخروج من الجهاز الآخر بنجاح</span><br>قم بتسجيل الدخول مرة أخرى')
          }
          else {
            this.stopChatConnection();
            this.authservice.SignOut();
            this.router.navigate(['/Home']);
          }
        });
      this.spinnerService.hide();
    });

    this.hubConnection.on('DisconnectCurrentSession', (msg) => {
      this.hubConnectionState$.next('Disconnected')
      // this.router.navigate(['/Auth/Login']);
      this.hubConnection.stop().catch(error => console.log(error));
      this.notificationService.showNotification(msg, 'assets/imges/Offline.jpg', "رسالة تأكيد")
      this.authservice.SignOut();
    });

    this.hubConnection.on('RefreshToken', (_token) => {
      localStorage.setItem('ConnectToken', _token)
      const exp = 1800; // 30 minutes in seconds
      this.startSessionTimer(exp);
      this.refreshTokenResponse$.next(_token);
    });

    this.hubConnection.on('LogOut', () => {
      this.hubConnection.stop().then(() => {
        this.notificationService.showNotification('تم تسجيل خروجك من المتصفح الحالي، بسبب تسجيل دخولك من متصفح آخر')
        this.authservice.SignOut();
        this.stopChatConnection();
        window.location.reload();
      }).catch(error => console.log(error))
    });
    this.hubConnection.on('ReciveNotification', (Notification) => {
      if (this.shouldEmitNotification(Notification as NotificationDto)) {
        this.Notification$.next(Notification)
      }
    });
    this.hubConnection.on('RecieveHistory', (UserChatHistory, UserHistory: any) => {
      this.messages$.next(UserHistory)
      this.ChatListHistory$.next(UserChatHistory)
    });
    this.hubConnection.on('OnlineUsers', (userData: UserDataDto | UserDataDto[]) => {
      this.updateOnlineUserData(userData);
    });
    this.hubConnection.on('ReceiveMeassage', (NewMessage: Message) => {
      this.message$.next(this.setMessageFlags(NewMessage));
    });
    this.hubConnection.on('OpenPrivateChat', (NewMessage: Message) => {
      if (NewMessage.from !== this.userAuth) {
        this.showPrivateMessageNotification(NewMessage);
      }
      this.message$.next(this.setMessageFlags(NewMessage));
    });
    this.hubConnection.on('NewPrivateMessage', (NewMessage: Message) => {
      if (NewMessage.from !== this.userAuth) {
        this.showPrivateMessageNotification(NewMessage);
      }
      this.message$.next(this.setMessageFlags(NewMessage));
    });
    this.hubConnection.on('ReceiveObject', (object: any) => {
      this.anyObject$.next(object)
    });
    this.hubConnection.on("Ping", token => {
      this.hubConnection.invoke("Pong", token).catch(console.error);
    });
    this.hubConnection.on('ReceiveNotificationList', (notifications: NotificationDto[]) => {
      this.primMsgList = [];
      this.Notification = [];
      this.primMsgCount = 0;

      const normalizedNotifications = (Array.isArray(notifications) ? notifications : [])
        .map(notification => this.notificationDisplayMapper.toDisplayNotification(notification) as unknown as NotificationDto)
        .sort((a, b) => this.toEpochMs(b?.time) - this.toEpochMs(a?.time));

      normalizedNotifications.forEach(displayNotification => {
        this.Notification.push(displayNotification);
        let _notification = {
          severity: displayNotification.type,
          summary: this.notificationDisplayMapper.buildToastSummary(displayNotification),
          detail: `${this.conditionalDate.transform(displayNotification?.time ?? null, "full")}`,
          sticky: false,
          life: 5000 // notificat
        };
        this.primMsgList.push(_notification);

        this.primMsgCount++;
      });
      this.notificationList$.next(normalizedNotifications as any[]);
    });
    this.hubConnection.on('RecieveTypingState', (NewMessage: Message) => {
      if (NewMessage.to == this.userAuth) {
        this.typingState$.next(true)
        setTimeout(() => {
          this.typingState$.next(false)
        }, 2000);
      }
    });
    ///////////////////////////////     Encrypt & Decrypt       /////////////////////////////////////////
    // this.hubConnection.on('encrypt', (_encryptedText) => {
    //   this.encryptedText$ = _encryptedText
    // });
    // this.hubConnection.on('decrypt', (_decryptedText) => {
    //   this.decryptedText$ = _decryptedText
    // });
    ///////////////////////////////////////////////////////////////////////////////////////
  }
  stopChatConnection() {
    this.hubConnection.stop().catch(error => console.log(error))
  }
  async RefreshToken(token: string) {
    return this.hubConnection.invoke('RefreshToken', token)
      .catch(error => console.log(error));
  }

  async requestTokenRefresh(token: string, timeoutMs: number = 5000): Promise<string> {
    if (!token || !token.trim()) {
      throw new Error('Token is required to refresh session');
    }

    if (!this.hubConnection || this.hubConnection.state !== signalR.HubConnectionState.Connected) {
      throw new Error('SignalR connection is not available for token refresh');
    }

    const waitForRefreshToken = firstValueFrom(
      this.refreshTokenResponse$.pipe(
        take(1),
        timeout({ first: timeoutMs })
      )
    );

    await this.RefreshToken(token);
    return await waitForRefreshToken;
  }
  async SendMessage(_content: string) {
    const message: Message = {
      timeStamp: new Date(),
      isMe: true,
      from: this.userAuth,
      to: '',
      content: _content,
      isRead: false,
      senderName: this.userRName
    }
    return this.hubConnection.invoke('ReceiveMessage', message)
      .catch(error => console.log(error))
  }
  async SendPrivateMessage(to: ChatModel, _content: string) {
    let _user = this.onlineUsers.find(f => f.userId == to.userId) as UserDataDto
    const message: Message = {
      timeStamp: new Date(),
      isMe: true,
      from: this.userAuth,
      to: _user.userId,
      content: _content,
      isRead: false,
      senderName: this.userRName
    }
    if (to.chatInitiated == undefined || !to.chatInitiated) {
      return this.hubConnection.invoke('CreatePrivateChat', message)
        .catch(error => console.log(error));
    } else {
      return this.hubConnection.invoke('ReceivePrivateMessage', message)
        .catch(error => console.log(error));
    }
  }
  async SendTypingState(to: ChatModel) {
    let _User = this.onlineUsers.find(f => f.userName == to.userName) as UserDataDto
    const message: Message = {
      timeStamp: new Date(),
      isMe: true,
      from: this.userAuth,
      to: _User.userId,
      content: '',
      isRead: false,
      senderName: this.userRName
    }
    this.hubConnection.invoke('SendTypingState', message)
      .catch(error => console.log(error));
  }
  async AddUserTogroup(groupName: string) {
    return this.hubConnection.invoke('AddUserTogroup', groupName)
      .catch(error => console.log(error));
  }
  async RemoveFromGroupAsync(groupName: string) {
    return this.hubConnection.invoke('RemoveUserFromgroup', groupName)
      .catch(error => console.log(error));
  }
  async SendObjectToGroup(groupName: string, object: any) {
    return this.hubConnection.invoke('SendObjectToGroup', groupName, object)
      .catch(error => console.log(error));
  }
  async SendNotificationToUser(userId: string, Notification: NotificationDto) {     //   info = 1,    success= 2 ,    warn = 3,
    return this.hubConnection.invoke('SendNotificationToUser', userId, Notification)
      .catch(error => console.log(error));
  }
  async SendNotificationToGroup(groupName: string, Notification: any) {     //   info = 1,    success= 2 ,    warn = 3,
    return this.hubConnection.invoke('SendNotificationToGroup', groupName, Notification)
      .catch(error => console.log(error));
  }
  async UpdateUserCurrentScreen(currentScreen: string) {     //   info = 1,    success= 2 ,    warn = 3,
    return this.hubConnection.invoke('UpdateUserCurrentScreen', currentScreen)
      .catch(error => console.log(error));
  }
  async LogOut(userId: string) {
    return this.hubConnection.invoke('LogOut', userId)
      .catch(error => console.log(error));
  }
  async ForceDisconnectCurrentSession(userId: string) {
    return this.hubConnection.invoke('ForceDisconnectCurrentSession', userId)
      .catch(error => console.log(error));
  }

  private shouldEmitNotification(notification: NotificationDto): boolean {
    const payload = notification as NotificationDto & {
      Notification?: string;
      Title?: string;
      Sender?: string;
      Type?: string;
      Category?: string;
    };

    const body = String(payload?.notification ?? payload?.Notification ?? '').trim();
    const title = String(payload?.title ?? payload?.Title ?? '').trim();
    const sender = String(payload?.sender ?? payload?.Sender ?? '').trim();
    const type = String(payload?.type ?? payload?.Type ?? '').trim();
    const category = String(payload?.category ?? payload?.Category ?? '').trim();
    if (!body && !title) {
      return true;
    }

    const signature = `${type}|${category}|${sender}|${title}|${body}`;
    const now = Date.now();

    this.recentNotificationSignatures.forEach((timestamp, key) => {
      if (now - timestamp > this.notificationDedupeWindowMs) {
        this.recentNotificationSignatures.delete(key);
      }
    });

    const previous = this.recentNotificationSignatures.get(signature);
    this.recentNotificationSignatures.set(signature, now);
    return !(previous && (now - previous) <= this.notificationDedupeWindowMs);
  }

  private toEpochMs(value: unknown): number {
    const epoch = new Date(value as any).getTime();
    return Number.isFinite(epoch) ? epoch : 0;
  }


  replaceItemAtIndex(index: number, newItem: any): void {
    if (index >= 0 && index < this.onlineUsers.length) {
      this.onlineUsers[index] = newItem;
    }
  }

  /**
   * Converts UserDataDto to ChatModel for compatibility with chat functionality
   * @param userData - UserDataDto object to convert
   * @returns ChatModel object
   */
  private convertToChatModel(userData: UserDataDto): ChatModel {
    return {
      connectionId: userData.connectionId,
      userId: userData.userId,
      userName: userData.userName || '',
      department: userData.department || '',
      chatInitiated: userData.chatInitiated || false,
      unreadCount: userData.unreadCount || 0,
      status: userData.status,
      lastSeen: userData.lastSeen ? new Date(userData.lastSeen) : undefined
    };
  }

  /**
   * Get online users as ChatModel array for compatibility with existing chat components
   * @returns Array of ChatModel objects
   */
  getOnlineUsersAsChatModel(): ChatModel[] {
    return this.onlineUsers.map(user => this.convertToChatModel(user));
  }

  private updateOnlineUserData(userData: UserDataDto | UserDataDto[]): void {
    if (!userData) return;
    const usersToUpdate = Array.isArray(userData) ? userData : [userData];

    const validUsers = usersToUpdate.filter(user => user.uniqId);

    const incomingUserIds = new Set(validUsers.map(user => user.uniqId));

    this.onlineUsers = this.onlineUsers.filter(existingUser =>
      incomingUserIds.has(existingUser.uniqId)
    );

    validUsers.forEach(user => {
      const existingUserIndex = this.onlineUsers.findIndex(
        existingUser => existingUser.uniqId === user.uniqId
      );

      if (existingUserIndex !== -1) {
        const existingUser = this.onlineUsers[existingUserIndex];
        this.onlineUsers[existingUserIndex] = {
          ...existingUser,
          uniqId: user.uniqId,
          connectionId: user.connectionId,
          userip: user.userip,
          userId: user.userId,
          currentAplication: user.currentAplication,
          userName: user.userName || existingUser.userName,
          department: user.department || existingUser.department,
          groupMembers: user.groupMembers || existingUser.groupMembers,
          currentScreen: user.currentScreen || existingUser.currentScreen,
          lastSeen: user.lastSeen,
          status: user.status ?? existingUser.status,
          version: user.version || existingUser.version,
          // Preserve chat-related properties
          chatInitiated: existingUser.chatInitiated || false,
          unreadCount: existingUser.unreadCount || 0
        };
      } else {
        this.onlineUsers.push(user);
      }
    });
    this.OnLineUsers$.next([...this.onlineUsers]);
  }
}
