import { Injectable } from '@angular/core';
import {
  ConditionalPayloadBundle,
  ConditionalRuleItem,
  RequiredRuleItem,
  SubmissionBlockingRuleItem,
  ValidationRulesFieldReference,
  ValidationRulesConfig,
  ValidationRulesEvaluationResult
} from '../models/validation-rules.models';

@Injectable()
export class ValidationRulesEngine {
  mergeRequiredRules(
    currentRules: ReadonlyArray<RequiredRuleItem>,
    availableFields: ReadonlyArray<ValidationRulesFieldReference>
  ): RequiredRuleItem[] {
    const normalizedCurrentRules = currentRules
      .map(rule => this.normalizeRequiredRule(rule))
      .filter((rule): rule is RequiredRuleItem => rule != null);

    const byFieldKey = new Map<string, RequiredRuleItem>(
      normalizedCurrentRules.map(rule => [rule.fieldKey.trim(), rule] as const)
    );

    return availableFields.map(field => {
      const matched = byFieldKey.get(field.fieldKey.trim());
      return {
        id: matched?.id ?? `required-${field.fieldKey}`,
        fieldKey: field.fieldKey,
        fieldLabel: field.label,
        isRequired: matched ? matched.isRequired : field.requiredByDefault
      };
    });
  }

  parseConditionalPayload(rawValue: unknown): ConditionalPayloadBundle {
    const parsed = this.parseJson(rawValue);
    if (!parsed) {
      return {
        requiredRules: [],
        conditionalRules: []
      };
    }

    if (Array.isArray(parsed)) {
      return {
        requiredRules: [],
        conditionalRules: parsed
          .map(item => this.normalizeConditionalRule(item))
          .filter((item): item is ConditionalRuleItem => item != null)
      };
    }

    const rawObject = parsed as Record<string, unknown>;
    const requiredRaw = Array.isArray(rawObject['requiredRules']) ? rawObject['requiredRules'] : [];
    const conditionalRaw = Array.isArray(rawObject['conditionalRules']) ? rawObject['conditionalRules'] : [];

    return {
      requiredRules: requiredRaw
        .map(item => this.normalizeRequiredRule(item))
        .filter((item): item is RequiredRuleItem => item != null),
      conditionalRules: conditionalRaw
        .map(item => this.normalizeConditionalRule(item))
        .filter((item): item is ConditionalRuleItem => item != null)
    };
  }

  serializeConditionalPayload(bundle: ConditionalPayloadBundle): string {
    const payload = {
      requiredRules: bundle.requiredRules
        .map(item => this.normalizeRequiredRule(item))
        .filter((item): item is RequiredRuleItem => item != null),
      conditionalRules: bundle.conditionalRules
        .map(item => this.normalizeConditionalRule(item))
        .filter((item): item is ConditionalRuleItem => item != null)
    };

    return JSON.stringify(payload);
  }

  parseBlockingPayload(rawValue: unknown): SubmissionBlockingRuleItem[] {
    const parsed = this.parseJson(rawValue);
    if (!parsed || !Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(item => this.normalizeBlockingRule(item))
      .filter((item): item is SubmissionBlockingRuleItem => item != null);
  }

  serializeBlockingPayload(rules: ReadonlyArray<SubmissionBlockingRuleItem>): string {
    const payload = rules
      .map(item => this.normalizeBlockingRule(item))
      .filter((item): item is SubmissionBlockingRuleItem => item != null);

    return JSON.stringify(payload);
  }

  evaluate(config: ValidationRulesConfig): ValidationRulesEvaluationResult {
    const blockingIssues: string[] = [];
    const warnings: string[] = [];

    const enabledRequiredRulesCount = config.requiredRules.filter(rule => rule.isRequired).length;
    const conditionalRulesCount = config.conditionalRules.length;
    const blockingRulesCount = config.blockingRules.length;

    if (!config.validationLevel) {
      blockingIssues.push('Validation Level إلزامي.');
    }
    if (!config.submitBehavior) {
      blockingIssues.push('Submit Behavior إلزامي.');
    }

    if (config.validationLevel === 'strict' && enabledRequiredRulesCount === 0) {
      blockingIssues.push('Strict validation يتطلب Rule إلزامية واحدة على الأقل.');
    }

    if (config.validationLevel === 'enterprise' && enabledRequiredRulesCount < 2) {
      warnings.push('Enterprise validation يفضل معه أكثر من حقل إلزامي.');
    }

    if (config.enableCrossFieldValidation && conditionalRulesCount === 0) {
      blockingIssues.push('تم تفعيل Cross-field validation بدون أي Conditional Rules.');
    }

    for (const rule of config.conditionalRules) {
      if (!rule.leftFieldKey.trim()) {
        blockingIssues.push('يوجد Conditional Rule بدون Left Field.');
      }
      if (!rule.rightValue.trim()) {
        blockingIssues.push('يوجد Conditional Rule بدون قيمة شرط.');
      }
    }

    const knownFieldKeys = new Set(config.requiredRules.map(rule => rule.fieldKey.trim()));
    for (const rule of config.conditionalRules) {
      const leftField = rule.leftFieldKey.trim();
      if (!leftField) {
        continue;
      }

      if (!knownFieldKeys.has(leftField)) {
        warnings.push(`الحقل "${leftField}" داخل Conditional Rules غير موجود في الحقول المرتبطة.`);
      }
    }

    for (const rule of config.blockingRules) {
      if (!rule.name.trim()) {
        blockingIssues.push('يوجد Submission Blocking Rule بدون اسم.');
      }
      if (!rule.conditionExpression.trim()) {
        blockingIssues.push('يوجد Submission Blocking Rule بدون شرط.');
      }
      if (!rule.message.trim()) {
        blockingIssues.push('يوجد Submission Blocking Rule بدون رسالة.');
      }
    }

    if (config.submitBehavior === 'block' && blockingRulesCount === 0) {
      blockingIssues.push('عند اختيار منع الإرسال يجب تعريف قاعدة Blocking واحدة على الأقل.');
    }

    if (config.validationLevel === 'enterprise' && blockingRulesCount === 0) {
      warnings.push('Enterprise validation يفضل معه قواعد Blocking مخصصة.');
    }

    return {
      isValid: blockingIssues.length === 0,
      blockingIssues,
      warnings
    };
  }

  private normalizeRequiredRule(raw: unknown): RequiredRuleItem | null {
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const candidate = raw as Record<string, unknown>;
    const fieldKey = String(candidate['fieldKey'] ?? '').trim();
    const fieldLabel = String(candidate['fieldLabel'] ?? '').trim();
    if (!fieldKey || !fieldLabel) {
      return null;
    }

    return {
      id: String(candidate['id'] ?? `required-${fieldKey}`).trim(),
      fieldKey,
      fieldLabel,
      isRequired: candidate['isRequired'] === true
    };
  }

  private normalizeConditionalRule(raw: unknown): ConditionalRuleItem | null {
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const candidate = raw as Record<string, unknown>;
    const operator = String(candidate['operator'] ?? '').trim();
    const effect = String(candidate['effect'] ?? '').trim();
    if (!this.isAllowedOperator(operator) || !this.isAllowedEffect(effect)) {
      return null;
    }

    const leftFieldKey = String(candidate['leftFieldKey'] ?? '').trim();
    const rightValue = String(candidate['rightValue'] ?? '').trim();
    const rawId = String(candidate['id'] ?? '').trim();

    return {
      id: rawId || `cond-${leftFieldKey || 'field'}-${operator}-${effect}`,
      leftFieldKey,
      operator,
      rightValue,
      effect
    };
  }

  private normalizeBlockingRule(raw: unknown): SubmissionBlockingRuleItem | null {
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const candidate = raw as Record<string, unknown>;
    const id = String(candidate['id'] ?? '').trim();
    const name = String(candidate['name'] ?? '').trim();
    const conditionExpression = String(candidate['conditionExpression'] ?? '').trim();
    const message = String(candidate['message'] ?? '').trim();

    if (!id && !name && !conditionExpression && !message) {
      return null;
    }

    return {
      id: id || `block-${name || 'rule'}-${conditionExpression || 'condition'}`,
      name,
      conditionExpression,
      message
    };
  }

  private parseJson(rawValue: unknown): unknown {
    const raw = String(rawValue ?? '').trim();
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private isAllowedOperator(value: string): value is ConditionalRuleItem['operator'] {
    return value === 'eq'
      || value === 'neq'
      || value === 'contains'
      || value === 'gt'
      || value === 'lt';
  }

  private isAllowedEffect(value: string): value is ConditionalRuleItem['effect'] {
    return value === 'required'
      || value === 'readonly'
      || value === 'hidden'
      || value === 'block-submit';
  }
}
