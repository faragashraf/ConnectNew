import { Component, Input, SimpleChanges, ViewChild } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { GenericFormsService } from 'src/app/Modules/GenericComponents/GenericForms.service';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';
import { PrintService } from 'src/app/shared/services/helper/print.service';
import { ConditionalDate } from 'src/app/shared/Pipe/Conditional-date.pipe';
import { ComponentConfig } from 'src/app/shared/models/Component.Config.model';
import { RequestTableComponent } from '../../../../GenericComponents/ConnectComponents/request-table/request-table.component';
import { CdCategoryMandDto, MessageDto, MessageStatus, TkmendField } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.dto';
import { AdministrativeCertificateController } from 'src/app/shared/services/BackendServices/AdministrativeCertificate/AdministrativeCertificate.service';
import { RequestStatusService } from '../../../Shared/helper/RequestStatus.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-pre-print-form',
  templateUrl: './pre-print-form.component.html',
  styleUrls: ['./pre-print-form.component.scss']
})
export class PrePrintFormComponent {
  @Input() message: MessageDto = {} as MessageDto
  @Input() messageDtos: MessageDto[] = []
  // @Input() minDate: Date = new Date();
  @Input() maxDate: Date = this.message.replies?.sort((a, b) => (b.replyId ?? 0) - (a.replyId ?? 0))[0].createdDate as Date;
  timeOnly: boolean = false;
  dateFormat: string = 'yy/mm/dd';
  @ViewChild(RequestTableComponent) childRequestTableComponent!: RequestTableComponent;

  filteredCategory: CdCategoryMandDto[] = []
  isDivDisabled: boolean = false;
  @Input() config: ComponentConfig = {} as ComponentConfig;

  PRINTED: Boolean = false;
  isNew: Boolean = true;
  disableAddButton: Boolean = false;
  ser: number = 0
  constructor(public genericFormService: GenericFormsService, private fb: FormBuilder, private spinner: SpinnerService, private msg: MsgsService, public printService: PrintService,
    private administrativeCertificateController: AdministrativeCertificateController, public requestStatusService: RequestStatusService, private conditionalDate: ConditionalDate) {
    this.genericFormService.prePrintForm = this.fb.group({
      mandFileds: this.fb.array([]),
    });
  }

  get mandFileds(): FormArray {
    return this.genericFormService.prePrintForm.get('mandFileds') as FormArray;
  }

  duplicateLastTwoGroupsWithIncrementedNames(): void {
    const length = this.mandFileds.length;
    if (length < 2) return;

    const lastTwo = [this.mandFileds.at(length - 2), this.mandFileds.at(length - 1)];

    for (const group of lastTwo) {
      const controls = (group as FormGroup).controls;
      const name = Object.keys(controls)[0].split('|')[0];

      const field = this.filteredCategory?.find(cat => cat.mendField == name)
      if (field) {

        const Newfield: TkmendField = { fildSql: this.ser, fildRelted: this.message.messageId, fildKind: field.mendField, fildTxt: '' } as TkmendField
        // this.message.fields?.push(Newfield);
        this.genericFormService.addFormArrayWithValidators(`${Newfield.fildKind}|${this.ser}` as string, this.mandFileds);

        let news: CdCategoryMandDto = {
          mendSql: this.ser, mendCategory: 104,
          mendField: name,
          mendStat: false,
          mendGroup: 4,
          applicationId: environment.OTPApplicationName
        } as CdCategoryMandDto
        this.filteredCategory.push(news)
        this.ser += 1;
      }
    }
  }
  date!: Date;
  ngOnInit(): void {
    this.isNew = true;
  }
  ngOnChanges(changes: SimpleChanges) {
    // React to input changes
    if (changes['cdCategoryMandDto']) {
    }
    if (changes['message']) {
      this.message = (changes['message'].currentValue);
      this.mandFileds.clear();
      this.ser = 0;
      this.PrepareFilter();

      const sortedCategories = [...this.filteredCategory].sort((a, b) => (a.mendSql ?? 0) - (b.mendSql ?? 0));
      if (sortedCategories.length === 0) return;

      const firstMendField = sortedCategories[0].mendField;
      const firstField = this.message.fields?.find(f => f.fildKind === firstMendField);

      if (firstField && firstField.fildTxt && firstField.fildTxt.length > 0) {
        this.isNew = false;
        this.isDivDisabled = true;
      } else {
        this.isNew = true;
        this.isDivDisabled = false;
      }

      if (this.isNew)
        this.PopulateNewForm(this.mandFileds, this.message.fields as TkmendField[]);
      else
        this.PopulateFormWithValues(this.mandFileds, this.message.fields as TkmendField[]);

      this.setupConditionalLogic();
    }
  }
  setupConditionalLogic() {
    // Find the control by name instead of fixed index
    let triggerControl: FormControl | null = null;
    let triggerIndex = -1;

    this.mandFileds.controls.forEach((group, index) => {
      const formGroup = group as FormGroup;
      const controlName = Object.keys(formGroup.controls)[0];
      const [name, i] = controlName.split('|');

      if (name.includes('HAVE_NOT_HAVE') || name.includes('INQUIRY_STATUS')) {
        triggerIndex = index;
        triggerControl = formGroup.get(controlName) as FormControl;
      }

      // Set Approval Date Automatically From Reply
      if (this.isNew && name.includes('APPROVAL_DATE')) {
        const Control = formGroup.get(controlName) as FormControl;
        this.message.replies?.find(f => {
          const [userId,userName,kind, area, department] = f.authorName?.split('-') as string[]
          if (department && department.trim() == 'الشئون القانونية') {
            Control.patchValue(this.conditionalDate.transform(new Date(f?.createdDate as Date)));
          }
        })
      }
    });


    if (triggerControl && triggerIndex !== -1) {
      // Initial state check
      this.toggleSubsequentControls((triggerControl as FormControl).value, triggerIndex);

      // Listen for value changes
      (triggerControl as FormControl).valueChanges
        .pipe(
          debounceTime(500),
          distinctUntilChanged(
            // (prev, curr) => this.deepCompare(prev, curr)
          ) // Deep comparison
        ).subscribe(value => {
          this.toggleSubsequentControls(value, triggerIndex);
        });
    }
  }

  // Modified toggle method
  toggleSubsequentControls(currentValue: string, triggerIndex: number) {
    const shouldDisable = (currentValue !== 'لديه' && triggerIndex == 2) || (currentValue !== 'نتيجة الإستعلام' && (triggerIndex == 4 || triggerIndex == 3));

    for (let i = triggerIndex + 1; i < this.mandFileds.length; i++) {
      const control = this.getControlByIndex(i);
      if (control) {
        if (shouldDisable) {
          control.disable()
          this.disableAddButton = true;
          if (triggerIndex == 4 || triggerIndex == 3) {
            control.patchValue(currentValue)
          } else {
            control.patchValue(null)
          }
          if (triggerIndex == 2)
            this.removeLastMandField();
        } else if (!shouldDisable) {
          control.enable();
          this.disableAddButton = false;
        }
      }
    }
  }

  // Keep existing helper method
  getControlByIndex(index: number): FormControl | null {
    const formGroup = this.mandFileds.at(index) as FormGroup;
    if (!formGroup) return null;
    const controlName = Object.keys(formGroup.controls)[0];
    return formGroup.get(controlName) as FormControl;
  }

  onSubmit(): void {
    if (this.genericFormService.prePrintForm.valid) {
      console.log('Form Submitted:', this.genericFormService.prePrintForm.value);
      this.CompleteData()
    } else {
      console.log('Form is invalid');
    }
  }

  PrepareFilter() {
    this.filteredCategory = this.genericFormService.cdCategoryMandDto.filter(f => f.mendGroup == 4 &&
      f.mendCategory == this.config.tkCategoryCds.find(f=> f.value == this.message.categoryCd.toString())?.key) ;
    if (this.message.fields?.find(f => f.fildKind == 'INQUIRY_TYPE') && this.message.fields?.find(f => f.fildTxt == 'إستعلام عن رصيد حساب')) {
      this.filteredCategory = this.filteredCategory.filter(f =>
        f.mendField !== 'REMITTANCES_TYPE'
        && f.mendField !== 'STAKEHOLDER_COUNT'
        // && f.mendField !== 'ACCOUNT_BALANCE'
        // && f.mendField !== 'ACCOUNT_BALANCE_TEXT'
        && f.mendField !== 'HAVE_NOT_HAVE'
        && f.mendField !== 'ACCOUNT_TYPEE'
        && f.mendField !== 'ACCOUNT_NUMBERR'
      )
    } else if (this.message.fields?.find(f => f.fildKind == 'INQUIRY_TYPE') && this.message.fields?.find(f => f.fildTxt == 'إستعلام عن حسابات')) {
      this.filteredCategory = this.filteredCategory.filter(f =>
        f.mendField !== 'REMITTANCES_TYPE'
        && f.mendField !== 'STAKEHOLDER_COUNT'
        && f.mendField !== 'ACCOUNT_BALANCE'
        && f.mendField !== 'ACCOUNT_BALANCE_TEXT'
        // && f.mendField !== 'HAVE_NOT_HAVE'
        // && f.mendField !== 'ACCOUNT_TYPEE'
        // && f.mendField !== 'ACCOUNT_NUMBERR'
      )
    } else if (this.message.fields?.find(f => f.fildKind == 'INQUIRY_TYPE') && this.message.fields?.find(f => f.fildTxt == 'إستعلام عن حوالات')) {
      this.filteredCategory = this.filteredCategory.filter(f =>
        // f.mendField !== 'REMITTANCES_TYPE'
        // && f.mendField !== 'STAKEHOLDER_COUNT'
        f.mendField !== 'ACCOUNT_BALANCE'
        && f.mendField !== 'ACCOUNT_BALANCE_TEXT'
        && f.mendField !== 'HAVE_NOT_HAVE'
        && f.mendField !== 'ACCOUNT_TYPEE'
        && f.mendField !== 'ACCOUNT_NUMBERR'
      )
    }
    else if (this.message.fields?.find(f => f.fildKind == 'CERTIFICATE_TYPE') && this.message.fields?.find(f => f.fildTxt == 'POS') && this.message.fields?.find(f => f.fildKind == 'DESTINATION') && this.message.fields?.find(f => f.fildTxt == 'إلى من يهمة الامر')) {
      this.filteredCategory = this.filteredCategory.filter(f =>
        f.mendField !== 'APPROVAL_DATE'
      )
    }

  }
  
  PopulateNewForm(form: FormArray<any>, TkmendField: TkmendField[]) {
    form.clear();

    this.filteredCategory.forEach((cat, index) => {
      this.genericFormService.addFormArrayWithValidators(`${cat.mendField}|${index}`, form);
      this.genericFormService.setControlValue(form, `${cat.mendField}|${index}`, null);
      this.ser++
    })
  }

  PopulateFormWithValues(form: FormArray<any>, TkmendField: TkmendField[]) {
    form.clear();
    // Sort CdCategoryMandDto by index (assuming mendSql is the index)
    this.filterMessageFieldsByCategoryMandDto(TkmendField)?.forEach((field, index) => {
      this.genericFormService.addFormArrayWithValidators(`${field?.fildKind}|${index}`, form);
      this.genericFormService.setControlValue(form, `${field?.fildKind}|${index}`, field?.fildTxt);
    });
  }

  getAccountNameCount(): number {
    return this.mandFileds.controls.filter(control => {
      // Check if any control name includes "Account_name"
      return Object.keys(control.value).some(key => key.includes('ACCOUNT_NUMBERR'));
    }).length;
  }

  removeLastMandField(): void {
    if (this.mandFileds.length > 5) {
      this.message.fields = this.message.fields?.filter(f => f.fildSql != this.ser && f.fildSql != this.ser - 1)
      this.ser -= 2;
      this.filteredCategory.splice(this.mandFileds.length - 2, 2)
      this.mandFileds.removeAt(this.mandFileds.length - 1);
      this.mandFileds.removeAt(this.mandFileds.length - 1);
    }
  }

  CompleteData() {
    let requestModel: TkmendField[] = []
    this.mandFileds.controls.forEach((group, index) => {
      const formGroup = group as FormGroup;
      const controlName = Object.keys(formGroup.controls)[0];
      formGroup.controls[controlName]
      const [name, i] = controlName.split('|');
      requestModel.push({ fildRelted: this.message.messageId, fildSql: 0, fildKind: name, fildTxt: formGroup.controls[controlName].value } as TkmendField)
    });
    this.spinner.show('جاري تسجيل البيانات ...');
    this.administrativeCertificateController.createNewFileds(requestModel)
      .subscribe({
        next: (res) => {
          
          if (res.isSuccess) {
            this.isNew = false;
            const response = res.data as TkmendField[]
            this.message.fields = [...(this.message.fields || []), ...response];
            this.genericFormService.prePrintFormVisible = false;
            this.msg.msgSuccess('تم استكمال البيانات بنجاح')
            this.message.status = MessageStatus.تم_الطباعة
            this.requestStatusService.updateStatus(this.message, this.messageDtos, false)
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

  filterMessageFieldsByCategoryMandDto(TkmendField: TkmendField[]): TkmendField[] | [] {
    if (!this.message.fields || !Array.isArray(this.message.fields)) return [];
    const allowedKinds = this.genericFormService.cdCategoryMandDto.filter(f => f.mendGroup == 4).map(dto => dto.mendField);
    return TkmendField.filter(field => allowedKinds.includes(field.fildKind as string));
  }
}
