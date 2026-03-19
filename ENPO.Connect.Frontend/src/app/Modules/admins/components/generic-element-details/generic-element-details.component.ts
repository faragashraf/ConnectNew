import { Component, ContentChildren, ElementRef, EventEmitter, Input, OnInit, Output, QueryList } from '@angular/core';
import { FormArray, FormBuilder, FormGroup } from '@angular/forms';
import { PowerBiController } from 'src/app/Modules/enpopower-bi/services/PowerBi.service';
import { GenericFormsService } from 'src/app/Modules/GenericComponents/GenericForms.service';
import { CdmendDto } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.dto';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';

@Component({
  selector: 'app-generic-element-details',
  templateUrl: './generic-element-details.component.html',
  styleUrls: ['./generic-element-details.component.scss']
})
export class GenericElementDetailsComponent implements OnInit {
  // Dialog control inputs
  @Input() visible: boolean = false;
  @Output() visibleChange = new EventEmitter<boolean>();

  @Input() headerTitle: string = 'Details';
  @Input() headerIcon: string = 'pi pi-file';
  @Input() closable: boolean = true;
  @Input() style: any = { width: '80vw', height: '80vh' };
  @Input() baseZIndex: number = 10000;
  @Input() dismissableMask: boolean = true;
  @Input() blockScroll: boolean = true;

  @Input() field: CdmendDto = {} as CdmendDto;

  @Output() onClose = new EventEmitter<void>();


  @Input() fieldForm!: FormGroup;
  @Input() cdmendTbl!: FormArray;
  @Input() fieldTypes: any[] = [];
  @Input() isEditing: boolean = false;

  @Output() save = new EventEmitter<void>();
  @Output() addField = new EventEmitter<void>();
  // Emit the rebuilt tree after a save operation so the parent can update its view
  @Output() tree = new EventEmitter<void>();
  // New event to emit the current form value and cdmendTbl so parent can persist
  @Output() addNewSelection = new EventEmitter<void>();
  @Output() updateControlSelection = new EventEmitter<FormArray>();
  @Output() updateControlSelectionWithField = new EventEmitter<{ tbl: any[], field: any }>();
  @Output() removeSelection = new EventEmitter<number>();
  @Output() removeSelectionWithField = new EventEmitter<{ index: number, tbl: any[], field: any }>();


  // detect whether a footer was projected by parent
  @ContentChildren('[dialog-footer]', { descendants: true, read: ElementRef }) projectedFooterNodes!: QueryList<ElementRef>;
  hasProjectedFooter: boolean = false;

  // Optional inputs for rendering the preview internally (previously projected)
  ticketForm?: FormGroup;
  @Input() filtered_1_CategoryMand: any[] = [];
  constructor(public genericFormService: GenericFormsService, private fb: FormBuilder,
    private powerBiController: PowerBiController, private spinner: SpinnerService, private msg: MsgsService
  ) { }

  get cdmendTblFormArray(): FormArray {
    return this.fieldForm?.get('cdmendTbl') as FormArray;
  }

  get mandFileds_1(): FormArray {
    return <FormArray>this.ticketForm?.controls['mandFileds_1'];
  }

  ngOnInit(): void {
    if (this.fieldForm) {
      this.fieldForm.patchValue({
        cdmendSql: this.field.cdmendSql ?? null,
        cdmendTxt: this.field.cdmendTxt ?? '',
        cdMendLbl: this.field.cdMendLbl ?? '',
        placeholder: this.field.placeholder ?? '',
        defaultValue: this.field.defaultValue ?? '',
        cdmendType: this.field.cdmendType ?? '',
        required: this.field.required ?? false,
        requiredTrue: this.field.requiredTrue ?? false,
        email: this.field.email ?? false,
        pattern: this.field.pattern ?? false,
        min: this.field.min ?? null,
        max: this.field.max ?? null,
        minxLenght: this.field.minxLenght ?? null,
        maxLenght: this.field.maxLenght ?? null,
        cdmendmask: this.field.cdmendmask ?? '',
        cdmendStat: this.field.cdmendStat ?? true,
        width: this.field.width ?? null,
        height: this.field.height ?? null,
        isDisabledInit: this.field.isDisabledInit ?? false,
        isSearchable: this.field.isSearchable ?? false,
        applicationId: this.field.applicationId ?? ''
      });

      // Initialize cdmendTbl FormArray from parsed tbl or cdmendTbl
      const tblData = this.safeParseCdmendTbl(this.field.cdmendTbl ?? []);
      const tblFormGroups = (tblData || []).map((row: any) => this.fb.group({ key: [row.key], name: [row.name] }));
      this.fieldForm.setControl('cdmendTbl', this.fb.array(tblFormGroups));
    }

    this.ticketForm = this.fb.group({
      mandFileds_1: this.fb.array([]),
    });

    if (this.field.cdmendTxt) {
      this.genericFormService.addFormArrayWithValidators(`${this.field.cdmendTxt}`, this.mandFileds_1);
      this.genericFormService.setControlValue(this.ticketForm, `${this.field.cdmendTxt}`, this.field.defaultValue);
    }
  }
  ngAfterContentInit(): void {
    // mark whether the parent provided a projected footer
    this.hasProjectedFooter = !!(this.projectedFooterNodes && this.projectedFooterNodes.length > 0);
  }

  // Helper used by the inlined preview: safely parse a potential JSON table or return as array
  safeParseCdmendTbl(val: any): any[] {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    try {
      return JSON.parse(val);
    } catch (e) {
      return [];
    }
  }

  // Simple label formatter for option objects used by preview
  optionLabel(o: any): string {
    if (!o) return '';
    if (typeof o === 'string') return o;
    return o.label || o.text || o.name || o.value || JSON.stringify(o);
  }

  onSubmit() {
    if (this.isEditing) {
      // perform local save and emit updated tree instead of emitting the generic "save" event
      this.saveField();
    } else {
      this.addField.emit();
    }
  }

  onAddNewSelection() {
    this.cdmendTblFormArray.push(this.fb.group({ key: [''], name: [''] }));
    this.addNewSelection.emit();
  }

  onUpdateControlSelection() {
    const currentTbl = this.cdmendTblFormArray;
    this.updateControlSelection.emit(currentTbl);
    // also emit the richer payload for parents that expect it
    this.updateControlSelectionWithField.emit({ tbl: currentTbl.value || [], field: this.field });
  }

  onRemoveSelection(index: number) {
    this.cdmendTblFormArray.removeAt(index);
    this.removeSelection.emit(index);
    this.removeSelectionWithField.emit({ index, tbl: this.cdmendTblFormArray?.value || [], field: this.field });
  }

  // Dialog helpers
  close() {
    this.visible = false;
    this.visibleChange.emit(false);
    this.onClose.emit();
  }

  saveAndClose() {
    // perform save then close; parent will receive updated tree via the `tree` output
    this.saveField();
  }

  /**
   * Save the current field into the shared GenericFormsService.cdmendDto collection and
   * emit the rebuilt tree so parent components can refresh their tree view.
   */
  saveField(): void {
    if (!this.fieldForm || !this.fieldForm.valid) return;
    const updated: CdmendDto = this.fieldForm.value;

    // Find existing item by unique identifiers
    const idx = this.genericFormService.cdmendDto.findIndex(f => f.cdmendTxt === updated.cdmendTxt);

    let isNew = false;

    if (idx !== -1) {
      const merged = { ...this.genericFormService.cdmendDto[idx], ...updated } as CdmendDto;
      try {
        const arr = Array.isArray(merged.cdmendTbl) ? merged.cdmendTbl : this.safeParseCdmendTbl(merged.cdmendTbl);
        (merged as any).cdmendTbl = JSON.stringify(arr);
      } catch {
        (merged as any).cdmendTbl = JSON.stringify([]);
      }
      this.genericFormService.cdmendDto[idx] = merged;
    } else {
      isNew = true;
      // fallback: push as new
      (updated as any).cdmendTbl = JSON.stringify(this.safeParseCdmendTbl(updated.cdmendTbl ?? []));
      this.genericFormService.cdmendDto.push(updated);
    }

    // ensure the persisted field also has a serialized cdmendTbl
    (updated as any).cdmendTbl = JSON.stringify(this.safeParseCdmendTbl(updated.cdmendTbl ?? []));

    // Extract pipe-separated values
    const pipeSeparatedValues = this.extractPipeSeparatedValues(updated);

    // Use specific ID for new vs update operations
    const operationId = isNew ? 40 : 33; // Replace 40 with the actual Insert ID

    this.excuteGenericStatmentById(operationId, pipeSeparatedValues).subscribe({
      next: (resp) => {
        if (resp.isSuccess) {
          // rebuild tree and emit to parent
          this.tree.emit();

          // reset local editing state where appropriate
          this.isEditing = false;
          this.fieldForm.reset();
          this.close();

          this.msg.msgSuccess(resp.data as string)
        }
        else {
          let errr = '';
          resp.errors?.forEach(e => errr += e.message + "<br>");
          this.msg.msgError(errr, "هناك خطا ما", true);
        }
      },
      error: (error) => {
        this.msg.msgError(error, "هناك خطا ما", true);
      },
      complete: () => {
        console.log(' Complete');
      }
    });

  }


  extractPipeSeparatedValues(obj: any): string {
    if (!obj) return '';

    // Get all property keys and sort them alphabetically
    const sortedKeys = Object.keys(obj).sort();

    // Extract values for sorted keys and convert to strings
    const values = sortedKeys.map(key => {
      const value = obj[key];

      if (value === null || value === undefined) {
        return "''";
      }

      // if (value === null || value === undefined || value === '') return "''";
      // if (typeof value === 'boolean') return value ? "'1'" : "'0'";
      // if (typeof value === 'number') return "'" + String(value) + "'";
      // if (typeof value === 'object') return "'" + JSON.stringify(value) + "'";
      // if (typeof value === 'string') return "'" + value + "'";
      // // Convert to string and trim whitespace
      return "'" + String(value) + "'";
    });

    // Join with pipe separator
    return values.join("|");
  }
  excuteGenericStatmentById(number: number, parameters?: string) {
    this.spinner.show('جاري تحميل البيانات ...');
    return this.powerBiController.excuteGenericStatmentById(number, parameters);
  }
  onDialogHide() {
    // ensure two-way binding is updated when user closes dialog via UI
    this.visible = false;
    this.visibleChange.emit(false);
    this.onClose.emit();
  }
}
