import { Component, Input, Output, EventEmitter, SimpleChanges } from '@angular/core';
import { GenericFormsService, GenericFormsIsolationProvider } from 'src/app/Modules/GenericComponents/GenericForms.service';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';
import { PrintService } from 'src/app/shared/services/helper/print.service';
import { ComponentConfig } from 'src/app/shared/models/Component.Config.model';
import { CdCategoryMandDto, MessageDto, MessageStatus, TkmendField } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.dto';
import { AdministrativeCertificateController } from 'src/app/shared/services/BackendServices/AdministrativeCertificate/AdministrativeCertificate.service';
import { RequestStatusService } from '../../AdminCertificates/Shared/helper/RequestStatus.service';
import { FormGroup } from '@angular/forms';
import { FileParameter } from 'src/app/shared/services/BackendServices/dto-shared';

@Component({
  selector: 'app-complete-request',
  templateUrl: './complete-request.component.html',
  styleUrls: ['./complete-request.component.scss'],
  providers: [GenericFormsIsolationProvider]
})
export class CompleteRequestComponent {
  @Input() message: MessageDto = {} as MessageDto;
  @Input() messageDtos: MessageDto[] = [];
  @Input() config: ComponentConfig = {} as ComponentConfig;
  @Input() fileParameters: FileParameter[] = [];

  @Output() messageUpdated = new EventEmitter<MessageDto>();

  filteredCategory: CdCategoryMandDto[] = [];
  localConfig: ComponentConfig = {} as ComponentConfig;

  constructor(
    public genericFormService: GenericFormsService, 
    private spinner: SpinnerService, 
    private msg: MsgsService, 
    public printService: PrintService,
    private administrativeCertificateController: AdministrativeCertificateController, 
    public requestStatusService: RequestStatusService
  ) { }

  ngOnInit(): void {
    this.localConfig = { 
        ...this.config, 
        isNew: true, 
        submitButtonText: 'تسجيل', 
        fieldsConfiguration: { 
            ...(this.config?.fieldsConfiguration || {}), 
            isDivDisabled: false 
        } 
    };
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['message']) {
      this.message = changes['message'].currentValue;
      this.PrepareFilter();
    }
  }

  PrepareFilter() {
    this.filteredCategory = this.genericFormService.cdCategoryMandDto.filter(f => f.mendGroup == 25);
  }

  onFileChange(event: FileParameter[]) {
    this.fileParameters = event;
  }

  onSubmitData(form: FormGroup): void {
    let requestModel: TkmendField[] = [];

    this.genericFormService.dynamicGroups.forEach(group => {
      const formArray = this.genericFormService.getFormArray(group.formArrayName, form);
      formArray.controls.forEach(grp => {
        const formGroup = grp as FormGroup;
        const controlName = Object.keys(formGroup.controls)[0];
        const name = controlName.split('|')[0];
        const value = formGroup.controls[controlName]?.value;

        if (value !== null && value !== undefined && value !== '') {
          requestModel.push({ 
            fildRelted: this.message.messageId, 
            fildSql: 0, 
            fildKind: name, 
            fildTxt: value 
          } as TkmendField);
        }
      });
    });
    if(requestModel.length === 0) {
      this.msg.msgError('خطأ', '<h5>الرجاء إدخال البيانات المطلوبة</h5>', true);
      return;
    }

    this.spinner.show('جاري تسجيل البيانات ...');
    this.administrativeCertificateController.completeRequest(requestModel, this.fileParameters)
      .subscribe({
        next: (res: any) => {
          if (res.isSuccess) {
            console.log(res.data);
            const response = res.data as MessageDto;
            this.messageDecreed(response);
            this.genericFormService.prePrintFormVisible = false;
            this.msg.msgSuccess('تم استكمال البيانات بنجاح');
          } else {
            let errors = '';
            res.errors?.forEach((e: any) => {
              errors += e.message + '\n';
            });
            this.msg.msgError('Error', '<h5>' + errors + '</h5>', true);
          }
        },
        error: (error: any) => {
          this.msg.msgError('Error', '<h5>' + error + '</h5>', true);
        }
      });
  }

  private messageDecreed(updatedMessage: MessageDto) {
    // 1. Mutate internal state if required (though preferring one way data flow is better)
    this.message = updatedMessage;
    
    // 2. Emit upward so the parent overwrites its bound [message] variable
    this.messageUpdated.emit(this.message);
  }
}
