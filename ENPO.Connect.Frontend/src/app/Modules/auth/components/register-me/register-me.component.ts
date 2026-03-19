import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { debounceTime, forkJoin } from 'rxjs';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';
import { ExchangeUserInfo, ExchangeUserInfoCommonResponse, SSOController, StringCommonResponse } from '../../services/SSO.service';
import { DomainAuthController } from '../../services/Domain_Auth.service';
import { Router } from '@angular/router';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-register-me',
  templateUrl: './register-me.component.html',
  styleUrls: ['./register-me.component.scss']
})
export class RegisterMeComponent {
  frm!: FormGroup;
  authOption: string = 'noParams'; // Default option
  exchangeUserInfo: ExchangeUserInfo = {} as ExchangeUserInfo
  MeInfo: ExchangeUserInfo = {} as ExchangeUserInfo
  IsAuth: boolean = false;
  IsAshrafAuth: boolean = false;


  userForm: FormGroup;
  previewImage: SafeUrl | undefined;

  constructor(private sso: SSOController, private sanitizer: DomSanitizer,private router: Router,
    private spinner: SpinnerService, private msg: MsgsService, private DomainAuth: DomainAuthController,
    private fb: FormBuilder) {
    this.frm = this.fb.group({
      authOption: ['noParams'], // Default radio button value
      userName: [''],  // Initially no validation
      userId: [null, Validators.required],
    });

    this.userForm = this.fb.group({
      userEmail: [''],
      userDisplayName: [''],
      userTitle: [''],
      mobilePhone: ['',],
    });
  }

  ngOnInit() {
    this.onOptionChange(); // Initialize validators based on default selection
    this.AuthMe()
    this.frm.valueChanges.pipe(
      debounceTime(1000)
    ).subscribe();
  }
  initForm() {
    this.frm = this.fb.group({
      validates: [null, Validators.required],
      userName: [null, Validators.required],
      userId: [null, Validators.required],
    });
  }

  ValidateUser() {
    this.exchangeUserInfo = {} as ExchangeUserInfo

    this.spinner.show('جاري التحقق ...');
    if (this.authOption === 'withParams') {
      let _value = this.frm.get('userName')?.value
      if (_value.length > 0) {
        this.DomainAuth.isEmailExistInExchange(_value)
          .subscribe({
            next: (resp: ExchangeUserInfoCommonResponse) => {
              if (resp.isSuccess && resp.data) {
                
                this.exchangeUserInfo = resp.data
                this.exchangeUserInfo.safeImage = this.sanitizer.bypassSecurityTrustUrl('data:image/png;base64,' + resp.data.userPicture as string)
                this.IsAuth = true;
              }
              else {
                
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
        const userName = this.frm.get('userName')?.value;
        console.log(`Validating user with email: ${userName}`);
      }

      // Add your validation logic here
    } else {
      this.AuthMe()
      console.log('Validating without parameters');
    }
  }

  AuthMe() {
    this.spinner.show('جاري التحقق ...');
    this.sso.authanticateMe()
      .subscribe({
        next: (resp) => {
          if (resp.isSuccess && resp.data) {
            
            this.exchangeUserInfo = resp.data
            this.exchangeUserInfo.safeImage = this.sanitizer.bypassSecurityTrustUrl('data:image/png;base64,' + resp.data.userPicture as string)
            this.IsAuth = true;
            this.userForm.patchValue(this.exchangeUserInfo)
            if (this.exchangeUserInfo.userEmail?.includes('a.farag')) {
              this.IsAshrafAuth = true
            }
            this.frm.get('userName')?.patchValue(resp.data.userEmail)
          }
          else {
            
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

  onSubmit(): void {
    // this.onOptionChange();
    if (this.frm.valid) {
      console.log('Form Submitted:', this.frm.value);
      this.Register()
    } else {
      console.error('Form is invalid');
    }
  }

  onOptionChange(): void {
    this.exchangeUserInfo = {} as ExchangeUserInfo
    this.authOption = this.frm.get('authOption')?.value;
    this.userForm.reset()
    this.IsAuth = false
    if (this.authOption === 'withParams') {
      this.frm.get('userName')?.setValidators([Validators.required]);
    } else {
      this.AuthMe()
      this.frm.get('userName')?.clearValidators();
    }
    this.frm.get('userName')?.updateValueAndValidity();
    this.frm.get('userName')?.patchValue(null)
    this.frm.get('userId')?.patchValue(null)
  }
  Register() {
    let _auth$!: any;
    let _reg$!: any;
    if (this.authOption === 'withParams') {
      let _value = this.frm.get('userName')?.value
      if (_value.length > 0) {
        _auth$ = this.DomainAuth.isEmailExistInExchange(_value)
        _reg$ = this.DomainAuth.registerUser(_value, this.frm.get('userId')?.value, environment.OTPApplicationName)
      }
    } else {
      _auth$ = this.sso.authanticateMe()
      _reg$ = this.sso.registerMe(this.frm.get('userId')?.value, environment.OTPApplicationName)
    }
    const _Obs$ = forkJoin<[ExchangeUserInfoCommonResponse, StringCommonResponse]>(_auth$, _reg$)
    this.spinner.show('جاري ارسال طلب التسجيل ...');
    _Obs$
      .subscribe({
        next: (resp) => {
          if (resp[0].isSuccess && resp[0].data) {
            
            this.msg.msgSuccess(resp[1].data as string)
            this.exchangeUserInfo = resp[0].data
            this.exchangeUserInfo.safeImage = this.sanitizer.bypassSecurityTrustUrl('data:image/png;base64,' + resp[0].data.userPicture as string)
          }
          if (resp[0].isSuccess && resp[1].isSuccess && resp[0].data) {
            this.msg.msgSuccess(resp[1].data as string)
          }
          else {
            
            let errr = '';
            resp[0].errors?.forEach((e: any) => errr += e.message + "<br>");
            resp[1].errors?.forEach((e: any) => errr += e.message + "<br>");
            this.msg.msgError(errr, "هناك خطا ما", true);
          }
        },
        error: (error) => {
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


  navigateToLogin() {
    this.router.navigate(['/Home']); // Correct usage with array
  }
}
