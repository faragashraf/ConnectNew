import { Injectable } from '@angular/core';
import {
  BoundFieldItem,
  FieldLibraryBindingValidationResult,
  ReusableFieldLibraryItem
} from '../models/field-library-binding.models';

@Injectable()
export class FieldLibraryBindingEngine {
  createBindingFromLibrary(
    reusableField: ReusableFieldLibraryItem,
    existingBindings: ReadonlyArray<BoundFieldItem>
  ): BoundFieldItem {
    const nextDisplayOrder = (existingBindings.reduce((max, current) => Math.max(max, current.displayOrder), 0) || 0) + 1;
    return {
      bindingId: `bind-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      sourceFieldId: reusableField.id,
      fieldKey: this.buildUniqueFieldKey(reusableField.fieldKey, existingBindings),
      label: reusableField.label,
      type: reusableField.type,
      displayOrder: nextDisplayOrder,
      visible: true,
      required: reusableField.requiredByDefault,
      readonly: reusableField.readonlyByDefault,
      defaultValue: reusableField.defaultValue ?? '',
      dynamicRuntimeJson: ''
    };
  }

  parseBindingsPayload(rawValue: unknown): BoundFieldItem[] {
    const raw = String(rawValue ?? '').trim();
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .map(item => this.normalizeBinding(item))
        .filter((item): item is BoundFieldItem => item != null)
        .sort((left, right) => left.displayOrder - right.displayOrder);
    } catch {
      return [];
    }
  }

  serializeBindingsPayload(bindings: ReadonlyArray<BoundFieldItem>): string {
    const normalized = bindings
      .map(item => this.normalizeBinding(item))
      .filter((item): item is BoundFieldItem => item != null)
      .sort((left, right) => left.displayOrder - right.displayOrder);

    return JSON.stringify(normalized);
  }

  normalizeDisplayOrder(bindings: ReadonlyArray<BoundFieldItem>): BoundFieldItem[] {
    return [...bindings]
      .sort((left, right) => left.displayOrder - right.displayOrder)
      .map((item, index) => ({
        ...item,
        displayOrder: index + 1
      }));
  }

  validateBindings(bindings: ReadonlyArray<BoundFieldItem>): FieldLibraryBindingValidationResult {
    const blockingIssues: string[] = [];
    const warnings: string[] = [];

    if (bindings.length === 0) {
      blockingIssues.push('يجب ربط حقل واحد على الأقل قبل متابعة الخطوة التالية.');
      return {
        isValid: false,
        blockingIssues,
        warnings
      };
    }

    const keyMap = new Map<string, number>();
    const displayOrderSet = new Set<number>();

    for (const binding of bindings) {
      const fieldKey = binding.fieldKey.trim().toLowerCase();
      keyMap.set(fieldKey, (keyMap.get(fieldKey) ?? 0) + 1);

      if (displayOrderSet.has(binding.displayOrder)) {
        blockingIssues.push(`يوجد تعارض في ترتيب العرض (${binding.displayOrder}) بين الحقول المرتبطة.`);
      }
      displayOrderSet.add(binding.displayOrder);

      if (!binding.label.trim()) {
        blockingIssues.push('يوجد حقل مرتبط بدون اسم.');
      }
      if (!binding.fieldKey.trim()) {
        blockingIssues.push('يوجد حقل مرتبط بدون مفتاح.');
      }
      if (binding.displayOrder <= 0) {
        blockingIssues.push(`الحقل "${binding.label || binding.fieldKey}" يملك ترتيب عرض غير صالح.`);
      }
      if (!binding.groupId || binding.groupId <= 0) {
        blockingIssues.push(`الحقل "${binding.label || binding.fieldKey}" غير مرتبط بمجموعة صالحة.`);
      }
    }

    for (const [fieldKey, count] of keyMap.entries()) {
      if (count > 1) {
        blockingIssues.push(`مفتاح الحقل "${fieldKey}" مكرر داخل الربط.`);
      }
    }

    return {
      isValid: blockingIssues.length === 0,
      blockingIssues,
      warnings
    };
  }

  private buildUniqueFieldKey(baseKey: string, bindings: ReadonlyArray<BoundFieldItem>): string {
    const normalizedBase = baseKey.trim() || 'field';
    const existing = new Set(bindings.map(item => item.fieldKey.trim().toLowerCase()));
    if (!existing.has(normalizedBase.toLowerCase())) {
      return normalizedBase;
    }

    let suffix = 2;
    while (existing.has(`${normalizedBase}_${suffix}`.toLowerCase())) {
      suffix++;
    }

    return `${normalizedBase}_${suffix}`;
  }

  private normalizeBinding(raw: unknown): BoundFieldItem | null {
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const candidate = raw as Record<string, unknown>;
    const bindingId = String(candidate['bindingId'] ?? '').trim();
    const sourceFieldId = String(candidate['sourceFieldId'] ?? '').trim();
    const fieldKey = String(candidate['fieldKey'] ?? '').trim();
    const label = String(candidate['label'] ?? '').trim();
    const type = String(candidate['type'] ?? '').trim();
    const displayOrder = Number(candidate['displayOrder'] ?? 0);
    const mendSql = Number(candidate['mendSql'] ?? 0);
    const cdmendSql = Number(candidate['cdmendSql'] ?? 0);
    const groupId = Number(candidate['groupId'] ?? 0);
    const groupName = String(candidate['groupName'] ?? '').trim();
    const displaySettingsJson = String(candidate['displaySettingsJson'] ?? '').trim();
    const dynamicRuntimeJson = String(candidate['dynamicRuntimeJson'] ?? '').trim();

    if (!bindingId || !fieldKey || !label || !this.isValidType(type) || !Number.isFinite(displayOrder)) {
      return null;
    }

    return {
      bindingId,
      sourceFieldId: sourceFieldId || `local-${fieldKey}`,
      fieldKey,
      label,
      type: type as BoundFieldItem['type'],
      displayOrder: Math.max(1, Math.trunc(displayOrder)),
      visible: candidate['visible'] !== false,
      required: candidate['required'] === true,
      readonly: candidate['readonly'] === true,
      defaultValue: String(candidate['defaultValue'] ?? '').trim(),
      mendSql: Number.isFinite(mendSql) && mendSql > 0 ? Math.trunc(mendSql) : undefined,
      cdmendSql: Number.isFinite(cdmendSql) && cdmendSql > 0 ? Math.trunc(cdmendSql) : undefined,
      groupId: Number.isFinite(groupId) && groupId > 0 ? Math.trunc(groupId) : undefined,
      groupName: groupName.length > 0 ? groupName : undefined,
      displaySettingsJson: displaySettingsJson.length > 0 ? displaySettingsJson : undefined,
      dynamicRuntimeJson: dynamicRuntimeJson.length > 0 ? dynamicRuntimeJson : ''
    };
  }

  private isValidType(value: string): boolean {
    return value === 'InputText'
      || value === 'Textarea'
      || value === 'Dropdown'
      || value === 'Number'
      || value === 'Date'
      || value === 'Checkbox';
  }

  private validateDefaultValueByType(type: BoundFieldItem['type'], defaultValue: string): string | null {
    const normalized = defaultValue.trim();
    if (!normalized) {
      return null;
    }

    if (type === 'Number' && Number.isNaN(Number(normalized))) {
      return 'القيمة الافتراضية يجب أن تكون رقمًا صالحًا.';
    }

    if (type === 'Checkbox' && normalized !== 'true' && normalized !== 'false') {
      return 'قيمة Checkbox يجب أن تكون true أو false.';
    }

    return null;
  }
}
