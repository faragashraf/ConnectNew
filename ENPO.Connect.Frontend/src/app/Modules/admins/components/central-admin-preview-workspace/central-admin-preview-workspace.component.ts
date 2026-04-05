import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription, auditTime } from 'rxjs';
import { ComponentConfig } from 'src/app/shared/models/Component.Config.model';
import { SubjectAdminPreviewWorkspaceDto } from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.dto';
import { DynamicSubjectsController } from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.service';
import { ComponentConfigService } from '../../services/component-config.service';
import {
  CentralAdminPreviewFoundationService,
  PreviewIssueSeverity,
  PreviewFieldRenderModel,
  PreviewWorkspaceRenderModel
} from '../../services/central-admin-preview-foundation.service';
import { CentralAdminContextService, CentralAdminContextState } from '../../services/central-admin-context.service';

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

  private readonly subscriptions = new Subscription();
  private requestSeq = 0;
  private lastStateKey = '';

  constructor(
    private readonly centralAdminContext: CentralAdminContextService,
    private readonly dynamicSubjectsController: DynamicSubjectsController,
    private readonly componentConfigService: ComponentConfigService,
    private readonly previewFoundation: CentralAdminPreviewFoundationService
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

  private refreshForState(state: CentralAdminContextState): void {
    const categoryId = Number(state.selectedCategoryId ?? 0);
    if (categoryId <= 0) {
      this.loading = false;
      this.loadError = '';
      this.workspace = null;
      this.renderModel = null;
      this.matchedConfigs = [];
      this.canonicalConfig = null;
      this.lastStateKey = '';
      return;
    }

    const stateKey = [
      categoryId,
      String(state.selectedApplicationId ?? '').trim(),
      String(state.routeKeyPrefix ?? '').trim(),
      String(state.selectedConfigRouteKey ?? '').trim()
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

        const configurationIssues = this.previewFoundation.buildConfigurationIssues(matchedConfigs, {
          routeKeyPrefix: state.routeKeyPrefix,
          selectedConfigRouteKey: state.selectedConfigRouteKey,
          canonicalRouteKey: resolution.canonical?.routeKey ?? null
        });

        this.renderModel = this.previewFoundation.buildRenderModel(workspace, {
          extraIssues: configurationIssues,
          configBoundOptionFields,
          canonicalRouteKey: resolution.canonical?.routeKey ?? null,
          matchedConfigCount: matchedConfigs.length
        });

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
        const configurationIssues = this.previewFoundation.buildConfigurationIssues([], {
          routeKeyPrefix: state.routeKeyPrefix,
          selectedConfigRouteKey: state.selectedConfigRouteKey,
          canonicalRouteKey: null
        });
        this.renderModel = this.previewFoundation.buildRenderModel(workspace, {
          extraIssues: configurationIssues,
          configBoundOptionFields: new Set<string>(),
          canonicalRouteKey: null,
          matchedConfigCount: 0
        });
      }
    });
  }
}
