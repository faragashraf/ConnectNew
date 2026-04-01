import { Component, OnInit, AfterViewInit, HostListener, OnChanges, SimpleChanges, ViewChild, ElementRef } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';
import { DomSanitizer } from '@angular/platform-browser';
import { AuthorizationNew, ErrorDto, ExchangeUserInfo, LoginModel, SSOController } from '../../services/SSO.service';
import { DomainAuthController } from '../../services/Domain_Auth.service';
import { AuthObjectsService, UserOtpEnrollmentDto } from 'src/app/shared/services/helper/auth-objects.service';
import { Subscription } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { SignalRService } from 'src/app/shared/services/SignalRServices/SignalR.service';
import { WindowsNotificationService } from 'src/app/shared/services/helper/windowsNotification.service';
import { BroadcastService } from 'src/app/shared/services/helper/broadcast.service';
import { AuthenticatorService } from 'src/app/shared/services/authenticator.service';
import { environment } from 'src/environments/environment';

type LoginQueryParams = {
  username: string | null;
  password: string | null;
};

type LoginCredentials = {
  username: string;
  password: string;
};

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit, AfterViewInit {
  EgyptPostToolTip: string = 'البريد المصري  '
  loginForm!: FormGroup;

  // New State Machine Definition
  mode: 'initial' | 'windows_checking' | 'windows_success' | 'windows_failed' | 'credentials' = 'initial';
  windowsError: string = '';

  // UI States
  showPassword = false;
  capsLockOn = false;

  // OTP State
  step: 'credentials' | 'otp' = 'credentials';
  otpPin: string = '';
  otpEnrollment: UserOtpEnrollmentDto | null = null;
  otpError: string = '';
  isVerifyingOtp: boolean = false;

  // 2FA Tutorial Video State
  isTwoFaVideoOpen: boolean = false;
  readonly twoFaVideoSrc = 'assets/videos/TwoStepAuthentication.mp4';

  // User IP Tracking
  myIp: string = '';

  @ViewChild('twoFaVideo') videoRef!: ElementRef<HTMLVideoElement>;

  // Google Authenticator download assets & links
  googlePlayQrPath = 'assets/QRCode/GOOGLE_PLAY_GOOGLE_AUTHANTICATOR.png';
  appStoreQrPath = 'assets/QRCode/APP_STORE_GOOGLE_AUTHANTICATOR.png';
  // Local store badge assets
  googlePlayBadgePath = 'assets/QRCode/googlePlay.png';
  appStoreBadgePath = 'assets/QRCode/App_Store.png';

  // Official store links (open in new tab)
  googlePlayUrl = 'https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2';
  appStoreUrl = 'https://apps.apple.com/app/google-authenticator/id388497605';
  isAutoLoginInProgress = false;

  private readonly autoLoginUsernameParam = 'username';
  private readonly autoLoginPasswordParam = 'password';
  private readonly summerRequestsRoute = '/EmployeeRequests/SummerRequests';
  private hasAttemptedAutoLogin = false;
  private autoLoginProbeAttempts = 0;
  private readonly autoLoginProbeMaxAttempts = 20;
  private readonly autoLoginProbeIntervalMs = 250;
  private autoLoginProbeTimer: ReturnType<typeof setInterval> | null = null;
  private pendingPostLoginRedirectUrl: string | null = null;

  constructor(private fb: FormBuilder, private router: Router, private route: ActivatedRoute,
    public msg: MsgsService, private chatService: SignalRService, private notificationService: WindowsNotificationService, private sanitizer: DomSanitizer,
    private sso: SSOController, private broadcastService: BroadcastService,
    private DomainAuth: DomainAuthController, private spinner: SpinnerService, public AuthService: AuthObjectsService,
    private authenticatorService: AuthenticatorService) {
    this.loginForm = this.fb.group({
      username: ['', Validators.required],
      password: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    // Initial state is set to 'initial' by default. 
    // We do NOT run auto verification automatically anymore.
    localStorage.removeItem('Picture');
    this.getCallerInfo();
    this.startAutoLoginProbe();
  }

  ngAfterViewInit(): void {
    this.tryAutoLoginOnceFromQueryParams();
  }

  getCallerInfo() {
    this.DomainAuth.callerInfo().subscribe({
      next: (resp) => {
        if (resp) {
          this.myIp = resp.ip || '';
        }
      },
      error: (err) => console.log(err)
    });
  }

  startWindowsAuth() {
    this.mode = 'windows_checking';
    this.windowsError = '';

    this.sso.authanticateMe().subscribe({
      next: (resp: any) => {
        if (resp.isSuccess) {
          this.mode = 'windows_success';
          this.MeInfo = resp.data;
          if (resp.data.userPicture) {
            this.MeInfo.safeImage = this.sanitizer.bypassSecurityTrustUrl('data:image/png;base64,' + resp.data.userPicture as string);
          }
        } else {
          this.mode = 'windows_failed';
          let errr = '';
          resp.errors?.forEach((e: any) => errr += e.message + " ");
          this.windowsError = errr || 'تعذر التحقق من الهوية';
        }
      },
      error: (error: any) => {
        this.mode = 'windows_failed';
        this.windowsError = 'تعذر تسجيل الدخول باستخدام Windows. يرجى استخدام اسم المستخدم وكلمة المرور.';
        console.error('Windows Auth Failed:', error);
      }
    });
  }

  switchToCredentials() {
    this.mode = 'credentials';
  }

  loginModel = {} as LoginModel;
  UserAuthorizationsNew = {} as AuthorizationNew
  // New UI Helper Methods
  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  @HostListener('window:keydown', ['$event'])
  @HostListener('window:keyup', ['$event'])
  checkCapsLock(event: KeyboardEvent) {
    this.capsLockOn = event.getModifierState && event.getModifierState('CapsLock');
  }


  MeInfo: ExchangeUserInfo = {} as ExchangeUserInfo
  isFlipped: boolean = false;

  AuthMe() {
    this.spinner.show('جاري التحقق من المستخدم الحالي...');
    this.sso.authanticateMe()
      .subscribe({
        next: (resp: any) => {
          if (resp.isSuccess) {
            this.MeInfo = resp.data
            this.MeInfo.safeImage = this.sanitizer.bypassSecurityTrustUrl('data:image/png;base64,' + resp.data.userPicture as string)
          }
          else {
            let errr = '';
            resp.errors?.forEach((e: any) => errr += e.message + "<br>");
            this.msg.msgError(errr, "هناك خطا ما", true);
          }
        },
        error: (error: any) => {
          if (error.message.includes('Unauthorized'))
            this.mode = 'credentials'
          // this.msg.msgError( "يرجى التأكد من تسجيل دخولك بالدومين على نظام التشغيل","هناك خطأ ما", true);
          // this.msg.msgError(error, "هناك خطا ما", true);
        },
        complete: () => {
          console.log('انتهاء التحقق');
        }
      }
      );
  }

  LoginWithUserAndPassword() {
    if (this.isFlipped || this.isAutoLoginInProgress) {
      return;
    }

    const username = this.loginForm.get('username')?.value as string;
    const password = this.loginForm.get('password')?.value as string;

    if (this.loginForm.valid) {
      this.executePasswordLogin(username, password, false);
    }
  }
  LoginWithOutPassword() {
    this.spinner.show('جاري التحقق من المستخدم الحالي...');
    this.sso.authanticateMe()
      .subscribe({
        next: (resp: any) => {
          if (resp.isSuccess) {
            this.AuthService.DomainAuthenticated$.next(true);
            this.MeInfo = resp.data
            this.MeInfo.safeImage = this.sanitizer.bypassSecurityTrustUrl('data:image/png;base64,' + resp.data.userPicture as string);
            this.spinner.show('جاري تسجيل الدخول');
            this.sso.authorizeWithOutPassword(this.MeInfo.userEmail, environment.OTPApplicationName)
              .subscribe({
                next: (resp) => {
                  if (resp.isSuccess) {
                    this.handleCredentialLoginSuccess(resp.data, true);
                  }
                  else {
                    let errr = '';
                    resp.errors?.forEach(e => errr += e.message + "<br>");
                    this.msg.msgError(errr, "هناك خطا ما", true);
                  }

                },
                error: (error) => {
                  console.log(error.message);

                  this.msg.msgError(error, "هناك خطا ما", true);
                },
                complete: () => {
                  console.log('checkResetedPassword Complete');
                }
              }
              );

          }
          else {

            console.log('AuthMeError :', resp.errors);
            let errr = '';
            resp.errors?.forEach((e: any) => errr += e.message + "<br>");
            this.msg.msgError(errr, "هناك خطا ما", true);
          }
        },
        error: (error: any) => {
          console.log(error.message);

          // this.msg.msgError("هناك خطأ ما", "يرجى التأكد من تسجيل دخولك بالدومين على نظام التشغيل", true);
          this.msg.msgError(error, "هناك خطا ما", true);
        },
        complete: () => {
          console.log('انتهاء التحقق');
        }
      }
      );


  }
  handleCredentialLoginSuccess(
    authData: AuthorizationNew,
    fromAuto: boolean,
    redirectUrlOverride: string | null = null
  ) {
    this.UserAuthorizationsNew = authData;
    this.pendingPostLoginRedirectUrl = redirectUrlOverride;
    const token = this.UserAuthorizationsNew.token as string;

    // 1. Set Pending Token
    this.AuthService.setPendingToken(token);

    // 2. Check Profile/OTP Enrollment
    // The profile is in authData.exchangeUserInfo
    const profile = authData.exchangeUserInfo;
    const enrollment = authData.userOtpEnrollmentDto;


    if (enrollment && enrollment.isEnabled == 'Y') {
      // 3a. Require OTP
      this.step = 'otp';
      this.otpEnrollment = enrollment;
      this.otpPin = '';
      this.otpError = '';
      this.isFlipped = false; // Hide global spinner
    } else {
      // 3b. Finalize Login
      this.finalizeLogin(authData, fromAuto, this.pendingPostLoginRedirectUrl);
    }
  }

  finalizeLogin(
    authData: AuthorizationNew,
    fromAuto: boolean,
    redirectUrlOverride: string | null = null
  ) {
    // Commit token
    localStorage.setItem('ConnectToken', authData.token as string);
    // Clear pending
    this.AuthService.clearPendingToken();

    this.AuthService.getUserProfile(); // refresh local profile view

    this.spinner.show('جاري الإتصال بالـ HubSync');
    
    this.chatService.hubConnectionState$.pipe(
      filter(result => result === 'Online' || result === 'Ashraf'),
      take(1)
    ).subscribe(() => {
      if (fromAuto) {
        this.spinner.hide();
        setTimeout(() => {
          this.setLocalStorage(JSON.stringify(authData), authData.exchangeUserInfo, redirectUrlOverride);
        }, 500);
      } else {
        this.setLocalStorage(JSON.stringify(authData), authData.exchangeUserInfo, redirectUrlOverride);
      }
    });

    this.chatService.startConnection();
  }

  verifyOtp() {
    if (!this.otpEnrollment || this.otpPin.length !== 6) return;
    if (this.isVerifyingOtp) return; // prevent duplicate verification calls
    this.isVerifyingOtp = true;
    this.otpError = '';

    setTimeout(() => {
      this.authenticatorService.validate({
        userId: this.otpEnrollment?.userId || this.UserAuthorizationsNew.userName as string, // Fallback if needed
        issuer: this.otpEnrollment?.issuer || '',
        pairingId: this.otpEnrollment?.id as unknown as number, // Ensure it's a number
        pin: this.otpPin
      }).subscribe({
        next: (res) => {
          this.isVerifyingOtp = false;
          if (res.isValid) {
            this.finalizeLogin(
              this.UserAuthorizationsNew,
              this.mode === 'windows_success',
              this.pendingPostLoginRedirectUrl
            );
          } else {
            this.otpError = this.mapOtpError(res.reason);
          }
        },
        error: (err) => {
          this.isVerifyingOtp = false;
          this.otpError = 'حدث خطأ أثناء التحقق. حاول مرة أخرى.';
          this.otpPin = '';
          console.error(err);
        }
      });
    }, 1000);


  }

  cancelOtp() {
    this.AuthService.clearPendingToken();
    this.step = 'credentials';
    this.otpEnrollment = null;
    this.otpPin = '';
    this.otpError = '';
    this.UserAuthorizationsNew = {} as AuthorizationNew;
    this.pendingPostLoginRedirectUrl = null;
    this.isAutoLoginInProgress = false;
    this.AuthService.DomainAuthenticated$.next(false);
    // Return to credentials so they can try again
    this.mode = 'credentials';
  }

  mapOtpError(reason: string | null): string {
    switch (reason) {
      case 'INVALID_PIN': return 'الرمز غير صحيح. حاول مرة أخرى.';
      case 'REPLAYED_CODE': return 'تم استخدام هذا الرمز بالفعل. انتظر الرمز التالي.';
      case 'ENROLLMENT_NOT_FOUND': return 'لم يتم العثور على إعدادات المصادقة.';
      case 'DISABLED': return 'المصادقة الثنائية غير مفعلة لهذا الحساب.';
      default: return 'حدث خطأ ما. يرجى المحاولة مرة أخرى.';
    }
  }

  setLocalStorage(
    authObj: string,
    excahnge?: ExchangeUserInfo,
    redirectUrlOverride: string | null = null
  ) {
    localStorage.setItem('ConnectToken', this.UserAuthorizationsNew.token as string);
    localStorage.setItem('ConnectFunctions', this.UserAuthorizationsNew.functions as string);
    localStorage.setItem('UserId', this.UserAuthorizationsNew.userName as string);
    localStorage.setItem('firstName', this.UserAuthorizationsNew.firstName as string);
    localStorage.setItem('Picture', excahnge?.userPicture as string);
    this.AuthService.setAuthObject(authObj);
    // 
    this.notificationService.showNotification('HubSync Is Online', 'assets/imges/Online.jpg');
    this.AuthService.populateNaBarItems();
    this.chatService.hubConnectionState$.next('Online');
    this.broadcastService.post({
      type: 'USER_SIGNIN',
      payload: {
        userDisplayName: this.UserAuthorizationsNew.firstName,
        userId: this.UserAuthorizationsNew.userName,
        picture: excahnge?.userPicture as string,
        privillages: authObj
      }
    });
    this.chatService.RefreshToken(this.UserAuthorizationsNew.token as string);

    const returnUrl = redirectUrlOverride && redirectUrlOverride.trim().length > 0
      ? redirectUrlOverride
      : this.resolvePostLoginUrl();
    this.pendingPostLoginRedirectUrl = null;
    this.router.navigateByUrl(returnUrl);

  }

  private tryAutoLoginOnceFromQueryParams(): void {
    if (this.hasAttemptedAutoLogin) {
      this.stopAutoLoginProbe();
      return;
    }

    const rawParams = this.readLoginQueryParams();
    const credentials = this.validateAutoLoginCredentials(rawParams);
    if (!credentials) {
      return;
    }

    this.hasAttemptedAutoLogin = true;
    this.stopAutoLoginProbe();
    this.stripLoginCredentialsFromUrl();

    this.mode = 'credentials';
    this.loginForm.patchValue(
      {
        username: credentials.username,
        password: credentials.password
      },
      { emitEvent: false }
    );

    this.executePasswordLogin(
      credentials.username,
      credentials.password,
      true,
      this.summerRequestsRoute
    );
  }

  private readLoginQueryParams(): LoginQueryParams {
    const fromRoute: LoginQueryParams = {
      username: this.route.snapshot.queryParamMap.get(this.autoLoginUsernameParam),
      password: this.route.snapshot.queryParamMap.get(this.autoLoginPasswordParam)
    };

    if (fromRoute.username !== null && fromRoute.password !== null) {
      return fromRoute;
    }

    const fromLocation = this.readLoginQueryParamsFromLocation();
    const fromRawHref = this.readLoginQueryParamsFromRawHref();
    return {
      username: fromRoute.username ?? fromLocation.username ?? fromRawHref.username,
      password: fromRoute.password ?? fromLocation.password ?? fromRawHref.password
    };
  }

  private validateAutoLoginCredentials(rawParams: LoginQueryParams): LoginCredentials | null {
    const username = String(rawParams.username ?? '');
    const password = String(rawParams.password ?? '');

    if (!username.trim() || !password.trim()) {
      return null;
    }

    return {
      username,
      password
    };
  }

  private readLoginQueryParamsFromLocation(): LoginQueryParams {
    try {
      const currentUrl = new URL(window.location.href);
      const fromSearch: LoginQueryParams = {
        username: currentUrl.searchParams.get(this.autoLoginUsernameParam),
        password: currentUrl.searchParams.get(this.autoLoginPasswordParam)
      };
      if (fromSearch.username !== null || fromSearch.password !== null) {
        return fromSearch;
      }

      const normalizedHash = currentUrl.hash.startsWith('#')
        ? currentUrl.hash.substring(1)
        : currentUrl.hash;
      const queryStartIndex = normalizedHash.indexOf('?');
      if (queryStartIndex < 0) {
        return { username: null, password: null };
      }

      const queryString = normalizedHash.substring(queryStartIndex + 1);
      const searchParams = new URLSearchParams(queryString);
      return {
        username: searchParams.get(this.autoLoginUsernameParam),
        password: searchParams.get(this.autoLoginPasswordParam)
      };
    } catch {
      return { username: null, password: null };
    }
  }

  private readLoginQueryParamsFromRawHref(): LoginQueryParams {
    const href = String(window.location.href ?? '');
    const query = this.extractQueryStringFromRawHref(href);
    if (!query) {
      return { username: null, password: null };
    }

    const params = new URLSearchParams(query);
    return {
      username: params.get(this.autoLoginUsernameParam),
      password: params.get(this.autoLoginPasswordParam)
    };
  }

  private extractQueryStringFromRawHref(href: string): string {
    const hashIndex = href.indexOf('#');
    if (hashIndex >= 0) {
      const hashPart = href.substring(hashIndex + 1);
      const hashQueryIndex = hashPart.indexOf('?');
      if (hashQueryIndex >= 0) {
        return hashPart.substring(hashQueryIndex + 1);
      }
    }

    const queryIndex = href.indexOf('?');
    if (queryIndex >= 0) {
      return href.substring(queryIndex + 1);
    }

    return '';
  }

  private startAutoLoginProbe(): void {
    if (this.autoLoginProbeTimer) {
      clearInterval(this.autoLoginProbeTimer);
    }

    this.autoLoginProbeAttempts = 0;
    this.tryAutoLoginOnceFromQueryParams();

    this.autoLoginProbeTimer = setInterval(() => {
      if (this.hasAttemptedAutoLogin) {
        this.stopAutoLoginProbe();
        return;
      }

      this.autoLoginProbeAttempts += 1;
      this.tryAutoLoginOnceFromQueryParams();

      if (this.autoLoginProbeAttempts >= this.autoLoginProbeMaxAttempts) {
        this.stopAutoLoginProbe();
      }
    }, this.autoLoginProbeIntervalMs);
  }

  private stopAutoLoginProbe(): void {
    if (!this.autoLoginProbeTimer) {
      return;
    }

    clearInterval(this.autoLoginProbeTimer);
    this.autoLoginProbeTimer = null;
  }

  private stripLoginCredentialsFromUrl(): void {
    try {
      const currentUrl = new URL(window.location.href);
      let changed = false;

      if (currentUrl.searchParams.has(this.autoLoginUsernameParam)) {
        currentUrl.searchParams.delete(this.autoLoginUsernameParam);
        changed = true;
      }

      if (currentUrl.searchParams.has(this.autoLoginPasswordParam)) {
        currentUrl.searchParams.delete(this.autoLoginPasswordParam);
        changed = true;
      }

      const normalizedHash = currentUrl.hash.startsWith('#')
        ? currentUrl.hash.substring(1)
        : currentUrl.hash;
      const queryStartIndex = normalizedHash.indexOf('?');

      if (queryStartIndex >= 0) {
        const hashPath = normalizedHash.substring(0, queryStartIndex);
        const hashQuery = normalizedHash.substring(queryStartIndex + 1);
        const hashParams = new URLSearchParams(hashQuery);
        const hadHashUsername = hashParams.has(this.autoLoginUsernameParam);
        const hadHashPassword = hashParams.has(this.autoLoginPasswordParam);

        if (hadHashUsername || hadHashPassword) {
          hashParams.delete(this.autoLoginUsernameParam);
          hashParams.delete(this.autoLoginPasswordParam);
          const cleanedHashQuery = hashParams.toString();
          currentUrl.hash = cleanedHashQuery ? `${hashPath}?${cleanedHashQuery}` : hashPath;
          changed = true;
        }
      }

      if (!changed) {
        return;
      }

      const nextUrl = `${currentUrl.origin}${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
      window.history.replaceState(window.history.state, document.title, nextUrl);
    } catch {
      // Keep silent on cleanup failures. It should not block login flow.
    }
  }

  private executePasswordLogin(
    username: string,
    password: string,
    isAutoLogin: boolean,
    successRedirectUrl: string | null = null
  ): void {
    if (this.isFlipped || this.isAutoLoginInProgress) {
      return;
    }

    this.loginModel.userId = username;
    this.loginModel.password = password;
    this.isFlipped = true;
    this.isAutoLoginInProgress = isAutoLogin;
    this.spinner.show(isAutoLogin ? 'جاري تسجيل الدخول التلقائي...' : 'جاري تسجيل الدخول');
    this.DomainAuth.authorizeWithPassword(environment.OTPApplicationName, this.loginModel, false)
      .subscribe({
        next: (resp) => {
          if (resp.isSuccess) {
            this.isAutoLoginInProgress = false;
            this.handleCredentialLoginSuccess(resp.data, isAutoLogin, successRedirectUrl);
            return;
          }

          this.handlePasswordLoginFailure(resp.errors, isAutoLogin);
        },
        error: (error) => {
          console.log(error.message);
          if (isAutoLogin) {
            this.msg.msgError(
              'تعذر تسجيل الدخول التلقائي عبر الرابط. يمكنك المتابعة بإدخال البيانات يدويًا.',
              'فشل تسجيل الدخول التلقائي',
              true
            );
          } else {
            this.msg.msgError(error, "هناك خطا ما", true);
          }
          this.resetPasswordLoginState();
        },
        complete: () => {
          console.log('checkResetedPassword Complete');
        }
      });
  }

  private handlePasswordLoginFailure(errors: ErrorDto[] | undefined, isAutoLogin: boolean): void {
    const hasPopupError = !isAutoLogin
      && !!errors
      && errors.length > 0
      && (errors[0].code == '403' || errors[0].code == '409');

    if (hasPopupError) {
      this.msg.msgSuccess(errors?.[1]?.message as string, 7000, true);
      this.openCenteredPopup(errors?.[0]?.message as string);
      this.resetPasswordLoginState();
      return;
    }

    let errr = '';
    errors?.forEach(e => errr += e.message + "<br>");

    if (isAutoLogin) {
      const msgWithDetails = errr.length > 0
        ? `تعذر تسجيل الدخول التلقائي عبر الرابط. يمكنك المتابعة بإدخال البيانات يدويًا.<br>${errr}`
        : 'تعذر تسجيل الدخول التلقائي عبر الرابط. يمكنك المتابعة بإدخال البيانات يدويًا.';
      this.msg.msgError(msgWithDetails, 'فشل تسجيل الدخول التلقائي', true);
    } else if (errr.length > 0) {
      this.msg.msgError(errr, "هناك خطا ما", true);
    }

    this.resetPasswordLoginState();
  }

  private resetPasswordLoginState(): void {
    this.isFlipped = false;
    this.isAutoLoginInProgress = false;
    this.pendingPostLoginRedirectUrl = null;
  }

  private resolvePostLoginUrl(): string {
    const raw = String(this.route.snapshot.queryParams['returnUrl'] ?? '').trim();
    return this.normalizeReturnUrl(raw);
  }

  private normalizeReturnUrl(rawReturnUrl: string): string {
    if (!rawReturnUrl) {
      return '/Home';
    }

    let candidate = rawReturnUrl;
    try {
      candidate = decodeURIComponent(rawReturnUrl);
    } catch {
      candidate = rawReturnUrl;
    }

    candidate = candidate.replace(/\\/g, '/').trim();
    if (!candidate) {
      return '/Home';
    }

    if (/^https?:\/\//i.test(candidate)) {
      try {
        const parsed = new URL(candidate);
        candidate = parsed.hash?.startsWith('#/')
          ? parsed.hash.substring(1)
          : `${parsed.pathname || '/'}${parsed.search || ''}`;
      } catch {
        return '/Home';
      }
    }

    const hashIndex = candidate.indexOf('#');
    if (hashIndex >= 0) {
      const hashRoute = candidate.substring(hashIndex + 1).trim();
      if (hashRoute.startsWith('/')) {
        candidate = hashRoute;
      }
    }

    if (!candidate.startsWith('/')) {
      candidate = `/${candidate}`;
    }

    const normalized = candidate.toLowerCase();
    if (
      normalized === '/' ||
      normalized === '/connect' ||
      normalized === '/connect/' ||
      normalized === '/connect/index.html' ||
      normalized.startsWith('/auth/login')
    ) {
      return '/Home';
    }

    return candidate;
  }

  printBarcode() {
    window.print();
  }

  openCenteredPopup(htmlContent: string, width = 800, height = 1000) {
    const screenLeft = window.screenLeft !== undefined ? window.screenLeft : window.screenX;
    const screenTop = window.screenTop !== undefined ? window.screenTop : window.screenY;

    const screenWidth = window.innerWidth || document.documentElement.clientWidth || screen.width;
    const screenHeight = window.innerHeight || document.documentElement.clientHeight || screen.height;

    const left = screenLeft + (screenWidth - width - 300) / 2;
    const top = screenTop + (screenHeight - height) / 2;

    const popup = window.open(
      '',
      '_blank',
      `width=${width},height=${height},top=${top},left=${left},resizable=no,scrollbars=yes`
      // `width=${width},height=${height},top=${top},resizable=no,scrollbars=yes`
    );

    if (popup) {
      popup.document.write(htmlContent);
      popup.document.close();
      popup.document.title = 'البريد المصري - نظام التحقق التلقائي';
      popup.focus();
    } else {
      alert('لم يتم فتح النافذة المنبثقة. قد يكون تم حظرها من المتصفح.');
    }
  }

  barcodes: string[] = ['123456789', '12345EDERF6789']

  // 2FA Video Methods
  openTwoFaVideo() {
    this.isTwoFaVideoOpen = true;
    setTimeout(() => {
      if (this.videoRef && this.videoRef.nativeElement) {
        const video = this.videoRef.nativeElement;
        video.currentTime = 0;
        // Attempt autoplay muted if desired, or just let user play
        video.muted = false;
        video.volume = 1.0;
        // video.play().catch(err => console.log('Autoplay prevented:', err));
      }
    }, 100);
  }

  closeTwoFaVideo() {
    if (this.videoRef && this.videoRef.nativeElement) {
      const video = this.videoRef.nativeElement;
      video.pause();
      video.currentTime = 0;
    }
    this.isTwoFaVideoOpen = false;
  }
}
