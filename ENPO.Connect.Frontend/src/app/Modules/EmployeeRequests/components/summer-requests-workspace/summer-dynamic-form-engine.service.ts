import { Injectable } from '@angular/core';
import { AbstractControl, FormArray, FormGroup, Validators } from '@angular/forms';
import { CdCategoryMandDto, TkmendField } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.dto';
import { ComponentConfig, defaultModel, userConfigFromLocalStorage } from 'src/app/shared/models/Component.Config.model';
import { GenericFormsService, GroupInfo, selection } from 'src/app/Modules/GenericComponents/GenericForms.service';
import { SummerDestinationConfig } from './summer-requests-workspace.config';
import {
  createDefaultSummerFieldAliases,
  SummerFieldAliasMap
} from '../summer-shared/core/summer-field-aliases';

@Injectable()
export class SummerDynamicFormEngineService {
  private readonly otherRelationTokens = new Set<string>([
    'أخرى',
    'اخرى',
    'اخري',
    'OTHER'
  ]);
  private readonly childRelationTokens = new Set<string>(['ابن', 'ابنة', 'SON', 'DAUGHTER']);

  aliases: SummerFieldAliasMap = createDefaultSummerFieldAliases();

  createFormConfig(): ComponentConfig {
    return new ComponentConfig({
      routeKey: 'admins/summer-requests/dynamic-booking',
      componentTitle: 'إنشاء طلب مصيف',
      showViewToggle: false,
      formDisplayOption: 'fullscreen',
      isNew: true,
      menuId: 0,
      unitId: [0],
      genericFormName: '',
      globalFilterFields: [],
      listRequestModel: { ...defaultModel },
      userConfiguration: { ...userConfigFromLocalStorage },
      submitButtonText: 'تسجيل طلب المصيف',
      submissionLabel: 'تسجيل الطلب',
      fieldsConfiguration: {
        isDivDisabled: false,
        dateFormat: 'yy/mm/dd',
        showTime: false,
        timeOnly: false,
        maxDate: new Date(),
        useDefaultRadioView: true,
        isNotRequired: false
      },
      attachmentConfig: {
        showAttachmentSection: true,
        AllowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'],
        maximumFileSize: 10,
        maxFileCount: 0,
        isMandatory: false,
        allowAdd: true,
        allowMultiple: true
      }
    });
  }

  applyAliasOverrides(overrides: Record<string, string[]> | undefined | null): void {
    if (!overrides || typeof overrides !== 'object') {
      return;
    }

    const next: SummerFieldAliasMap = { ...this.aliases };
    (Object.keys(next) as Array<keyof SummerFieldAliasMap>).forEach(key => {
      const raw = overrides[key as string];
      if (!Array.isArray(raw) || raw.length === 0) {
        return;
      }

      const normalized = raw
        .map(item => String(item ?? '').trim())
        .filter(item => item.length > 0);

      if (normalized.length > 0) {
        next[key] = normalized;
      }
    });

    this.aliases = next;
  }

  filterCategoryFields(
    allFields: CdCategoryMandDto[],
    categoryId: number,
    applicationId: string,
    availableMendFields: string[] = []
  ): CdCategoryMandDto[] {
    const requestedCategory = Number(categoryId);
    const base = (allFields ?? []).filter(field =>
      Number(field.mendCategory ?? 0) === requestedCategory &&
      field.mendStat !== true
    );

    const available = new Set(
      (availableMendFields ?? [])
        .map(item => String(item ?? '').trim().toLowerCase())
        .filter(item => item.length > 0)
    );

    // Prefer matching by CDMend keys (most reliable when CdCategoryMand.applicationId is missing).
    const byAvailable = available.size > 0
      ? base.filter(field => available.has(String(field.mendField ?? '').trim().toLowerCase()))
      : [];

    // Fallback to ApplicationID filter when metadata list is unavailable.
    const app = String(applicationId ?? '').trim().toLowerCase();
    const byApp = app.length > 0
      ? base.filter(field => String(field.applicationId ?? '').trim().toLowerCase() === app)
      : [];

    const resolved = byAvailable.length > 0
      ? byAvailable
      : (byApp.length > 0 ? byApp : base);

    return [...resolved].sort((a, b) => {
      const groupDiff = Number(a.mendGroup ?? 0) - Number(b.mendGroup ?? 0);
      if (groupDiff !== 0) {
        return groupDiff;
      }
      return Number(a.mendSql ?? 0) - Number(b.mendSql ?? 0);
    });
  }

  applyDestinationSelections(genericFormService: GenericFormsService, destination: SummerDestinationConfig): void {
    this.upsertSelection(genericFormService, this.aliases.waveCode, destination.waves.map(w => ({
      key: w.code,
      name: `${w.code} - ${w.startsAtLabel}`
    })));

    this.upsertSelection(genericFormService, this.aliases.familyCount, destination.familyOptions.map(option => ({
      key: String(option),
      name: String(option)
    })));

    this.upsertSelection(genericFormService, this.aliases.stayMode, destination.stayModes.map(mode => ({
      key: mode.code,
      name: mode.label
    })));
  }

  resolveControl(form: FormGroup, genericFormService: GenericFormsService, aliases: readonly string[]): AbstractControl | null {
    for (const alias of aliases) {
      for (let index = 0; index <= 80; index += 1) {
        const direct = genericFormService.GetControl(form, `${alias}|${index}`);
        if (direct) {
          return direct;
        }
      }

      const partial = genericFormService.GetControlContaining(form, `${alias}|`);
      if (partial) {
        return partial;
      }
    }

    return null;
  }

  resolveControlName(form: FormGroup, aliases: readonly string[]): string | null {
    for (const key of Object.keys(form.controls)) {
      const control = form.controls[key];
      if (!(control instanceof FormArray)) {
        continue;
      }

      for (const formGroupControl of control.controls) {
        const instance = formGroupControl as FormGroup;
        const name = Object.keys(instance.controls)[0];
        const base = this.parseControlName(name).base;
        if (aliases.some(alias => alias.toLowerCase() === base.toLowerCase())) {
          return name;
        }
      }
    }

    return null;
  }

  parseControlName(controlName: string): { base: string; index: number } {
    const [base, idx] = String(controlName ?? '').split('|');
    const parsed = Number(idx);
    return {
      base: String(base ?? '').trim(),
      index: Number.isFinite(parsed) ? parsed : 0
    };
  }

  ensureExtraCountRule(
    form: FormGroup,
    genericFormService: GenericFormsService,
    destination: SummerDestinationConfig,
    allowAdminExtraOverride = false,
    forceAdminEditOverride = false
  ): void {
    const familyCtrl = this.resolveControl(form, genericFormService, this.aliases.familyCount);
    const extraCtrl = this.resolveControl(form, genericFormService, this.aliases.extraCount);
    if (!familyCtrl || !extraCtrl) {
      return;
    }

    const family = Number(familyCtrl.value ?? 0) || 0;
    const currentExtra = Math.max(0, Number(extraCtrl.value ?? 0) || 0);
    const maxFamily = destination.familyOptions.length > 0 ? Math.max(...destination.familyOptions) : 0;
    const maxExtra = Number(destination.maxExtraMembers ?? 0) || 0;
    const enabledByFamilyRule = maxFamily > 0 && family === maxFamily && maxExtra > 0;
    const enabledByAdminExceeding = allowAdminExtraOverride && currentExtra > maxExtra;
    const enabledByForcedAdminEdit = allowAdminExtraOverride && forceAdminEditOverride;
    const enabled = enabledByFamilyRule || enabledByAdminExceeding || enabledByForcedAdminEdit;

    if (enabled) {
      extraCtrl.enable({ emitEvent: false });
      if (allowAdminExtraOverride) {
        extraCtrl.setValidators([Validators.min(0)]);
      } else {
        extraCtrl.setValidators([Validators.min(0), Validators.max(maxExtra)]);
      }
    } else {
      extraCtrl.setValue(0, { emitEvent: false });
      extraCtrl.clearValidators();
      extraCtrl.disable({ emitEvent: false });
    }

    extraCtrl.updateValueAndValidity({ emitEvent: false });
  }

  ensureAgeRule(form: FormGroup, genericFormService: GenericFormsService, relationControlName: string): void {
    const relationContext = this.resolveControlByName(form, relationControlName);
    if (!relationContext) {
      return;
    }

    const requiresAge = this.isChildRelation(relationContext.control.value);
    let ageControl = this.resolveCompanionAgeControl(relationContext.formArray);
    ageControl ??= this.resolveControl(form, genericFormService, this.aliases.companionAge);

    if (!ageControl) {
      return;
    }

    if (requiresAge) {
      ageControl.enable({ emitEvent: false });
      ageControl.setValidators([Validators.required, Validators.min(0)]);
    } else {
      ageControl.setValue(null, { emitEvent: false });
      ageControl.clearValidators();
      ageControl.disable({ emitEvent: false });
    }

    ageControl.updateValueAndValidity({ emitEvent: false });
  }

  ensureRelationOtherRule(form: FormGroup, genericFormService: GenericFormsService, relationControlName: string): void {
    const relationContext = this.resolveControlByName(form, relationControlName);
    if (!relationContext) {
      return;
    }

    const requiresRelationText = this.isOtherRelation(relationContext.control.value);
    let relationOtherControl = this.resolveCompanionControl(relationContext.formArray, this.aliases.companionRelationOther);
    relationOtherControl ??= this.resolveControl(form, genericFormService, this.aliases.companionRelationOther);

    if (!relationOtherControl) {
      return;
    }

    if (requiresRelationText) {
      relationOtherControl.enable({ emitEvent: false });
      relationOtherControl.setValidators([Validators.required]);
    } else {
      relationOtherControl.setValue('', { emitEvent: false });
      relationOtherControl.clearValidators();
      relationOtherControl.disable({ emitEvent: false });
    }

    relationOtherControl.updateValueAndValidity({ emitEvent: false });
  }

  isChildRelation(value: unknown): boolean {
    return this.childRelationTokens.has(this.normalizeRelationValue(value));
  }

  isOtherRelation(value: unknown): boolean {
    return this.otherRelationTokens.has(this.normalizeRelationValue(value));
  }

  collectRequestFields(form: FormGroup, genericFormService: GenericFormsService, groups: GroupInfo[], categoryId: number, applicationId: string): TkmendField[] {
    const rows: TkmendField[] = [];
    let fildSql = 1;

    const collect = (group: GroupInfo): void => {
      const formArray = genericFormService.getFormArray(group.formArrayName, form);
      if (!formArray) {
        return;
      }

      const groupInstanceId = Number(group.instanceGroupId ?? 1) || 1;

      formArray.controls.forEach(formArrayControl => {
        const itemGroup = formArrayControl as FormGroup;
        const controlName = Object.keys(itemGroup.controls)[0];
        if (!controlName) {
          return;
        }

        const parsed = this.parseControlName(controlName);
        const fieldMeta = group.fields.find(field => String(field.mendField ?? '').trim() === parsed.base);
        const raw = itemGroup.get(controlName)?.value;

        rows.push({
          fildSql,
          fildRelted: 0,
          fildKind: parsed.base,
          fildTxt: this.toSafeString(raw),
          instanceGroupId: groupInstanceId,
          mendSql: Number(fieldMeta?.mendSql ?? 0) || 0,
          mendCategory: Number(fieldMeta?.mendCategory ?? categoryId) || categoryId,
          mendStat: fieldMeta?.mendStat ?? false,
          mendGroup: Number(fieldMeta?.mendGroup ?? group.groupId) || group.groupId,
          applicationId: String(fieldMeta?.applicationId ?? applicationId ?? ''),
          groupName: String(fieldMeta?.groupName ?? group.groupName ?? ''),
          isExtendable: fieldMeta?.isExtendable ?? group.isExtendable ?? false,
          groupWithInRow: Number(fieldMeta?.groupWithInRow ?? group.groupWithInRow ?? 0) || 0
        });
        fildSql += 1;
      });
    };

    groups.forEach(group => {
      collect(group);
      (group.instances ?? []).forEach(instance => collect(instance));
    });

    return rows;
  }

  getDesiredCompanionCount(form: FormGroup, genericFormService: GenericFormsService): number {
    const family = Number(this.resolveControl(form, genericFormService, this.aliases.familyCount)?.value ?? 0) || 0;
    const extra = Number(this.resolveControl(form, genericFormService, this.aliases.extraCount)?.value ?? 0) || 0;
    return Math.max(0, family + extra - 1);
  }

  findCompanionGroup(groups: GroupInfo[]): GroupInfo | undefined {
    return groups.find(group =>
      group.isExtendable &&
      group.fields.some(field => {
        const key = String(field.mendField ?? '').trim().toLowerCase();
        return this.aliases.companionName.some(alias => alias.toLowerCase() === key) ||
          this.aliases.companionRelation.some(alias => alias.toLowerCase() === key);
      })
    );
  }

  private resolveControlByName(form: FormGroup, controlName: string): { control: AbstractControl; formArray: FormArray } | null {
    for (const key of Object.keys(form.controls)) {
      const control = form.controls[key];
      if (!(control instanceof FormArray)) {
        continue;
      }

      for (const rowControl of control.controls) {
        const row = rowControl as FormGroup;
        if (row.contains(controlName)) {
          const resolved = row.get(controlName);
          if (resolved) {
            return { control: resolved, formArray: control };
          }
        }
      }
    }

    return null;
  }
  private resolveCompanionAgeControl(formArray: FormArray): AbstractControl | null {
    return this.resolveCompanionControl(formArray, this.aliases.companionAge);
  }

  private resolveCompanionControl(formArray: FormArray, aliases: readonly string[]): AbstractControl | null {
    const normalizedAliases = aliases.map(alias => String(alias ?? '').trim().toLowerCase());
    for (const rowControl of formArray.controls) {
      const row = rowControl as FormGroup;
      const controlName = Object.keys(row.controls)[0];
      const base = this.parseControlName(controlName).base.toLowerCase();
      if (normalizedAliases.some(alias => alias === base)) {
        return row.get(controlName);
      }
    }
    return null;
  }

  private normalizeRelationValue(value: unknown): string {
    return String(value ?? '')
      .trim()
      .replace(/\s+/g, ' ')
      .toUpperCase();
  }
  private toSafeString(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'string') {
      return value;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }

    return String(value);
  }

  private upsertSelection(
    genericFormService: GenericFormsService,
    aliases: readonly string[],
    items: selection[]
  ): void {
    aliases.forEach(alias => {
      const normalized = String(alias ?? '').trim();
      if (!normalized) {
        return;
      }

      const index = genericFormService.selectionArrays.findIndex(item => item.nameProp === normalized);
      const payload = {
        keyProp: 'key',
        nameProp: normalized,
        items: [...items]
      };
      if (index >= 0) {
        genericFormService.selectionArrays[index] = payload;
      } else {
        genericFormService.selectionArrays.push(payload);
      }
    });
  }
}
