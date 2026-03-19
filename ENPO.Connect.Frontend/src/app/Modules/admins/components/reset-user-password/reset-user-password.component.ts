import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthorizationController } from 'src/app/Modules/auth/services/Authorization.service';
import { PowerBiController } from 'src/app/Modules/enpopower-bi/services/PowerBi.service';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';

export interface FoundUser {
  Department?: string;
  USER_ID?: string;
  ARABIC_NAME?: string;
  ENGLISH_NAME?: string;
  EFFECTIVE_DATE_FROM?: string;
  EFFECTIVE_DATE_TO?: string;
  LAST_NAME?: string;
  FIRST_NAME?: string;
  PREFERED_LANGUAGE?: string;
  PASSWORD?: string;
  STATUS?: string;
  CREATED_ON?: string;
  CREATED_BY?: string;
  LAST_UPDATED?: string;
  LAST_UPDATED_BY?: string;
  RESET_PASSWORD?: string;
  LAST_PASSWORD_DATE?: string;
  NEXT_PASSWORD_DATE?: string;
  LOGIN_STATUS?: string;
  NATIONAL_ID?: string;
  MOBILE_NUMBER?: string;
}

@Component({
  selector: 'app-reset-user-password',
  templateUrl: './reset-user-password.component.html',
  styleUrls: ['./reset-user-password.component.scss']
})
export class ResetUserPasswordComponent implements OnInit {
  form: FormGroup;
  loading = false;
  state: 'idle' | 'searching' | 'found' | 'notfound' = 'idle';
  foundUser: FoundUser | null = null;
  message = '';

  constructor(private fb: FormBuilder, private autorization: AuthorizationController,
    private spinner: SpinnerService, private msg: MsgsService, private powerBiController: PowerBiController) {
    this.form = this.fb.group({
      userId: ['', [Validators.required, Validators.minLength(1)]]
    });
  }

  ngOnInit(): void { }

  get userId() {
    return this.form.get('userId');
  }

  // Simulated lookup. Replace with real service call as needed.
  findUser() {

    this.loading = true;
    this.state = 'searching';
    this.foundUser = null;
    this.message = '';
    if (this.form.valid) {
      this.powerBiController.getGenericDataById(20, this.userId?.value)
        .subscribe({
          next: (resp) => {
            if (resp.isSuccess) {
              this.loading = false;
              this.state = 'found';
              this.foundUser = (resp.data as any[])[0]
              console.log(resp.data as any[]);
            }
            else {
              this.loading = false;
              this.state = 'notfound';
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
            console.log(' Complete');
          }
        }
        );
    }


  }

  // Simulate reset password action.
  resetPassword() {
    if (!this.foundUser) return;

    this.loading = true;
    this.spinner.show('جاري تحميل البيانات ...');
    this.autorization.resetPassword(this.userId?.value.toString())
      .subscribe({
        next: (resp) => {
                      this.loading = false;
          if (resp.isSuccess) {
            this.message = `Password reset successfully for ${this.displayName()}.`;
            // After reset you might clear state or keep user shown; we'll keep it but disable reset further
            // this.state = 'Find';
            this.foundUser = null;
            this.form.reset();
            this.msg.msgSuccess(resp.data as string)
          }
          else {
            let errr = '';
            resp.errors?.forEach(e => errr += e.message + "<br>");
            this.msg.msgError(errr, "هناك خطا ما", true);
          }

        },
        error: (error) => {
                      this.loading = false;
          console.log(error.message);
          this.msg.msgError(error, "هناك خطا ما", true);
        },
        complete: () => {
          console.log(' Complete');
        }
      }
      );
  }

  // small helper to know whether reset button should be enabled
  canReset(): boolean {
    return !!this.foundUser && !this.loading;
  }
  // helper getters / helpers to surface data using the new payload keys
  dept(): string {
    return this.foundUser?.Department || '-';
  }

  displayName(): string {
    return this.foundUser?.ENGLISH_NAME || this.foundUser?.ARABIC_NAME || this.foundUser?.FIRST_NAME || '-';
  }
  reset() {

  }
}
