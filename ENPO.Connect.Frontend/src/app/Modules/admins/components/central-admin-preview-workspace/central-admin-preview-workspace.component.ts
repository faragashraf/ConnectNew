import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription, auditTime } from 'rxjs';
import { GenericFormsService } from 'src/app/Modules/GenericComponents/GenericForms.service';
import { TreeNode } from 'primeng/api';
import { AdministrativeCertificateController, DynamicFormController, PowerBiController } from 'src/app/shared/services/BackendServices';
import { ComponentConfig, processRequestsAndPopulate } from 'src/app/shared/models/Component.Config.model';
import { SubjectAdminPreviewWorkspaceDto } from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.dto';
import { DynamicSubjectsController } from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.service';
import { ComponentConfigService } from '../../services/component-config.service';
import {
  CentralAdminPreviewFoundationService,
  PreviewIssueSeverity,
  PreviewFieldRenderModel,
  PreviewTreeBinding,
  PreviewWorkspaceRenderModel
} from '../../services/central-admin-preview-foundation.service';
import { CentralAdminContextService, CentralAdminContextState } from '../../services/central-admin-context.service';
import { RequestPolicyRuntimeContext } from '../../services/request-policy-resolver.service';

@Component({
  selector: 'app-central-admin-preview-workspace',
  templateUrl: './central-admin-preview-workspace.component.html',
  styleUrls: ['./central-admin-preview-workspace.component.scss']
})
export class CentralAdminPreviewWorkspaceComponent implements OnInit, OnDestroy {
  loading = false;
  loadError = '';

  workspace: SubjectAdminPreviewWorkspaceDto | null = null;
  renderModel: PreviewWorkspaceRenderModel | null = null;
  matchedConfigs: ComponentConfig[] = [];
  canonicalConfig: ComponentConfig | null = null;
  treeDialogVisible = false;
  treeDialogNodes: TreeNode[] = [];
  treeDialogFieldLabel = '';
  treeDialogFieldKey = '';
  treeDialogSelection: TreeNode | null = null;

  private readonly subscriptions = new Subscription();
  private requestSeq = 0;
  private lastStateKey = '';
  private treeBindings = new Map<string, PreviewTreeBinding>();
  private treeNodesByField = new Map<string, TreeNode[]>();
  private selectedTreeLabelByField = new Map<string, string>();

  constructor(
    private readonly centralAdminContext: CentralAdminContextService,
    private readonly dynamicSubjectsController: DynamicSubjectsController,
    private readonly componentConfigService: ComponentConfigService,
    private readonly previewFoundation: CentralAdminPreviewFoundationService,
    private readonly powerBiController: PowerBiController,
    private readonly dynamicFormController: DynamicFormController,
    private readonly administrativeCertificateController: AdministrativeCertificateController,
    private readonly genericFormService: GenericFormsService
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.centralAdminContext.state$
        .pipe(auditTime(120))
        .subscribe(state => this.refreshForState(state))
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  get contextState(): CentralAdminContextState {
    return this.centralAdminContext.snapshot;
  }

  get hasCategorySelection(): boolean {
    return Number(this.contextState.selectedCategoryId ?? 0) > 0;
  }

  get statusText(): string {
    if (!this.renderModel) {
      return '-';
    }

    return this.renderModel.isReady ? 'جاهز للمعاينة' : 'غير جاهز';
  }

  get primaryRouteKey(): string {
    const canonical = String(this.canonicalConfig?.routeKey ?? '').trim();
    if (canonical) {
      return canonical;
    }

    const selected = String(this.contextState.selectedConfigRouteKey ?? '').trim();
    if (selected) {
      return selected;
    }

    return String(this.matchedConfigs[0]?.routeKey ?? '-');
  }

  get issueSeverityClassMap(): Record<PreviewIssueSeverity, string> {
    return {
      Error: 'severity-error',
      Warning: 'severity-warning',
      Info: 'severity-info'
    };
  }

  trackByIssue(index: number, issue: { code: string; fieldKey?: string; groupId?: number }): string {
    return `${issue.code}-${issue.fieldKey ?? 'na'}-${issue.groupId ?? 0}-${index}`;
  }

  trackByGroup(_index: number, group: { groupId: number }): number {
    return Number(group.groupId ?? 0);
  }

  trackByField(_index: number, field: { mendSql: number; fieldKey: string }): string {
    const mendSql = Number(field.mendSql ?? 0);
    if (mendSql > 0) {
      return `m-${mendSql}`;
    }

    return `k-${field.fieldKey}`;
  }

  isTextareaField(field: PreviewFieldRenderModel): boolean {
    return String(field.type ?? '').toLowerCase().includes('textarea');
  }

  isSelectField(field: PreviewFieldRenderModel): boolean {
    const normalized = String(field.type ?? '').toLowerCase();
    return normalized.includes('drop')
      || normalized.includes('select')
      || normalized.includes('combo')
      || normalized.includes('radio')
      || normalized.includes('tree');
  }

  isBooleanField(field: PreviewFieldRenderModel): boolean {
    const normalized = String(field.type ?? '').toLowerCase();
    return normalized.includes('bool') || normalized.includes('check') || normalized.includes('toggle');
  }

  isDateField(field: PreviewFieldRenderModel): boolean {
    const normalized = String(field.type ?? '').toLowerCase();
    return normalized.includes('date') || normalized.includes('calendar');
  }

  isNumberField(field: PreviewFieldRenderModel): boolean {
    const normalized = String(field.type ?? '').toLowerCase();
    return normalized.includes('number') || normalized.includes('decimal') || normalized.includes('int');
  }

  toSelectPreviewOptions(field: PreviewFieldRenderModel): Array<{ label: string; value: string }> {
    return (field.optionsPreview ?? []).slice(0, 8).map((item, index) => ({
      label: item,
      value: `${index}`
    }));
  }

  hasTreeButton(field: PreviewFieldRenderModel): boolean {
    return Boolean(field.treeEnabled);
  }

  hasTreeNodes(field: PreviewFieldRenderModel): boolean {
    return this.getTreeNodes(field).length > 0;
  }

  getTreeNodes(field: PreviewFieldRenderModel): TreeNode[] {
    return this.treeNodesByField.get(this.normalizeFieldKey(field.fieldKey)) ?? [];
  }

  openTreeDialog(field: PreviewFieldRenderModel): void {
    if (!field.treeEnabled) {
      return;
    }

    const nodes = this.getTreeNodes(field);
    if (nodes.length === 0) {
      return;
    }

    this.treeDialogFieldKey = field.fieldKey;
    this.treeDialogFieldLabel = field.label;
    this.treeDialogNodes = nodes;
    this.treeDialogSelection = null;
    this.treeDialogVisible = true;
  }

  onTreeNodeSelect(event: unknown): void {
    const node = (event as any)?.node ?? null;
    if (!node || !this.treeDialogFieldKey) {
      return;
    }

    const label = String(node?.label ?? node?.key ?? '').trim();
    if (label) {
      this.selectedTreeLabelByField.set(this.normalizeFieldKey(this.treeDialogFieldKey), label);
    }

    this.treeDialogSelection = node;
    this.treeDialogVisible = false;
  }

  getTreeSelectedLabel(field: PreviewFieldRenderModel): string {
    return this.selectedTreeLabelByField.get(this.normalizeFieldKey(field.fieldKey)) ?? '';
  }

  private refreshForState(state: CentralAdminContextState): void {
    const categoryId = Number(state.selectedCategoryId ?? 0);
    if (categoryId <= 0) {
      this.loading = false;
      this.loadError = '';
      this.workspace = null;
      this.renderModel = null;
      this.matchedConfigs = [];
      this.canonicalConfig = null;
      this.treeBindings.clear();
      this.treeNodesByField.clear();
      this.selectedTreeLabelByField.clear();
      this.treeDialogVisible = false;
      this.lastStateKey = '';
      return;
    }

    const stateKey = [
      categoryId,
      String(state.selectedApplicationId ?? '').trim(),
      String(state.routeKeyPrefix ?? '').trim(),
      String(state.selectedConfigRouteKey ?? '').trim(),
      String(state.documentDirection ?? '').trim(),
      String(state.requestMode ?? '').trim(),
      String(state.creatorUnitId ?? '').trim(),
      String(state.targetUnitId ?? '').trim(),
      String(state.runtimeContextJson ?? '').trim()
    ].join('|');

    if (stateKey === this.lastStateKey) {
      return;
    }

    this.lastStateKey = stateKey;
    this.loadWorkspace(state);
  }

  private loadWorkspace(state: CentralAdminContextState): void {
    const categoryId = Number(state.selectedCategoryId ?? 0);
    const appId = String(state.selectedApplicationId ?? '').trim() || undefined;
    const requestSeq = ++this.requestSeq;

    this.loading = true;
    this.loadError = '';

    this.dynamicSubjectsController.getAdminCategoryPreviewWorkspace(categoryId, appId).subscribe({
      next: previewResponse => {
        if (requestSeq !== this.requestSeq) {
          return;
        }

        if (previewResponse?.errors?.length) {
          this.workspace = null;
          this.renderModel = null;
          this.loadError = previewResponse.errors.map(error => error?.message).filter(Boolean).join(' | ')
            || 'تعذر تحميل بيانات المعاينة.';
          return;
        }

        this.workspace = previewResponse?.data ?? null;
        this.loadConfigurationAndBuildModel(state, this.workspace, requestSeq);
      },
      error: () => {
        if (requestSeq !== this.requestSeq) {
          return;
        }

        this.workspace = null;
        this.renderModel = null;
        this.loadError = 'حدث خطأ أثناء تحميل بيانات المعاينة من الخادم.';
      },
      complete: () => {
        if (requestSeq === this.requestSeq) {
          this.loading = false;
        }
      }
    });
  }

  private loadConfigurationAndBuildModel(
    state: CentralAdminContextState,
    workspace: SubjectAdminPreviewWorkspaceDto | null,
    requestSeq: number
  ): void {
    this.componentConfigService.getAll().subscribe({
      next: configs => {
        if (requestSeq !== this.requestSeq) {
          return;
        }

        const matchedConfigs = this.previewFoundation.filterConfigs(configs ?? [], {
          routeKeyPrefix: state.routeKeyPrefix,
          applicationId: state.selectedApplicationId,
          categoryId: state.selectedCategoryId
        });
        this.matchedConfigs = matchedConfigs;
        const resolution = this.previewFoundation.resolveCanonicalConfig(matchedConfigs, {
          selectedConfigRouteKey: state.selectedConfigRouteKey
        });
        this.canonicalConfig = resolution.canonical;

        const categoryId = Number(state.selectedCategoryId ?? 0);
        const configBoundOptionFields = this.previewFoundation.resolveConfigBoundOptionFieldsFromConfigs(
          resolution.matched,
          categoryId
        );
        const treeBindings = this.previewFoundation.resolveTreeBindingsFromConfigs(
          resolution.matched,
          categoryId
        );
        this.treeBindings = treeBindings;
        this.treeNodesByField.clear();
        this.selectedTreeLabelByField.clear();

        const configurationIssues = this.previewFoundation.buildConfigurationIssues(matchedConfigs, {
          routeKeyPrefix: state.routeKeyPrefix,
          selectedConfigRouteKey: state.selectedConfigRouteKey,
          canonicalRouteKey: resolution.canonical?.routeKey ?? null
        });
        const runtimeContext = this.buildRuntimeContext(state);

        this.renderModel = this.previewFoundation.buildRenderModel(workspace, {
          extraIssues: configurationIssues,
          configBoundOptionFields,
          treeBindings,
          canonicalRouteKey: resolution.canonical?.routeKey ?? null,
          matchedConfigCount: matchedConfigs.length,
          requestPolicy: workspace?.subjectType?.requestPolicy ?? null,
          runtimeContext
        });
        this.resolveTreeDataFromConfig(resolution.matched, categoryId, requestSeq);

        if (resolution.canonical?.routeKey) {
          const selectedRoute = String(this.centralAdminContext.snapshot.selectedConfigRouteKey ?? '').trim().toLowerCase();
          const canonicalRoute = String(resolution.canonical.routeKey ?? '').trim().toLowerCase();
          if (selectedRoute !== canonicalRoute) {
            this.centralAdminContext.patchContext({
              selectedConfigRouteKey: resolution.canonical.routeKey
            });
          }
        }
      },
      error: () => {
        if (requestSeq !== this.requestSeq) {
          return;
        }

        this.matchedConfigs = [];
        this.canonicalConfig = null;
        this.treeBindings.clear();
        this.treeNodesByField.clear();
        this.selectedTreeLabelByField.clear();
        const configurationIssues = this.previewFoundation.buildConfigurationIssues([], {
          routeKeyPrefix: state.routeKeyPrefix,
          selectedConfigRouteKey: state.selectedConfigRouteKey,
          canonicalRouteKey: null
        });
        const runtimeContext = this.buildRuntimeContext(state);
        this.renderModel = this.previewFoundation.buildRenderModel(workspace, {
          extraIssues: configurationIssues,
          configBoundOptionFields: new Set<string>(),
          treeBindings: new Map<string, PreviewTreeBinding>(),
          canonicalRouteKey: null,
          matchedConfigCount: 0,
          requestPolicy: workspace?.subjectType?.requestPolicy ?? null,
          runtimeContext
        });
      }
    });
  }

  private buildRuntimeContext(state: CentralAdminContextState): RequestPolicyRuntimeContext {
    let runtimeVariables: Record<string, unknown> = {};
    const runtimeJson = String(state.runtimeContextJson ?? '').trim();
    if (runtimeJson.length > 0) {
      try {
        const parsed = JSON.parse(runtimeJson);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          runtimeVariables = parsed as Record<string, unknown>;
        }
      } catch {
        runtimeVariables = {};
      }
    }

    return {
      applicationId: state.selectedApplicationId ?? null,
      categoryId: state.selectedCategoryId ?? null,
      routeKeyPrefix: state.routeKeyPrefix ?? null,
      documentDirection: state.documentDirection ?? null,
      creatorUnitId: state.creatorUnitId ?? null,
      targetUnitId: state.targetUnitId ?? null,
      requestMode: state.requestMode ?? null,
      variables: runtimeVariables
    };
  }

  private resolveTreeDataFromConfig(matchedConfigs: ComponentConfig[], categoryId: number, requestSeq: number): void {
    if (this.treeBindings.size === 0) {
      this.treeNodesByField.clear();
      return;
    }

    const treeRequests = this.previewFoundation.extractTreePopulateRequests(matchedConfigs, categoryId);
    if (treeRequests.length === 0) {
      this.treeNodesByField.clear();
      return;
    }

    const context = this.buildPreviewRequestContext(treeRequests);
    this.genericFormService.selectionArrays = [];
    processRequestsAndPopulate(context, this.genericFormService, undefined, {
      trigger: 'onCategoryChanged',
      runtime: { categoryId },
      preserveDynamicMetadata: true,
      trace: false
    }).subscribe({
      next: () => {
        if (requestSeq !== this.requestSeq) {
          return;
        }

        this.applyTreeDataFromContext(context);
      },
      error: () => {
        if (requestSeq !== this.requestSeq) {
          return;
        }

        this.treeNodesByField.clear();
      }
    });
  }

  private buildPreviewRequestContext(treeRequests: unknown[]): any {
    return {
      config: {
        routeKey: this.canonicalConfig?.routeKey ?? 'CentralAdminShell/PreviewWorkspace',
        genericFormName: this.canonicalConfig?.genericFormName ?? '',
        dynamicFormSettings: {
          traceRequests: false
        },
        requestsarray: treeRequests
      },
      powerBiController: this.powerBiController,
      dynamicFormController: this.dynamicFormController,
      administrativeCertificateController: this.administrativeCertificateController,
      genericFormService: this.genericFormService,
      unitTree: [],
      categoryTree: [],
      msg: {
        msgError: () => {}
      },
      spinner: {
        show: () => {},
        hide: () => {}
      }
    };
  }

  private applyTreeDataFromContext(context: any): void {
    const mapped = new Map<string, TreeNode[]>();
    this.treeBindings.forEach(binding => {
      const nodes = this.coerceTreeNodes(this.resolvePath(context, binding.treePath));
      if (nodes.length > 0) {
        mapped.set(this.normalizeFieldKey(binding.fieldKey), nodes);
      }
    });

    this.treeNodesByField = mapped;
  }

  private resolvePath(source: any, path: string): any {
    const normalizedPath = String(path ?? '').trim().replace(/^this\./i, '');
    if (!normalizedPath) {
      return source;
    }

    const parts = normalizedPath.split('.').filter(Boolean);
    let cursor = source;
    for (const part of parts) {
      if (cursor == null) {
        return undefined;
      }
      cursor = cursor[part];
    }

    return cursor;
  }

  private coerceTreeNodes(value: unknown): TreeNode[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map(item => this.mapAnyToTreeNode(item))
      .filter((node): node is TreeNode => node !== null);
  }

  private mapAnyToTreeNode(item: unknown): TreeNode | null {
    if (item == null || typeof item !== 'object') {
      const text = String(item ?? '').trim();
      if (!text) {
        return null;
      }

      return {
        key: text,
        label: text,
        children: []
      };
    }

    const source = item as Record<string, unknown>;
    const key = String(source['key'] ?? source['id'] ?? source['value'] ?? '').trim();
    const label = String(source['label'] ?? source['name'] ?? source['text'] ?? source['value'] ?? key).trim();
    const children = Array.isArray(source['children'])
      ? (source['children'] as unknown[]).map(child => this.mapAnyToTreeNode(child)).filter((node): node is TreeNode => node !== null)
      : [];

    if (!key && !label && children.length === 0) {
      return null;
    }

    return {
      key: key || label,
      label: label || key,
      selectable: true,
      children
    };
  }

  private normalizeFieldKey(value: unknown): string {
    const raw = String(value ?? '').trim().toLowerCase();
    if (!raw) {
      return '';
    }

    return raw.split('|')[0].split('__')[0].trim();
  }
}
