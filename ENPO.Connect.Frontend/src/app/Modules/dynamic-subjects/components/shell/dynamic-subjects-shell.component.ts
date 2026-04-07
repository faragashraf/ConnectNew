import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { TreeNode } from 'primeng/api';
import { Subscription } from 'rxjs';
import { DynamicSubjectsController } from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.service';
import { SubjectCategoryTreeNodeDto } from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.dto';
import { AppNotificationService } from 'src/app/shared/services/notifications/app-notification.service';
import { DynamicSubjectsRealtimeService } from '../../services/dynamic-subjects-realtime.service';
import { DynamicSubjectAccessService } from '../../services/dynamic-subject-access.service';
import {
  AdminControlCenterCanonicalCategoryLink,
  AdminControlCenterRuntimeBridgeContext,
  AdminControlCenterRuntimeBridgeService
} from '../../services/admin-control-center-runtime-bridge.service';

@Component({
  selector: 'app-dynamic-subjects-shell',
  templateUrl: './dynamic-subjects-shell.component.html',
  styleUrls: ['./dynamic-subjects-shell.component.scss']
})
export class DynamicSubjectsShellComponent implements OnInit, OnDestroy {
  treeNodes: TreeNode[] = [];
  selectedTreeNode: TreeNode | null = null;
  loadingTree = false;
  runtimeBridgeContext: AdminControlCenterRuntimeBridgeContext | null = null;
  runtimeCanonicalLink: AdminControlCenterCanonicalCategoryLink | null = null;
  private pendingCategorySelection: number | null = null;
  private readonly subscriptions: Subscription[] = [];

  constructor(
    private readonly dynamicSubjectsController: DynamicSubjectsController,
    private readonly dynamicSubjectsRealtimeService: DynamicSubjectsRealtimeService,
    private readonly dynamicSubjectAccess: DynamicSubjectAccessService,
    private readonly appNotification: AppNotificationService,
    private readonly runtimeBridgeService: AdminControlCenterRuntimeBridgeService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.subscriptions.push(
      this.route.queryParamMap.subscribe(params => {
        this.applyRuntimeBridgeContext(params);
      })
    );

    this.loadTree();
    this.subscriptions.push(
      this.dynamicSubjectsRealtimeService.events$().subscribe(eventItem => {
        if (eventItem.eventType === 'SubjectTypeConfigUpdated') {
          this.loadTree();
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  loadTree(): void {
    this.loadingTree = true;
    this.dynamicSubjectsController.getCategoryTree(this.dynamicSubjectAccess.getApplicationId()).subscribe({
      next: response => {
        if (response?.errors?.length) {
          this.appNotification.showApiErrors(response.errors, 'تعذر تحميل شجرة أنواع الموضوعات.');
          this.treeNodes = [];
          return;
        }

        const scopedTree = this.dynamicSubjectAccess.filterByTopParent(response?.data ?? []);
        this.treeNodes = this.mapTreeNodes(scopedTree);
        this.trySelectPendingTreeNode();
      },
      error: () => {
        this.treeNodes = [];
        this.appNotification.error('تعذر تحميل شجرة أنواع الموضوعات، يرجى المحاولة مرة أخرى.');
      },
      complete: () => {
        this.loadingTree = false;
      }
    });
  }

  onNodeSelect(event: any): void {
    const node = event?.node ?? event;
    this.selectedTreeNode = node ?? null;
    const canCreate = Boolean(node?.data?.canCreate);
    if (!canCreate) {
      this.appNotification.warning('يرجى اختيار نوع نهائي من الشجرة يحتوي على حقول ديناميكية.');
      return;
    }

    const categoryId = Number(node?.data?.categoryId ?? node?.key ?? 0);
    if (!categoryId || categoryId <= 0) {
      return;
    }

    this.dynamicSubjectsRealtimeService.joinCategoryGroup(categoryId);
    const runtimeParams = this.buildRuntimeScopeQueryParams(categoryId);
    this.router.navigate(['/DynamicSubjects/subjects/new'], { queryParams: runtimeParams });
  }

  openRuntimeFromScopeLink(): void {
    const categoryId = Number(this.runtimeCanonicalLink?.categoryId ?? this.runtimeBridgeContext?.categoryId ?? 0);
    if (categoryId <= 0) {
      this.appNotification.warning('تعذر تحديد Category Id صالح لفتح نموذج التشغيل.');
      return;
    }

    this.router.navigate(['/DynamicSubjects/subjects/new'], {
      queryParams: this.buildRuntimeScopeQueryParams(categoryId)
    });
  }

  private mapTreeNodes(items: SubjectCategoryTreeNodeDto[]): TreeNode[] {
    return (items ?? []).map(item => ({
      key: String(item.categoryId),
      label: item.categoryName,
      data: item,
      selectable: item.canCreate || (item.children?.length ?? 0) > 0,
      children: this.mapTreeNodes(item.children ?? [])
    }));
  }

  private applyRuntimeBridgeContext(params: ParamMap): void {
    this.runtimeBridgeContext = this.runtimeBridgeService.resolveFromQueryParams(params);
    this.runtimeCanonicalLink = null;
    this.pendingCategorySelection = null;

    if (!this.runtimeBridgeContext) {
      return;
    }

    const runtimeCategoryId = Number(this.runtimeBridgeContext.categoryId ?? 0);
    this.pendingCategorySelection = runtimeCategoryId > 0 ? runtimeCategoryId : null;
    this.resolveRuntimeCanonicalLink();
  }

  private resolveRuntimeCanonicalLink(): void {
    if (!this.runtimeBridgeContext) {
      this.runtimeCanonicalLink = null;
      return;
    }

    const fallbackApplicationId = this.dynamicSubjectAccess.getApplicationId();
    this.subscriptions.push(
      this.runtimeBridgeService.resolveCanonicalCategoryLink(this.runtimeBridgeContext, fallbackApplicationId).subscribe({
        next: link => {
          this.runtimeCanonicalLink = link;
          this.pendingCategorySelection = Number(link?.categoryId ?? this.runtimeBridgeContext?.categoryId ?? 0) || null;
          this.trySelectPendingTreeNode();
        },
        error: () => {
          this.runtimeCanonicalLink = {
            applicationId: fallbackApplicationId,
            categoryId: Number(this.runtimeBridgeContext?.categoryId ?? 0),
            categoryName: null,
            parentCategoryId: null,
            categoryPathLabel: null,
            canCreate: false,
            isFoundInParentTree: false,
            issues: ['تعذر التحقق من الربط المرجعي مع الشجرة الأم من شاشة التشغيل.'],
            warnings: []
          };
        }
      })
    );
  }

  private trySelectPendingTreeNode(): void {
    const targetCategoryId = Number(this.pendingCategorySelection ?? 0);
    if (targetCategoryId <= 0 || this.treeNodes.length === 0) {
      return;
    }

    const matched = this.findTreeNodeByCategoryId(this.treeNodes, targetCategoryId);
    if (!matched) {
      return;
    }

    this.selectedTreeNode = matched;
  }

  private findTreeNodeByCategoryId(nodes: ReadonlyArray<TreeNode>, targetCategoryId: number): TreeNode | null {
    for (const node of nodes ?? []) {
      const categoryId = Number(node?.data?.categoryId ?? node?.key ?? 0);
      if (categoryId === targetCategoryId) {
        return node;
      }

      const childMatch = this.findTreeNodeByCategoryId(node.children ?? [], targetCategoryId);
      if (childMatch) {
        return childMatch;
      }
    }

    return null;
  }

  private buildRuntimeScopeQueryParams(categoryId: number): Record<string, string | number> {
    const params: Record<string, string | number> = { categoryId };
    if (!this.runtimeBridgeContext) {
      return params;
    }

    params['source'] = this.runtimeBridgeContext.source;
    params['scopeCategoryId'] = categoryId;

    if (this.runtimeBridgeContext.applicationId) {
      params['scopeApplicationId'] = this.runtimeBridgeContext.applicationId;
    }
    if (this.runtimeBridgeContext.documentDirection) {
      params['documentDirection'] = this.runtimeBridgeContext.documentDirection;
    }
    if (this.runtimeBridgeContext.routeKeyPrefix) {
      params['scopeRouteKeyPrefix'] = this.runtimeBridgeContext.routeKeyPrefix;
    }
    if (this.runtimeBridgeContext.createConfigRouteKey) {
      params['scopeCreateRouteKey'] = this.runtimeBridgeContext.createConfigRouteKey;
    }

    return params;
  }
}
