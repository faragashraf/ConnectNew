import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AppNotificationService } from 'src/app/shared/services/notifications/app-notification.service';
import {
  REQUEST_RUNTIME_ALL_APPLICATIONS_VALUE,
  RequestRuntimeApplicationOption,
  RequestRuntimeCatalogDto,
  RequestRuntimeTreeNode,
  createEmptyRuntimeCatalog
} from '../../models/request-runtime-catalog.models';
import { RequestRuntimeCatalogFacadeService } from '../../services/request-runtime-catalog-facade.service';

@Component({
  selector: 'app-request-runtime-catalog-page',
  templateUrl: './request-runtime-catalog-page.component.html',
  styleUrls: ['./request-runtime-catalog-page.component.scss']
})
export class RequestRuntimeCatalogPageComponent implements OnInit {
  readonly allApplicationsValue = REQUEST_RUNTIME_ALL_APPLICATIONS_VALUE;

  loading = false;
  catalog: RequestRuntimeCatalogDto = createEmptyRuntimeCatalog();
  applicationOptions: RequestRuntimeApplicationOption[] = [
    { label: 'كل التطبيقات', value: REQUEST_RUNTIME_ALL_APPLICATIONS_VALUE }
  ];

  selectedApplicationId = REQUEST_RUNTIME_ALL_APPLICATIONS_VALUE;
  searchText = '';

  treeNodes: RequestRuntimeTreeNode[] = [];
  selectedNode: RequestRuntimeTreeNode | null = null;

  totalStartableCount = 0;
  visibleStartableCount = 0;

  constructor(
    private readonly facade: RequestRuntimeCatalogFacadeService,
    private readonly appNotification: AppNotificationService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.loadCatalog();
  }

  loadCatalog(): void {
    this.loading = true;
    this.facade.loadCatalog().subscribe({
      next: response => {
        this.catalog = response.data ?? createEmptyRuntimeCatalog();

        if ((response.errors ?? []).length > 0) {
          this.appNotification.showApiErrors(response.errors, 'تعذر تحميل شجرة الطلبات المتاحة للتسجيل.');
        }

        this.applicationOptions = this.facade.buildApplicationOptions(this.catalog);
        const hasSelected = this.applicationOptions.some(option => option.value === this.selectedApplicationId);
        if (!hasSelected) {
          this.selectedApplicationId = REQUEST_RUNTIME_ALL_APPLICATIONS_VALUE;
        }

        this.refreshTree();
      },
      error: () => {
        this.catalog = createEmptyRuntimeCatalog();
        this.treeNodes = [];
        this.totalStartableCount = 0;
        this.visibleStartableCount = 0;
        this.appNotification.error('تعذر تحميل شجرة الطلبات المتاحة للتسجيل.');
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  onApplicationChange(): void {
    this.refreshTree();
  }

  onSearchChange(): void {
    this.refreshTree();
  }

  clearSearch(): void {
    this.searchText = '';
    this.refreshTree();
  }

  expandAll(): void {
    this.setExpandedState(this.treeNodes, true);
  }

  collapseAll(): void {
    this.setExpandedState(this.treeNodes, false);
  }

  onNodeSelect(event: { node?: RequestRuntimeTreeNode }): void {
    this.selectedNode = event?.node ?? null;
  }

  startSelectedRequest(): void {
    const categoryId = Number(this.selectedNode?.data?.categoryId ?? 0);
    if (categoryId <= 0 || this.selectedNode?.data?.canStart !== true) {
      this.appNotification.warning('اختر طلبًا متاحًا من الشجرة ثم ابدأ التسجيل.');
      return;
    }

    this.startRequest(categoryId);
  }

  onStartRequestFromNode(node: RequestRuntimeTreeNode, event: MouseEvent): void {
    event.stopPropagation();

    const categoryId = Number(node?.data?.categoryId ?? 0);
    if (categoryId <= 0 || node?.data?.canStart !== true) {
      return;
    }

    this.startRequest(categoryId);
  }

  private refreshTree(): void {
    this.treeNodes = this.facade.buildTreeNodes(
      this.catalog,
      this.selectedApplicationId,
      this.searchText
    );

    this.totalStartableCount = this.facade.countTotalStartableRequests(
      this.catalog,
      this.selectedApplicationId
    );

    this.visibleStartableCount = this.facade.countVisibleStartableRequests(this.treeNodes);

    this.selectedNode = null;
  }

  private setExpandedState(nodes: RequestRuntimeTreeNode[], expanded: boolean): void {
    (nodes ?? []).forEach(node => {
      node.expanded = expanded;
      this.setExpandedState((node.children ?? []) as RequestRuntimeTreeNode[], expanded);
    });
  }

  private startRequest(categoryId: number): void {
    this.router.navigate(['/DynamicSubjects/subjects/new'], {
      queryParams: {
        categoryId,
        source: 'runtime-catalog'
      }
    });
  }
}
