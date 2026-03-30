import { Component, OnInit, AfterViewInit, ViewChildren, QueryList, ElementRef, ChangeDetectorRef } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { FormBuilder, FormGroup, FormArray, FormControl } from '@angular/forms';
import { AuthObjectsService, UserOtpEnrollmentDto } from '../../services/helper/auth-objects.service';
import { SignalRService } from '../../services/SignalRServices/SignalR.service';
import { NavigationEnd, Router } from '@angular/router';
import { BroadcastService } from '../../services/helper/broadcast.service';
import { MsgsService } from '../../services/helper/msgs.service';
import { AuthenticatorService } from '../../services/authenticator.service';
import { PairResponseDto, PairRequestDto } from 'src/app/shared/models/authenticator.models';
import { TourService } from '../../services/tour.service';
import { filter, timeInterval, timeout } from 'rxjs/operators';
import { SoundService } from '../../services/helper/sound.service';
import { ThemeService } from '../../services/theme.service';
import { WindowsNotificationService } from '../../services/helper/windowsNotification.service';

@Component({
  selector: 'app-nav-bar',
  templateUrl: './nav-bar.component.html',
  styleUrls: ['./nav-bar.component.scss']
})
export class NavBarComponent implements OnInit, AfterViewInit {

  showNotifications = false;
  showAllNotificationsDialog: boolean = false;
  copiedEmail: boolean = false;
  pairingLoading = false;
  pairingError?: string | null = null;
  pairing?: PairResponseDto | null = null;
  qrDataUrl?: string | null = null;
  qrSafeUrl?: SafeUrl | null = null;
  
  // OTP / validation state (reactive)
  otpPin: string = '';
  otpError: string | null = null;
  otpSuccess = false;

  validateLoading = false;
  validateError: string | null = null;
  validateSuccess = false;
  validatedAtUtc: string | null = null;
  isEnrollmentEnabled: boolean = false;
  twoFactorForm: FormGroup;
  showAdvanced = false;

  // New flags for state machine
  toggleLoading = false;
  showSetupDialog = false;

  themeOptions = [
    { label: 'الافتراضي (Production)', value: 'prod' },
    { label: 'التجريبي (Test)', value: 'test' },
    { label: 'المطورين (Development)', value: 'dev' }
  ];
  selectedTheme: string = 'prod';

  visualThemeOptions = [
    { label: 'فاتح (Light)', value: 'light' },
    { label: 'داكن (Dark)', value: 'dark' }
  ];
  selectedVisualTheme: string = 'light';

  constructor(public authService: AuthObjectsService, public signalRService: SignalRService,
    public router: Router, public broadcastService: BroadcastService,
    public msgsService: MsgsService,
    private tourService: TourService,
    public soundService: SoundService,
    private authenticatorService: AuthenticatorService,
    private sanitizer: DomSanitizer,
    private fb: FormBuilder,
    private cd: ChangeDetectorRef,
    public themeService: ThemeService,
    private windowsNotificationService: WindowsNotificationService
  ) {
    this.twoFactorForm = this.fb.group({
      pairingId: [null],
      issuer: [null],
      accountName: [null],
      pairedAtUtc: [null],
      enabled: [false]
    });
  }

  get isTest(): boolean {
    return this.themeService.isTest;
  }

  get isDev(): boolean {
    return this.themeService.isDev;
  }

  Environment: string = '';
  ngOnInit() {
    this.selectedTheme = this.themeService.mode;
    this.selectedVisualTheme = this.themeService.visualTheme;
    this.signalRService.primMsg.messageObserver.subscribe((msgs: any) => {
      const payload = Array.isArray(msgs) ? msgs : [msgs];
      this.signalRService.primMsgList = [...payload, ...this.signalRService.primMsgList];
    });

    // Start tour on successful login (Auth/Login -> Home) or page refresh if logged in
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      // Don't start on Auth pages
      if (event.urlAfterRedirects && !event.urlAfterRedirects.includes('/Auth/')) {
        // this.checkAndStartTour();
      }
    });

    // Also subscribe to Auth changes (e.g. if navigation happened before auth subject fired)
    this.authService.authObject$.subscribe((isAuthenticated) => {
      if (isAuthenticated && !this.router.url.includes('/Auth/')) {
        // this.checkAndStartTour();
      }
    });

    // Initial check for refresh case where router event might have already fired
    setTimeout(() => {
      if (!this.router.url.includes('/Auth/')) {
        // this.checkAndStartTour();
      }
    }, 2000);
  }

  ngAfterViewInit() {

  }

  private checkAndStartTour() {
    // Check effective auth (either service property or minimal user info)
    if (this.authService.currentUser && this.authService.currentUser.length > 0) {
      // Delay slightly to ensure UI is ready
      setTimeout(() => this.tourService.startTour(), 500);
    }
  }

  get passwordExpiryInfo() {
    try {
      const raw = this.userProfile?.passwordExpirationDate;
      if (!raw) return null;
      const dt = new Date(raw);
      const now = new Date();
      const diffMs = dt.getTime() - now.getTime();
      const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      let cls = 'expiry-ok';
      if (diffMs < 0) cls = 'expiry-expired';
      else if (days <= 7) cls = 'expiry-soon';
      return { dt, days, diffMs, cls };
    } catch (e) {
      return null;
    }
  }

  copyEmail(email: string | null | undefined) {
    if (!email) { return; }
    try {
      navigator.clipboard.writeText(email.toString()).then(() => {
        this.copiedEmail = true;
        setTimeout(() => this.copiedEmail = false, 1400);
      }).catch(() => {
        this.copiedEmail = true;
        setTimeout(() => this.copiedEmail = false, 1400);
      });
    } catch (e) {
      // ignore
    }
  }


  /**
   * Called when user clicks "Enable 2FA" or toggle switch ON.
   * If already validated, we just toggle ON.
   * If not validated, we must start the Setup flow (Pair -> QR -> Validate).
   */
  async requestEnable2fa() {
    if (this.toggleLoading || this.pairingLoading || this.validateLoading) return;

    if (this.is2faValidated) {
      // User has a valid enrollment, just toggle ON directly
      this.doToggle(true);
    } else {
      // User is not validated/enrolled -> must setup first
      this.startSetupFlow();
    }
  }

  /**
   * Called when user clicks "Disable 2FA" or toggle switch OFF.
   */
  requestDisable2fa() {
    if (this.toggleLoading || this.pairingLoading || this.validateLoading) return;

    // If it's already disabled, inform the user and skip calling the API.
    if (!this.is2faEnabled) {
      this.msgsService.msgInfo('المصادقة الثنائية غير مفعلة حالياً');
      return;
    }

    // Ask for explicit confirmation before disabling 2FA
    const confirmMsg = 'هل أنت متأكد من تعطيل المصادقة الثنائية؟ قد يتطلب ذلك إعادة تفعيلها لاحقاً.';
    this.msgsService.msgConfirm(confirmMsg, 'تأكيد تعطيل المصادقة الثنائية').then(confirmed => {
      if (confirmed) {
        this.doToggle(false);
      }
    });
  }

  /**
   * Called when user clicks "Re-pair" or "Reset Authenticator".
   * Forces a new pairing session, revoking or overwriting the old one locally until validated.
   */
  requestRepair() {
    if (this.toggleLoading || this.pairingLoading || this.validateLoading) return;

    const confirmMsg = 'سيتم فقدان إعداد المصادقة الحالي وستحتاج لإعادة ضبط التطبيق. هل أنت متأكد؟';
    this.msgsService.msgConfirm(confirmMsg, 'تأكيد إعادة الربط').then(confirmed => {
      if (confirmed) {
        // Start fresh pairing
        this.startSetupFlow();
      }
    });
  }

  /**
   * Initiates the Setup Flow: Pair -> QR -> OTP
   */
  startSetupFlow() {
    const userId = this.userProfile?.userId;
    const accountName = this.userProfile?.ArabicName;
    const dto: PairRequestDto = { userId: userId?.toString() || '', issuer: AuthenticatorService.issuer, accountName };

    this.pairingLoading = true;
    this.pairingError = null;
    this.otpPin = ''; // clear previous input
    this.otpError = null;
    this.authenticatorService.pair(dto).subscribe({
      next: (res) => {
        this.pairing = res;
        this.qrDataUrl = `data:image/png;base64,${res.qrCodePngBase64}`;
        try {
          this.qrSafeUrl = this.sanitizer.bypassSecurityTrustUrl(this.qrDataUrl);
          this.authService.patchUserOtpEnrollmentDto({});
        } catch (e) {
          this.qrSafeUrl = `data:image/png;base64,${res.qrCodePngBase64}` as unknown as SafeUrl;
        }
        
        // Show the cleanup UI
        this.showSetupDialog = true; 
        this.pairingLoading = false;
      },
      error: (err) => {
        this.pairingLoading = false;
        this.pairingError = err?.message || 'فشل في إنشاء رمز الاستجابة.';
        this.msgsService.msgError('خطأ في الاتصال', this.pairingError || '');
      }
    });
  }

  confirmAuthenticator(code?: string) {
    if (!this.pairing?.pairingId) return;
    if (this.validateLoading) return;
    
    const pin = code || this.otpPin;
    if (!pin || pin.length !== 6) {
      this.validateError = 'الرجاء إدخال رمز مكون من 6 أرقام.';
      return;
    }

    const userId = this.userProfile?.userName;
    const issuer = AuthenticatorService.issuer;
    const req = {
      userId,
      issuer,
      pin: pin,
      pairingId: this.pairing.pairingId as unknown as number
    };

    this.validateLoading = true;
    this.validateError = null;
    this.validateSuccess = false;

    this.authenticatorService.validate(req).subscribe({
      next: (res) => {
        this.validateLoading = false;
        if (res && res.isValid) {
          this.validateSuccess = true;
          this.validateError = null;
          
          this.otpPin = '';

          // 1. Update Local Enrollment State
          const dto: UserOtpEnrollmentDto = {
            id: res.enrollmentId ?? (this.pairing?.pairingId as unknown as number),
            userId: userId,
            issuer: issuer,
            isActive: true,
            isEnabled: 'Y', 
            createdAtUtc: this.enrollment?.createdAtUtc ?? this.pairing?.createdAtUtc ?? new Date().toISOString(),
            revokedAtUtc: null,
            lastUsedAtUtc: res.validatedAtUtc ?? new Date().toISOString()
          };
          this.authService.updateUserOtpEnrollment(dto);

          // 2. Success Feedback
          this.msgsService.msgSuccess('تم تفعيل المصادقة بنجاح', 3000, true);

          // 3. Close Setup Dialog / Cleanup
          this.showSetupDialog = false;
          this.pairing = null;
          this.qrDataUrl = null;
        } else {
          this.validateSuccess = false;
          this.validateError = this.mapReason(res.reason);
          this.msgsService.msgError('فشل التحقق', this.validateError || '');
          this.otpPin = '';
        }
      },
      error: (err) => {
        this.validateLoading = false;
        this.validateSuccess = false;
        this.validateError = this.mapReason(err?.error?.reason);
        this.msgsService.msgError('فشل التحقق', this.validateError || '');
        this.otpPin = '';
      }
    });
  }

  /**
   * Perform the actual toggle call to API
   */
  private doToggle(targetState: boolean) {
    this.toggleLoading = true;
    this.authenticatorService.toggle().subscribe({
      next: (res) => {
        this.toggleLoading = false;
        const isNowEnabled = res.isEnabled; 

        if (this.enrollment) {
          const updated: UserOtpEnrollmentDto = {
            ...this.enrollment,
            isEnabled: (isNowEnabled ? 'Y' : 'N') as any
          };
          this.authService.updateUserOtpEnrollment(updated);
        }

        if (isNowEnabled) {
          this.msgsService.msgSuccess('تم تفعيل المصادقة الثنائية');
        } else {
          this.msgsService.msgInfo('تم تعطيل المصادقة الثنائية');
        }
      },
      error: (err) => {
        this.toggleLoading = false;
        const reason = err?.error?.reason || 'UNKNOWN';
        const arabicMsg = this.mapToggleReason(reason);
        this.msgsService.msgError(arabicMsg, 'خطأ في التغيير');
      }
    });
  }

  onToggleCallback(event: any) {
    const isChecked = event.checked;
    if (isChecked) {
        this.requestEnable2fa();
    } else {
        this.requestDisable2fa();
    }
  }



  copyToClipboard(text?: string | null) {
    if (!text) return;
    try {
      navigator.clipboard.writeText(text).then(() => {
        this.msgsService.msgSuccess('تم النسخ', 1500, true);
      }).catch(() => {
        this.msgsService.msgInfo('نسخ إلى الحافظة غير مدعوم');
      });
    } catch (e) {
      // ignore
    }
  }

  get userProfile(): any {
    return this.authService.getUserProfile();
  }

  // Enrollment getters
  get enrollment(): any | null {
    return this.userProfile?.userOtpEnrollmentDto ?? this.authService.getUserOtpEnrollmentDtoFromStorage() ?? null;
  }

  get is2faEnabled(): boolean {
    const e = this.enrollment;
    return !!e && e.isActive === true && e.isEnabled === 'Y' && !e.revokedAtUtc;
  }

  get is2faValidated(): boolean {
    const e = this.enrollment;
    return !!e && e.isActive === true ;
  }

  private mapToggleReason(reason: string): string {
    const r = reason?.toUpperCase();
    switch (r) {
      case 'UNAUTHORIZED': return 'غير مصرح — برجاء تسجيل الدخول مرة أخرى';
      case 'INVALID_ISSUER': return 'المصدر غير صحيح';
      case 'INVALID_USER': return 'المستخدم غير صحيح';
      case 'ENROLLMENT_NOT_FOUND': return 'لا يوجد إعداد للمصادقة الثنائية لهذا المستخدم';
      case 'CONFLICT_ENABLED_EXISTS': return 'يوجد إعداد مفعل بالفعل — لا يمكن تفعيل أكثر من إعداد';
      default: return 'حدث خطأ غير متوقع';
    }
  }

  private mapReason(reason?: string | null): string {
    if (!reason) return 'تعذر التحقق';
    const r = reason.toUpperCase();
    switch (r) {
      case 'INVALID_PIN': return 'الرمز غير صحيح';
      case 'REPLAYED_CODE': return 'الرمز تم استخدامه من قبل، انتظر رمز جديد';
      case 'ENROLLMENT_NOT_FOUND': return 'لا يوجد تسجيل للمصادقة الثنائية';
      default: return 'تعذر التحقق';
    }
  }

  cancelSetup() {
    this.showSetupDialog = false;
    this.pairing = null;
    this.qrDataUrl = null;
    this.pairingError = null;
    this.otpPin = '';
  }

  pairError: string | null = null; // Add missing property if needed

  clearAllNtf() {

    this.signalRService.primMsg.clear();
    this.signalRService.primMsgCount = 0
  }

  testSuccess() {
    this.msgsService.msgSuccess('تمت العملية بنجاح', 3000, true);
  }

  testError() {
    this.msgsService.msgError('خطأ', 'حدث خطأ أثناء تنفيذ العملية', false);
  }

  testInfo() {
    this.msgsService.msgInfo('هذه رسالة معلومات للتنبيه', 'معلومة');
  }

  testConfirm() {
    this.msgsService.msgConfirm('هل أنت متأكد من تنفيذ هذا الإجراء؟', 'نعم، تابع').then(res => {
      if (res) {
        this.msgsService.msgSuccess('تم التأكيد', 3000, true);
      } else {
        this.msgsService.msgInfo('تم الإلغاء');
      }
    });
  }

  async testSystemNotification() {
    const isSent = await this.windowsNotificationService.runManualNotificationTest();
    if (isSent) {
      this.msgsService.msgSuccess('تم إرسال إشعار نظام تجريبي. تحقق من Notification Center.', 4000, true);
      return;
    }

    this.msgsService.msgInfo('تعذر إرسال الإشعار. تحقق من صلاحية الإشعارات في المتصفح والنظام.', 'اختبار إشعار النظام');
  }

  testSummerCapacityNotification() {
    const now = new Date();
    const payload = {
      event: 'SUMMER_CAPACITY_UPDATED',
      destinationId: 147,
      destinationName: 'المصيف التجريبي',
      waveCode: 'W3',
      batchNumber: '3',
      action: 'EDIT',
      emittedAt: now.toISOString(),
      sender: 'Connect',
      title: 'إدارة طلبات المصايف'
    };

    this.signalRService.Notification$.next({
      sender: 'Connect',
      title: 'إدارة طلبات المصايف',
      notification: JSON.stringify(payload),
      type: 'Info',
      category: 'Business',
      time: now
    } as any);

    this.msgsService.msgInfo('تم إرسال إشعار سعة مصيف تجريبي عبر نفس مسار الإشعارات اللحظية.', 'اختبار سعة المصيف');
  }

  clearCache() {
    this.soundService.performClearCacheAndReload();
  }

  startAppTour() {
    this.tourService.forceStartTour();
  }

  openAllNotifications() {
    this.showAllNotificationsDialog = true;
  }

  onProfileDialogOpen() {
    // Reset OTP/validation state when the dialog is opened
    // this.resetOtp();
    this.validateLoading = false;
    this.validateError = null;
    this.validateSuccess = false;
    this.validatedAtUtc = null;
    this.isEnrollmentEnabled = false;
    this.showAdvanced = false;

    // Read enrollment from profile and ensure localStorage is synchronized
    try {
      const enrollment = this.userProfile?.userOtpEnrollmentDto ?? this.authService.getUserOtpEnrollmentDtoFromStorage();
      if (enrollment) {
        this.authService.patchUserOtpEnrollmentDto(enrollment);
      }
    } catch (e) {
      // ignore
    }
    try {
      this.twoFactorForm.patchValue({ pairingId: null, issuer: null, accountName: null, pairedAtUtc: null, enabled: false });
    } catch (e) {
      // ignore if form not ready
    }
  }

  refreshStatus() {
    // Reload from storage
    const enrollment = this.authService.getUserOtpEnrollmentDtoFromStorage();
    if (enrollment) {
      // Force UI update by reassignment if needed, or just let the getter pick it up
      this.msgsService.msgSuccess('تم تحديث الحالة', 1500, true);
    } else {
      // optionally try to fetch full profile from backend if available
      this.authService.getUserProfile();
      this.msgsService.msgInfo('تم تحديث البيانات');
    }
  }

  changeVisualTheme(theme: string) {
    this.themeService.setVisualTheme(theme as any);
  }

  // ========================================================================
  // VIEW MODEL HELPERS FOR MODERN TABS
  // ========================================================================

  private normalizeBool(value: any): boolean | null {
    if (value === true || value === false) return value;
    if (typeof value === 'string') {
        const v = value.toLowerCase().trim();
        if (v === 'true') return true;
        if (v === 'false') return false;
    }
    return null;
  }

  get validatedEmail(): boolean | null {
    const p = this.userProfile || {};
    return this.normalizeBool(p.ValidatedEmail ?? p.validatedEmail);
  }

  get validatedMobile(): boolean | null {
    const p = this.userProfile || {};
    return this.normalizeBool(p.ValidatedMobile ?? p.validatedMobile);
  }

  /**
   * Basic Info Tab Rows
   */
  get basicInfoRows(): any[] {
    const p = this.userProfile || {};
    return [
      { label: 'رقم الملف', value: p.userId, icon: 'pi pi-id-card', copy: false },
      { label: 'الرقم القومي', value: p.NationalId || p.nationalId, icon: 'pi pi-credit-card', copy: false },
      // Mobile handled in template or we can just leave it here and add custom rendering if we iterate. 
      // User asked to "Mobile number (if exists) + add ValidatedMobile badge". 
      // We'll keep it here but we might need to handle it in template specificially if we want the badge. 
      // For now let's remove it from GENERIC rows and handle it explicitly in template to support the badge cleanly.
      // { label: 'رقم الهاتف', value: p.MobileNumber, icon: 'pi pi-phone', copy: false },
      { label: 'الوظيفة', value: p.Job, icon: 'pi pi-briefcase', copy: false },
      { label: 'القسم', value: p.Department, icon: 'pi pi-building', copy: false },
      // { label: 'الحالة', value: p.registrationStatus ? 'مسجل' : 'غير مسجل', icon: 'pi pi-check-circle', copy: false, isStatus: true, statusClass: p.registrationStatus ? 'status-registered' : 'status-unregistered' }
    ].filter(r => r.value); // only show if value exists
  }

  /** 
   * Mailbox / Contact Tab Rows
   */
  get mailboxRows(): any[] {
    // We handle email row manually in template to add badge
    return [];
  }

  /**
   * Handle clicks on group chips.
   * If the group looks like an email address, open a mailto: link.
   * Otherwise, emit an informational toast (or extend to navigate to group details).
   */
  onGroupClick(event: Event, group: string) {
    event.preventDefault();
    if (!group) return;
    try {
      if (group.includes('@')) {
        window.location.href = `mailto:${group}`;
      } else {
        this.msgsService.msgInfo('فتح تفاصيل المجموعة', group);
      }
    } catch (e) {
      // fallback: show info
      this.msgsService.msgInfo('فتح المجموعة', group);
    }
  }
}
