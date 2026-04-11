import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TreeNode } from 'primeng/api';
import { OverlayPanel } from 'primeng/overlaypanel';
import { CommonResponse } from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.dto';
import { DynamicSubjectsAdminCatalogController } from 'src/app/shared/services/BackendServices/DynamicSubjectsAdminCatalog/DynamicSubjectsAdminCatalog.service';
import {
  AdminCatalogApplicationCreateRequestDto,
  AdminCatalogApplicationDeleteDiagnosticsDto,
  AdminCatalogApplicationDto,
  AdminCatalogApplicationUpdateRequestDto,
  AdminCatalogCategoryCreateRequestDto,
  AdminCatalogCategoryDeleteDiagnosticsDto,
  AdminCatalogCategoryTreeNodeDto,
  AdminCatalogCategoryUpdateRequestDto,
  AdminCatalogDeleteResultDto,
  AdminCatalogGroupCreateRequestDto,
  AdminCatalogGroupTreeNodeDto,
  AdminCatalogGroupUpdateRequestDto
} from 'src/app/shared/services/BackendServices/DynamicSubjectsAdminCatalog/DynamicSubjectsAdminCatalog.dto';

type MessageSeverity = 'success' | 'warn' | 'error';
type UiPhase = 1 | 2;
type ParentGroupOption = { label: string; value: number | null };
type ControlPanelSectionKey =
  | 'basic'
  | 'lifecycle'
  | 'availabilityPermissions'
  | 'fieldsForm'
  | 'dynamicIntegrations'
  | 'notifications';
type ControlPanelSection = { key: ControlPanelSectionKey; label: string; anchorId: string };

@Component({
  selector: 'app-admin-control-center-catalog-page',
  templateUrl: './admin-control-center-catalog-page.component.html',
  styleUrls: ['./admin-control-center-catalog-page.component.scss']
})
export class AdminControlCenterCatalogPageComponent implements OnInit {
  private static readonly CATALOG_CONTEXT_STORAGE_KEY = 'connect:control-center-catalog:context:v1';
  readonly controlPanelSections: ReadonlyArray<ControlPanelSection> = [
    { key: 'basic', label: 'المعلومات الأساسية', anchorId: 'catalog-section-basic' },
    { key: 'lifecycle', label: 'دورة الطلب', anchorId: 'catalog-section-lifecycle' },
    { key: 'availabilityPermissions', label: 'الإتاحة والصلاحيات', anchorId: 'catalog-section-availability-permissions' },
    { key: 'fieldsForm', label: 'الحقول والنموذج', anchorId: 'catalog-section-fields-form' },
    { key: 'dynamicIntegrations', label: 'السلوك الديناميكي والتكاملات', anchorId: 'catalog-section-dynamic-integrations' },
    { key: 'notifications', label: 'الإشعارات', anchorId: 'catalog-section-notifications' }
  ];

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

  readonly groupForm: FormGroup = this.fb.group({
    groupName: ['', [Validators.required, Validators.maxLength(200)]],
    groupDescription: ['', [Validators.maxLength(255)]],
    parentGroupId: [null],
    displayOrder: [0, [Validators.required, Validators.min(0), Validators.max(100000)]],
    isActive: [true]
  });

  applications: AdminCatalogApplicationDto[] = [];
  selectedApplicationId: string | null = null;

  categoryTree: TreeNode[] = [];
  parentPickerTree: TreeNode[] = [];
  selectedCategoryNode: TreeNode | null = null;

  groupTree: TreeNode[] = [];
  selectedGroupNode: TreeNode | null = null;
  groupParentOptions: ParentGroupOption[] = [{ label: 'بدون مجموعة أم (مجموعة رئيسية)', value: null }];

  editingApplicationId: string | null = null;
  editingCategoryId: number | null = null;
  editingGroupId: number | null = null;

  loadingApplications = false;
  loadingTree = false;
  loadingGroups = false;

  savingApplication = false;
  savingCategory = false;
  savingGroup = false;

  deletingApplicationId: string | null = null;
  deletingCategory = false;
  deletingGroup = false;

  activePhase: UiPhase = 1;
  activeControlPanelSection: ControlPanelSectionKey = 'basic';
  groupsLoadedForCategoryId: number | null = null;
  routingMandatoryCompletionPercent = 0;
  fieldAccessMandatoryCompletionPercent = 0;

  message = '';
  messageSeverity: MessageSeverity = 'success';

  private readonly categoryIndex = new Map<number, AdminCatalogCategoryTreeNodeDto>();
  private readonly categoryPathIndex = new Map<number, string>();
  private readonly categoryTreeNodeIndex = new Map<number, TreeNode>();

  private readonly groupIndex = new Map<number, AdminCatalogGroupTreeNodeDto>();
  private readonly groupPathIndex = new Map<number, string>();
  private readonly groupTreeNodeIndex = new Map<number, TreeNode>();

  constructor(
    private readonly fb: FormBuilder,
    private readonly adminCatalogController: DynamicSubjectsAdminCatalogController
  ) {}

  ngOnInit(): void {
    this.prepareNewApplication();
    this.prepareNewCategory();
    this.prepareNewGroup();
    this.loadApplications();
  }

  get selectedApplication(): AdminCatalogApplicationDto | null {
    if (!this.selectedApplicationId) {
      return null;
    }

    return this.applications.find(item => item.applicationId === this.selectedApplicationId) ?? null;
  }

  get selectedCategory(): AdminCatalogCategoryTreeNodeDto | null {
    const candidate = this.selectedCategoryNode?.data as AdminCatalogCategoryTreeNodeDto | undefined;
    return candidate ?? null;
  }

  get selectedCategoryId(): number | null {
    const selected = this.selectedCategory;
    return selected ? this.toNonNegativeInt(selected.categoryId) : null;
  }

  get selectedCategoryPathLabel(): string {
    const categoryId = this.selectedCategoryId;
    if (!categoryId) {
      return 'لا توجد عقدة محددة';
    }

    return this.categoryPathIndex.get(categoryId) ?? `#${categoryId}`;
  }

  get selectedGroup(): AdminCatalogGroupTreeNodeDto | null {
    const candidate = this.selectedGroupNode?.data as AdminCatalogGroupTreeNodeDto | undefined;
    return candidate ?? null;
  }

  get parentDisplayLabel(): string {
    const parentCategoryId = this.toNonNegativeInt(this.categoryForm.get('parentCategoryId')?.value);
    if (parentCategoryId === 0) {
      return 'الجذر (بدون عقدة أم)';
    }

    return this.categoryPathIndex.get(parentCategoryId) ?? `#${parentCategoryId}`;
  }

  get categoryEditorHelperText(): string {
    if (this.editingCategoryId != null) {
      return 'أنت في وضع التعديل، وأي حفظ سيُحدِّث العقدة الحالية مباشرة.';
    }

    if (this.selectedCategoryId != null) {
      return 'أنت في وضع الإضافة، وسيتم إنشاء عقدة جديدة أسفل العقدة المحددة ما لم تغيّر العقدة الأم.';
    }

    return 'ابدأ بإضافة عقدة جذرية أو اختر عقدة من الشجرة ثم عدّل بياناتها.';
  }

  get categoryStatusLabel(): string {
    return this.categoryForm.get('isActive')?.value === true ? 'العقدة مفعلة' : 'العقدة غير مفعلة';
  }

  get canSaveApplication(): boolean {
    return !this.savingApplication && this.applicationForm.valid;
  }

  get canSaveCategory(): boolean {
    return this.selectedApplicationId != null
      && !this.loadingTree
      && !this.savingCategory
      && this.categoryForm.valid;
  }

  get canSaveGroup(): boolean {
    return this.selectedApplicationId != null
      && this.selectedCategoryId != null
      && !this.loadingGroups
      && !this.savingGroup
      && this.groupForm.valid;
  }

  get phase1CompletionPercent(): number {
    const checkpoints = [
      this.applications.length > 0,
      this.selectedApplicationId != null,
      this.categoryTree.length > 0,
      this.selectedCategoryId != null
    ];

    const passed = checkpoints.filter(Boolean).length;
    return Math.round((passed / checkpoints.length) * 100);
  }

  get phase2CompletionPercent(): number {
    if (!this.selectedCategoryId) {
      return 0;
    }

    const checkpoints = [
      this.groupsLoadedForCategoryId === this.selectedCategoryId,
      this.groupTree.length > 0,
      this.selectedGroup != null || this.editingGroupId != null
    ];

    const passed = checkpoints.filter(Boolean).length;
    return Math.round((passed / checkpoints.length) * 100);
  }

  get overallCompletionPercent(): number {
    return Math.round((this.phase1CompletionPercent + this.phase2CompletionPercent) / 2);
  }

  onRoutingCompletionChanged(percent: number): void {
    const normalized = Number(percent ?? 0);
    if (!Number.isFinite(normalized)) {
      this.routingMandatoryCompletionPercent = 0;
      return;
    }

    this.routingMandatoryCompletionPercent = Math.max(0, Math.min(100, Math.round(normalized)));
  }

  onFieldAccessCompletionChanged(percent: number): void {
    const normalized = Number(percent ?? 0);
    if (!Number.isFinite(normalized)) {
      this.fieldAccessMandatoryCompletionPercent = 0;
      return;
    }

    this.fieldAccessMandatoryCompletionPercent = Math.max(0, Math.min(100, Math.round(normalized)));
  }

  onActivatePhase(phase: UiPhase): void {
    if (phase === 2 && !this.selectedCategoryId) {
      this.showMessage('warn', 'اختر عقدة من الشجرة أولًا للانتقال إلى المرحلة الثانية.');
      return;
    }

    this.activePhase = phase;
  }

  onJumpToControlPanelSection(sectionKey: ControlPanelSectionKey): void {
    const target = this.controlPanelSections.find(item => item.key === sectionKey);
    if (!target) {
      return;
    }

    this.activeControlPanelSection = sectionKey;
    if (typeof document === 'undefined') {
      return;
    }

    const host = document.getElementById(target.anchorId);
    host?.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
  }

  onSelectApplication(application: AdminCatalogApplicationDto): void {
    this.selectedApplicationId = application.applicationId;
    this.activePhase = 1;
    this.persistCatalogContextCache(null, this.selectedApplicationId);

    this.clearTreeState();
    this.clearGroupsState();
    this.prepareNewCategory();
    this.prepareNewGroup();

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

  onDeleteApplication(application: AdminCatalogApplicationDto, event: Event): void {
    event.stopPropagation();
    const applicationId = this.normalizeString(application.applicationId);
    if (!applicationId || this.deletingApplicationId) {
      return;
    }

    this.deletingApplicationId = applicationId;
    this.adminCatalogController.diagnoseApplicationDelete(applicationId).subscribe({
      next: response => {
        if (!this.ensureSuccess(response, 'تعذر تشخيص حذف التطبيق.')) {
          return;
        }

        const diagnostics = response.data;
        if (!diagnostics) {
          this.showMessage('error', 'تعذر قراءة تفاصيل حذف التطبيق.');
          return;
        }

        const confirmationMessage = this.buildApplicationDeleteConfirmationMessage(diagnostics);
        if (!window.confirm(confirmationMessage)) {
          return;
        }

        this.adminCatalogController.deleteApplication(applicationId).subscribe({
          next: deleteResponse => {
            if (!this.ensureSuccess(deleteResponse, 'تعذر حذف التطبيق.')) {
              return;
            }

            this.handleApplicationDeleteResult(applicationId, deleteResponse.data);
          },
          error: () => this.showMessage('error', 'حدث خطأ أثناء حذف التطبيق.'),
          complete: () => { this.deletingApplicationId = null; }
        });
      },
      error: () => {
        this.showMessage('error', 'حدث خطأ أثناء تشخيص حذف التطبيق.');
        this.deletingApplicationId = null;
      }
    });
  }

  onSaveApplication(): void {
    this.applicationForm.markAllAsTouched();
    if (!this.canSaveApplication) {
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
      const request: AdminCatalogApplicationUpdateRequestDto = { applicationName, isActive };
      this.adminCatalogController.updateApplication(editApplicationId, request).subscribe({
        next: response => {
          if (!this.ensureSuccess(response, 'تعذر تعديل التطبيق.')) {
            return;
          }

          this.showMessage('success', 'تم تعديل التطبيق بنجاح.');
          this.prepareNewApplication();
          this.loadApplications(editApplicationId);
        },
        error: () => this.showMessage('error', 'حدث خطأ أثناء تعديل التطبيق.'),
        complete: () => { this.savingApplication = false; }
      });

      return;
    }

    const createRequest: AdminCatalogApplicationCreateRequestDto = {
      applicationId: applicationIdFromForm!,
      applicationName,
      isActive
    };

    this.adminCatalogController.createApplication(createRequest).subscribe({
      next: response => {
        if (!this.ensureSuccess(response, 'تعذر إنشاء التطبيق.')) {
          return;
        }

        const createdId = this.normalizeString(response.data?.applicationId) ?? createRequest.applicationId;
        this.showMessage('success', 'تم إنشاء التطبيق بنجاح.');
        this.prepareNewApplication();
        this.loadApplications(createdId);
      },
      error: () => this.showMessage('error', 'حدث خطأ أثناء إنشاء التطبيق.'),
      complete: () => { this.savingApplication = false; }
    });
  }

  onStartCreateCategory(): void {
    this.prepareNewCategory(this.selectedCategoryId ?? 0);
  }

  onStartEditSelectedCategory(): void {
    const selected = this.selectedCategory;
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

  onDeleteSelectedCategory(): void {
    const selected = this.selectedCategory;
    if (!selected || this.deletingCategory) {
      this.showMessage('warn', 'اختر عقدة من الشجرة أولًا للحذف.');
      return;
    }

    this.deletingCategory = true;
    this.adminCatalogController.diagnoseCategoryDelete(selected.categoryId).subscribe({
      next: response => {
        if (!this.ensureSuccess(response, 'تعذر تشخيص حذف العقدة.')) {
          return;
        }

        const diagnostics = response.data;
        if (!diagnostics) {
          this.showMessage('error', 'تعذر قراءة تفاصيل الحذف.');
          return;
        }

        if (diagnostics.isBlocked) {
          this.showMessage('warn', diagnostics.decisionReason ?? 'لا يمكن حذف العقدة في حالتها الحالية.');
          return;
        }

        const confirmationMessage = this.buildCategoryDeleteConfirmationMessage(diagnostics);
        if (!window.confirm(confirmationMessage)) {
          return;
        }

        this.adminCatalogController.deleteCategory(selected.categoryId).subscribe({
          next: deleteResponse => {
            if (!this.ensureSuccess(deleteResponse, 'تعذر حذف العقدة.')) {
              return;
            }

            this.handleCategoryDeleteResult(selected.categoryId, deleteResponse.data);
          },
          error: () => this.showMessage('error', 'حدث خطأ أثناء حذف العقدة.'),
          complete: () => { this.deletingCategory = false; }
        });
      },
      error: () => {
        this.showMessage('error', 'حدث خطأ أثناء تشخيص حذف العقدة.');
        this.deletingCategory = false;
      }
    });
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

  onCategoryTreeNodeSelect(): void {
    const selected = this.selectedCategory;
    if (!selected) {
      return;
    }

    this.editingCategoryId = selected.categoryId;
    this.categoryForm.reset(
      {
        categoryName: selected.categoryName,
        parentCategoryId: this.toNonNegativeInt(selected.parentCategoryId),
        isActive: selected.isActive
      },
      { emitEvent: false }
    );

    this.activePhase = 2;
    this.persistCatalogContextCache(selected.categoryId, this.selectedApplicationId);
    this.prepareNewGroup();
    this.selectedGroupNode = null;
    this.editingGroupId = null;
    this.loadGroupsByCategory(selected.categoryId);
  }

  onSaveCategory(): void {
    if (!this.selectedApplicationId) {
      this.showMessage('warn', 'اختر تطبيقًا أولًا قبل إدارة الشجرة.');
      return;
    }

    this.categoryForm.markAllAsTouched();
    if (!this.canSaveCategory) {
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
      const request: AdminCatalogCategoryUpdateRequestDto = { categoryName, parentCategoryId, isActive };
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
        error: () => this.showMessage('error', 'حدث خطأ أثناء تعديل عنصر الشجرة.'),
        complete: () => { this.savingCategory = false; }
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
      error: () => this.showMessage('error', 'حدث خطأ أثناء إنشاء عنصر الشجرة.'),
      complete: () => { this.savingCategory = false; }
    });
  }

  onStartCreateGroup(): void {
    const suggestedParentId = this.selectedGroup ? this.toPositiveInt(this.selectedGroup.groupId) : null;
    this.prepareNewGroup(suggestedParentId);
  }

  onStartEditSelectedGroup(): void {
    const selected = this.selectedGroup;
    if (!selected) {
      this.showMessage('warn', 'اختر مجموعة أولًا للتعديل.');
      return;
    }

    this.editingGroupId = selected.groupId;
    this.groupForm.reset(
      {
        groupName: selected.groupName,
        groupDescription: selected.groupDescription ?? '',
        parentGroupId: this.toPositiveInt(selected.parentGroupId),
        displayOrder: this.toNonNegativeInt(selected.displayOrder),
        isActive: selected.isActive
      },
      { emitEvent: false }
    );
  }

  onDeleteSelectedGroup(): void {
    const selected = this.selectedGroup;
    if (!selected || this.deletingGroup) {
      this.showMessage('warn', 'اختر مجموعة أولًا للحذف.');
      return;
    }

    const confirmationMessage = [
      `سيتم حذف المجموعة: ${selected.groupName} (#${selected.groupId}).`,
      'إذا كان للمجموعة أبناء فلن يتم الحذف.',
      'هل تريد المتابعة؟'
    ].join('\n');

    if (!window.confirm(confirmationMessage)) {
      return;
    }

    this.deletingGroup = true;
    this.adminCatalogController.deleteGroup(selected.groupId).subscribe({
      next: response => {
        if (!this.ensureSuccess(response, 'تعذر حذف المجموعة.')) {
          return;
        }

        this.showMessage('success', response.data?.message ?? 'تم حذف المجموعة بنجاح.');
        this.prepareNewGroup();

        const categoryId = this.selectedCategoryId;
        if (categoryId) {
          this.loadGroupsByCategory(categoryId);
        }
      },
      error: () => this.showMessage('error', 'حدث خطأ أثناء حذف المجموعة.'),
      complete: () => { this.deletingGroup = false; }
    });
  }

  onSaveGroup(): void {
    const selectedApplicationId = this.selectedApplicationId;
    const selectedCategoryId = this.selectedCategoryId;
    if (!selectedApplicationId || !selectedCategoryId) {
      this.showMessage('warn', 'اختر تطبيقًا وعقدة أولًا قبل إدارة المجموعات.');
      return;
    }

    this.groupForm.markAllAsTouched();
    if (!this.canSaveGroup) {
      return;
    }

    const groupName = this.normalizeString(this.groupForm.get('groupName')?.value);
    const groupDescription = this.normalizeString(this.groupForm.get('groupDescription')?.value);
    const parentGroupId = this.toPositiveInt(this.groupForm.get('parentGroupId')?.value);
    const displayOrder = this.toNonNegativeInt(this.groupForm.get('displayOrder')?.value);
    const isActive = this.groupForm.get('isActive')?.value === true;

    if (!groupName) {
      this.showMessage('warn', 'اسم المجموعة مطلوب.');
      return;
    }

    const parentError = this.validateGroupParent(parentGroupId);
    if (parentError) {
      this.showMessage('warn', parentError);
      return;
    }

    this.savingGroup = true;

    if (this.editingGroupId != null) {
      const request: AdminCatalogGroupUpdateRequestDto = {
        groupName,
        groupDescription: groupDescription ?? undefined,
        parentGroupId: parentGroupId ?? undefined,
        displayOrder,
        isActive
      };

      this.adminCatalogController.updateGroup(this.editingGroupId, request).subscribe({
        next: response => {
          if (!this.ensureSuccess(response, 'تعذر تعديل المجموعة.')) {
            return;
          }

          const updatedGroupId = response.data?.groupId ?? this.editingGroupId;
          this.showMessage('success', 'تم تعديل المجموعة بنجاح.');
          this.prepareNewGroup(parentGroupId);
          this.loadGroupsByCategory(selectedCategoryId, updatedGroupId);
        },
        error: () => this.showMessage('error', 'حدث خطأ أثناء تعديل المجموعة.'),
        complete: () => { this.savingGroup = false; }
      });

      return;
    }

    const createRequest: AdminCatalogGroupCreateRequestDto = {
      categoryId: selectedCategoryId,
      applicationId: selectedApplicationId,
      groupName,
      groupDescription: groupDescription ?? undefined,
      parentGroupId: parentGroupId ?? undefined,
      displayOrder,
      isActive
    };

    this.adminCatalogController.createGroup(createRequest).subscribe({
      next: response => {
        if (!this.ensureSuccess(response, 'تعذر إنشاء المجموعة.')) {
          return;
        }

        const createdGroupId = response.data?.groupId ?? null;
        this.showMessage('success', 'تم إنشاء المجموعة بنجاح.');
        this.prepareNewGroup(parentGroupId);
        this.loadGroupsByCategory(selectedCategoryId, createdGroupId);
      },
      error: () => this.showMessage('error', 'حدث خطأ أثناء إنشاء المجموعة.'),
      complete: () => { this.savingGroup = false; }
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
          this.clearGroupsState();
          return;
        }

        this.applications = [...(response.data ?? [])];

        const preferred = this.normalizeString(preferredApplicationId);
        const hasPreferred = preferred
          ? this.applications.some(item => item.applicationId === preferred)
          : false;

        if (hasPreferred) {
          this.selectedApplicationId = preferred;
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
          this.clearGroupsState();
          return;
        }

        this.loadCategoryTree(this.selectedApplicationId);
      },
      error: () => {
        this.applications = [];
        this.selectedApplicationId = null;
        this.clearTreeState();
        this.clearGroupsState();
        this.showMessage('error', 'حدث خطأ أثناء تحميل التطبيقات.');
      },
      complete: () => { this.loadingApplications = false; }
    });
  }

  private loadCategoryTree(applicationId: string, preferredCategoryId?: number | null): void {
    this.loadingTree = true;

    this.adminCatalogController.getCategoryTree(applicationId).subscribe({
      next: response => {
        if (!this.ensureSuccess(response, 'تعذر تحميل شجرة الأنواع من قاعدة البيانات.')) {
          this.clearTreeState();
          this.clearGroupsState();
          return;
        }

        const categories = response.data ?? [];
        this.rebuildCategoryIndex(categories);
        this.rebuildCategoryTreeNodes(categories);

        const targetCategoryId = preferredCategoryId ?? this.selectedCategoryId ?? this.editingCategoryId;
        if (targetCategoryId && this.categoryTreeNodeIndex.has(targetCategoryId)) {
          this.selectedCategoryNode = this.categoryTreeNodeIndex.get(targetCategoryId) ?? null;
          const selectedCategory = this.selectedCategory;
          this.persistCatalogContextCache(selectedCategory?.categoryId ?? null, this.selectedApplicationId);
        } else {
          this.selectedCategoryNode = null;
          this.persistCatalogContextCache(null, this.selectedApplicationId);
          this.activePhase = 1;
          this.clearGroupsState();
        }
      },
      error: () => {
        this.clearTreeState();
        this.clearGroupsState();
        this.showMessage('error', 'حدث خطأ أثناء تحميل الشجرة.');
      },
      complete: () => { this.loadingTree = false; }
    });
  }

  private loadGroupsByCategory(categoryId: number, preferredGroupId?: number | null): void {
    if (categoryId <= 0) {
      this.clearGroupsState();
      return;
    }

    this.loadingGroups = true;

    this.adminCatalogController.getGroupsByCategory(categoryId).subscribe({
      next: response => {
        if (!this.ensureSuccess(response, 'تعذر تحميل المجموعات الخاصة بالعقدة المختارة.')) {
          this.clearGroupsState();
          return;
        }

        const groups = response.data ?? [];
        this.groupsLoadedForCategoryId = categoryId;
        this.rebuildGroupIndex(groups);
        this.rebuildGroupTreeNodes(groups);
        this.buildGroupParentOptions();

        const targetGroupId = preferredGroupId ?? this.toPositiveInt(this.selectedGroup?.groupId) ?? this.editingGroupId;
        if (targetGroupId && this.groupTreeNodeIndex.has(targetGroupId)) {
          this.selectedGroupNode = this.groupTreeNodeIndex.get(targetGroupId) ?? null;
        } else {
          this.selectedGroupNode = null;
        }
      },
      error: () => {
        this.clearGroupsState();
        this.showMessage('error', 'حدث خطأ أثناء تحميل المجموعات.');
      },
      complete: () => { this.loadingGroups = false; }
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

  private rebuildCategoryTreeNodes(nodes: ReadonlyArray<AdminCatalogCategoryTreeNodeDto>): void {
    this.categoryTreeNodeIndex.clear();
    this.categoryTree = this.mapCategoryTreeNodes(nodes, true);
    this.parentPickerTree = this.mapCategoryTreeNodes(nodes, false);
  }

  private mapCategoryTreeNodes(nodes: ReadonlyArray<AdminCatalogCategoryTreeNodeDto>, withIndex: boolean): TreeNode[] {
    return (nodes ?? []).map(node => {
      const label = node.isActive
        ? `${node.categoryName} (#${node.categoryId})`
        : `${node.categoryName} (#${node.categoryId}) - غير مفعل`;

      const mapped: TreeNode = {
        label,
        data: node,
        expanded: true,
        children: this.mapCategoryTreeNodes(node.children ?? [], withIndex)
      };

      if (withIndex) {
        this.categoryTreeNodeIndex.set(node.categoryId, mapped);
      }

      return mapped;
    });
  }

  private rebuildGroupIndex(nodes: ReadonlyArray<AdminCatalogGroupTreeNodeDto>): void {
    this.groupIndex.clear();
    this.groupPathIndex.clear();

    const walk = (items: ReadonlyArray<AdminCatalogGroupTreeNodeDto>, parentPath: string): void => {
      for (const item of items ?? []) {
        const nextPath = parentPath.length > 0
          ? `${parentPath} / ${item.groupName}`
          : item.groupName;

        this.groupIndex.set(item.groupId, item);
        this.groupPathIndex.set(item.groupId, `${nextPath} (#${item.groupId})`);
        walk(item.children ?? [], nextPath);
      }
    };

    walk(nodes, '');
  }

  private rebuildGroupTreeNodes(nodes: ReadonlyArray<AdminCatalogGroupTreeNodeDto>): void {
    this.groupTreeNodeIndex.clear();
    this.groupTree = this.mapGroupTreeNodes(nodes, true);
  }

  private mapGroupTreeNodes(nodes: ReadonlyArray<AdminCatalogGroupTreeNodeDto>, withIndex: boolean): TreeNode[] {
    return (nodes ?? []).map(node => {
      const label = node.isActive
        ? `${node.groupName} (#${node.groupId})`
        : `${node.groupName} (#${node.groupId}) - غير مفعل`;

      const mapped: TreeNode = {
        label,
        data: node,
        expanded: true,
        children: this.mapGroupTreeNodes(node.children ?? [], withIndex)
      };

      if (withIndex) {
        this.groupTreeNodeIndex.set(node.groupId, mapped);
      }

      return mapped;
    });
  }

  private buildGroupParentOptions(): void {
    const options: ParentGroupOption[] = [{ label: 'بدون مجموعة أم (مجموعة رئيسية)', value: null }];

    for (const [groupId, path] of this.groupPathIndex.entries()) {
      options.push({ label: path, value: groupId });
    }

    options.sort((left, right) => {
      if (left.value == null) {
        return -1;
      }

      if (right.value == null) {
        return 1;
      }

      return left.label.localeCompare(right.label, 'ar');
    });

    this.groupParentOptions = options;
  }

  private validateGroupParent(candidateParentGroupId: number | null): string | null {
    if (this.editingGroupId == null || candidateParentGroupId == null) {
      return null;
    }

    if (candidateParentGroupId === this.editingGroupId) {
      return 'لا يمكن اختيار نفس المجموعة كأب لها.';
    }

    if (this.isDescendantOfEditingGroup(candidateParentGroupId)) {
      return 'لا يمكن اختيار مجموعة ابنة كأب للمجموعة الحالية.';
    }

    return null;
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

  private isDescendantOfEditingGroup(candidateGroupId: number): boolean {
    if (this.editingGroupId == null) {
      return false;
    }

    const editingGroup = this.groupIndex.get(this.editingGroupId);
    if (!editingGroup) {
      return false;
    }

    const descendants = new Set<number>();
    const walk = (items: ReadonlyArray<AdminCatalogGroupTreeNodeDto>): void => {
      for (const item of items ?? []) {
        descendants.add(item.groupId);
        walk(item.children ?? []);
      }
    };

    walk(editingGroup.children ?? []);
    return descendants.has(this.toNonNegativeInt(candidateGroupId));
  }

  private handleApplicationDeleteResult(applicationId: string, result: AdminCatalogDeleteResultDto | undefined): void {
    const message = this.normalizeString(result?.message)
      ?? (result?.mode === 'soft' ? 'تم حذف التطبيق حذفًا منطقيًا.' : 'تم حذف التطبيق حذفًا نهائيًا.');

    this.showMessage('success', message);

    if (this.selectedApplicationId === applicationId) {
      this.selectedApplicationId = null;
      this.clearTreeState();
      this.clearGroupsState();
      this.prepareNewCategory();
      this.prepareNewGroup();
      this.activePhase = 1;
    }

    this.prepareNewApplication();
    this.loadApplications(this.selectedApplicationId);
  }

  private handleCategoryDeleteResult(categoryId: number, result: AdminCatalogDeleteResultDto | undefined): void {
    const message = this.normalizeString(result?.message)
      ?? (result?.mode === 'soft' ? 'تم حذف العقدة حذفًا منطقيًا.' : 'تم حذف العقدة حذفًا نهائيًا.');

    this.showMessage('success', message);

    if (this.selectedCategoryId === categoryId) {
      this.selectedCategoryNode = null;
      this.clearGroupsState();
      this.prepareNewGroup();
      this.activePhase = 1;
    }

    this.prepareNewCategory();
    if (this.selectedApplicationId) {
      this.loadCategoryTree(this.selectedApplicationId);
    }
  }

  private buildApplicationDeleteConfirmationMessage(diagnostics: AdminCatalogApplicationDeleteDiagnosticsDto): string {
    const modeLabel = diagnostics.canHardDelete ? 'حذف نهائي' : 'حذف منطقي';
    return [
      `سيتم تنفيذ: ${modeLabel}`,
      `التطبيق: ${diagnostics.applicationId}`,
      `روابط أنواع الطلب: ${diagnostics.linkedCategoriesCount}`,
      `روابط الحقول: ${diagnostics.linkedFieldsCount}`,
      `روابط المجموعات: ${diagnostics.linkedGroupsCount}`,
      diagnostics.decisionReason ?? '',
      'هل تريد المتابعة؟'
    ].filter(item => item.trim().length > 0).join('\n');
  }

  private buildCategoryDeleteConfirmationMessage(diagnostics: AdminCatalogCategoryDeleteDiagnosticsDto): string {
    const modeLabel = diagnostics.canHardDelete ? 'حذف نهائي' : 'حذف منطقي';
    return [
      `سيتم تنفيذ: ${modeLabel}`,
      `العقد الفرعية الفعالة: ${diagnostics.childrenCount}`,
      `روابط الحقول: ${diagnostics.linkedFieldsCount}`,
      `روابط الطلبات/الرسائل: ${diagnostics.linkedMessagesCount}`,
      `روابط المجموعات: ${diagnostics.linkedGroupsCount}`,
      diagnostics.decisionReason ?? '',
      'هل تريد المتابعة؟'
    ].filter(item => item.trim().length > 0).join('\n');
  }

  private clearTreeState(): void {
    this.categoryTree = [];
    this.parentPickerTree = [];
    this.selectedCategoryNode = null;
    this.categoryIndex.clear();
    this.categoryPathIndex.clear();
    this.categoryTreeNodeIndex.clear();
  }

  private clearGroupsState(): void {
    this.groupTree = [];
    this.selectedGroupNode = null;
    this.groupParentOptions = [{ label: 'بدون مجموعة أم (مجموعة رئيسية)', value: null }];
    this.groupsLoadedForCategoryId = null;
    this.groupIndex.clear();
    this.groupPathIndex.clear();
    this.groupTreeNodeIndex.clear();
  }

  private prepareNewApplication(): void {
    this.editingApplicationId = null;
    this.applicationForm.reset(
      { applicationId: '', applicationName: '', isActive: true },
      { emitEvent: false }
    );
  }

  private prepareNewCategory(defaultParentCategoryId = 0): void {
    this.editingCategoryId = null;
    this.categoryForm.reset(
      { categoryName: '', parentCategoryId: this.toNonNegativeInt(defaultParentCategoryId), isActive: true },
      { emitEvent: false }
    );
  }

  private prepareNewGroup(defaultParentGroupId: number | null = null): void {
    this.editingGroupId = null;
    this.groupForm.reset(
      { groupName: '', groupDescription: '', parentGroupId: defaultParentGroupId, displayOrder: 0, isActive: true },
      { emitEvent: false }
    );
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

  private toPositiveInt(value: unknown): number | null {
    const normalized = Number(value ?? 0);
    if (!Number.isFinite(normalized) || normalized <= 0) {
      return null;
    }

    return Math.trunc(normalized);
  }

  private normalizeString(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : null;
  }

  private persistCatalogContextCache(categoryId: number | null, applicationId: string | null): void {
    const normalizedCategoryId = this.toPositiveInt(categoryId);
    const normalizedApplicationId = this.normalizeString(applicationId);
    if (!normalizedCategoryId && !normalizedApplicationId) {
      return;
    }

    const payload = {
      categoryId: normalizedCategoryId,
      applicationId: normalizedApplicationId
    };

    localStorage.setItem(AdminControlCenterCatalogPageComponent.CATALOG_CONTEXT_STORAGE_KEY, JSON.stringify(payload));
  }
}
