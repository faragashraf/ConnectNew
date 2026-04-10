import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TreeNode } from 'primeng/api';
import { Subscription } from 'rxjs';
import { DynamicSubjectsController } from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.service';
import { SubjectCategoryTreeNodeDto } from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.dto';
import { AppNotificationService } from 'src/app/shared/services/notifications/app-notification.service';
import { DynamicSubjectsRealtimeService } from '../../services/dynamic-subjects-realtime.service';
import { DynamicSubjectAccessService } from '../../services/dynamic-subject-access.service';

@Component({
  selector: 'app-dynamic-subjects-shell',
  templateUrl: './dynamic-subjects-shell.component.html',
  styleUrls: ['./dynamic-subjects-shell.component.scss']
})
export class DynamicSubjectsShellComponent implements OnInit, OnDestroy {
  treeNodes: TreeNode[] = [];
  selectedTreeNode: TreeNode | null = null;
  loadingTree = false;
  private readonly subscriptions: Subscription[] = [];

  constructor(
    private readonly dynamicSubjectsController: DynamicSubjectsController,
    private readonly dynamicSubjectsRealtimeService: DynamicSubjectsRealtimeService,
    private readonly dynamicSubjectAccess: DynamicSubjectAccessService,
    private readonly appNotification: AppNotificationService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
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
    this.router.navigate(['/DynamicSubjects/subjects/new'], { queryParams: { categoryId } });
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
}
