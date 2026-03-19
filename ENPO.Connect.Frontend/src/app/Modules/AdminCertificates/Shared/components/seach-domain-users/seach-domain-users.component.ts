import { Component, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { Table } from 'primeng/table';
import { DomainAuthController, ExchangeUserInfo } from 'src/app/Modules/auth/services/Domain_Auth.service';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';

@Component({
  selector: 'app-seach-domain-users',
  templateUrl: './seach-domain-users.component.html',
  styleUrls: ['./seach-domain-users.component.scss']
})
export class SeachDomainUsersComponent {
  @Input() SearchText: string = '';
  @Input() dialogVisible: boolean = false;
  @Output() dialogVisibleChange = new EventEmitter<boolean>();
  @Output() exchangeUserInfoOut = new EventEmitter<ExchangeUserInfo>();
  @Output() errorMessage = new EventEmitter<string>();

  @ViewChild('dt2') dt2!: Table; // Using non-null assertion to tell TypeScript that it will always be initialized


  exchangeUserInfo: ExchangeUserInfo = {} as ExchangeUserInfo
  SelectedexchangeUserInfo: ExchangeUserInfo = {} as ExchangeUserInfo
  exchangeUserInfos: ExchangeUserInfo[] = [];


  constructor(private sanitizer: DomSanitizer,
    private spinner: SpinnerService, private msg: MsgsService, private DomainAuth: DomainAuthController) { }


  ngOnInit() {
    // this.SearchUser()
  }

  SearchUser() {
    this.exchangeUserInfos = []
    this.spinner.show('جاري تحميل البيانات ...');
    this.DomainAuth.searchDomainName(this.SearchText)
      .subscribe({
        next: (resp) => {
          if (resp.isSuccess && resp.data) {
            
            this.exchangeUserInfos = resp.data
            this.exchangeUserInfos.forEach(f => {
              f.safeImage = this.sanitizer.bypassSecurityTrustUrl('data:image/png;base64,' + f.userPicture as string)
            })
          }
          else {
            
            let errr = '';
            resp.errors?.forEach(e => errr += e.message + "<br>");
            this.msg.msgError(errr, "هناك خطا ما", true);
          }
        },
        error: (error) => {
          console.log(error.message);
          
          this.msg.msgError("هناك خطأ ما", "يرجى التأكد من تسجيل دخولك بالدومين على نظام التشغيل", true);
          // this.msgsService.msgError(error, "هناك خطا ما", true);
        },
        complete: () => {
          console.log('checkResetedPassword Complete');
        }
      }
      );
  }
  onRowSelect(event: any) {
    // console.log('event', event?.data);
  }
  onRowUnselect(event: any) {
    // console.log('event', event?.data);
  }

  onFilterInput(event: Event): void {
    const inputElement = event.target as HTMLInputElement; // Explicitly assert as HTMLInputElement
    const inputValue = inputElement.value;
    this.dt2?.filterGlobal(inputValue, 'contains');
  }
  // Handle double-click event
  onRowDblClick(rowData: ExchangeUserInfo) {
    if (rowData.registrationStatus == false && rowData.isGroup == false) {
      this.errorMessage.emit('المستخدم غير مسجل بالتطبيق، يرجى التأكد من الاختيار التصحيح أو طلب التسجيل من المذكور')
      // this.msg.msgError('انتبه', 'المستخدم غير مسجل بالتطبيق', true)
    }

    this.exchangeUserInfoOut.emit(rowData)
    this.SelectedexchangeUserInfo = rowData
    this.onHide()
  }
  onHide() {
    this.dialogVisible = false;
    // this.exchangeUserInfoOut.emit(this.SelectedexchangeUserInfo)
    this.dialogVisibleChange.emit(this.dialogVisible);
    this.SearchText = '';
  }
}
