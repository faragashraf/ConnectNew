import { Component, ViewChild } from '@angular/core';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';
import { SSOController } from '../../../auth/services/SSO.service';
import { Table } from 'primeng/table';
import { DomainAuthController, DomainRegistrationRequest, DomainRegistrationRequestListCommonResponse } from '../../../auth/services/Domain_Auth.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { map } from 'rxjs';

// tree-node.model.ts
@Component({
  selector: 'app-registrations-requests',
  templateUrl: './registrations-requests.component.html',
  styleUrls: ['./registrations-requests.component.scss']
})
export class RegistrationsRequestsComponent {

  registrationRequests: DomainRegistrationRequest[] = []
  registrationRequest: DomainRegistrationRequest = {} as DomainRegistrationRequest

  constructor(private msg: MsgsService,
    private DomainAuth: DomainAuthController, private sso: SSOController, private spinner: SpinnerService, private fb: FormBuilder) {

  }
  pageSize: number = 5;
  totalRecords: number = 0;
  loading: boolean = false;
  currentPage: number = 1


  registrationForm!: FormGroup;
  originalStatus: any;

  onPageChange(event: any) {
    this.currentPage = (Number(event.first / event.rows) + 1);
  }
  ngOnInit(): void {
    this.initializeForm();

    this.getAllPending()
  }

  initializeForm(): void {
    this.registrationForm = this.fb.group({
      regRealName: [''],
      regEmail: [''],
      regTitle: [''],
      regGsm: [''],
      regIp: [''],
      regApplicationId: [''],
      regAproved: [''],
      regGender: [''],
      regUserId: [''],
      regCat: ['', Validators.required]
    });
  }
  getAllPending() {
    this.spinner.show('جاري تسجيل الدخول');
    this.DomainAuth.getAllRegistrationRequests(this.currentPage, this.pageSize)
      .pipe(
        map((m: DomainRegistrationRequestListCommonResponse) => {
          m.data.forEach(_m => {
            _m.regAproved = _m.regAproved == 1 ? 'معتمد' : _m.regAproved == 0 ? 'معلق' : 'مرفوض';
          });
          return m;
        })
      )
      .subscribe({
        next: (resp) => {
          if (resp.isSuccess) {
            this.registrationRequests = resp.data
            this.totalRecords = resp.totalCount
            this.pageSize = resp.pageSize
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

  receiveData(event: any) {
    if (this.registrationRequest.id > 0) {
      this.registrationRequest.regCat = event
      console.log('receiveData', event);
    }
  }

  @ViewChild('dt1') dt1!: Table; // Using non-null assertion to tell TypeScript that it will always be initialized

  onFilterInput(event: Event): void {
    const inputElement = event.target as HTMLInputElement; // Explicitly assert as HTMLInputElement
    const inputValue = inputElement.value;
    this.dt1?.filterGlobal(inputValue, 'contains');
  }

  appOptions = [
    { value: 'CORR', label: 'Correspondence' },
    { value: 'SWB', label: 'SWB' }
  ]
  genderOptions = [
    { value: 'Male', label: 'Male' },
    { value: 'Female', label: 'Female' }
  ]
  approvalOptions = [
    { value: 'معلق', label: 'معلق' },
    { value: 'معتمد', label: 'تمت الموافقة' },
    { value: 'مرفوض', label: 'مرفوض' }
  ]
  saveOriginalStatus(value: any): void {
    this.originalStatus = value;
  }


  updateStatus() {
    const currentValue = this.registrationForm.get('regApplicationId')?.value;
    // Add your update logic here
    console.log('Status updated from', this.originalStatus, 'to', currentValue);
  }
  UpdateRegistration() {
    this.spinner.show('جاري تسجيل البيانات');
    const request = this.registrationRequest
    request.regAproved = request.regAproved == 'معتمد' ? 1 : request.regAproved == 'معلق' ? '0' : '2'
    this.DomainAuth.registerApproval(request)
      .subscribe({
        next: (resp) => {
          if (resp.isSuccess) {
            this.msg.msgSuccess(resp.data as string)
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
          this.isverified = false;
        }
      }
      );
  }

  isverified: boolean = false;
  verifyUser() {
    this.spinner.show('جاري تسجيل الدخول');
    this.DomainAuth.verifyUser(this.registrationRequest.regUserId)
      .subscribe({
        next: (resp) => {
          if (resp.isSuccess) {
            this.msg.msgSuccess('تم العثور على المستخدم باسم : <br>' + resp.data.arabicName as string + '<br>' + resp.data.emailAddress)
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
}
