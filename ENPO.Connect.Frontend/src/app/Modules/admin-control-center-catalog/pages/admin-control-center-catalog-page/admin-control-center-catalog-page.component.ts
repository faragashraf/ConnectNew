import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TreeNode } from 'primeng/api';
import { OverlayPanel } from 'primeng/overlaypanel';
import { CommonResponse } from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.dto';
import {
  DynamicSubjectsAdminCatalogController
} from 'src/app/shared/services/BackendServices/DynamicSubjectsAdminCatalog/DynamicSubjectsAdminCatalog.service';
import {
  AdminCatalogApplicationCreateRequestDto,
  AdminCatalogApplicationDto,
  AdminCatalogApplicationUpdateRequestDto,
  AdminCatalogCategoryCreateRequestDto,
  AdminCatalogCategoryDto,
  AdminCatalogCategoryTreeNodeDto,
  AdminCatalogCategoryUpdateRequestDto
} from 'src/app/shared/services/BackendServices/DynamicSubjectsAdminCatalog/DynamicSubjectsAdminCatalog.dto';

type MessageSeverity = 'success' | 'warn' | 'error';

@Component({
  selector: 'app-admin-control-center-catalog-page',
  templateUrl: './admin-control-center-catalog-page.component.html',
  styleUrls: ['./admin-control-center-catalog-page.component.scss']
})
export class AdminControlCenterCatalogPageComponent implements OnInit {
  readonly applicationForm: FormGroup = this.fb.group({
    applicationId: ['', [Validators.required, Validators.maxLength(10)]],
    applicationName: ['', [Validators.required, Validators.maxLength(200)]],
    isActive: [true]
  });

  readonly categoryForm: FormGroup = this.fb.group({
    categoryName: ['', [Validators.required, Validators.maxLength(50)]],
    parentCategoryId: [0, [Validators.required]],
    isActive: [true]
  });

  applications: AdminCatalogApplicationDto[] = [];
  selectedApplicationId: string | null = null;

  categoryTree: TreeNode[] = [];
  parentPickerTree: TreeNode[] = [];
  selectedCategoryNode: TreeNode | null = null;

  editingApplicationId: string | null = null;
  editingCategoryId: number | null = null;

  loadingApplications = false;
  loadingTree = false;
  savingApplication = false;
  savingCategory = false;

  message = '';
  messageSeverity: MessageSeverity = 'success';

  private readonly categoryIndex = new Map<number, AdminCatalogCategoryTreeNodeDto>();
  private readonly categoryPathIndex = new Map<number, string>();
  private readonly categoryTreeNodeIndex = new Map<number, TreeNode>();

  constructor(
    private readonly fb: FormBuilder,
    private readonly adminCatalogController: DynamicSubjectsAdminCatalogController
  ) {}

  ngOnInit(): void {
    this.prepareNewApplication();
    this.prepareNewCategory();
    this.loadApplications();
  }

  get selectedApplication(): AdminCatalogApplicationDto | null {
    if (!this.selectedApplicationId) {
      return null;
    }

    return this.applications.find(item => item.applicationId === this.selectedApplicationId) ?? null;
  }

  get parentDisplayLabel(): string {
    const parentCategoryId = this.toNonNegativeInt(this.categoryForm.get('parentCategoryId')?.value);
    if (parentCategoryId === 0) {
      return 'جذر (بدون Parent)';
    }

    return this.categoryPathIndex.get(parentCategoryId) ?? `#${parentCategoryId}`;
  }

  get canSaveCategory(): boolean {
    return this.selectedApplicationId != null && !this.loadingTree;
  }

  onSelectApplication(application: AdminCatalogApplicationDto): void {
    this.selectedApplicationId = application.applicationId;
    this.clearTreeState();
    this.prepareNewCategory();
    this.loadCategoryTree(application.applicationId);
  }

  onRefreshApplications(): void {
    this.loadApplications(this.selectedApplicationId);
  }

  onStartCreateApplication(): void {
    this.prepareNewApplication();
  }

  onStartEditApplication(application: AdminCatalogApplicationDto): void {
    this.editingApplicationId = application.applicationId;
    this.applicationForm.reset(
      {
        applicationId: application.applicationId,
        applicationName: application.applicationName,
        isActive: application.isActive
      },
      { emitEvent: false }
    );
  }

  onSaveApplication(): void {
    this.applicationForm.markAllAsTouched();
    if (this.applicationForm.invalid || this.savingApplication) {
      return;
    }

    const applicationIdFromForm = this.normalizeString(this.applicationForm.get('applicationId')?.value);
    const applicationName = this.normalizeString(this.applicationForm.get('applicationName')?.value);
    const isActive = this.applicationForm.get('isActive')?.value === true;

    if (!applicationName) {
      this.showMessage('warn', 'اسم التطبيق مطلوب.');
      return;
    }

    const editApplicationId = this.normalizeString(this.editingApplicationId);
    if (!editApplicationId && !applicationIdFromForm) {
      this.showMessage('warn', 'معرف التطبيق مطلوب.');
      return;
    }

    this.savingApplication = true;

    if (editApplicationId) {
      const request: AdminCatalogApplicationUpdateRequestDto = {
        applicationName,
        isActive
      };

      this.adminCatalogController.updateApplication(editApplicationId, request).subscribe({
        next: response => {
          if (!this.ensureSuccess(response, 'تعذر تعديل التطبيق.')) {
            return;
          }

          this.showMessage('success', 'تم تعديل التطبيق بنجاح.');
          this.prepareNewApplication();
          this.loadApplications(editApplicationId);
        },
        error: () => {
          this.showMessage('error', 'حدث خطأ أثناء تعديل التطبيق.');
        },
        complete: () => {
          this.savingApplication = false;
        }
      });

      return;
    }

    const request: AdminCatalogApplicationCreateRequestDto = {
      applicationId: applicationIdFromForm!,
      applicationName,
      isActive
    };

    this.adminCatalogController.createApplication(request).subscribe({
      next: response => {
        if (!this.ensureSuccess(response, 'تعذر إنشاء التطبيق.')) {
          return;
        }

        const createdApplicationId = this.normalizeString(response.data?.applicationId) ?? request.applicationId;
        this.showMessage('success', 'تم إنشاء التطبيق بنجاح.');
        this.prepareNewApplication();
        this.loadApplications(createdApplicationId);
      },
      error: () => {
        this.showMessage('error', 'حدث خطأ أثناء إنشاء التطبيق.');
      },
      complete: () => {
        this.savingApplication = false;
      }
    });
  }

  onStartCreateCategory(): void {
    const selectedParentId = this.readSelectedCategoryId() ?? 0;
    this.prepareNewCategory(selectedParentId);
  }

  onStartEditSelectedCategory(): void {
    const selected = this.readSelectedCategory();
    if (!selected) {
      this.showMessage('warn', 'اختر عنصرًا من الشجرة أولًا للتعديل.');
      return;
    }

    this.editingCategoryId = selected.categoryId;
    this.categoryForm.reset(
      {
        categoryName: selected.categoryName,
        parentCategoryId: selected.parentCategoryId,
        isActive: selected.isActive
      },
      { emitEvent: false }
    );
  }

  openParentPicker(panel: OverlayPanel, event: Event): void {
    panel.toggle(event);
  }

  onChooseRootParent(panel: OverlayPanel): void {
    this.categoryForm.patchValue({ parentCategoryId: 0 });
    panel.hide();
  }

  onParentNodeSelect(event: { node?: TreeNode }, panel: OverlayPanel): void {
    const parentCandidate = event?.node?.data as AdminCatalogCategoryTreeNodeDto | undefined;
    if (!parentCandidate) {
      return;
    }

    if (this.editingCategoryId && parentCandidate.categoryId === this.editingCategoryId) {
      this.showMessage('warn', 'لا يمكن اختيار نفس العنصر كأب له.');
      return;
    }

    if (this.editingCategoryId && this.isDescendantOfEditingNode(parentCandidate.categoryId)) {
      this.showMessage('warn', 'لا يمكن اختيار عنصر ابن كأب للعقدة الحالية.');
      return;
    }

    this.categoryForm.patchValue({ parentCategoryId: parentCandidate.categoryId });
    panel.hide();
  }

  onSaveCategory(): void {
    if (!this.selectedApplicationId) {
      this.showMessage('warn', 'اختر تطبيقًا أولًا قبل إدارة الشجرة.');
      return;
    }

    this.categoryForm.markAllAsTouched();
    if (this.categoryForm.invalid || this.savingCategory || this.loadingTree) {
      return;
    }

    const categoryName = this.normalizeString(this.categoryForm.get('categoryName')?.value);
    const parentCategoryId = this.toNonNegativeInt(this.categoryForm.get('parentCategoryId')?.value);
    const isActive = this.categoryForm.get('isActive')?.value === true;

    if (!categoryName) {
      this.showMessage('warn', 'اسم العنصر مطلوب.');
      return;
    }

    if (this.editingCategoryId != null) {
      if (parentCategoryId === this.editingCategoryId) {
        this.showMessage('warn', 'لا يمكن اختيار نفس العنصر كأب له.');
        return;
      }

      if (this.isDescendantOfEditingNode(parentCategoryId)) {
        this.showMessage('warn', 'لا يمكن اختيار عنصر ابن كأب للعقدة الحالية.');
        return;
      }
    }

    this.savingCategory = true;
    const preferredNodeId = this.editingCategoryId;

    if (this.editingCategoryId != null) {
      const request: AdminCatalogCategoryUpdateRequestDto = {
        categoryName,
        parentCategoryId,
        isActive
      };

      this.adminCatalogController.updateCategory(this.editingCategoryId, request).subscribe({
        next: response => {
          if (!this.ensureSuccess(response, 'تعذر تعديل عنصر الشجرة.')) {
            return;
          }

          const resolvedCategoryId = response.data?.categoryId ?? preferredNodeId ?? null;
          this.showMessage('success', 'تم تعديل عنصر الشجرة بنجاح.');
          this.prepareNewCategory(parentCategoryId);
          this.loadCategoryTree(this.selectedApplicationId!, resolvedCategoryId);
        },
        error: () => {
          this.showMessage('error', 'حدث خطأ أثناء تعديل عنصر الشجرة.');
        },
        complete: () => {
          this.savingCategory = false;
        }
      });

      return;
    }

    const request: AdminCatalogCategoryCreateRequestDto = {
      applicationId: this.selectedApplicationId,
      categoryName,
      parentCategoryId,
      isActive
    };

    this.adminCatalogController.createCategory(request).subscribe({
      next: response => {
        if (!this.ensureSuccess(response, 'تعذر إنشاء عنصر الشجرة.')) {
          return;
        }

        const createdCategoryId = response.data?.categoryId ?? null;
        this.showMessage('success', 'تم إنشاء عنصر الشجرة بنجاح.');
        this.prepareNewCategory(parentCategoryId);
        this.loadCategoryTree(this.selectedApplicationId!, createdCategoryId);
      },
      error: () => {
        this.showMessage('error', 'حدث خطأ أثناء إنشاء عنصر الشجرة.');
      },
      complete: () => {
        this.savingCategory = false;
      }
    });
  }

  private loadApplications(preferredApplicationId?: string | null): void {
    this.loadingApplications = true;

    this.adminCatalogController.getApplications().subscribe({
      next: response => {
        if (!this.ensureSuccess(response, 'تعذر تحميل التطبيقات من قاعدة البيانات.')) {
          this.applications = [];
          this.selectedApplicationId = null;
          this.clearTreeState();
          return;
        }

        this.applications = [...(response.data ?? [])];
        const normalizedPreferred = this.normalizeString(preferredApplicationId);
        const hasPreferred = normalizedPreferred
          ? this.applications.some(item => item.applicationId === normalizedPreferred)
          : false;

        if (hasPreferred) {
          this.selectedApplicationId = normalizedPreferred;
        } else {
          const hasCurrentSelection = this.selectedApplicationId
            ? this.applications.some(item => item.applicationId === this.selectedApplicationId)
            : false;

          this.selectedApplicationId = hasCurrentSelection
            ? this.selectedApplicationId
            : (this.applications[0]?.applicationId ?? null);
        }

        if (!this.selectedApplicationId) {
          this.clearTreeState();
          return;
        }

        this.loadCategoryTree(this.selectedApplicationId);
      },
      error: () => {
        this.applications = [];
        this.selectedApplicationId = null;
        this.clearTreeState();
        this.showMessage('error', 'حدث خطأ أثناء تحميل التطبيقات.');
      },
      complete: () => {
        this.loadingApplications = false;
      }
    });
  }

  private loadCategoryTree(applicationId: string, preferredCategoryId?: number | null): void {
    this.loadingTree = true;

    this.adminCatalogController.getCategoryTree(applicationId).subscribe({
      next: response => {
        if (!this.ensureSuccess(response, 'تعذر تحميل الشجرة من جدول CDCategory.')) {
          this.clearTreeState();
          return;
        }

        const categories = response.data ?? [];
        this.rebuildCategoryIndex(categories);
        this.rebuildTreeNodes(categories);

        const targetCategoryId = preferredCategoryId
          ?? this.readSelectedCategoryId()
          ?? this.editingCategoryId;

        if (targetCategoryId && this.categoryTreeNodeIndex.has(targetCategoryId)) {
          this.selectedCategoryNode = this.categoryTreeNodeIndex.get(targetCategoryId) ?? null;
          return;
        }

        this.selectedCategoryNode = null;
      },
      error: () => {
        this.clearTreeState();
        this.showMessage('error', 'حدث خطأ أثناء تحميل الشجرة.');
      },
      complete: () => {
        this.loadingTree = false;
      }
    });
  }

  private rebuildCategoryIndex(nodes: ReadonlyArray<AdminCatalogCategoryTreeNodeDto>): void {
    this.categoryIndex.clear();
    this.categoryPathIndex.clear();

    const walk = (items: ReadonlyArray<AdminCatalogCategoryTreeNodeDto>, parentPath: string): void => {
      for (const item of items ?? []) {
        const nextPath = parentPath.length > 0
          ? `${parentPath} / ${item.categoryName}`
          : item.categoryName;

        this.categoryIndex.set(item.categoryId, item);
        this.categoryPathIndex.set(item.categoryId, `${nextPath} (#${item.categoryId})`);

        walk(item.children ?? [], nextPath);
      }
    };

    walk(nodes, '');
  }

  private rebuildTreeNodes(nodes: ReadonlyArray<AdminCatalogCategoryTreeNodeDto>): void {
    this.categoryTreeNodeIndex.clear();
    this.categoryTree = this.mapTreeNodes(nodes, true);
    this.parentPickerTree = this.mapTreeNodes(nodes, false);
  }

  private mapTreeNodes(nodes: ReadonlyArray<AdminCatalogCategoryTreeNodeDto>, withIndex: boolean): TreeNode[] {
    return (nodes ?? []).map(node => {
      const label = node.isActive
        ? `${node.categoryName} (#${node.categoryId})`
        : `${node.categoryName} (#${node.categoryId}) - غير مفعل`;

      const mapped: TreeNode = {
        label,
        data: node,
        expanded: true,
        children: this.mapTreeNodes(node.children ?? [], withIndex)
      };

      if (withIndex) {
        this.categoryTreeNodeIndex.set(node.categoryId, mapped);
      }

      return mapped;
    });
  }

  private clearTreeState(): void {
    this.categoryTree = [];
    this.parentPickerTree = [];
    this.selectedCategoryNode = null;
    this.categoryIndex.clear();
    this.categoryPathIndex.clear();
    this.categoryTreeNodeIndex.clear();
  }

  private prepareNewApplication(): void {
    this.editingApplicationId = null;
    this.applicationForm.reset(
      {
        applicationId: '',
        applicationName: '',
        isActive: true
      },
      { emitEvent: false }
    );
  }

  private prepareNewCategory(defaultParentCategoryId = 0): void {
    this.editingCategoryId = null;
    this.categoryForm.reset(
      {
        categoryName: '',
        parentCategoryId: this.toNonNegativeInt(defaultParentCategoryId),
        isActive: true
      },
      { emitEvent: false }
    );
  }

  private readSelectedCategory(): AdminCatalogCategoryTreeNodeDto | null {
    const candidate = this.selectedCategoryNode?.data as AdminCatalogCategoryTreeNodeDto | undefined;
    return candidate ?? null;
  }

  private readSelectedCategoryId(): number | null {
    const selected = this.readSelectedCategory();
    if (!selected) {
      return null;
    }

    return this.toNonNegativeInt(selected.categoryId);
  }

  private isDescendantOfEditingNode(candidateCategoryId: number): boolean {
    if (this.editingCategoryId == null) {
      return false;
    }

    const editingNode = this.categoryIndex.get(this.editingCategoryId);
    if (!editingNode) {
      return false;
    }

    const descendants = new Set<number>();
    const walk = (items: ReadonlyArray<AdminCatalogCategoryTreeNodeDto>): void => {
      for (const item of items ?? []) {
        descendants.add(item.categoryId);
        walk(item.children ?? []);
      }
    };

    walk(editingNode.children ?? []);
    return descendants.has(this.toNonNegativeInt(candidateCategoryId));
  }

  private ensureSuccess<T>(response: CommonResponse<T>, fallbackMessage: string): boolean {
    if (response?.isSuccess) {
      return true;
    }

    this.showMessage('error', this.readResponseError(response, fallbackMessage));
    return false;
  }

  private readResponseError<T>(response: CommonResponse<T> | null | undefined, fallbackMessage: string): string {
    const candidate = response?.errors?.find(item => this.normalizeString(item?.message) != null)?.message;
    return this.normalizeString(candidate) ?? fallbackMessage;
  }

  private showMessage(severity: MessageSeverity, message: string): void {
    this.messageSeverity = severity;
    this.message = message;
  }

  private toNonNegativeInt(value: unknown): number {
    const normalized = Number(value ?? 0);
    if (!Number.isFinite(normalized) || normalized < 0) {
      return 0;
    }

    return Math.trunc(normalized);
  }

  private normalizeString(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : null;
  }
}
