import { Injectable, SkipSelf } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';
import { forkJoin, of, Observable } from 'rxjs';
import { map, catchError, finalize } from 'rxjs/operators';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { CdcategoryDto, CdcategoryDtoIEnumerableCommonResponse, CdCategoryMandDto, CdCategoryMandDtoIEnumerableCommonResponse, CdmendDto, CdmendDtoIEnumerableCommonResponse } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.dto';
import { MessageDto, TkmendField } from 'src/app/shared/services/BackendServices/AdministrativeCertificate/AdministrativeCertificate.dto';
import { DynamicFormController } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.service';

export interface AreaSectors {
  area: string;
  sector: string;
}

export interface GroupInfo {
  groupName: string;
  groupId: number;
  formArrayName: string;
  fields: CdCategoryMandDto[];
  isExtendable?: boolean;
  groupWithInRow?: number;
  isDuplicated?: boolean;
  instances?: GroupInfo[];
  originGroupId?: number;
  instanceGroupId?: number;
}

@Injectable({
  providedIn: 'root'
})


export class GenericFormsService {

  validationMessages: ValidationMessage[] = [
    {
      key: 'tkCategoryCd',
      validators: [{ key: 'required', value: 'برجاء اختيار الفئة' }]
    }
  ];
  formErrors: formErrors[] = []
  prePrintForm!: FormGroup;

  //XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX Main Data   XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  cdmendDto: CdmendDto[] = [];
  searchableCdmendDto: CdmendDto[] = [];
  cdCategoryMandDto: CdCategoryMandDto[] = [];
  cdcategoryDtos: CdcategoryDto[] = []
  filteredCdcategoryDtos: CdcategoryDto[] = [];
  prePrintFormVisible: boolean = false;

  externalImpelementationList: string[] = [];
  // store selections along with the original key/name property names discovered when mapping
  selections: { keyProp: string, nameProp: string, items?: selection[] } = { keyProp: '', nameProp: '', items: [] };
  selectionArrays: { keyProp: string, nameProp: string, items: selection[] }[] = [];
  private staticSelectionCache: Map<string, selection[]> = new Map();
  private treeBoundFieldKeys: Set<string> = new Set();

  dynamicGroups: GroupInfo[] = [];

  // Optional per-field instance limits (e.g. {'FamilyMember_Name': 5})
  instanceLimits: { [field: string]: number } = {};

  //XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX Main Data   XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX



  //XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX Pre Print Form - remittances   XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

  areaSectors: AreaSectors[] = [
    { area: 'جنوب القاهرة', sector: 'القاهرة' },
    { area: 'حلوان', sector: 'القاهرة' },
    { area: 'شرق القاهرة', sector: 'القاهرة' },
    { area: 'وسط و شمال القاهرة', sector: 'القاهرة' },
    { area: 'القطامية', sector: 'القاهرة' },
    { area: 'الإسكندرية', sector: 'غرب الدلتا' },
    { area: 'برج العرب', sector: 'غرب الدلتا' },
    { area: 'البحيرة', sector: 'غرب الدلتا' },
    { area: 'القليوبية', sector: 'وسط الدلتا' },
    { area: 'الغربية', sector: 'وسط الدلتا' },
    { area: 'المحلة', sector: 'وسط الدلتا' },
    { area: 'شمال المنوفية', sector: 'وسط الدلتا' },
    { area: 'جنوب المنوفية', sector: 'وسط الدلتا' },
    { area: 'دمياط', sector: 'شمال الدلتا' },
    { area: 'شمال الدقهلية', sector: 'شمال الدلتا' },
    { area: 'جنوب الدقهلية', sector: 'شمال الدلتا' },
    { area: 'كفر الشيخ', sector: 'شمال الدلتا' },
    { area: 'مرسى مطروح', sector: 'غرب الدلتا' },
    { area: 'الإسماعيلية', sector: 'شرق الدلتا' },
    { area: 'السويس', sector: 'شرق الدلتا' },
    { area: 'بورسعيد', sector: 'شرق الدلتا' },
    { area: 'شمال الشرقية', sector: 'شرق الدلتا' },
    { area: 'جنوب الشرقية', sector: 'شرق الدلتا' },
    { area: 'الفيوم', sector: 'الجيزة' },
    { area: 'بني سويف', sector: 'مصر الوسطى' },
    { area: 'المنيا', sector: 'مصر الوسطى' },
    { area: 'أسيوط', sector: 'مصر الوسطى' },
    { area: 'سوهاج', sector: 'مصر العليا' },
    { area: 'قنا', sector: 'مصر العليا' },
    { area: 'أسوان', sector: 'مصر العليا' },
    { area: 'الأقصر', sector: 'مصر العليا' },
    { area: 'البحر الأحمر', sector: 'مصر العليا' },
    { area: 'الوادي الجديد', sector: 'مصر الوسطى' },
    { area: 'شمال سيناء', sector: 'شرق الدلتا' },
    { area: 'جنوب سيناء', sector: 'شرق الدلتا' },
    { area: 'الجيزة', sector: 'الجيزة' },
    { area: 'شمال 6 أكتوبر', sector: 'الجيزة' },
    { area: 'جنوب 6 أكتوبر', sector: 'الجيزة' }
  ];


  //XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  constructor(private fb: FormBuilder, private spinner: SpinnerService, private dynamicFormController: DynamicFormController, private msg: MsgsService) {
    this.cdmendDto = [];
    this.cdcategoryDtos = [];
    this.filteredCdcategoryDtos = [];
  }

  /**
   * Clears runtime-only state used while rendering a dynamic form instance
   * without touching loaded metadata from the backend.
   */
  resetDynamicRuntimeState(clearSelections: boolean = false): void {
    this.dynamicGroups = [];
    this.formErrors = [];
    this.validationMessages = [];
    this.treeBoundFieldKeys.clear();
    if (clearSelections) {
      this.selectionArrays = [];
      this.staticSelectionCache.clear();
    }
  }

  markTreeBoundFields(fieldKeys: string[]): void {
    (fieldKeys ?? []).forEach(fieldKey => {
      const normalized = this.normalizeDynamicFieldKey(fieldKey);
      if (!normalized) {
        return;
      }

      this.treeBoundFieldKeys.add(normalized);
    });
  }

  isTreeBoundField(controlFullName: string): boolean {
    const parsed = this.nameIndexes(controlFullName ?? '');
    const normalized = this.normalizeDynamicFieldKey(parsed.name);
    if (!normalized) {
      return false;
    }

    return this.treeBoundFieldKeys.has(normalized);
  }

  /**
   * Creates the shell FormGroup for dynamic forms with fixed system controls
   * and optional attachments control.
   */
  createDynamicFormShell(
    groups: GroupInfo[],
    options?: {
      includeAttachments?: boolean;
      attachmentsMandatory?: boolean;
      createdBy?: string;
    }
  ): FormGroup {
    const formConfig: Record<string, any> = {
      tkCategoryCd: [null],
      messageID: [null],
      subject: [null],
      createdBy: [options?.createdBy ?? '']
    };

    (groups ?? []).forEach(group => {
      formConfig[group.formArrayName] = this.fb.array([]);
      (group.instances ?? []).forEach(instance => {
        formConfig[instance.formArrayName] = this.fb.array([]);
      });
    });

    if (options?.includeAttachments) {
      formConfig['attachments'] = [[], options.attachmentsMandatory ? Validators.required : null];
    }

    return this.fb.group(formConfig);
  }

  //XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX       HTML Methods    XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  // Recursively set control value in nested form
  getFormArray(formArrayName: string, form: FormGroup): FormArray {
    return form.get(formArrayName) as FormArray;
  }
  organizeFieldsByGroups(fields: CdCategoryMandDto[]): void {
    this.dynamicGroups = [];
    const groupMap = new Map<number, CdCategoryMandDto[]>();

    // Group fields by mendGroup
    fields.forEach(field => {
      const groupId = field.mendGroup || 0;
      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, []);
      }
      groupMap.get(groupId)?.push(field);
    });

    // Create GroupInfo objects
    groupMap.forEach((groupFields, groupId) => {
      const groupName = groupFields[0]?.groupName || `Group ${groupId}`;
      const _isExtendable = groupFields[0]?.isExtendable || false;
      const _groupWithInRow = groupFields[0]?.groupWithInRow || 0;
      const formArrayName = `mandFileds_group_${groupId}`;

      this.dynamicGroups.push({
        groupName,
        groupId,
        formArrayName,
        fields: groupFields,
        isExtendable: _isExtendable,
        groupWithInRow: _groupWithInRow,
        instances: []
      });
    });

    // Sort by groupId
    this.dynamicGroups.sort((a, b) => a.groupId - b.groupId);
  }
  organizeMessageFieldsByGroups(fields: TkmendField[]): void {
    this.dynamicGroups = [];
    const groupMap = new Map<number, TkmendField[]>();

    // debug logs removed

    // Sort fields by instanceGroupId so that per-group slicing is deterministic
    const sorted = [...fields].sort((a, b) => ((a.instanceGroupId ?? 0) as number) - ((b.instanceGroupId ?? 0) as number));

    // Group fields by mendGroup
    sorted.forEach((field: TkmendField): void => {
      const groupId: number = (field.mendGroup ?? 0) as number;
      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, [] as TkmendField[]);
      }
      groupMap.get(groupId)?.push(field);
    });

    // Create GroupInfo objects
    groupMap.forEach((groupFields, groupId) => {
      const groupName = groupFields[0]?.groupName || `Group ${groupId}`;
      const _isExtendable = groupFields[0]?.isExtendable || false;
      const _groupWithInRow = groupFields[0]?.groupWithInRow || 0;
      const formArrayName = `mandFileds_group_${groupId}`;
      // Determine an instanceGroupId for this group if message fields carried it
      const groupInstanceId = (groupFields as TkmendField[]).find(x => x.instanceGroupId !== undefined && x.instanceGroupId !== null)?.instanceGroupId;

      // Convert TkmendField (message fields) into CdCategoryMandDto-like objects
      const mappedFields: CdCategoryMandDto[] = (groupFields as TkmendField[]).map(f => ({
        mendSql: (f as any).fildSql,
        mendCategory: (f as any).mendCategory,
        mendField: `${(f as any).fildKind}`,
        mendStat: (f as any).mendStat,
        mendGroup: (f as any).mendGroup,
        groupName: (f as any).groupName,
        isExtendable: (f as any).isExtendable,
        groupWithInRow: (f as any).groupWithInRow,
        applicationId: (f as any).applicationId
      } as any as CdCategoryMandDto));

      this.dynamicGroups.push({
        groupName,
        groupId,
        formArrayName,
        fields: mappedFields,
        isExtendable: _isExtendable,
        groupWithInRow: _groupWithInRow,
        instances: [],
        // Normalize server-provided instanceGroupId: map 0 -> 1 so client-side instances start at 1
        instanceGroupId: (groupInstanceId === 0) ? 1 : groupInstanceId
      });
    });
    // Sort by groupId
    this.dynamicGroups.sort((a, b) => a.groupId - b.groupId);
    // debug logs removed
  }
  GetControl(formGroup: FormGroup | FormArray, controlName: string): AbstractControl | null {
    if (formGroup instanceof FormGroup) {
      if (formGroup.controls[controlName]) {
        return formGroup.controls[controlName];
      }

      for (const key of Object.keys(formGroup.controls)) {
        const control = formGroup.controls[key];
        if (control instanceof FormGroup || control instanceof FormArray) {
          const result = this.GetControl(control, controlName);
          if (result) return result;
        }
      }
    } else if (formGroup instanceof FormArray) {
      for (const control of formGroup.controls) {
        if (control instanceof FormGroup || control instanceof FormArray) {
          const result = this.GetControl(control, controlName);
          if (result) return result;
        }
      }
    }

    return null;
  }
  GetControlContaining(formGroup: FormGroup | FormArray, partialName: string): AbstractControl | null {
    if (!partialName) return null;
    const search = partialName.toLowerCase();
    if (formGroup instanceof FormGroup) {
      for (const key of Object.keys(formGroup.controls)) {
        if (key.toLowerCase().includes(search)) {
          return formGroup.controls[key];
        }
        const control = formGroup.controls[key];
        if (control instanceof FormGroup || control instanceof FormArray) {
          const result = this.GetControlContaining(control, partialName);
          if (result) return result;
        }
      }
    } else if (formGroup instanceof FormArray) {
      for (const control of formGroup.controls) {
        if (control instanceof FormGroup || control instanceof FormArray) {
          const result = this.GetControlContaining(control, partialName);
          if (result) return result;
        }
      }
    }

    return null;
  }
  EnableDisableControlByName(Form: FormGroup, ctrlName: string, state: boolean) {

    const docParentCtrl = this.GetControl(Form, ctrlName);
    if (docParentCtrl) {
      if (state) {
        docParentCtrl.enable();
        docParentCtrl.setValidators([Validators.required])
      }
      else {
        docParentCtrl.patchValue(null);
        docParentCtrl.disable();
        docParentCtrl.clearValidators();
      }

      docParentCtrl.updateValueAndValidity();
    }
  }
  EnableDisableControl(ctrl: AbstractControl, state: boolean) {
    if (ctrl) {
      if (state) {
        ctrl.enable();
        ctrl.setValidators([Validators.required])
      }
      else {
        ctrl.patchValue(null);
        ctrl.disable();
        ctrl.clearValidators();
      }

      ctrl.updateValueAndValidity();
    }
  }
  public GetPropertyValue<T extends keyof CdmendDto>(
    name: string,
    property: T
  ): string | '' {
    const item = this.cdmendDto.find((f) => f.cdmendTxt === this.nameIndexes(name).name);
    const value = item?.[property];
    if (value === undefined) return '';
    if (property == 'width') {
      return value !== 0 ? `${value}rem` : '';
    }
    else {
      return value?.toString() || '';
    }
  }

  /**
   * Get numeric width in rem units (number) for a given control name. Returns undefined when not found.
   */
  public GetWidth(name: string): number | undefined {
    const item = this.cdmendDto.find((f) => f.cdmendTxt === this.nameIndexes(name).name);
    const value = item?.width;
    return value !== undefined ? Number(value) : undefined;
  }

  /**
   * Get numeric height in px (number) for a given control name. Returns undefined when not found.
   */
  public GetHeight(name: string): number | undefined {
    const item = this.cdmendDto.find((f) => f.cdmendTxt === this.nameIndexes(name).name);
    const value = item?.height;
    return value !== undefined ? Number(value) : undefined;
  }

  getControlNamesFromGroup(group: AbstractControl): string[] {
    if (group instanceof FormGroup) {
      return Object.keys(group.controls);
    }
    return [];
  }

  // getWidth(name: string): string | null {
  //   const width = this.cdmendDto.filter(f => f.cdmendTxt == name).pop()?.width;
  //   return width !== 0 ? `${width}rem` : null;
  // }

  // returnFieldType(field: string): string {
  //   return <string>this.cdmendDto.find(f => f.cdmendTxt == field)?.cdmendType
  // }

  // Recursively set control value in nested form
  setControlValue(formGroup: FormGroup | FormArray, controlName: string, value: any): void {
    // Use the recursive GetControl helper to locate the exact control by full name
    try {
      const target = this.GetControl(formGroup, controlName);
      if (target) {
        const parsedName = this.nameIndexes(controlName).name;
        const preparedValue = (() => {
          try {
            return this.checkDateAndReturnValue(parsedName, value);
          } catch {
            return value;
          }
        })();
        target.patchValue(preparedValue);
      }
    } catch (e) {
      // swallow errors to avoid breaking UI; no-op when control not found or patch fails
    }
  }

  setControlValueByIndex(formGroup: FormGroup | FormArray, controlIndex: number, value: any): void {
    if (formGroup instanceof FormArray) {
      // Check if the index is valid
      if (formGroup.at(controlIndex)) {
        const control = formGroup.at(controlIndex);

        if (control instanceof FormGroup || control instanceof FormArray) {
          // If it's a group/array, set value recursively
          this.setControlValueByIndex(control, 0, value);
        } else {
          // Directly set the value if it's a FormControl
          control.patchValue(value);
        }
      }
    } else if (formGroup instanceof FormGroup) {
      const keys = Object.keys(formGroup.controls);

      if (controlIndex >= 0 && controlIndex < keys.length) {
        const key = keys[controlIndex];
        const control = formGroup.get(key);

        if (control instanceof FormGroup || control instanceof FormArray) {
          this.setControlValueByIndex(control, 0, value);
        } else {
          control?.patchValue(value);
        }
      }
    }
  }


  logValidationErrors(group: FormGroup): void {
    Object.keys(group.controls).forEach((key: string) => {
      const abstractControl = group.get(key);
      this.formErrors.map(m => {
        if (m.key == key) {
          m.value = ''
        }
      });

      if (abstractControl && !abstractControl.valid &&
        (abstractControl.dirty || abstractControl.touched)) {
        const messages_X = this.validationMessages.find(f => f.key == key)?.validators;

        for (const errorKey in abstractControl.errors) {
          if (errorKey) {
            const errorPayload = (abstractControl.errors as Record<string, unknown>)[errorKey];
            const configuredMessage = String(messages_X?.find(f => f.key == errorKey)?.value ?? '').trim();
            const payloadMessage = this.extractValidationErrorMessage(errorPayload);
            const resolvedMessage = configuredMessage || payloadMessage || this.resolveFallbackValidationMessage(errorKey);
            if (!resolvedMessage) {
              continue;
            }

            this.formErrors.map(m => {
              if (m.key == key) {
                m.value += (m.value.length > 0 ? ' - ' : '') + resolvedMessage
              }
            })
          }
        }
      }

      if (abstractControl instanceof FormGroup) {
        this.logValidationErrors(abstractControl);
      }

      if (abstractControl instanceof FormArray) {
        for (const control of abstractControl.controls)
          if (control instanceof FormGroup) {
            this.logValidationErrors(control);
          }
      }
    })
  }

  returnFormErrors(key: string) {
    return this.formErrors?.find(f => f.key == key)?.value
  }

  private extractValidationErrorMessage(errorPayload: unknown): string | null {
    if (typeof errorPayload === 'string') {
      const normalized = errorPayload.trim();
      return normalized.length > 0 ? normalized : null;
    }

    if (!errorPayload || typeof errorPayload !== 'object' || Array.isArray(errorPayload)) {
      return null;
    }

    const messageCandidate = String((errorPayload as Record<string, unknown>)['message'] ?? '').trim();
    return messageCandidate.length > 0 ? messageCandidate : null;
  }

  private resolveFallbackValidationMessage(errorKey: string): string {
    switch (String(errorKey ?? '').trim().toLowerCase()) {
      case 'required':
        return 'هذا الحقل مطلوب.';
      case 'min':
        return 'القيمة أقل من الحد الأدنى المسموح.';
      case 'max':
        return 'القيمة أعلى من الحد الأقصى المسموح.';
      case 'minlength':
        return 'عدد الأحرف أقل من المطلوب.';
      case 'maxlength':
        return 'عدد الأحرف أكبر من المسموح.';
      case 'pattern':
        return 'القيمة غير مطابقة للنمط المطلوب.';
      default:
        return 'قيمة غير صالحة.';
    }
  }

  filedIsRequired(field: string): boolean {
    return <boolean>this.cdmendDto.find(f => f.cdmendTxt == field)?.required
  }

  implementControlSelection(filedName: string): selection[] {
    const _filedName = this.nameIndexes(filedName).name;
    const normalizedFieldKey = this.normalizeDynamicFieldKey(_filedName);
    if (!normalizedFieldKey) {
      return [];
    }

    const _apiSelection = this.selectionArrays.find(arr =>
      this.normalizeDynamicFieldKey(arr?.nameProp) === normalizedFieldKey
    );
    if (_apiSelection != undefined) {
      return _apiSelection.items;
    }
    
    // Check cache for static metadata selections
    if (this.staticSelectionCache.has(normalizedFieldKey)) {
      return this.staticSelectionCache.get(normalizedFieldKey)!;
    }

    // Default logic
    let _mandData = this.cdmendDto.find(f =>
      this.normalizeDynamicFieldKey(f.cdmendTxt) === normalizedFieldKey
    );
    if (!_mandData) {
      _mandData = this.cdmendDto.find(f => f.cdmendTxt == _filedName);
    }
    if (_mandData) {
      const raw = String(_mandData.cdmendTbl ?? '');
      try {
        const parsed = JSON.parse(raw) as selection[];
        this.staticSelectionCache.set(normalizedFieldKey, parsed);
        return parsed;
      } catch (e) {
        try {
          // tolerate single-quoted JSON stored in DB: replace single quotes with double quotes
          const fixed = raw.replace(/\'/g, '"');
          const parsed = JSON.parse(fixed) as selection[];
          this.staticSelectionCache.set(normalizedFieldKey, parsed);
          return parsed;
        } catch (e2) {
          console.warn('implementControlSelection: failed to parse cdmendTbl for', _filedName, raw);
          const empty: selection[] = [];
          this.staticSelectionCache.set(normalizedFieldKey, empty);
          return empty;
        }
      }
    }
    return []
  }

  setRuntimeSelectionForField(fieldKey: string, items: selection[]): void {
    const normalizedFieldKey = this.normalizeDynamicFieldKey(fieldKey);
    if (!normalizedFieldKey) {
      return;
    }

    const normalizedItems = (items ?? [])
      .map(item => ({
        key: String(item?.key ?? '').trim(),
        name: String(item?.name ?? '').trim()
      }))
      .filter(item => item.key.length > 0 || item.name.length > 0)
      .map(item => ({
        key: item.key.length > 0 ? item.key : item.name,
        name: item.name.length > 0 ? item.name : item.key
      }));

    const existingIndex = this.selectionArrays.findIndex(entry =>
      this.normalizeDynamicFieldKey(entry?.nameProp) === normalizedFieldKey
    );
    const nextPayload = {
      keyProp: 'key',
      nameProp: normalizedFieldKey,
      items: normalizedItems
    };

    if (existingIndex >= 0) {
      this.selectionArrays[existingIndex] = nextPayload;
    } else {
      this.selectionArrays.push(nextPayload);
    }

    this.staticSelectionCache.delete(normalizedFieldKey);
  }

  clearRuntimeSelectionForField(fieldKey: string): void {
    const normalizedFieldKey = this.normalizeDynamicFieldKey(fieldKey);
    if (!normalizedFieldKey) {
      return;
    }

    this.selectionArrays = this.selectionArrays.filter(entry =>
      this.normalizeDynamicFieldKey(entry?.nameProp) !== normalizedFieldKey
    );
    this.staticSelectionCache.delete(normalizedFieldKey);
  }
  getRequesterFieldTxt(message: MessageDto, fieldValue: string): string | '' {
    const requesterField = message.fields?.find(field => field.fildKind === fieldValue);
    if (requesterField != undefined && requesterField?.fildTxt) {
      return requesterField?.fildTxt
    }
    return '';
    ;
  }
  getType(str: string | null | undefined): boolean | undefined {
    if (!str || str.length < 14) return undefined; // Handle edge cases

    const sex = str.charAt(13);
    const numericValue = parseInt(sex, 10); // Convert to number

    if (isNaN(numericValue)) {
      return undefined; // Non-numeric character
    } else {
      return numericValue % 2 === 0 ? true : false;
    }
  }
  getSector(area: string): string | '' {
    let _sector = this.areaSectors.find(f => f.area == area)
    if (_sector != undefined) {
      return _sector.sector;
    }
    else
      return '';
  }

  nameIndexes(metaFiled: string): { name: string, index: number } {
    const [name, index] = metaFiled?.split('|');
    return { name, index: parseInt(index, 10) };
  }

  private normalizeDynamicFieldKey(value: unknown): string {
    const raw = String(value ?? '').trim().toLowerCase();
    if (!raw) {
      return '';
    }

    return raw.split('|')[0].split('__')[0].trim();
  }
  public updateNextControlLabel(form: FormGroup | FormArray, event: any, ctrlFullNameToMatch: string, targetControlFullName: string, labelPattern: string | null, filtered_CategoryMand: CdCategoryMandDto[]) {
    const parsed = this.nameIndexes(event.controlFullName);
    const ctrlName = parsed.name;
    if (ctrlFullNameToMatch == ctrlName) {
      const targetParsed = this.nameIndexes(targetControlFullName);
      const targetName = targetParsed.name;
      const targetIndexProvided = targetParsed.index;

      const group = this.dynamicGroups.find(g => g.fields.some(f => f.mendField === targetName));

      let nextLabel = '';
      let nextField: CdCategoryMandDto | undefined;

      if (group) {
        const foundIdx = group.fields.findIndex(f => f.mendField === targetName);
        if (foundIdx >= 0) {
          nextField = group.fields[foundIdx];
          nextLabel = this.GetPropertyValue(`${nextField.mendField}|${foundIdx}`, 'cdMendLbl');
        } else if (typeof targetIndexProvided === 'number') {
          const inferredIdx = targetIndexProvided;
          if (inferredIdx >= 0 && inferredIdx < group.fields.length) {
            nextField = group.fields[inferredIdx];
            nextLabel = this.GetPropertyValue(`${nextField.mendField}|${inferredIdx}`, 'cdMendLbl');
          }
        }
      }

      if (!nextLabel) {
        const idx = filtered_CategoryMand.findIndex(f => f.mendField === targetName);
        const next = idx >= 0 ? filtered_CategoryMand[idx] : undefined;
        if (next) {
          nextField = next as any as CdCategoryMandDto;
          nextLabel = this.GetPropertyValue(`${next.mendField}|0`, 'cdMendLbl');
        }
      }

      if (nextLabel) {
        try {
          const ctrl = this.GetControl(form, event.controlFullName);
          const selectedKey = ctrl?.value ?? event.event?.target?.value ?? event.event?.value;

          let selectedLabel = '';
          if (selectedKey !== undefined && selectedKey !== null) {
            const options = this.implementControlSelection(event.controlFullName) || [];
            const found = options.find((o: any) => String(o.key) === String(selectedKey));
            selectedLabel = found?.name ?? String(selectedKey);
          }

          const defaultPattern = 'رقم {value} الجهة';
          const pattern = labelPattern ?? defaultPattern;
          const resolved = pattern.replace('{value}', selectedLabel);

          this.cdmendDto.forEach(f => {
            if (f.cdmendTxt === nextField?.mendField) {
              f.cdMendLbl = resolved;
            }
          });
        } catch (e) {
          // ignore errors
        }
      } else {
        // nothing found
      }
    }
  }
  private checkDateAndReturnValue(name: string | null | undefined, value: any): any {
    if (!name) return value;

    // Detect date-like names. Use same robust rules as before.
    const looksLikeDate = (
      name.includes('Date') || // camelCase like startDate
      (() => {
        const normalized = name.replace(/[_\-]/g, ' ').toLowerCase();
        return normalized === 'date' || normalized.startsWith('date') || normalized.endsWith('date') || /\bdate\b/i.test(normalized);
      })()
    );

    if (!looksLikeDate) return value;

    // p-calendar expects a Date object (or null). Handle empty strings/nulls.
    if (value === null || value === undefined || value === '') return null;

    if (value instanceof Date) return value;

    // If it's a number (timestamp), treat as ms timestamp
    if (typeof value === 'number') {
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : d;
    }

    // If it's a string, try parsing. Accepts ISO or locale strings.
    if (typeof value === 'string') {
      const parsed = new Date(value);
      return isNaN(parsed.getTime()) ? null : parsed;
    }

    // As a last resort, attempt to coerce into Date
    try {
      const coerced = new Date(value);
      return isNaN(coerced.getTime()) ? null : coerced;
    } catch {
      return null;
    }
  }

  getSearchableCdmendDtosByCategory(): { cdmendTxt: string | undefined, cdMendLbl: string | undefined }[] {
    const categoryIds = new Set(this.cdcategoryDtos.map(c => c.catId));
    const activeFields = new Set(
      this.cdCategoryMandDto
        .filter(m => categoryIds.has(m.mendCategory))
        .map(m => m.mendField)
    );

    return this.cdmendDto
      .filter(f => f.isSearchable === true && activeFields.has(f.cdmendTxt))
      .map(({ cdmendTxt, cdMendLbl }) => ({ cdmendTxt, cdMendLbl }));
  }
  //XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX       HTML Methods     XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  applicationName: string = '';
  GetDataMetadata(catParent: number): Observable<boolean> {
    this.spinner.show();
    const Obs1$ = this.dynamicFormController.getMandatoryAll(this.applicationName);
    const Obs2$ = this.dynamicFormController.getMandatoryMetaDate(this.applicationName);
    const Obs3$ = this.dynamicFormController.getAllCategories(this.applicationName);
    const Obs4$ = forkJoin<[CdCategoryMandDtoIEnumerableCommonResponse, CdmendDtoIEnumerableCommonResponse, CdcategoryDtoIEnumerableCommonResponse]>(Obs1$, Obs2$, Obs3$)
    return Obs4$.pipe(
      map((res) => {
        if (res[0].isSuccess && res[1].isSuccess && res[2].isSuccess) {
          this.cdCategoryMandDto = res[0].data as CdCategoryMandDto[];
          this.cdmendDto = res[1].data as CdmendDto[];
          this.cdcategoryDtos = res[2].data?.filter(f => f.catParent >= catParent) as CdcategoryDto[];

          // Clear static selection cache when metadata is reloaded
          this.staticSelectionCache.clear();
          return true;
        }
        else {
          let errors = "";
          res[0].errors?.forEach(e => {
            errors += e.message + '\n';
          });
          res[1].errors?.forEach(e => {
            errors += e.message + '\n';
          });
          this.msg.msgError('خطأ', '<h5>' + errors + '</h5>', true);
          return false;
        }
      }),
      catchError((error) => {
        this.msg.msgError('خطأ', '<h5>' + error + '</h5>', true);
        return of(false);
      }),
      finalize(() => {
        console.log('Finalized metadata loading');
      })
    );
  }

  addFormArrayWithValidators(metaFiled: string, FrmArray: FormArray, isNotRequired: boolean = false): void {
    let _mandData = this.cdmendDto.find(f => f.cdmendTxt == this.nameIndexes(metaFiled).name)
    // Get init Form Group with Dynamic Control
    const NestedForm = this.fb.group({
      [metaFiled]: [_mandData?.defaultValue]
    });
    const nestedControl = NestedForm.get(metaFiled);
    if (nestedControl) {
      this.setErrorsObjects(_mandData, nestedControl, this.nameIndexes(metaFiled).index, isNotRequired);
      FrmArray.push(NestedForm);
    }
  }
  setErrorsObjects(_mandData: CdmendDto | undefined, control: AbstractControl, index: number = -1, isNotRequired: boolean = false) {
    const fieldLable = String(_mandData?.cdMendLbl ?? _mandData?.cdmendTxt ?? '').trim() || 'هذا الحقل'

    const controlName = `${_mandData?.cdmendTxt}|${index}`

    this.formErrors.push({ key: controlName, value: '' });
    const _validators: _Validators[] = []
    if (!isNotRequired && _mandData?.required) {
      _validators.push({ key: 'required', value: `برجاء إدخال ${fieldLable}` })
    }
    if (Number(_mandData?.minValue) > 0 && _mandData?.cdmendDatatype == 'number') {
      _validators.push({ key: 'min', value: `${fieldLable} يجب ألا يقل عن ${_mandData?.minValue}` })
    }
    if (Number(_mandData?.maxValue) > 0 && _mandData?.cdmendDatatype == 'number') {
      _validators.push({ key: 'max', value: `${fieldLable} يجب ألا يزيد عن ${_mandData?.maxValue}` })
    }
    if (Number(_mandData?.minValue) > 0 && _mandData?.cdmendDatatype == 'string') {
      _validators.push({ key: 'minlength', value: `${fieldLable} يجب ألا يقل عن ${_mandData?.minValue} حرف أو اكثر` })
    }
    if (Number(_mandData?.maxValue) > 0 && _mandData?.cdmendDatatype == 'string') {
      _validators.push({ key: 'maxlength', value: `${fieldLable} يجب ألا يزيد عن ${_mandData?.maxValue} حرف أو أقل` })
    }
    // if (_mandData?.maxValue == 'future' && _mandData?.cdmendDatatype == 'date') {
    //   _validators.push({ key: 'maxlength', value: `${fieldLable} يجب ألا يزيد عن ${_mandData?.maxValue} حرف أو أقل` })
    // }
    if (_mandData?.pattern) {
      _validators.push({ key: 'pattern', value: `${fieldLable} يجب أن يطابق النمط ${_mandData?.cdmendTbl} ` })
    }
    this.validationMessages.push({
      key: index == -1 ? controlName : controlName, validators: _validators
    });

    this.setValidators(_mandData, control, isNotRequired);
  }
  setValidators(_mandData: CdmendDto | undefined, control: AbstractControl, isNotRequired: boolean = false) {
    // Set validators dynamically
    const currentValidators = control?.validator ? [control.validator] : [];
    let newValidators: ValidatorFn[] = []
    if (!isNotRequired && _mandData?.required) {
      newValidators.push(Validators.required)
    }
    if (Number(_mandData?.minValue) > 0 && _mandData?.cdmendDatatype == 'string') {
      newValidators.push(Validators.minLength(Number(_mandData?.minValue)))
    }
    if (Number(_mandData?.maxValue) > 0 && _mandData?.cdmendDatatype == 'string') {
      newValidators.push(Validators.maxLength(Number(_mandData?.maxValue)))
    }
    if (Number(_mandData?.minValue) > 0 && _mandData?.cdmendDatatype == 'number') {
      newValidators.push(Validators.min(Number(_mandData?.minValue)))
    }
    if (Number(_mandData?.maxValue) > 0 && _mandData?.cdmendDatatype == 'number') {
      newValidators.push(Validators.max(Number(_mandData?.maxValue)))
    }
    if (_mandData?.pattern) {
      newValidators.push(Validators.pattern(<string>_mandData?.cdmendTbl))
    }
    control.setValidators([...currentValidators, ...newValidators]);
    control.updateValueAndValidity();
  }

  isHiddenField(field: string): boolean {
    const commaSeparated: string = '';
    const fieldsArray: string[] = commaSeparated
      .split(',') // Split the string into an array
      .map(item => item.trim()); // Trim whitespace from each field
    return fieldsArray.includes(field); // Check if the field exists in the array
  }
  filterCategories(categories: CdcategoryDto[], messages: MessageDto[]): CdcategoryDto[] {
    // Extract valid numeric category IDs from messages
    const validCategoryIds = new Set<number>(
      messages
        .map(msg => parseInt(msg.categoryCd.toString(), 10))  // Convert string to number
        .filter(catId => !isNaN(catId))            // Remove invalid conversions
    );

    // Return categories with IDs present in the message category IDs
    return categories.filter(cat => validCategoryIds.has(cat.catId));
  }

  handleGenericEvent(event: any) {
    // You s add custom logic here, e.g. logging, validation, analytics, etc.
    console.log('triggered on control', event)
  }
  mapArrayToSelectionArray(arrayName: string, items: any[]): { keyProp: string, nameProp: string, items: selection[] } {
    if (!Array.isArray(items) || items.length === 0) return { keyProp: '', nameProp: '', items: [] };

    // Inspect first item to determine key/name property order
    const first = items[0];
    const props = Object.keys(first || {});
    if (props.length < 2) {
      // fallback: stringify the whole object as name
      return {
        keyProp: props[0] || '',
        nameProp: arrayName || '',
        items: items.map(i => ({ key: JSON.stringify(i), name: JSON.stringify(i) }))
      };
    }

    const keyProp = props[0];
    const nameProp = props[1];

    const mapped: selection[] = items.map(i => ({
      key: i[keyProp] !== undefined && i[keyProp] !== null ? i[keyProp].toString() : '',
      name: i[nameProp] !== undefined && i[nameProp] !== null ? i[nameProp].toString() : ''
    }));

    return { keyProp, nameProp: arrayName, items: mapped };
  }

  /////////////////////////               check Form array Validity                  /////////////////////////////////

  isFormArrayValid(form: FormGroup, formArrayName: string): boolean {
    if (!form) return false;
    const fa = form.get(formArrayName) as FormArray | null;
    if (!fa) return false;
    return fa.valid && fa.length > 0;
  }

  isGroupAllInstancesValid(form: FormGroup, group: GroupInfo): boolean {
    if (!form || !group) return false;

    const checkArray = (g: GroupInfo | undefined | null): boolean => {
      if (!g) return true;
      const fa = form.get(g.formArrayName) as FormArray | null;
      // If a form array doesn't exist or has no controls, treat as invalid
      if (!fa || fa.length === 0 || !fa.valid) return false;
      if (!g.instances || g.instances.length === 0) return true;
      return g.instances.every(inst => checkArray(inst));
    };

    return checkArray(group);
  }

  getGroupValidity(form: FormGroup, group: GroupInfo): boolean {
    if (!group) return false;
    return group.isExtendable ? this.isGroupAllInstancesValid(form, group) : this.isFormArrayValid(form, group.formArrayName);
  }
  /**
   * Log controls without validators for debugging.
   * Prints array of control paths (FormGroup keys / FormArray indices).
   */
  logControlsMissingValidators(form: FormGroup): void {
    try {
      const missing: string[] = [];
      const traverse = (ctrl: any, path: string) => {
        if (!ctrl) return;
        if (ctrl instanceof FormGroup) {
          Object.keys(ctrl.controls).forEach(key => {
            const child = ctrl.controls[key];
            const childPath = path ? `${path}.${key}` : key;
            traverse(child, childPath);
          });
        } else if (ctrl instanceof FormArray) {
          ctrl.controls.forEach((c: any, idx: number) => {
            traverse(c, `${path}[${idx}]`);
          });
        } else {
          // FormControl
          const hasValidator = !!ctrl?.validator;
          if (!hasValidator) missing.push(path);
        }
      };
      traverse(form, '');
      console.log('GenericFormsService: controls without validators ->', missing);
    } catch (e) {
      console.warn('logControlsMissingValidators failed', e);
    }
  }
  /**
   * For a list of control paths (e.g. "mandFileds_group_1[11].AGENCY_NUMBER|1_30075461"),
   * report whether each control exists, has validators, is valid and its errors.
   * Returns an array of status objects and prints them to console for quick debugging.
   */
  reportControlsStatus(form: FormGroup, controlPaths: string[]): { path: string, controlName: string, controlNameClean: string, exists: boolean, hasValidator: boolean, valid: boolean, errors: any }[] {
    try {
      const out: { path: string, controlName: string, controlNameClean: string, exists: boolean, hasValidator: boolean, valid: boolean, errors: any }[] = [];
      if (!form) {
        console.warn('reportControlsStatus: provided form is falsy');
        return out;
      }
      for (const p of (controlPaths || [])) {
        const parts = (p || '').toString().split('.');
        const controlName = parts[parts.length - 1] || p;
        const ctrl = this.GetControl(form, controlName as string);
        const exists = !!ctrl;
        const hasValidator = !!(ctrl && ctrl.validator);
        const valid = exists ? !!ctrl.valid : false;
        const errors = exists ? ctrl.errors : { missing: true };
        const controlNameClean = this.nameIndexes(controlName as string).name;
        out.push({ path: p, controlName: controlName as string, controlNameClean, exists, hasValidator, valid, errors });
      }
      console.log('GenericFormsService.reportControlsStatus ->', out);
      return out;
    } catch (e) {
      console.warn('reportControlsStatus failed', e);
      return [];
    }
  }
  /////////////////////////               check Form array Validity                  /////////////////////////////////

}
export interface _Validators {
  key: string;
  value: string;
}

export interface ValidationMessage {
  key: string;
  validators: _Validators[];
}
export interface selection {
  key: string;
  name: string;
}
export interface formErrors {
  key: string,
  value: string
}

export const GenericFormsIsolationProvider = {
  provide: GenericFormsService,
  useFactory: (
    rootService: GenericFormsService,
    fb: FormBuilder,
    spinner: SpinnerService,
    dynamicFormController: DynamicFormController,
    msg: MsgsService
  ) => {
    const newService = new GenericFormsService(fb, spinner, dynamicFormController, msg);
    // Copy lookup/static data from the Root service so components don't crash
    // while keeping state like dynamicGroups, formErrors, selections isolated!
    newService.cdmendDto = rootService.cdmendDto;
    newService.searchableCdmendDto = rootService.searchableCdmendDto;
    newService.cdCategoryMandDto = rootService.cdCategoryMandDto;
    newService.cdcategoryDtos = rootService.cdcategoryDtos;
    newService.filteredCdcategoryDtos = rootService.filteredCdcategoryDtos;
    newService.areaSectors = rootService.areaSectors;
    newService.externalImpelementationList = rootService.externalImpelementationList;
    return newService;
  },
  deps: [
    [new SkipSelf(), GenericFormsService],
    FormBuilder,
    SpinnerService,
    DynamicFormController,
    MsgsService
  ]
};
