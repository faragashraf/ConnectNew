import { Component, OnInit, HostListener, OnChanges, SimpleChanges, ViewChild, ElementRef } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, ActivatedRoute } from '@angular/router';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';
import { DomSanitizer } from '@angular/platform-browser';
import { AuthorizationNew, AuthorizationNewCommonResponse, ExchangeUserInfo, LoginModel, SSOController } from '../../services/SSO.service';
import { DomainAuthController } from '../../services/Domain_Auth.service';
import { AuthObjectsService, UserOtpEnrollmentDto } from 'src/app/shared/services/helper/auth-objects.service';
import { Subscription } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { SignalRService } from 'src/app/shared/services/SignalRServices/SignalR.service';
import { WindowsNotificationService } from 'src/app/shared/services/helper/windowsNotification.service';
import { BroadcastService } from 'src/app/shared/services/helper/broadcast.service';
import { AuthenticatorService } from 'src/app/shared/services/authenticator.service';
import { environment } from 'src/environments/environment';


@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  EgyptPostToolTip: string = 'البريد المصري  '
  loginForm!: FormGroup;
  readonly localMockMode: boolean = environment.useLocalMockAuth === true;

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
  // Optional local badges (place PNGs under assets/QRCode/ if not present)
  googlePlayBadgePath = 'assets/QRCode/google-play-badge.png';
  appStoreBadgePath = 'assets/QRCode/app-store-badge.png';

  // Store links (open in new tab)
  googlePlayUrl = 'assets/QRCode/googlePlay.png';
  appStoreUrl = 'assets/QRCode/App_Store.svg';

  constructor(private fb: FormBuilder, private router: Router, private route: ActivatedRoute,
    public msg: MsgsService, private chatService: SignalRService, private notificationService: WindowsNotificationService, private sanitizer: DomSanitizer,
    private sso: SSOController, private broadcastService: BroadcastService,
    private DomainAuth: DomainAuthController, private spinner: SpinnerService, public AuthService: AuthObjectsService,
    private authenticatorService: AuthenticatorService, private http: HttpClient) {
    this.loginForm = this.fb.group({
      username: ['', Validators.required],
      password: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    // Initial state is set to 'initial' by default. 
    // We do NOT run auto verification automatically anymore.
    localStorage.removeItem('Picture');
    this.mode = this.localMockMode ? 'credentials' : 'initial';
    this.getCallerInfo();
  }

  getCallerInfo() {
    if (this.localMockMode) {
      this.myIp = '127.0.0.1';
      return;
    }

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
    this.loginModel.userId = this.loginForm.get('username')?.value
    this.loginModel.password = this.loginForm.get('password')?.value
    if (this.loginForm.valid) {
      this.isFlipped = true;
      this.spinner.show('جاري تسجيل الدخول');
      if (this.localMockMode) {
        this.loginWithLocalMock();
        return;
      }

      this.DomainAuth.authorizeWithPassword(environment.OTPApplicationName, this.loginModel, false)
        .subscribe({
          next: (resp) => {
            if (resp.isSuccess) {
              this.handleCredentialLoginSuccess(resp.data, false);
            }
            else {
              // 
              let errr = '';
              if (resp.errors && resp.errors.length > 0 && (resp.errors[0].code == '403' || resp.errors[0].code == '409')) {
                this.msg.msgSuccess(resp.errors[1].message as string, 7000, true)
                this.openCenteredPopup(resp.errors[0].message as string)
              } else if (resp.errors && resp.errors.length > 0) {
                resp.errors?.forEach(e => errr += e.message + "<br>");
                this.msg.msgError(errr, "هناك خطا ما", true);
              }
              this.isFlipped = false;
            }
            // 
          },
          error: (error) => {
            console.log(error.message);
            // 
            this.msg.msgError(error, "هناك خطا ما", true);
            this.isFlipped = false;
          },
          complete: () => {
            console.log('checkResetedPassword Complete');
          }
        }
        );
    }
  }

  private loginWithLocalMock() {
    const localAuthUrl = `${environment.ConnectApiURL}${environment.localMockAuthPath}`;
    const payload: LoginModel = {
      userId: this.loginModel.userId,
      password: this.loginModel.password
    };
    this.http.post<AuthorizationNewCommonResponse>(localAuthUrl, payload).subscribe({
      next: (resp) => {
        if (resp?.isSuccess && resp.data) {
          this.handleCredentialLoginSuccess(resp.data, false);
          return;
        }

        let err = '';
        resp?.errors?.forEach(e => err += `${e.message}<br>`);
        this.msg.msgError(err || 'Mock login failed.', 'Unexpected error', true);
        this.isFlipped = false;
      },
      error: (error) => {
        console.log(error?.message || error);
        this.msg.msgError(error, 'Unexpected error', true);
        this.isFlipped = false;
      },
      complete: () => {
        console.log('local mock login complete');
      }
    });
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
  handleCredentialLoginSuccess(authData: AuthorizationNew, fromAuto: boolean) {
    this.UserAuthorizationsNew = authData;
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
      this.finalizeLogin(authData, fromAuto);
    }
  }

  finalizeLogin(authData: AuthorizationNew, fromAuto: boolean) {
    // Commit token
    localStorage.setItem('ConnectToken', authData.token as string);
    // Clear pending
    this.AuthService.clearPendingToken();

    this.AuthService.getUserProfile(); // refresh local profile view

    this.spinner.show('جاري الإتصال بالـ HubSync');
    
    this.chatService.hubConnectionState$.pipe(
      filter(result => result === 'Online'),
      take(1)
    ).subscribe(() => {
      if (fromAuto) {
        this.spinner.hide();
        setTimeout(() => {
          this.setLocalStorage(JSON.stringify(authData), authData.exchangeUserInfo);
        }, 500);
      } else {
        this.setLocalStorage(JSON.stringify(authData), authData.exchangeUserInfo);
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
            this.finalizeLogin(this.UserAuthorizationsNew, this.mode === 'windows_success');
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

  setLocalStorage(authObj: string, excahnge?: ExchangeUserInfo) {
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

    const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/Home';
    this.router.navigateByUrl(returnUrl);

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
