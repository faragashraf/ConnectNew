import { Injectable } from '@angular/core';
import { ComponentConfig, RequestArrayItem } from 'src/app/shared/models/Component.Config.model';
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
  optionsPreview: string[];
  unresolvedOptions: boolean;
  treeEnabled: boolean;
  treePath?: string;
  bindingHint?: string;
}

export interface PreviewGroupRenderModel {
  groupId: number;
  groupName: string;
  fields: PreviewFieldRenderModel[];
}

export interface PreviewConfigResolution {
  canonical: ComponentConfig | null;
  matched: ComponentConfig[];
  alternatives: ComponentConfig[];
}

export interface PreviewTreeBinding {
  fieldKey: string;
  treePath: string;
  requestMethod?: string;
  requestId?: string;
}

export interface PreviewWorkspaceRenderModel {
  categoryId: number;
  categoryName: string;
  applicationId?: string;
  canonicalRouteKey?: string;
  matchedConfigCount: number;
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
    const routePrefix = this.normalizeRouteToken(context.routeKeyPrefix);
    const applicationId = String(context.applicationId ?? '').trim().toLowerCase();
    const categoryId = Number(context.categoryId ?? 0);

    return (allConfigs ?? []).filter(cfg => {
      const routeKey = this.normalizeRouteToken(cfg?.routeKey);
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

  resolveCanonicalConfig(
    matchedConfigs: ComponentConfig[],
    context: { selectedConfigRouteKey?: string | null }
  ): PreviewConfigResolution {
    const matched = [...(matchedConfigs ?? [])];
    if (matched.length === 0) {
      return { canonical: null, matched: [], alternatives: [] };
    }

    const selectedRoute = this.normalizeRouteToken(context.selectedConfigRouteKey);
    if (selectedRoute) {
      const selectedMatch = matched.find(cfg => this.normalizeRouteToken(cfg?.routeKey) === selectedRoute);
      if (selectedMatch) {
        return {
          canonical: selectedMatch,
          matched,
          alternatives: matched.filter(cfg => cfg !== selectedMatch)
        };
      }
    }

    const ranked = matched
      .map(cfg => ({ cfg, score: this.scoreConfigForPreview(cfg) }))
      .sort((a, b) => b.score - a.score || this.normalizeRouteToken(a.cfg?.routeKey).localeCompare(this.normalizeRouteToken(b.cfg?.routeKey)));

    const canonical = ranked[0]?.cfg ?? null;
    return {
      canonical,
      matched,
      alternatives: canonical ? matched.filter(cfg => cfg !== canonical) : matched
    };
  }

  resolveConfigBoundOptionFields(config: ComponentConfig | null | undefined, categoryId: number): Set<string> {
    const fields = new Set<string>();
    if (!config || !Array.isArray(config.requestsarray)) {
      return fields;
    }

    (config.requestsarray ?? []).forEach(request => {
      if (!this.requestMatchesCategory(request, categoryId)) {
        return;
      }

      (request.requestsSelectionFields ?? []).forEach(field => {
        const normalized = this.normalizeFieldKey(field);
        if (normalized) {
          fields.add(normalized);
        }
      });

      const bindings = Array.isArray(request.bindings) ? request.bindings : [];
      bindings.forEach(binding => {
        const bindType = String(binding?.bindType ?? '').trim().toLowerCase();
        if (bindType !== 'options') {
          return;
        }

        const targetField = this.normalizeFieldKey(binding?.targetFieldKey ?? binding?.target?.fieldKey);
        if (targetField) {
          fields.add(targetField);
        }
      });
    });

    return fields;
  }

  resolveConfigBoundOptionFieldsFromConfigs(configs: ComponentConfig[], categoryId: number): Set<string> {
    const merged = new Set<string>();
    (configs ?? []).forEach(config => {
      const fields = this.resolveConfigBoundOptionFields(config, categoryId);
      fields.forEach(field => merged.add(field));
    });
    return merged;
  }

  resolveTreeBindingsFromConfigs(configs: ComponentConfig[], categoryId: number): Map<string, PreviewTreeBinding> {
    const bindings = new Map<string, PreviewTreeBinding>();

    (configs ?? []).forEach(config => {
      (config?.requestsarray ?? []).forEach(request => {
        if (!this.requestMatchesCategory(request, categoryId)) {
          return;
        }

        if (!this.isTreePopulateRequest(request)) {
          return;
        }

        const treePath = this.extractTreePath(request);
        if (!treePath) {
          return;
        }

        const targetFields = this.extractRequestTargetFields(request);
        targetFields.forEach(field => {
          const normalizedField = this.normalizeFieldKey(field);
          if (!normalizedField || bindings.has(normalizedField)) {
            return;
          }

          bindings.set(normalizedField, {
            fieldKey: normalizedField,
            treePath,
            requestMethod: String(request?.method ?? ''),
            requestId: String(request?.requestId ?? '')
          });
        });
      });
    });

    return bindings;
  }

  extractTreePopulateRequests(configs: ComponentConfig[], categoryId: number): RequestArrayItem[] {
    const requests: RequestArrayItem[] = [];
    const dedup = new Set<string>();

    (configs ?? []).forEach(config => {
      (config?.requestsarray ?? []).forEach(request => {
        if (!this.requestMatchesCategory(request, categoryId)) {
          return;
        }

        if (!this.isTreePopulateRequest(request)) {
          return;
        }

        const signature = [
          String(request?.method ?? '').trim().toLowerCase(),
          JSON.stringify(request?.args ?? []),
          String(request?.populateMethod ?? '').trim().toLowerCase(),
          JSON.stringify(request?.populateArgs ?? []),
          JSON.stringify(request?.conditions ?? {})
        ].join('|');
        if (dedup.has(signature)) {
          return;
        }

        dedup.add(signature);
        requests.push({
          ...request,
          args: Array.isArray(request?.args) ? [...request.args] : [],
          requestsSelectionFields: Array.isArray(request?.requestsSelectionFields) ? [...request.requestsSelectionFields] : [],
          populateArgs: Array.isArray(request?.populateArgs) ? [...request.populateArgs] : []
        });
      });
    });

    return requests;
  }

  buildConfigurationIssues(
    matchedConfigs: ComponentConfig[],
    context: { routeKeyPrefix?: string | null; selectedConfigRouteKey?: string | null; canonicalRouteKey?: string | null }
  ): PreviewWorkspaceIssue[] {
    const issues: PreviewWorkspaceIssue[] = [];
    const routePrefix = String(context.routeKeyPrefix ?? '').trim();
    const selectedRouteKey = String(context.selectedConfigRouteKey ?? '').trim();
    const canonicalRouteKey = String(context.canonicalRouteKey ?? '').trim();

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
      const selectedNormalized = this.normalizeRouteToken(selectedRouteKey);
      const hasSelected = (matchedConfigs ?? []).some(cfg =>
        this.normalizeRouteToken(cfg?.routeKey) === selectedNormalized
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

    if ((matchedConfigs ?? []).length > 1) {
      issues.push({
        code: 'MULTIPLE_CONFIG_MATCHES',
        severity: 'Warning',
        source: 'configuration',
        message: canonicalRouteKey
          ? `تم العثور على أكثر من Config matching. سيتم اعتماد (${canonicalRouteKey}) كـ canonical route.`
          : 'تم العثور على أكثر من Config matching بدون canonical route واضحة.'
      });
    }

    return issues;
  }

  buildRenderModel(
    workspace: SubjectAdminPreviewWorkspaceDto | null | undefined,
    options?: {
      extraIssues?: PreviewWorkspaceIssue[];
      configBoundOptionFields?: Set<string>;
      treeBindings?: Map<string, PreviewTreeBinding>;
      canonicalRouteKey?: string | null;
      matchedConfigCount?: number;
    }
  ): PreviewWorkspaceRenderModel | null {
    if (!workspace) {
      return null;
    }

    const configBoundOptionFields = options?.configBoundOptionFields ?? new Set<string>();
    const treeBindings = options?.treeBindings ?? new Map<string, PreviewTreeBinding>();
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
      .map(field => this.mapField(field, groupsMeta, configBoundOptionFields, treeBindings));

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
      .map(issue => this.mapBackendIssue(issue))
      .filter(issue => !this.shouldSuppressIssue(issue, configBoundOptionFields));

    const backendMissingBindingFields = new Set(
      backendIssues
        .filter(issue => issue.code === 'MISSING_OPTIONS_BINDING')
        .map(issue => this.normalizeFieldKey(issue.fieldKey))
        .filter(Boolean)
    );

    const unresolvedFields = fields.filter(field => field.unresolvedOptions);
    const unresolvedIssues: PreviewWorkspaceIssue[] = unresolvedFields
      .filter(field => !backendMissingBindingFields.has(this.normalizeFieldKey(field.fieldKey)))
      .map(field => ({
        code: 'UNRESOLVED_OPTIONS_SOURCE',
        severity: 'Error',
        source: 'context',
        message: `الحقل '${field.fieldKey}' يحتاج options/binding ولم يتم حل المصدر حتى الآن.`,
        fieldKey: field.fieldKey,
        groupId: field.groupId
      }));

    const mergedIssues = this.deduplicateIssues([
      ...backendIssues,
      ...(options?.extraIssues ?? []),
      ...unresolvedIssues
    ]);

    const hasError = mergedIssues.some(issue => issue.severity === 'Error');
    const missingBindingFields = new Set(
      mergedIssues
        .filter(issue => issue.code === 'MISSING_OPTIONS_BINDING' || issue.code === 'UNRESOLVED_OPTIONS_SOURCE')
        .map(issue => this.normalizeFieldKey(issue.fieldKey))
        .filter(Boolean)
    );

    const isReady = !hasError;

    return {
      categoryId: workspace.categoryId,
      categoryName: workspace.categoryName,
      applicationId: workspace.applicationId,
      canonicalRouteKey: String(options?.canonicalRouteKey ?? '').trim() || undefined,
      matchedConfigCount: Number(options?.matchedConfigCount ?? 0),
      groups,
      issues: mergedIssues,
      isReady,
      summary: {
        linkedFieldsCount: Number(workspace.readiness?.linkedFieldsCount ?? 0),
        activeLinkedFieldsCount: Number(workspace.readiness?.activeLinkedFieldsCount ?? 0),
        visibleLinkedFieldsCount: Number(workspace.readiness?.visibleLinkedFieldsCount ?? 0),
        renderableFieldsCount: Number(workspace.readiness?.renderableFieldsCount ?? fields.length),
        groupsCount: groups.length,
        missingBindingsCount: missingBindingFields.size
      }
    };
  }

  private mapField(
    field: SubjectFieldDefinitionDto,
    groupsMeta: Map<number, string>,
    configBoundOptionFields: Set<string>,
    treeBindings: Map<string, PreviewTreeBinding>
  ): PreviewFieldRenderModel {
    const normalizedFieldKey = this.normalizeFieldKey(field.fieldKey);
    const treeBinding = treeBindings.get(normalizedFieldKey);
    const treeEnabled = Boolean(treeBinding);
    const hasConfigBinding = configBoundOptionFields.has(normalizedFieldKey);
    const displayBindingHint = this.extractBindingHint(field.displaySettingsJson);
    const bindingHint = displayBindingHint || (treeEnabled ? `tree:${treeBinding?.treePath}` : (hasConfigBinding ? 'config.requestsarray' : ''));
    const optionsPreview = this.parseOptionsPreview(field.optionsPayload);
    const optionsCount = optionsPreview.length;
    const requiresOptions = this.requiresOptions(field.fieldType);
    const optionsSource: 'inline' | 'binding' | 'none' = requiresOptions
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
      optionsPreview,
      unresolvedOptions: requiresOptions && optionsSource === 'none' && !treeEnabled,
      treeEnabled,
      treePath: treeBinding?.treePath,
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

  private shouldSuppressIssue(issue: PreviewWorkspaceIssue, configBoundOptionFields: Set<string>): boolean {
    if (issue.code !== 'MISSING_OPTIONS_BINDING') {
      return false;
    }

    const fieldKey = this.normalizeFieldKey(issue.fieldKey);
    if (!fieldKey) {
      return false;
    }

    return configBoundOptionFields.has(fieldKey);
  }

  private deduplicateIssues(issues: PreviewWorkspaceIssue[]): PreviewWorkspaceIssue[] {
    const seen = new Set<string>();
    const deduplicated: PreviewWorkspaceIssue[] = [];

    (issues ?? []).forEach(issue => {
      const key = [
        String(issue?.code ?? '').trim().toLowerCase(),
        this.normalizeFieldKey(issue?.fieldKey),
        Number(issue?.groupId ?? 0),
        String(issue?.source ?? '').trim().toLowerCase()
      ].join('|');
      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      deduplicated.push(issue);
    });

    return deduplicated;
  }

  private requestMatchesCategory(request: RequestArrayItem | undefined, categoryId: number): boolean {
    if (!request || typeof request !== 'object') {
      return true;
    }

    const conditions = request.conditions;
    if (!conditions || typeof conditions !== 'object') {
      return true;
    }

    const includes = (conditions.categoryIdIn ?? [])
      .map(value => Number(value))
      .filter(value => Number.isFinite(value));
    const excludes = (conditions.categoryIdNotIn ?? [])
      .map(value => Number(value))
      .filter(value => Number.isFinite(value));

    if (includes.length > 0 && (!Number.isFinite(categoryId) || !includes.includes(categoryId))) {
      return false;
    }

    if (excludes.length > 0 && Number.isFinite(categoryId) && excludes.includes(categoryId)) {
      return false;
    }

    return true;
  }

  private extractRequestTargetFields(request: RequestArrayItem | undefined): string[] {
    if (!request || typeof request !== 'object') {
      return [];
    }

    const fields = new Set<string>();
    (request.requestsSelectionFields ?? []).forEach(field => {
      const normalized = this.normalizeFieldKey(field);
      if (normalized) {
        fields.add(normalized);
      }
    });

    const bindings = Array.isArray(request.bindings) ? request.bindings : [];
    bindings.forEach(binding => {
      const bindType = String(binding?.bindType ?? '').trim().toLowerCase();
      if (bindType !== 'options') {
        return;
      }

      const targetField = this.normalizeFieldKey(binding?.targetFieldKey ?? binding?.target?.fieldKey);
      if (targetField) {
        fields.add(targetField);
      }
    });

    return Array.from(fields);
  }

  private isTreePopulateRequest(request: RequestArrayItem | undefined): boolean {
    const method = String(request?.populateMethod ?? '').trim().toLowerCase();
    if (!method) {
      return false;
    }

    return method.includes('populatetreegeneric') || method.includes('tree');
  }

  private extractTreePath(request: RequestArrayItem | undefined): string {
    if (!request || !Array.isArray(request.populateArgs)) {
      return '';
    }

    const args = request.populateArgs ?? [];
    const byIndex = this.normalizeContextPath(args[3]);
    if (byIndex) {
      return byIndex;
    }

    for (const arg of args) {
      const normalized = this.normalizeContextPath(arg);
      if (normalized.includes('tree')) {
        return normalized;
      }
    }

    return '';
  }

  private scoreConfigForPreview(cfg: ComponentConfig): number {
    const route = this.normalizeRouteToken(cfg?.routeKey);
    let score = 0;

    if (route.includes('subjecteditor')) {
      score += 400;
    }
    if (route.includes('editor')) {
      score += 320;
    }
    if (route.includes('create') || route.includes('/new')) {
      score += 220;
    }
    if (cfg?.isNew === true) {
      score += 180;
    }
    if (route.includes('subjectdetail') || route.includes('detail')) {
      score -= 90;
    }
    if (route.includes('dynamicsubjects/')) {
      score += 60;
    }

    const hasBindingHints = (cfg?.requestsarray ?? []).some(request =>
      (request.requestsSelectionFields ?? []).length > 0
      || (Array.isArray(request.bindings) && request.bindings.length > 0)
    );
    if (hasBindingHints) {
      score += 35;
    }

    return score;
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

  private parseOptionsPreview(optionsPayload: string | undefined): string[] {
    const payload = String(optionsPayload ?? '').trim();
    if (!payload) {
      return [];
    }

    try {
      const parsed = JSON.parse(payload);
      if (Array.isArray(parsed)) {
        return parsed
          .map(item => {
            if (item == null) {
              return '';
            }

            if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
              return String(item);
            }

            const value = String((item as any).label ?? (item as any).name ?? (item as any).value ?? (item as any).text ?? '');
            return value;
          })
          .map(item => item.trim())
          .filter(item => item.length > 0)
          .slice(0, 12);
      }

      if (parsed && typeof parsed === 'object') {
        return Object.values(parsed)
          .map(value => String(value ?? '').trim())
          .filter(value => value.length > 0)
          .slice(0, 12);
      }
    } catch {
      return payload
        .split(/[|,;\n]+/g)
        .map(item => item.trim())
        .filter(item => item.length > 0)
        .slice(0, 12);
    }

    return [];
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

  private normalizeRouteToken(value: unknown): string {
    return String(value ?? '')
      .trim()
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .replace(/\/+$/, '')
      .toLowerCase();
  }

  private normalizeFieldKey(value: unknown): string {
    const raw = String(value ?? '').trim().toLowerCase();
    if (!raw) {
      return '';
    }

    return raw.split('|')[0].split('__')[0].trim();
  }

  private normalizeContextPath(value: unknown): string {
    return String(value ?? '')
      .trim()
      .replace(/^this\./i, '');
  }
}
