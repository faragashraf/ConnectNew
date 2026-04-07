import { Injectable } from '@angular/core';
import {
  CompositionFieldReference,
  FormCompositionContainer,
  FormCompositionValidationResult
} from '../models/form-composition.models';

@Injectable()
export class FormCompositionEngine {
  parseContainersPayload(rawValue: unknown): FormCompositionContainer[] {
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
        .map(item => this.normalizeContainer(item))
        .filter((item): item is FormCompositionContainer => item != null)
        .sort((left, right) => left.displayOrder - right.displayOrder);
    } catch {
      return [];
    }
  }

  serializeContainersPayload(containers: ReadonlyArray<FormCompositionContainer>): string {
    const normalized = containers
      .map(item => this.normalizeContainer(item))
      .filter((item): item is FormCompositionContainer => item != null)
      .sort((left, right) => left.displayOrder - right.displayOrder);

    return JSON.stringify(normalized);
  }

  normalizeDisplayOrder(containers: ReadonlyArray<FormCompositionContainer>): FormCompositionContainer[] {
    return [...containers]
      .sort((left, right) => left.displayOrder - right.displayOrder)
      .map((item, index) => ({
        ...item,
        displayOrder: index + 1
      }));
  }

  validate(
    containers: ReadonlyArray<FormCompositionContainer>,
    availableFields: ReadonlyArray<CompositionFieldReference>,
    allowInlineSections: boolean
  ): FormCompositionValidationResult {
    const blockingIssues: string[] = [];
    const warnings: string[] = [];

    if (containers.length === 0) {
      blockingIssues.push('يجب إضافة مجموعة واحدة على الأقل داخل Form Composition.');
      return { isValid: false, blockingIssues, warnings };
    }

    const visibleContainers = containers.filter(item => item.visible);
    if (visibleContainers.length === 0) {
      blockingIssues.push('لا يمكن حفظ التكوين بدون أي مجموعة مرئية.');
    }

    const availableFieldMap = new Map(availableFields.map(field => [field.fieldKey, field]));
    const duplicatedVisibleFieldKeys = new Set<string>();
    const seenVisibleFieldKeys = new Set<string>();
    const titleMap = new Map<string, number>();

    for (const container of containers) {
      const normalizedTitle = container.title.trim().toLowerCase();
      titleMap.set(normalizedTitle, (titleMap.get(normalizedTitle) ?? 0) + 1);

      if (!container.title.trim()) {
        blockingIssues.push('يوجد Container بدون عنوان.');
      }
      if (container.displayOrder <= 0) {
        blockingIssues.push(`Container "${container.title || container.id}" يملك ترتيب عرض غير صالح.`);
      }
      if (container.visible && container.fieldKeys.length === 0) {
        blockingIssues.push(`Container "${container.title}" مرئي لكنه فارغ.`);
      }

      for (const fieldKey of container.fieldKeys) {
        if (!availableFieldMap.has(fieldKey)) {
          blockingIssues.push(`الحقل "${fieldKey}" غير متاح داخل Field Library Binding.`);
        }

        if (!container.visible) {
          continue;
        }

        if (seenVisibleFieldKeys.has(fieldKey)) {
          duplicatedVisibleFieldKeys.add(fieldKey);
        }
        seenVisibleFieldKeys.add(fieldKey);
      }

      if (!allowInlineSections && container.type === 'section' && container.fieldKeys.length > 2) {
        warnings.push(`Container "${container.title}" قد يظهر مزدحمًا لأن Inline Sections غير مفعلة.`);
      }
    }

    duplicatedVisibleFieldKeys.forEach(fieldKey => {
      blockingIssues.push(`الحقل "${fieldKey}" مكرر في أكثر من مجموعة مرئية.`);
    });

    for (const [title, count] of titleMap.entries()) {
      if (count > 1 && title.length > 0) {
        warnings.push(`يوجد أكثر من مجموعة بعنوان "${title}".`);
      }
    }

    const unassignedFields = availableFields
      .filter(field => !seenVisibleFieldKeys.has(field.fieldKey))
      .map(field => field.label);
    if (unassignedFields.length > 0) {
      warnings.push(`بعض الحقول لم يتم وضعها في مجموعات مرئية: ${unassignedFields.join('، ')}`);
    }

    return {
      isValid: blockingIssues.length === 0,
      blockingIssues,
      warnings
    };
  }

  private normalizeContainer(raw: unknown): FormCompositionContainer | null {
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const candidate = raw as Record<string, unknown>;
    const id = String(candidate['id'] ?? '').trim();
    const title = String(candidate['title'] ?? '').trim();
    const type = String(candidate['type'] ?? '').trim();
    const displayOrder = Number(candidate['displayOrder'] ?? 0);
    const fieldKeys = Array.isArray(candidate['fieldKeys'])
      ? candidate['fieldKeys'].map(item => String(item ?? '').trim()).filter(Boolean)
      : [];

    if (!id || !this.isTypeAllowed(type) || !Number.isFinite(displayOrder)) {
      return null;
    }

    return {
      id,
      title,
      type: type as FormCompositionContainer['type'],
      visible: candidate['visible'] !== false,
      displayOrder: Math.max(1, Math.trunc(displayOrder)),
      fieldKeys
    };
  }

  private isTypeAllowed(type: string): boolean {
    return type === 'group'
      || type === 'section'
      || type === 'card'
      || type === 'tab';
  }
}
