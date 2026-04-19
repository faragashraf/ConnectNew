import { Component, EventEmitter, Input, OnDestroy, Output, ViewChild } from '@angular/core';
import { FormGroup, FormBuilder, Validators, FormControl } from '@angular/forms';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { SeachDomainUsersComponent } from '../../../AdminCertificates/Shared/components/seach-domain-users/seach-domain-users.component';
import { ExchangeUserInfo } from 'src/app/Modules/auth/services/Domain_Auth.service';
import { Router } from '@angular/router';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';
import { GenericFormsService } from '../../GenericForms.service';
import { ComponentConfig } from 'src/app/shared/models/Component.Config.model';
import { AdmCertDeptDto, MessageDto } from 'src/app/shared/services/BackendServices/AdministrativeCertificate/AdministrativeCertificate.dto';
import { DynamicFormCreateRequestFormRequest, RequestedData } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.dto';
import { AdministrativeCertificateController } from 'src/app/shared/services/BackendServices/AdministrativeCertificate/AdministrativeCertificate.service';
import { FileParameter } from 'src/app/shared/services/BackendServices/dto-shared';
import { TreeNode } from 'primeng/api';

@Component({
  selector: 'app-reply',
  templateUrl: './reply.component.html',
  styleUrls: ['./reply.component.scss']
  ,
  animations: [
    trigger('fadeSlide', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-8px)' }),
        animate('220ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('160ms ease-in', style({ opacity: 0, transform: 'translateY(-8px)' }))
      ])
    ])
  ]
})
export class ReplyComponent {
  @Output() formSubmit = new EventEmitter<any>();
  @Output() FilesSubmit = new EventEmitter<FileParameter[]>();
  @Input() message: MessageDto = {} as MessageDto;
  @Input() config: ComponentConfig = {} as ComponentConfig;
  // Unified flags object from parent component
  @Input() isMyInbox: boolean = false;
  @Input() isMyOutbox: boolean = false;
  @Input() admCertDeptDtos: any[] = []
  
  @Input() unitTree: TreeNode[] = [];

  @ViewChild(SeachDomainUsersComponent) childComponent!: SeachDomainUsersComponent;
 
  replyForm!: FormGroup;
  SelectedexchangeUserInfo: ExchangeUserInfo = {} as ExchangeUserInfo
  SearchText: string = '';
  dialogVisible: boolean = false;

  errorMessage: string = '';

  admCertDeptDto: AdmCertDeptDto = {} as AdmCertDeptDto
  showDirection: boolean = false;

  constructor(private fb: FormBuilder, private router: Router, private administrativeCertificateController: AdministrativeCertificateController,
    private spinner: SpinnerService, private msg: MsgsService, public genericFormService: GenericFormsService) {

  }
  ngOnInit() {
    this.replyForm = this.fb.group({
      message: ['', Validators.required],
      messageId: ['', Validators.required],
      nextResponsibleSectorID: ['', Validators.required]
    });
    // this.replyForm.get('nextResponsibleSectorID')?.patchValue(null)
    this.SearchText = ''
    const allowDefaultNextResponsibleSectorID = this.config.allowDefaultNextResponsibleSectorID !== false;
    
      if (allowDefaultNextResponsibleSectorID ) { // My Inbox
        this.replyForm.get('nextResponsibleSectorID')?.setValue(this.message.assignedSectorId?.toUpperCase());
      }
      else if ((this.config.listRequestModel.requestedData === RequestedData.MyRequest || this.config.listRequestModel.requestedData === RequestedData.Global )
        && this.config.routeKey.includes('AdminCer')) { // myRequest or Global
        // this.GetDepartments();
        this.showDirection = true;
      }

    this.replyForm.get('messageId')?.setValue(this.message.messageId);
  }

  // Visibility getters used by the template to control animated show/hide
  get hasSector(): boolean {
    return !!this.replyForm && !!this.replyForm.get('nextResponsibleSectorID')?.value;
  }

  get hasMessageText(): boolean {
    return !!this.replyForm && ((this.replyForm.get('message')?.value || '').toString().trim().length > 0);
  }
  onSubmit(): void {
    if (this.replyForm.valid) {
      let formData: DynamicFormCreateRequestFormRequest = this.replyForm.getRawValue()
      formData.files = this.fileParameters
      this.formSubmit.emit(formData);
      // this.FilesSubmit.emit(this.fileParameters);
    }
  }
  GetDepartments() {
    this.spinner.show();
    const area = this.message.fields?.find(field => field.fildKind == 'CREATED_AREA')?.fildTxt
    this.administrativeCertificateController.getAreaDepartments(area)
      .subscribe({
        next: (res) => {
          if (res.isSuccess) {
            this.admCertDeptDtos = res.data as AdmCertDeptDto[];
          }
          else {

            let errors = "";
            res.errors?.forEach(e => {
              errors += e.message + '\n';
            });
            this.msg.msgError('Error', '<h5>' + errors + '</h5>', true)
          }
        },
        error: (error) => {

          this.msg.msgError('Error', '<h5>' + error + '</h5>', true)
        },
        complete: () => {

        }
      })
  }
  search(event: ExchangeUserInfo) {
    this.SelectedexchangeUserInfo = event

    this.childComponent.SearchUser()
  }
  seterrorMessage(event: string) {
    this.errorMessage = event
  }
  handleDataFromChild(data: ExchangeUserInfo) {
    this.SelectedexchangeUserInfo = data
    if (!this.SelectedexchangeUserInfo.userEmail?.includes(this.message.assignedSectorId as string))
      this.replyForm.get('nextResponsibleSectorID')?.patchValue(`${data.userDisplayName}`)
    else {
      this.errorMessage += 'لا يمكن ارسال رد لنفسك';
    }


    this.SearchText = this.SelectedexchangeUserInfo.userEmail as string;
    if (this.SelectedexchangeUserInfo.userDisplayName != undefined)
      this.SearchText += " - " + this.SelectedexchangeUserInfo.userDisplayName
    if (this.SelectedexchangeUserInfo.userTitle != undefined)
      this.SearchText += " - " + this.SelectedexchangeUserInfo.userTitle


    // this.replyForm.get('nextResponsibleSectorID')?.setValue(this.SelectedexchangeUserInfo.userEmail)
  }
  // Optional: Method to set messageId from parent component
  setMessageId(id: number) {
    this.replyForm.get('messageId')?.setValue(id);
  }

  fileParameters: FileParameter[] = [];

  onFileChange(event: any) {
    this.fileParameters = event
  }
}
