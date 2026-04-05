import { Injectable } from '@angular/core';
import { ComponentConfig } from 'src/app/shared/models/Component.Config.model';
import {
  SubjectAdminPreviewIssueDto,
  SubjectAdminPreviewWorkspaceDto,
  SubjectFieldDefinitionDto
} from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.dto';

export type PreviewIssueSeverity = 'Error' | 'Warning' | 'Info';
export type PreviewIssueSource = 'backend' | 'configuration' | 'context';

export interface PreviewWorkspaceIssue {
  code: string;
  severity: PreviewIssueSeverity;
  source: PreviewIssueSource;
  message: string;
  fieldKey?: string;
  groupId?: number;
}

export interface PreviewFieldRenderModel {
  mendSql: number;
  fieldKey: string;
  label: string;
  type: string;
  typeLabel: string;
  groupId: number;
  groupName: string;
  displayOrder: number;
  required: boolean;
  readonly: boolean;
  visible: boolean;
  optionsSource: 'inline' | 'binding' | 'none';
  optionsCount: number;
  bindingHint?: string;
}

export interface PreviewGroupRenderModel {
  groupId: number;
  groupName: string;
  fields: PreviewFieldRenderModel[];
}

export interface PreviewWorkspaceRenderModel {
  categoryId: number;
  categoryName: string;
  applicationId?: string;
  groups: PreviewGroupRenderModel[];
  issues: PreviewWorkspaceIssue[];
  isReady: boolean;
  summary: {
    linkedFieldsCount: number;
    activeLinkedFieldsCount: number;
    visibleLinkedFieldsCount: number;
    renderableFieldsCount: number;
    groupsCount: number;
    missingBindingsCount: number;
  };
}

@Injectable({ providedIn: 'root' })
export class CentralAdminPreviewFoundationService {
  filterConfigs(
    allConfigs: ComponentConfig[],
    context: { routeKeyPrefix?: string | null; applicationId?: string | null; categoryId?: number | null }
  ): ComponentConfig[] {
    const routePrefix = String(context.routeKeyPrefix ?? '').trim().toLowerCase();
    const applicationId = String(context.applicationId ?? '').trim().toLowerCase();
    const categoryId = Number(context.categoryId ?? 0);

    return (allConfigs ?? []).filter(cfg => {
      const routeKey = String(cfg?.routeKey ?? '').trim().toLowerCase();
      if (routePrefix && !routeKey.includes(routePrefix)) {
        return false;
      }

      const cfgCategory = Number(cfg?.listRequestModel?.categoryCd ?? 0);
      if (categoryId > 0 && cfgCategory > 0 && cfgCategory !== categoryId) {
        return false;
      }

      const cfgApplicationId = String(cfg?.dynamicFormSettings?.applicationId ?? '').trim().toLowerCase();
      if (applicationId && cfgApplicationId && cfgApplicationId !== applicationId) {
        return false;
      }

      return true;
    });
  }

  buildConfigurationIssues(
    matchedConfigs: ComponentConfig[],
    context: { routeKeyPrefix?: string | null; selectedConfigRouteKey?: string | null }
  ): PreviewWorkspaceIssue[] {
    const issues: PreviewWorkspaceIssue[] = [];
    const routePrefix = String(context.routeKeyPrefix ?? '').trim();
    const selectedRouteKey = String(context.selectedConfigRouteKey ?? '').trim();

    if (!routePrefix) {
      issues.push({
        code: 'ROUTE_PREFIX_MISSING',
        severity: 'Warning',
        source: 'configuration',
        message: 'RouteKey Prefix غير محدد في السياق الإداري.'
      });
    }

    if ((matchedConfigs ?? []).length === 0) {
      issues.push({
        code: 'CONFIG_NOT_FOUND',
        severity: 'Error',
        source: 'configuration',
        message: 'لا توجد إعدادات Component Config مطابقة للسياق الحالي.'
      });
      return issues;
    }

    if (selectedRouteKey) {
      const hasSelected = (matchedConfigs ?? []).some(cfg =>
        String(cfg?.routeKey ?? '').trim().toLowerCase() === selectedRouteKey.toLowerCase()
      );
      if (!hasSelected) {
        issues.push({
          code: 'SELECTED_ROUTEKEY_OUT_OF_SCOPE',
          severity: 'Warning',
          source: 'configuration',
          message: `الـ RouteKey المختار (${selectedRouteKey}) غير موجود ضمن الإعدادات المطابقة.`
        });
      }
    }

    return issues;
  }

  buildRenderModel(
    workspace: SubjectAdminPreviewWorkspaceDto | null | undefined,
    extraIssues: PreviewWorkspaceIssue[] = []
  ): PreviewWorkspaceRenderModel | null {
    if (!workspace) {
      return null;
    }

    const definition = workspace.formDefinition;
    const groupsMeta = new Map<number, string>();
    (definition?.groups ?? []).forEach(group => {
      groupsMeta.set(Number(group.groupId ?? 0), String(group.groupName ?? '').trim() || `جروب #${group.groupId}`);
    });

    const fields: PreviewFieldRenderModel[] = (definition?.fields ?? [])
      .slice()
      .sort((a, b) =>
        Number(a.mendGroup ?? 0) - Number(b.mendGroup ?? 0)
        || Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0)
        || Number(a.mendSql ?? 0) - Number(b.mendSql ?? 0)
      )
      .map(field => this.mapField(field, groupsMeta));

    const grouped = new Map<number, PreviewFieldRenderModel[]>();
    fields.forEach(field => {
      const groupId = Number(field.groupId ?? 0);
      if (!grouped.has(groupId)) {
        grouped.set(groupId, []);
      }

      grouped.get(groupId)?.push(field);
    });

    const groups: PreviewGroupRenderModel[] = Array.from(grouped.entries())
      .map(([groupId, groupFields]) => ({
        groupId,
        groupName: groupFields[0]?.groupName || groupsMeta.get(groupId) || `جروب #${groupId}`,
        fields: groupFields
      }))
      .sort((a, b) => a.groupId - b.groupId);

    const backendIssues = (workspace.readiness?.issues ?? [])
      .map(issue => this.mapBackendIssue(issue));
    const mergedIssues = [...backendIssues, ...(extraIssues ?? [])];

    const hasError = mergedIssues.some(issue => issue.severity === 'Error');
    const isReady = Boolean(workspace.readiness?.isReady) && !hasError;

    return {
      categoryId: workspace.categoryId,
      categoryName: workspace.categoryName,
      applicationId: workspace.applicationId,
      groups,
      issues: mergedIssues,
      isReady,
      summary: {
        linkedFieldsCount: Number(workspace.readiness?.linkedFieldsCount ?? 0),
        activeLinkedFieldsCount: Number(workspace.readiness?.activeLinkedFieldsCount ?? 0),
        visibleLinkedFieldsCount: Number(workspace.readiness?.visibleLinkedFieldsCount ?? 0),
        renderableFieldsCount: Number(workspace.readiness?.renderableFieldsCount ?? fields.length),
        groupsCount: groups.length,
        missingBindingsCount: Number(workspace.readiness?.missingBindingsCount ?? 0)
      }
    };
  }

  private mapField(field: SubjectFieldDefinitionDto, groupsMeta: Map<number, string>): PreviewFieldRenderModel {
    const bindingHint = this.extractBindingHint(field.displaySettingsJson);
    const optionsCount = this.getOptionsCount(field.optionsPayload);
    const optionsSource: 'inline' | 'binding' | 'none' = this.requiresOptions(field.fieldType)
      ? (optionsCount > 0 ? 'inline' : (bindingHint ? 'binding' : 'none'))
      : 'none';

    return {
      mendSql: Number(field.mendSql ?? 0),
      fieldKey: String(field.fieldKey ?? ''),
      label: String(field.fieldLabel ?? field.fieldKey ?? '').trim() || String(field.fieldKey ?? ''),
      type: String(field.fieldType ?? ''),
      typeLabel: this.resolveTypeLabel(field.fieldType),
      groupId: Number(field.mendGroup ?? 0),
      groupName: groupsMeta.get(Number(field.mendGroup ?? 0)) || `جروب #${field.mendGroup}`,
      displayOrder: Number(field.displayOrder ?? 0),
      required: Boolean(field.required),
      readonly: Boolean(field.isDisabledInit),
      visible: Boolean(field.isVisible),
      optionsSource,
      optionsCount,
      bindingHint: bindingHint || undefined
    };
  }

  private mapBackendIssue(issue: SubjectAdminPreviewIssueDto): PreviewWorkspaceIssue {
    const normalizedSeverity = String(issue?.severity ?? 'Warning').toLowerCase();
    const severity: PreviewIssueSeverity = normalizedSeverity === 'error'
      ? 'Error'
      : (normalizedSeverity === 'info' ? 'Info' : 'Warning');

    return {
      code: String(issue?.code ?? 'UNKNOWN'),
      severity,
      source: 'backend',
      message: String(issue?.message ?? ''),
      fieldKey: issue?.fieldKey,
      groupId: issue?.groupId
    };
  }

  private resolveTypeLabel(fieldType: string | undefined): string {
    const normalized = String(fieldType ?? '').trim().toLowerCase();
    if (normalized.includes('textarea')) return 'نص طويل';
    if (normalized.includes('drop') || normalized.includes('select') || normalized.includes('combo')) return 'قائمة';
    if (normalized.includes('radio')) return 'اختيار واحد';
    if (normalized.includes('check') || normalized.includes('bool') || normalized.includes('toggle')) return 'منطقي';
    if (normalized.includes('date')) return 'تاريخ';
    if (normalized.includes('number') || normalized.includes('decimal') || normalized.includes('int')) return 'رقم';
    return fieldType || 'غير محدد';
  }

  private requiresOptions(fieldType: string | undefined): boolean {
    const normalized = String(fieldType ?? '').trim().toLowerCase();
    return normalized.includes('drop')
      || normalized.includes('select')
      || normalized.includes('combo')
      || normalized.includes('radio')
      || normalized.includes('tree');
  }

  private getOptionsCount(optionsPayload: string | undefined): number {
    const payload = String(optionsPayload ?? '').trim();
    if (!payload) {
      return 0;
    }

    try {
      const parsed = JSON.parse(payload);
      if (Array.isArray(parsed)) {
        return parsed.length;
      }

      if (parsed && typeof parsed === 'object') {
        return Object.keys(parsed).length;
      }
    } catch {
      return payload.split(/[|,;\n]+/g).map(item => item.trim()).filter(item => item.length > 0).length;
    }

    return 0;
  }

  private extractBindingHint(displaySettingsJson: string | undefined): string {
    const payload = String(displaySettingsJson ?? '').trim();
    if (!payload) {
      return '';
    }

    try {
      const parsed = JSON.parse(payload);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return '';
      }

      const keys = Object.keys(parsed);
      const candidate = keys.find(key =>
        key.toLowerCase().includes('binding')
        || key.toLowerCase().includes('source')
        || key.toLowerCase().includes('request')
        || key.toLowerCase().includes('lookup')
        || key.toLowerCase().includes('endpoint')
      );
      if (!candidate) {
        return '';
      }

      const value = (parsed as Record<string, unknown>)[candidate];
      if (value == null) {
        return '';
      }

      if (typeof value === 'string') {
        return value.trim();
      }

      if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
      }

      if (Array.isArray(value)) {
        return value.length > 0 ? `${candidate}[${value.length}]` : '';
      }

      if (typeof value === 'object') {
        const objectKeys = Object.keys(value as Record<string, unknown>);
        return objectKeys.length > 0 ? `${candidate}.${objectKeys.join(',')}` : candidate;
      }
    } catch {
      return '';
    }

    return '';
  }
}
