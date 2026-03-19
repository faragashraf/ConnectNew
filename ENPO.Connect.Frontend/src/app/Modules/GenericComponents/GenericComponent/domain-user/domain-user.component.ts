import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { FormGroup, AbstractControl } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { DomainAuthController, ExchangeUserInfo } from 'src/app/Modules/auth/services/Domain_Auth.service';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';
import { GenericFormsService } from '../../GenericForms.service';
import { CdCategoryMandDto } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.dto';

@Component({
  selector: 'app-domain-user',
  templateUrl: './domain-user.component.html',
  styleUrls: ['./domain-user.component.scss']
})
export class DomainUserComponent implements OnInit {
  @Input() parentForm!: FormGroup;
  @Input() control: any;
  @Input() cdCategoryMandDto: CdCategoryMandDto = {} as CdCategoryMandDto;
  @Input() isDivDisabled: boolean = false;
  @Input() controlFullName: string = '';
    @Input() public genericFormsService?: GenericFormsService;
  @Output() genericEvent = new EventEmitter<{ event: any, controlFullName: string, eventType: string }>();

  showUserOverlay: boolean = false;
  isUserSelected: boolean = false;
  isInputFocused: boolean = false;
  isValidating: boolean = false;

  constructor( private sanitizer: DomSanitizer,
    private spinner: SpinnerService, private msg: MsgsService, private DomainAuth: DomainAuthController) { }
  ngOnInit(): void {
    this.ValidateUser();
  }

  ValidateUser() {
    let _value = this.control.value
    if (_value == null || _value.length == 0) return;
    this.isValidating = true;
    this.spinner.show('جاري التحقق من المستخدم');
    if (_value != null) {
      this.DomainAuth.isEmailExistInExchange(_value)
        .subscribe({
          next: (resp) => {
            if (resp.isSuccess && resp.data) {
              console.log('resp.data', resp.data);
              this.exchangeUserInfo = resp.data
              this.exchangeUserInfo.safeImage = this.sanitizer.bypassSecurityTrustUrl('data:image/png;base64,' + resp.data.userPicture as string)
              this.showUserOverlay = true;
              this.selectUser();
              // Focus the overlay for accessibility
              setTimeout(() => {
                const overlay = document.querySelector('.user-overlay') as HTMLElement;
                if (overlay) {
                  overlay.focus();
                }
              }, 100);
            }
            else {
              this.isValidating = false;
              this.spinner.hide();
              let errr = '';
              // resp.errors?.forEach(e => errr += e.message + "<br>");
              // this.msg.msgError(errr, "هناك خطا ما", true);
              // this.control.patchValue('');
            }
          },
          error: (error) => {
            this.spinner.hide();
            console.log(error.message);
            this.control.patchValue('');
            this.msg.msgError("هناك خطأ ما", "يرجى التأكد من تسجيل دخولك بالدومين على نظام التشغيل", true);
            // this.msgsService.msgError(error, "هناك خطا ما", true);
          },
          complete: () => {
            this.isValidating = false;
            this.spinner.hide();
            console.log('checkResetedPassword Complete');
          }
        }
        );
    }

  }

  exchangeUserInfo: ExchangeUserInfo = {} as ExchangeUserInfo
  SelectedexchangeUserInfo: ExchangeUserInfo = {} as ExchangeUserInfo
  exchangeUserInfos: ExchangeUserInfo[] = [];

  onBlur(event: any) {
    this.isInputFocused = false;

    this.genericEvent.emit({ event, controlFullName: this.controlFullName, eventType: 'blur' });
  }

  onFocus(event: any) {
    this.isInputFocused = true;
    this.genericEvent.emit({ event, controlFullName: this.controlFullName, eventType: 'focus' });
  }

  onInput(event: any) {
    this.genericEvent.emit({ event, controlFullName: this.controlFullName, eventType: 'input' });

    // Reset user selection if user starts typing
    if (this.isUserSelected) {
      this.isUserSelected = false;
      this.SelectedexchangeUserInfo = {} as ExchangeUserInfo;
    }

    this.ValidateUser();
  }

  closeOverlay(keepInput: boolean = false) {
    this.showUserOverlay = false;
    if (!this.isUserSelected && !keepInput) {
      this.exchangeUserInfo = {} as ExchangeUserInfo;
      try {
        // prefer setValue to keep consistency with selectUser/clearUserSelection
        if (this.control && typeof this.control.setValue === 'function') {
          this.control.setValue('');
          // Emit change so parent sees the cleared value
          this.genericEvent.emit({ event: { value: '' }, controlFullName: this.controlFullName, eventType: 'change' });
        } else if (this.control && typeof this.control.patchValue === 'function') {
          this.control.patchValue('');
          this.genericEvent.emit({ event: { value: '' }, controlFullName: this.controlFullName, eventType: 'change' });
        }
      } catch (e) {
        // swallow to avoid runtime errors if control shape is unexpected
        console.warn('Could not clear control value in closeOverlay:', e);
      }
    }
  }

  selectUser() {
    this.SelectedexchangeUserInfo = { ...this.exchangeUserInfo };
    // Ensure the safe image is also copied
    if (this.exchangeUserInfo.safeImage) {
      this.SelectedexchangeUserInfo.safeImage = this.exchangeUserInfo.safeImage;
    }

    this.showUserOverlay = false;
    this.isUserSelected = true;

    // Update the form control value with user email
    this.control.setValue(this.exchangeUserInfo.userEmail);

    // Emit a change event so parent components receive programmatic updates
    this.genericEvent.emit({
      event: { value: this.exchangeUserInfo.userEmail },
      controlFullName: this.controlFullName,
      eventType: 'change'
    });

    // You can emit an event here if needed to notify parent components
    this.genericEvent.emit({
      event: this.SelectedexchangeUserInfo,
      controlFullName: this.controlFullName,
      eventType: 'userSelected'
    });
  }

  onOverlayKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      this.closeOverlay();
    } else if (event.key === 'Enter') {
      this.selectUser();
    }
  }

  clearUserSelection() {
    this.isUserSelected = false;
    this.SelectedexchangeUserInfo = {} as ExchangeUserInfo;
    this.exchangeUserInfo = {} as ExchangeUserInfo;
    this.control.setValue('');
    this.showUserOverlay = false;

    // Notify parent that value changed (cleared)
    this.genericEvent.emit({ event: { value: '' }, controlFullName: this.controlFullName, eventType: 'change' });

    // Focus back to input
    setTimeout(() => {
      const input = document.getElementById(this.controlFullName) as HTMLInputElement;
      if (input) {
        input.focus();
      }
    }, 100);
  }

  getInputDisplayValue(): string {
    if (this.isUserSelected && this.SelectedexchangeUserInfo.userEmail) {
      return this.SelectedexchangeUserInfo.userEmail;
    }
    return this.control.value || '';
  }

  showUserDetails() {
    if (this.isUserSelected && this.SelectedexchangeUserInfo.userEmail) {
      // Set the exchange user info to the selected user for the overlay
      this.exchangeUserInfo = { ...this.SelectedexchangeUserInfo };
      this.showUserOverlay = true;

      // Focus the overlay for accessibility
      setTimeout(() => {
        const overlay = document.querySelector('.user-overlay') as HTMLElement;
        if (overlay) {
          overlay.focus();
        }
      }, 100);
    }
  }
}
