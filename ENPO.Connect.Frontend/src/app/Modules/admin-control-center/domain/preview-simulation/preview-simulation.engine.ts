import { Injectable } from '@angular/core';
import {
  PreviewRenderedContainer,
  PreviewRenderedField,
  PreviewRenderingMap,
  PreviewSimulationDirection,
  PreviewSimulationInput,
  PreviewSimulationMode
} from '../models/preview-simulation.models';

@Injectable()
export class PreviewSimulationEngine {
  buildRenderingMap(input: PreviewSimulationInput): PreviewRenderingMap {
    const blockingIssues: string[] = [];
    const warnings: string[] = [];

    const requiredFieldSet = new Set(input.requiredFieldKeys.map(item => item.trim()).filter(Boolean));
    const orderedBindings = [...input.bindings].sort((left, right) => left.displayOrder - right.displayOrder);
    const bindingByKey = new Map(orderedBindings.map(binding => [binding.fieldKey.trim(), binding]));

    if (orderedBindings.length === 0) {
      blockingIssues.push('لا يوجد Field Binding صالح. لا يمكن توليد Preview فعلي.');
    }

    const hiddenRequiredFieldKeys = orderedBindings
      .filter(binding => {
        const isRequired = requiredFieldSet.has(binding.fieldKey) || binding.required;
        return isRequired && !binding.visible;
      })
      .map(binding => binding.fieldKey);

    for (const fieldKey of hiddenRequiredFieldKeys) {
      blockingIssues.push(`الحقل الإلزامي "${fieldKey}" مخفي داخل Field Library Binding.`);
    }

    const renderedContainers: PreviewRenderedContainer[] = [];
    const usedFieldKeys = new Set<string>();

    const orderedContainers = [...input.containers].sort((left, right) => left.displayOrder - right.displayOrder);
    for (const container of orderedContainers) {
      if (!container.visible) {
        continue;
      }

      const renderedFields: PreviewRenderedField[] = [];
      for (const fieldKeyRaw of container.fieldKeys) {
        const fieldKey = String(fieldKeyRaw ?? '').trim();
        if (!fieldKey) {
          continue;
        }

        const binding = bindingByKey.get(fieldKey);
        if (!binding) {
          blockingIssues.push(`Container "${container.title}" يحتوي Field Key غير مرتبط: ${fieldKey}.`);
          continue;
        }

        if (!binding.visible) {
          warnings.push(`Container "${container.title}" يستخدم الحقل "${fieldKey}" لكنه غير مرئي في binding.`);
        }

        renderedFields.push({
          fieldKey,
          label: binding.label,
          type: binding.type,
          required: requiredFieldSet.has(fieldKey) || binding.required,
          readonly: input.mode === 'view' ? true : binding.readonly,
          defaultValue: binding.defaultValue
        });
        usedFieldKeys.add(fieldKey);
      }

      if (renderedFields.length === 0) {
        blockingIssues.push(`Container مرئي بدون حقول: "${container.title}".`);
      }

      renderedContainers.push({
        id: container.id,
        title: container.title,
        type: container.type,
        displayOrder: container.displayOrder,
        fields: renderedFields
      });
    }

    if (renderedContainers.length === 0) {
      blockingIssues.push('لا توجد مجموعات مرئية لعرض المعاينة.');
    }

    const unassignedFieldKeys = orderedBindings
      .filter(binding => binding.visible)
      .map(binding => binding.fieldKey)
      .filter(fieldKey => !usedFieldKeys.has(fieldKey));

    if (unassignedFieldKeys.length > 0) {
      warnings.push(`حقول مرئية غير موضوعة في أي مجموعة: ${unassignedFieldKeys.join('، ')}`);
    }

    const routeSnapshot = this.resolveRouteSnapshot(input.mode, input.direction, {
      routingMode: this.normalizeOrFallback(input.workflow.routingMode, 'غير محدد'),
      routeResolutionMode: this.normalizeOrFallback(input.workflow.routeResolutionMode, 'غير محدد'),
      targetResolutionStrategy: this.normalizeOrFallback(input.workflow.targetResolutionStrategy, 'غير محدد'),
      directionAwareBehavior: this.normalizeOrFallback(input.workflow.directionAwareBehavior, 'غير محدد'),
      createConfigRouteKey: this.normalizeOrFallback(input.workflow.createConfigRouteKey, ''),
      viewConfigRouteKey: this.normalizeOrFallback(input.workflow.viewConfigRouteKey, ''),
      routeKeyPrefix: this.normalizeOrFallback(input.workflow.routeKeyPrefix, ''),
      primaryConfigRouteKey: this.normalizeOrFallback(input.workflow.primaryConfigRouteKey, '')
    });

    if (!routeSnapshot.createConfigRouteKey) {
      blockingIssues.push('Create Config Route Key غير متوفر.');
    }
    if (!routeSnapshot.viewConfigRouteKey) {
      blockingIssues.push('View Config Route Key غير متوفر.');
    }

    return {
      mode: input.mode,
      direction: input.direction,
      routeSnapshot,
      containers: renderedContainers,
      unassignedFieldKeys,
      hiddenRequiredFieldKeys,
      blockingIssues,
      warnings
    };
  }

  parseRenderingMap(rawValue: unknown): PreviewRenderingMap | null {
    const raw = String(rawValue ?? '').trim();
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as PreviewRenderingMap;
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }

      if (!this.isValidMode(parsed.mode) || !this.isValidDirection(parsed.direction)) {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  serializeRenderingMap(map: PreviewRenderingMap): string {
    return JSON.stringify(map);
  }

  private resolveRouteSnapshot(
    mode: PreviewSimulationMode,
    direction: PreviewSimulationDirection,
    workflow: {
      routingMode: string;
      routeResolutionMode: string;
      targetResolutionStrategy: string;
      directionAwareBehavior: string;
      createConfigRouteKey: string;
      viewConfigRouteKey: string;
      routeKeyPrefix: string;
      primaryConfigRouteKey: string;
    }
  ): PreviewRenderingMap['routeSnapshot'] {
    const baseRoute = mode === 'view'
      ? workflow.viewConfigRouteKey
      : workflow.createConfigRouteKey;

    const directionalSuffix = workflow.directionAwareBehavior === 'split'
      ? `.${direction}`
      : '';

    const routeByDirection = baseRoute
      ? `${baseRoute}${directionalSuffix}`
      : '';

    return {
      routingMode: workflow.routingMode,
      routeResolutionMode: workflow.routeResolutionMode,
      targetResolutionStrategy: workflow.targetResolutionStrategy,
      directionAwareBehavior: workflow.directionAwareBehavior,
      routeKeyPrefix: workflow.routeKeyPrefix,
      primaryConfigRouteKey: workflow.primaryConfigRouteKey,
      createConfigRouteKey: workflow.createConfigRouteKey,
      viewConfigRouteKey: workflow.viewConfigRouteKey,
      resolvedRouteKey: routeByDirection
    };
  }

  private normalizeOrFallback(value: unknown, fallback: string): string {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
  }

  private isValidMode(value: unknown): value is PreviewSimulationMode {
    return value === 'create' || value === 'edit' || value === 'view';
  }

  private isValidDirection(value: unknown): value is PreviewSimulationDirection {
    return value === 'incoming' || value === 'outgoing';
  }
}
