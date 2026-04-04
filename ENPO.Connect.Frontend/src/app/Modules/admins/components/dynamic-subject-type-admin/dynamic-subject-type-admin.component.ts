import { DOCUMENT } from '@angular/common';
import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MenuItem, TreeDragDropService, TreeNode } from 'primeng/api';
import { GenericFormsService, GroupInfo } from 'src/app/Modules/GenericComponents/GenericForms.service';
import { ComponentConfig } from 'src/app/shared/models/Component.Config.model';
import { MessageDto } from 'src/app/shared/services/BackendServices/AdministrativeCertificate/AdministrativeCertificate.dto';
import { CdCategoryMandDto, CdmendDto } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.dto';
import { FileParameter } from 'src/app/shared/services/BackendServices/dto-shared';
import { forkJoin } from 'rxjs';
import { DynamicSubjectsController } from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.service';
import {
  SubjectAdminFieldDto,
  SubjectAdminGroupDto,
  SubjectCategoryFieldLinkAdminDto,
  SubjectCategoryFieldLinkUpsertItemDto,
  SubjectFieldDefinitionDto,
  SubjectFormDefinitionDto,
  SubjectTypeAdminCreateRequestDto,
  SubjectTypeAdminDto,
  SubjectTypeAdminUpdateRequestDto,
  SubjectTypeAdminUpsertRequestDto
} from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.dto';
import { AppNotificationService } from 'src/app/shared/services/notifications/app-notification.service';

interface AdminTreeNode extends TreeNode {
  key: string;
  data: SubjectTypeAdminDto;
  children?: AdminTreeNode[];
}

interface PreviewFieldRenderItem {
  controlName: string;
  definition: SubjectFieldDefinitionDto;
}

interface PreviewGroupRenderItem {
  groupId: number;
  groupName: string;
  fields: PreviewFieldRenderItem[];
}

interface PreviewInspectionItem {
  mendSql: number;
  groupName: string;
  fieldKey: string;
  fieldLabel: string;
  isVisible: boolean;
  isFieldActive: boolean;
  inPreview: boolean;
  reason: string;
}

interface PreviewInspectionSummary {
  totalLinked: number;
  visibleLinked: number;
  hiddenLinked: number;
  inactiveDefinitions: number;
  missingDefinitions: number;
  includedInPreview: number;
  excludedFromPreview: number;
  items: PreviewInspectionItem[];
}

@Component({
  selector: 'app-dynamic-subject-type-admin',
  templateUrl: './dynamic-subject-type-admin.component.html',
  styleUrls: ['./dynamic-subject-type-admin.component.scss'],
  providers: [TreeDragDropService]
})
export class DynamicSubjectTypeAdminComponent implements OnInit, OnDestroy {
  readonly managementMode: boolean;

  loading = false;
  savingCategory = false;
  savingSettings = false;
  savingLinks = false;
  loadingLinks = false;
  loadingPreview = false;
  previewDiagnosticsVisible = false;

  readonly tabOverviewIndex = 0;
  readonly tabEditIndex = 1;
  readonly tabGroupsIndex = 2;
  readonly tabPreviewIndex = 3;

  activeTabIndex = this.tabOverviewIndex;

  categoryTree: AdminTreeNode[] = [];
  categoryItems: SubjectTypeAdminDto[] = [];
  selectedCategoryNode: AdminTreeNode | null = null;
  selectedCategory: SubjectTypeAdminDto | null = null;
  contextMenuNode: AdminTreeNode | null = null;
  treeContextMenuItems: MenuItem[] = [];

  allFields: SubjectAdminFieldDto[] = [];
  groups: SubjectAdminGroupDto[] = [];
  editableLinks: SubjectCategoryFieldLinkAdminDto[] = [];

  groupFieldDraft: Record<number, string> = {};
  focusedGroupId: number | null = null;
  showFieldLibrary = false;

  previewDefinition: SubjectFormDefinitionDto | null = null;
  previewForm: FormGroup;
  previewGroups: PreviewGroupRenderItem[] = [];
  previewTicketForm: FormGroup;
  previewDynamicGroups: GroupInfo[] = [];
  previewCategoryMand: CdCategoryMandDto[] = [];
  readonly previewMessageDto: MessageDto = {} as MessageDto;
  readonly previewEmptyTree: any[] = [];
  readonly previewEmptyCategoryTree: TreeNode[] = [];
  readonly previewEmptyFiles: FileParameter[] = [];
  readonly previewFormConfig: ComponentConfig;

  categoryForm: FormGroup;
  settingsForm: FormGroup;
  groupForm: FormGroup;
  createCategoryForm: FormGroup;

  relationsDialogVisible = false;
  groupDialogVisible = false;
  createCategoryDialogVisible = false;
  editingGroupId: number | null = null;
  private workspaceRequestSeq = 0;
  private groupsRequestSeq = 0;
  private fieldsRequestSeq = 0;
  private linksRequestSeq = 0;
  private previewRequestSeq = 0;
  private readonly expandedNodeKeys = new Set<string>();

  constructor(
    @Inject(DOCUMENT) private readonly document: Document,
    private readonly fb: FormBuilder,
    private readonly activatedRoute: ActivatedRoute,
    public readonly genericFormService: GenericFormsService,
    private readonly dynamicSubjectsController: DynamicSubjectsController,
    private readonly appNotification: AppNotificationService
  ) {
    const routePath = String(this.activatedRoute.snapshot.routeConfig?.path ?? '').trim().toLowerCase();
    this.managementMode = routePath === 'dynamicsubjectmanagement';

    this.previewForm = this.fb.group({});
    this.previewTicketForm = this.fb.group({});

    this.categoryForm = this.fb.group({
      categoryName: ['', [Validators.required, Validators.maxLength(50)]],
      applicationId: ['', Validators.maxLength(10)],
      catMend: [''],
      catWorkFlow: [0, [Validators.required, Validators.min(0)]],
      catSms: [false],
      catMailNotification: [false],
      to: ['', Validators.maxLength(100)],
      cc: ['', Validators.maxLength(100)],
      isActive: [true]
    });

    this.settingsForm = this.fb.group({
      referencePolicyEnabled: [true],
      referencePrefix: ['', Validators.maxLength(40)],
      referenceSeparator: ['-', Validators.maxLength(10)],
      sourceFieldKeys: ['', Validators.maxLength(500)],
      includeYear: [true],
      useSequence: [true],
      sequenceName: ['Seq_Tickets', Validators.maxLength(80)]
    });

    this.groupForm = this.fb.group({
      groupName: ['', [Validators.required, Validators.maxLength(100)]],
      groupDescription: ['', Validators.maxLength(255)],
      isExtendable: [false],
      groupWithInRow: [1, [Validators.required, Validators.min(1), Validators.max(12)]]
    });

    this.createCategoryForm = this.fb.group({
      parentCategoryId: [0, Validators.min(0)],
      categoryName: ['', [Validators.required, Validators.maxLength(50)]],
      applicationId: ['', Validators.maxLength(10)],
      catMend: [''],
      catWorkFlow: [0, [Validators.required, Validators.min(0)]],
      catSms: [false],
      catMailNotification: [false],
      to: ['', Validators.maxLength(100)],
      cc: ['', Validators.maxLength(100)],
      isActive: [true]
    });

    this.previewFormConfig = new ComponentConfig({
      routeKey: 'DynamicSubjectTypes/Preview',
      isNew: false,
      showViewToggle: false,
      formDisplayOption: 'tabs',
      submitButtonText: 'معاينة',
      fieldsConfiguration: {
        isDivDisabled: true,
        dateFormat: 'yy/mm/dd',
        showTime: false,
        timeOnly: false,
        maxDate: new Date(),
        useDefaultRadioView: true,
        isNotRequired: true
      },
      attachmentConfig: {
        showAttachmentSection: false,
        AllowedExtensions: [],
        maximumFileSize: 2,
        maxFileCount: 0,
        isMandatory: false,
        allowAdd: false,
        allowMultiple: false
      }
    });
  }

  ngOnInit(): void {
    this.document.body.classList.add('dynamic-subject-admin-page');
    if (this.managementMode) {
      this.document.body.classList.add('dynamic-subject-admin-management-page');
    }
    this.initializeTreeContextMenu();
    this.loadWorkspace();
  }

  ngOnDestroy(): void {
    this.document.body.classList.remove('dynamic-subject-admin-page');
    this.document.body.classList.remove('dynamic-subject-admin-management-page');
  }

  get linkedGroups(): SubjectAdminGroupDto[] {
    const selectedCategoryId = Number(this.selectedCategory?.categoryId ?? 0);
    const linkedGroupIds = new Set(
      (this.editableLinks ?? [])
        .filter(item => this.isLinkForCategory(item, selectedCategoryId))
        .map(item => Number(item.groupId ?? 0))
        .filter(groupId => Number.isFinite(groupId) && groupId > 0)
    );

    return (this.groups ?? [])
      .filter(group => linkedGroupIds.has(group.groupId))
      .sort((a, b) => String(a.groupName || '').localeCompare(String(b.groupName || '')));
  }

  get groupsForRelations(): SubjectAdminGroupDto[] {
    return this.linkedGroups;
  }

  get managementGroupsForRelations(): SubjectAdminGroupDto[] {
    return [...(this.groups ?? [])]
      .sort((a, b) => String(a.groupName || '').localeCompare(String(b.groupName || '')));
  }

  get unlinkedFieldsCount(): number {
    return this.getUnlinkedSelectableFields().length;
  }

  get unlinkedSelectableFields(): SubjectAdminFieldDto[] {
    return this.getUnlinkedSelectableFields();
  }

  get previewInspection(): PreviewInspectionSummary {
    const selectedCategoryId = Number(this.selectedCategory?.categoryId ?? 0);
    const links = (this.editableLinks ?? [])
      .filter(link => this.isLinkForCategory(link, selectedCategoryId))
      .sort((a, b) => Number(a.groupId ?? 0) - Number(b.groupId ?? 0) || Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0));

    const previewLinksSet = new Set(
      (this.previewDefinition?.fields ?? [])
        .map(field => Number(field.mendSql ?? 0))
        .filter(mendSql => mendSql > 0)
    );

    const items: PreviewInspectionItem[] = links.map(link => {
      const fieldKey = String(link.fieldKey ?? '').trim();
      const field = this.allFields.find(item => String(item.fieldKey ?? '').trim().toLowerCase() === fieldKey.toLowerCase());
      const isFieldActive = field ? Boolean(field.isActive) : false;
      const inPreview = previewLinksSet.has(Number(link.mendSql ?? 0));

      let reason = 'مدرج في المعاينة';
      if (!link.isVisible) {
        reason = 'مخفي في إعدادات العرض (IsVisible = false)';
      } else if (!field) {
        reason = 'تعريف الحقل غير موجود في مكتبة الحقول';
      } else if (!isFieldActive) {
        reason = 'تعريف الحقل غير مفعل';
      } else if (!inPreview) {
        reason = 'مستبعد من استجابة المعاينة';
      }

      return {
        mendSql: Number(link.mendSql ?? 0),
        groupName: this.getGroupName(Number(link.groupId ?? 0)),
        fieldKey,
        fieldLabel: this.getFieldDisplayName(link.fieldKey),
        isVisible: Boolean(link.isVisible),
        isFieldActive,
        inPreview,
        reason
      };
    });

    const totalLinked = items.length;
    const visibleLinked = items.filter(item => item.isVisible).length;
    const hiddenLinked = totalLinked - visibleLinked;
    const missingDefinitions = items.filter(item => item.fieldKey.length > 0 && item.reason.includes('غير موجود')).length;
    const inactiveDefinitions = items.filter(item => item.fieldKey.length > 0 && !item.isFieldActive && !item.reason.includes('غير موجود')).length;
    const includedInPreview = items.filter(item => item.inPreview).length;
    const excludedFromPreview = totalLinked - includedInPreview;

    return {
      totalLinked,
      visibleLinked,
      hiddenLinked,
      inactiveDefinitions,
      missingDefinitions,
      includedInPreview,
      excludedFromPreview,
      items
    };
  }

  get selectedParentName(): string {
    if (!this.selectedCategory || this.selectedCategory.parentCategoryId <= 0) {
      return 'جذر';
    }

    const parent = this.categoryItems.find(item => item.categoryId === this.selectedCategory!.parentCategoryId);
    return parent?.categoryName || `#${this.selectedCategory.parentCategoryId}`;
  }

  loadWorkspace(preferredCategoryId?: number): void {
    this.loading = true;
    const requestSeq = ++this.workspaceRequestSeq;
    const retainedCategoryId = this.selectedCategory?.categoryId ?? 0;

    forkJoin({
      categories: this.dynamicSubjectsController.getAdminCategoryTree(),
      fields: this.dynamicSubjectsController.getAdminFields(),
      groups: this.dynamicSubjectsController.getAdminGroups()
    }).subscribe({
      next: result => {
        if (requestSeq !== this.workspaceRequestSeq) {
          return;
        }

        if (result.categories?.errors?.length) {
          this.appNotification.showApiErrors(result.categories.errors, 'تعذر تحميل شجرة الأنواع.');
          return;
        }

        if (result.fields?.errors?.length) {
          this.appNotification.showApiErrors(result.fields.errors, 'تعذر تحميل الحقول.');
        }

        if (result.groups?.errors?.length) {
          this.appNotification.showApiErrors(result.groups.errors, 'تعذر تحميل الجروبات.');
        }

        this.categoryItems = result.categories?.data ?? [];
        this.allFields = result.fields?.data ?? [];
        this.groups = result.groups?.data ?? [];

        this.categoryTree = this.buildCategoryTree(this.categoryItems);

        if (this.categoryTree.length === 0) {
          this.linksRequestSeq++;
          this.previewRequestSeq++;
          this.selectedCategory = null;
          this.selectedCategoryNode = null;
          this.contextMenuNode = null;
          this.previewDefinition = null;
          this.previewGroups = [];
          this.previewForm = this.fb.group({});
          this.previewTicketForm = this.fb.group({});
          this.previewDynamicGroups = [];
          this.previewCategoryMand = [];
          this.editableLinks = [];
          this.relationsDialogVisible = false;
          this.loadingLinks = false;
          this.loadingPreview = false;
          return;
        }

        const targetCategoryId = Number(preferredCategoryId ?? 0) > 0
          ? Number(preferredCategoryId)
          : retainedCategoryId;
        const targetNode = targetCategoryId > 0
          ? this.findNodeByKey(this.categoryTree, String(targetCategoryId))
          : null;

        const nodeToSelect = targetNode ?? this.categoryTree[0];
        this.selectCategoryNode(nodeToSelect);
      },
      error: () => {
        if (requestSeq === this.workspaceRequestSeq) {
          this.appNotification.error('حدث خطأ أثناء تحميل لوحة الإدارة.');
        }
      },
      complete: () => {
        if (requestSeq === this.workspaceRequestSeq) {
          this.loading = false;
        }
      }
    });
  }

  onCategoryNodeSelect(event: { node?: AdminTreeNode }): void {
    if (!event?.node) {
      return;
    }

    this.selectCategoryNode(event.node);
  }

  onCategoryNodeContextMenu(event: { node?: AdminTreeNode }): void {
    if (!event?.node) {
      return;
    }

    this.contextMenuNode = event.node;
    this.selectCategoryNode(event.node);
  }

  onTreeNodeExpand(event: { node?: AdminTreeNode }): void {
    const expandedKey = String(event?.node?.key ?? '').trim();
    if (expandedKey.length > 0) {
      this.expandedNodeKeys.add(expandedKey);
    }

    this.syncTreeViewport(undefined, { ensureVisible: false });
  }

  onTreeNodeCollapse(event: { node?: AdminTreeNode }): void {
    const collapsedKey = String(event?.node?.key ?? '').trim();
    if (collapsedKey.length > 0) {
      this.expandedNodeKeys.delete(collapsedKey);
    }

    const collapsedNode = event?.node;
    const selectedNode = this.selectedCategoryNode;
    if (collapsedNode && selectedNode && selectedNode.key !== collapsedNode.key && this.isNodeInBranch(collapsedNode, selectedNode.key)) {
      this.selectCategoryNode(collapsedNode);
      return;
    }

    this.syncTreeViewport(undefined, { ensureVisible: false });
  }

  openCreateCategoryDialog(parentNode?: AdminTreeNode | null): void {
    const parentCategoryId = Number(parentNode?.data?.categoryId ?? 0);
    const parentApplicationId = String(parentNode?.data?.applicationId ?? '').trim();

    this.createCategoryForm.reset({
      parentCategoryId: parentCategoryId > 0 ? parentCategoryId : 0,
      categoryName: '',
      applicationId: parentApplicationId,
      catMend: '',
      catWorkFlow: 0,
      catSms: false,
      catMailNotification: false,
      to: '',
      cc: '',
      isActive: true
    });

    this.createCategoryDialogVisible = true;
  }

  createCategory(): void {
    if (this.createCategoryForm.invalid) {
      this.createCategoryForm.markAllAsTouched();
      this.appNotification.warning('يرجى استكمال بيانات النوع قبل الإنشاء.');
      return;
    }

    const value = this.createCategoryForm.value;
    const payload: SubjectTypeAdminCreateRequestDto = {
      parentCategoryId: Number(value.parentCategoryId ?? 0),
      categoryName: String(value.categoryName ?? '').trim(),
      applicationId: String(value.applicationId ?? '').trim() || undefined,
      catMend: String(value.catMend ?? '').trim() || undefined,
      catWorkFlow: Number(value.catWorkFlow ?? 0),
      catSms: Boolean(value.catSms),
      catMailNotification: Boolean(value.catMailNotification),
      to: String(value.to ?? '').trim() || undefined,
      cc: String(value.cc ?? '').trim() || undefined,
      isActive: Boolean(value.isActive)
    };

    this.savingCategory = true;
    this.dynamicSubjectsController.createAdminCategory(payload).subscribe({
      next: response => {
        if (response?.errors?.length) {
          this.appNotification.showApiErrors(response.errors, 'تعذر إنشاء النوع.');
          return;
        }

        const createdId = Number(response?.data?.categoryId ?? 0);
        this.createCategoryDialogVisible = false;
        this.appNotification.success('تم إنشاء النوع بنجاح.');
        this.loadWorkspace(createdId > 0 ? createdId : undefined);

        if (createdId > 0) {
          this.activeTabIndex = this.tabEditIndex;
        }
      },
      error: () => {
        this.appNotification.error('حدث خطأ أثناء إنشاء النوع.');
      },
      complete: () => {
        this.savingCategory = false;
      }
    });
  }

  saveCategory(): void {
    if (!this.selectedCategory) {
      return;
    }

    if (this.categoryForm.invalid) {
      this.categoryForm.markAllAsTouched();
      this.appNotification.warning('يرجى استكمال البيانات الأساسية قبل الحفظ.');
      return;
    }

    const value = this.categoryForm.value;
    const payload: SubjectTypeAdminUpdateRequestDto = {
      categoryName: String(value.categoryName ?? '').trim(),
      applicationId: String(value.applicationId ?? '').trim() || undefined,
      catMend: String(value.catMend ?? '').trim() || undefined,
      catWorkFlow: Number(value.catWorkFlow ?? 0),
      catSms: Boolean(value.catSms),
      catMailNotification: Boolean(value.catMailNotification),
      to: String(value.to ?? '').trim() || undefined,
      cc: String(value.cc ?? '').trim() || undefined,
      isActive: Boolean(value.isActive)
    };

    this.savingCategory = true;
    this.dynamicSubjectsController.updateAdminCategory(this.selectedCategory.categoryId, payload).subscribe({
      next: response => {
        if (response?.errors?.length) {
          this.appNotification.showApiErrors(response.errors, 'تعذر حفظ بيانات النوع.');
          return;
        }

        this.appNotification.success('تم حفظ البيانات الأساسية للنوع.');
        this.loadWorkspace(this.selectedCategory?.categoryId);
      },
      error: () => {
        this.appNotification.error('حدث خطأ أثناء حفظ بيانات النوع.');
      },
      complete: () => {
        this.savingCategory = false;
      }
    });
  }

  saveCategorySettings(): void {
    if (!this.selectedCategory) {
      return;
    }

    if (this.settingsForm.invalid) {
      this.settingsForm.markAllAsTouched();
      this.appNotification.warning('يرجى استكمال إعدادات النوع قبل الحفظ.');
      return;
    }

    const value = this.settingsForm.value;
    const referencePolicyEnabled = Boolean(value.referencePolicyEnabled);
    const referencePrefix = String(value.referencePrefix ?? '').trim();
    const useSequence = Boolean(value.useSequence);
    const sequenceName = String(value.sequenceName ?? '').trim();

    if (referencePolicyEnabled && referencePrefix.length === 0) {
      this.settingsForm.get('referencePrefix')?.setErrors({ required: true });
      this.settingsForm.get('referencePrefix')?.markAsTouched();
      this.appNotification.warning('يرجى إدخال بادئة المرجع عند تفعيل سياسة الترقيم.');
      return;
    }

    if (useSequence && sequenceName.length === 0) {
      this.settingsForm.get('sequenceName')?.setErrors({ required: true });
      this.settingsForm.get('sequenceName')?.markAsTouched();
      this.appNotification.warning('يرجى إدخال اسم التسلسل عند تفعيل التسلسل الرقمي.');
      return;
    }

    const payload: SubjectTypeAdminUpsertRequestDto = {
      isActive: Boolean(this.categoryForm.get('isActive')?.value),
      referencePolicyEnabled,
      referencePrefix: referencePrefix || undefined,
      referenceSeparator: String(value.referenceSeparator ?? '-').trim() || '-',
      sourceFieldKeys: String(value.sourceFieldKeys ?? '').trim() || undefined,
      includeYear: Boolean(value.includeYear),
      useSequence,
      sequenceName: sequenceName || undefined
    };

    this.savingSettings = true;
    this.dynamicSubjectsController.upsertSubjectTypeAdminConfig(this.selectedCategory.categoryId, payload).subscribe({
      next: response => {
        if (response?.errors?.length) {
          this.appNotification.showApiErrors(response.errors, 'تعذر حفظ إعدادات النوع.');
          return;
        }

        this.appNotification.success('تم حفظ إعدادات النوع بنجاح.');
        this.loadWorkspace(this.selectedCategory?.categoryId);
      },
      error: () => {
        this.appNotification.error('حدث خطأ أثناء حفظ إعدادات النوع.');
      },
      complete: () => {
        this.savingSettings = false;
      }
    });
  }

  deleteCategory(target?: SubjectTypeAdminDto | null): void {
    const category = target ?? this.selectedCategory;
    if (!category) {
      return;
    }

    const confirmed = window.confirm(`هل أنت متأكد من حذف النوع "${category.categoryName}"؟`);
    if (!confirmed) {
      return;
    }

    this.dynamicSubjectsController.deleteAdminCategory(category.categoryId).subscribe({
      next: response => {
        if (response?.errors?.length) {
          this.appNotification.showApiErrors(response.errors, 'تعذر حذف النوع.');
          return;
        }

        this.appNotification.success('تم تنفيذ حذف النوع بنجاح.');
        this.loadWorkspace();
      },
      error: () => {
        this.appNotification.error('حدث خطأ أثناء حذف النوع.');
      }
    });
  }

  onCategoryTreeDrop(event: any): void {
    const draggedId = Number(event?.dragNode?.key ?? 0);
    if (!draggedId) {
      return;
    }

    const location = this.findNodeLocation(this.categoryTree, String(draggedId));
    if (!location) {
      this.loadWorkspace(this.selectedCategory?.categoryId);
      return;
    }

    if (!this.validateCategoryMoveTarget(draggedId, location.parentId)) {
      this.appNotification.warning('لا يمكن إسقاط النوع داخل نفسه أو داخل أحد أبنائه.');
      if (typeof event?.reject === 'function') {
        event.reject();
      }
      this.loadWorkspace(this.selectedCategory?.categoryId);
      return;
    }

    this.dynamicSubjectsController.moveAdminCategory(draggedId, {
      newParentCategoryId: location.parentId,
      newIndex: location.index
    }).subscribe({
      next: response => {
        if (response?.errors?.length) {
          this.appNotification.showApiErrors(response.errors, 'تعذر نقل النوع داخل الشجرة.');
          this.loadWorkspace(this.selectedCategory?.categoryId);
          return;
        }

        this.categoryItems = response?.data ?? [];
        this.categoryTree = this.buildCategoryTree(this.categoryItems);

        const movedNode = this.findNodeByKey(this.categoryTree, String(draggedId));
        if (movedNode) {
          this.selectCategoryNode(movedNode);
        }

        this.appNotification.success('تم تحديث تبعية وترتيب النوع بنجاح.');
      },
      error: () => {
        this.appNotification.error('حدث خطأ أثناء نقل النوع داخل الشجرة.');
        this.loadWorkspace(this.selectedCategory?.categoryId);
      }
    });
  }

  onFieldsChanged(): void {
    this.reloadFieldsAndCurrentCategoryLinks();
  }

  onMainTabChange(event: { index?: number } | null | undefined): void {
    const selectedIndex = Number(event?.index ?? -1);
    if (selectedIndex !== this.tabPreviewIndex || !this.selectedCategory) {
      return;
    }

    this.rebuildFinalPreviewForm();
    this.loadPreview(this.selectedCategory.categoryId, this.selectedCategory.applicationId || undefined);
  }

  openRelationsDialog(options?: { focusGroupId?: number; scroll?: boolean }): void {
    if (this.managementMode) {
      return;
    }

    this.relationsDialogVisible = true;
    const focusGroupId = Number(options?.focusGroupId ?? 0);
    if (focusGroupId > 0) {
      this.focusedGroupId = focusGroupId;
      if (options?.scroll) {
        this.scrollGroupIntoViewport(focusGroupId, 'smooth');
      }
    }
  }

  openCreateGroupDialog(): void {
    this.editingGroupId = null;
    this.groupForm.reset({
      groupName: '',
      groupDescription: '',
      isExtendable: false,
      groupWithInRow: 1
    });
    this.groupDialogVisible = true;
  }

  openEditGroupDialog(group: SubjectAdminGroupDto): void {
    this.editingGroupId = group.groupId;
    this.groupForm.reset({
      groupName: group.groupName || '',
      groupDescription: group.groupDescription || '',
      isExtendable: group.isExtendable,
      groupWithInRow: group.groupWithInRow ?? 1
    });
    this.groupDialogVisible = true;
  }

  saveGroup(): void {
    if (this.groupForm.invalid) {
      this.groupForm.markAllAsTouched();
      this.appNotification.warning('يرجى استكمال بيانات الجروب قبل الحفظ.');
      return;
    }

    const value = this.groupForm.value;
    const payload = {
      groupName: String(value.groupName ?? '').trim(),
      groupDescription: String(value.groupDescription ?? '').trim() || undefined,
      isExtendable: Boolean(value.isExtendable),
      groupWithInRow: Number(value.groupWithInRow ?? 1)
    };

    const request$ = this.editingGroupId
      ? this.dynamicSubjectsController.updateAdminGroup(this.editingGroupId, payload)
      : this.dynamicSubjectsController.createAdminGroup(payload);

    request$.subscribe({
      next: response => {
        if (response?.errors?.length) {
          this.appNotification.showApiErrors(response.errors, 'تعذر حفظ بيانات الجروب.');
          return;
        }

        const savedGroupId = Number(response?.data?.groupId ?? 0);

        this.groupDialogVisible = false;
        this.loadGroups();

        if (this.selectedCategory) {
          this.loadLinks(this.selectedCategory.categoryId);
          this.loadPreview(this.selectedCategory.categoryId, this.selectedCategory.applicationId || undefined);
        }

        if (savedGroupId > 0) {
          this.groupFieldDraft[savedGroupId] = '';
          if (!this.managementMode) {
            this.openRelationsDialog({ focusGroupId: savedGroupId, scroll: false });
          }
          setTimeout(() => this.focusGroup(savedGroupId, { activateRelationsTab: false, scroll: false }), 180);
        }

        this.appNotification.success('تم حفظ الجروب بنجاح.');
      },
      error: () => {
        this.appNotification.error('حدث خطأ أثناء حفظ الجروب.');
      }
    });
  }

  deleteGroup(group: SubjectAdminGroupDto): void {
    const confirmed = window.confirm(`هل أنت متأكد من حذف الجروب "${group.groupName || group.groupId}"؟`);
    if (!confirmed) {
      return;
    }

    this.dynamicSubjectsController.deleteAdminGroup(group.groupId).subscribe({
      next: response => {
        if (response?.errors?.length) {
          this.appNotification.showApiErrors(response.errors, 'تعذر حذف الجروب.');
          return;
        }

        this.loadGroups();
        if (this.selectedCategory) {
          this.loadLinks(this.selectedCategory.categoryId);
          this.loadPreview(this.selectedCategory.categoryId, this.selectedCategory.applicationId || undefined);
        }

        this.appNotification.success('تم حذف الجروب بنجاح.');
      },
      error: () => {
        this.appNotification.error('حدث خطأ أثناء حذف الجروب.');
      }
    });
  }

  getGroupLinks(groupId: number): SubjectCategoryFieldLinkAdminDto[] {
    const selectedCategoryId = Number(this.selectedCategory?.categoryId ?? 0);
    return (this.editableLinks ?? [])
      .filter(item =>
        this.isLinkForCategory(item, selectedCategoryId)
        && Number(item.groupId ?? 0) === Number(groupId)
        && String(item.fieldKey ?? '').trim().length > 0)
      .sort((a, b) => Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0));
  }

  getGroupLinkedFieldsCount(groupId: number): number {
    return this.getGroupLinks(groupId).length;
  }

  toAvailableFieldOptions(groupId: number): Array<{ label: string; value: string }> {
    return this.getAvailableFieldsForGroup(groupId).map(field => ({
      label: `${field.fieldLabel || field.fieldKey} (${field.fieldKey})`,
      value: field.fieldKey
    }));
  }

  addFieldToGroup(groupId: number): void {
    if (!this.selectedCategory) {
      return;
    }

    const selectedFieldKey = String(this.groupFieldDraft[groupId] ?? '').trim();
    if (!selectedFieldKey) {
      this.appNotification.warning('يرجى اختيار حقل قبل الإضافة إلى الجروب.');
      return;
    }

    const duplicated = this.editableLinks.some(item =>
      String(item.fieldKey ?? '').trim().toLowerCase() === selectedFieldKey.toLowerCase());
    if (duplicated) {
      this.appNotification.warning('هذا الحقل مربوط بالفعل داخل هذا النوع.');
      return;
    }

    const fieldMeta = this.selectableFields.find(item =>
      String(item.fieldKey ?? '').trim().toLowerCase() === selectedFieldKey.toLowerCase());
    if (!fieldMeta) {
      this.appNotification.warning('الحقل المختار غير متاح.');
      return;
    }

    const nextOrder = this.getNextDisplayOrderForGroup(groupId);
    this.editableLinks = [
      ...this.editableLinks,
      {
        mendSql: 0,
        categoryId: this.selectedCategory.categoryId,
        fieldKey: fieldMeta.fieldKey,
        fieldLabel: fieldMeta.fieldLabel,
        fieldType: fieldMeta.fieldType,
        groupId,
        groupName: this.getGroupName(groupId),
        isActive: true,
        displayOrder: nextOrder,
        isVisible: true,
        displaySettingsJson: undefined,
        applicationId: fieldMeta.applicationId
      }
    ];

    this.groupFieldDraft[groupId] = '';
    this.focusGroup(groupId, { scroll: false });
    this.rebuildFinalPreviewForm();
  }

  onDisplayOrderInput(groupId: number): void {
    this.normalizeGroupDisplayOrder(groupId);
    this.rebuildFinalPreviewForm();
  }

  moveLinkWithinGroup(groupId: number, link: SubjectCategoryFieldLinkAdminDto, direction: -1 | 1): void {
    const links = this.getGroupLinks(groupId);
    const index = links.findIndex(item => this.isSameLink(item, link));
    if (index < 0) {
      return;
    }

    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= links.length) {
      return;
    }

    const sourceOrder = links[index].displayOrder;
    links[index].displayOrder = links[targetIndex].displayOrder;
    links[targetIndex].displayOrder = sourceOrder;

    this.normalizeGroupDisplayOrder(groupId);
    this.rebuildFinalPreviewForm();
  }

  removeLinkFromGroup(link: SubjectCategoryFieldLinkAdminDto): void {
    const targetMendSql = Number(link.mendSql ?? 0);
    const targetFieldKey = String(link.fieldKey ?? '').trim().toLowerCase();
    const targetGroupId = Number(link.groupId ?? 0);

    this.editableLinks = this.editableLinks.filter(item => {
      const itemMendSql = Number(item.mendSql ?? 0);
      if (targetMendSql > 0 && itemMendSql > 0) {
        return itemMendSql !== targetMendSql;
      }

      return !(
        Number(item.groupId ?? 0) === targetGroupId
        && String(item.fieldKey ?? '').trim().toLowerCase() === targetFieldKey
      );
    });

    this.normalizeGroupDisplayOrder(targetGroupId);
    this.rebuildFinalPreviewForm();
  }

  saveLinks(): void {
    const category = this.selectedCategory;
    if (!category) {
      return;
    }

    const duplicatedField = this.findDuplicateFieldKey(this.editableLinks);
    if (duplicatedField) {
      this.appNotification.warning(`الحقل ${duplicatedField} مكرر أكثر من مرة داخل نفس النوع.`);
      return;
    }

    const invalidLink = this.editableLinks.find(item =>
      String(item.fieldKey ?? '').trim().length === 0 || Number(item.groupId ?? 0) <= 0);
    if (invalidLink) {
      this.appNotification.warning('جميع روابط الحقول يجب أن تحتوي على حقل وجروب صحيحين.');
      return;
    }

    const normalizedLinks = this.normalizeLinksByGroup();
    const payloadLinks: SubjectCategoryFieldLinkUpsertItemDto[] = normalizedLinks.map(item => ({
      mendSql: item.mendSql > 0 ? item.mendSql : undefined,
      fieldKey: String(item.fieldKey ?? '').trim(),
      groupId: Number(item.groupId),
      isActive: Boolean(item.isActive),
      displayOrder: Number(item.displayOrder ?? 0) > 0 ? Number(item.displayOrder) : 1,
      isVisible: Boolean(item.isVisible),
      displaySettingsJson: String(item.displaySettingsJson ?? '').trim() || undefined
    }));

    this.savingLinks = true;
    this.dynamicSubjectsController.upsertAdminCategoryFieldLinks(category.categoryId, { links: payloadLinks }).subscribe({
      next: response => {
        if (response?.errors?.length) {
          this.appNotification.showApiErrors(response.errors, 'تعذر حفظ ربط الحقول بالجروبات.');
          return;
        }

        this.editableLinks = this.getEditableActiveLinks(response?.data ?? [], category.categoryId);
        this.normalizeLinksByGroup();
        this.applyGroupMetadataToLinks();
        this.rebuildFinalPreviewForm();
        if (this.selectedCategory?.categoryId === category.categoryId) {
          this.loadPreview(category.categoryId, category.applicationId || undefined);
        }
        this.appNotification.success('تم حفظ الربط بين الحقول والجروبات بنجاح.');
      },
      error: () => {
        this.appNotification.error('حدث خطأ أثناء حفظ الربط.');
      },
      complete: () => {
        this.savingLinks = false;
      }
    });
  }

  toggleFieldLibrary(): void {
    this.showFieldLibrary = !this.showFieldLibrary;
  }

  scrollContainerBy(container: HTMLElement | null, delta: number): void {
    const target = this.resolveBestScrollTarget(container);
    if (!target) {
      window.scrollBy({ top: delta, behavior: 'smooth' });
      return;
    }

    const canScrollTarget = target.scrollHeight > (target.clientHeight + 2);
    if (canScrollTarget) {
      target.scrollBy({ top: delta, behavior: 'smooth' });
      return;
    }

    window.scrollBy({ top: delta, behavior: 'smooth' });
  }

  scrollContainerToTop(container: HTMLElement | null): void {
    const target = this.resolveBestScrollTarget(container);
    if (!target) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const canScrollTarget = target.scrollHeight > (target.clientHeight + 2);
    if (canScrollTarget) {
      target.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  scrollContainerToBottom(container: HTMLElement | null): void {
    const target = this.resolveBestScrollTarget(container);
    if (!target) {
      window.scrollTo({ top: this.document.documentElement.scrollHeight, behavior: 'smooth' });
      return;
    }

    const canScrollTarget = target.scrollHeight > (target.clientHeight + 2);
    if (canScrollTarget) {
      target.scrollTo({ top: target.scrollHeight, behavior: 'smooth' });
      return;
    }

    window.scrollTo({ top: this.document.documentElement.scrollHeight, behavior: 'smooth' });
  }

  onTabWheel(event: WheelEvent, container: HTMLElement | null): void {
    const target = this.resolveBestScrollTarget(container);
    if (!target) {
      return;
    }

    const maxScrollTop = Math.max(target.scrollHeight - target.clientHeight, 0);
    if (maxScrollTop <= 0) {
      return;
    }

    const nextTop = Math.max(0, Math.min(target.scrollTop + event.deltaY, maxScrollTop));
    if (nextTop === target.scrollTop) {
      return;
    }

    target.scrollTop = nextTop;
    event.preventDefault();
    event.stopPropagation();
  }

  focusGroup(groupId: number, options?: { activateRelationsTab?: boolean; scroll?: boolean; behavior?: ScrollBehavior }): void {
    this.focusedGroupId = groupId;
    const activateRelationsTab = options?.activateRelationsTab ?? true;
    if (activateRelationsTab && !this.managementMode) {
      this.openRelationsDialog({ focusGroupId: groupId, scroll: options?.scroll });
      return;
    }

    if (options?.scroll) {
      this.scrollGroupIntoViewport(groupId, options.behavior ?? 'smooth');
    }
  }

  getGroupName(groupId: number): string {
    const group = this.groups.find(item => item.groupId === groupId);
    if (group?.groupName && group.groupName.trim().length > 0) {
      return group.groupName;
    }

    return `جروب #${groupId}`;
  }

  getFieldDisplayName(fieldKey: string | undefined): string {
    const key = String(fieldKey ?? '').trim();
    if (!key) {
      return '-';
    }

    const field = this.allFields.find(item => String(item.fieldKey ?? '').trim().toLowerCase() === key.toLowerCase());
    return field?.fieldLabel?.trim() || key;
  }

  getFieldTypeDisplay(fieldType: string | undefined): string {
    const normalized = this.normalizeType(fieldType);
    if (normalized.includes('textarea')) {
      return 'نص طويل';
    }

    if (normalized.includes('drop')) {
      return 'قائمة منسدلة';
    }

    if (normalized.includes('radio')) {
      return 'اختيار واحد';
    }

    if (normalized.includes('check') || normalized.includes('bool')) {
      return 'قيمة منطقية';
    }

    if (normalized.includes('date')) {
      return 'تاريخ';
    }

    if (normalized.includes('number') || normalized.includes('int') || normalized.includes('decimal')) {
      return 'رقم';
    }

    return fieldType || 'غير محدد';
  }

  isSelectField(definition: SubjectFieldDefinitionDto): boolean {
    const normalized = this.normalizeType(definition.fieldType);
    return normalized.includes('select') || normalized.includes('drop') || normalized.includes('combo') || normalized.includes('radio');
  }

  isBooleanField(definition: SubjectFieldDefinitionDto): boolean {
    const normalized = this.normalizeType(definition.fieldType);
    return normalized.includes('bool') || normalized.includes('check') || normalized.includes('toggle');
  }

  isTextareaField(definition: SubjectFieldDefinitionDto): boolean {
    return this.normalizeType(definition.fieldType).includes('textarea');
  }

  isDateField(definition: SubjectFieldDefinitionDto): boolean {
    const normalized = this.normalizeType(definition.fieldType);
    return normalized.includes('date') || normalized.includes('calendar');
  }

  isNumberField(definition: SubjectFieldDefinitionDto): boolean {
    const normalized = this.normalizeType(definition.fieldType);
    return normalized.includes('number') || normalized.includes('decimal') || normalized.includes('int');
  }

  parseFieldOptions(definition: SubjectFieldDefinitionDto): Array<{ label: string; value: string }> {
    const payload = String(definition.optionsPayload ?? '').trim();
    if (!payload) {
      return [];
    }

    try {
      const parsed = JSON.parse(payload);
      if (Array.isArray(parsed)) {
        return parsed
          .map(item => {
            if (item == null) {
              return null;
            }

            if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
              const value = String(item);
              return { label: value, value };
            }

            const hasKeyValuePair = Object.prototype.hasOwnProperty.call(item, 'key')
              && Object.prototype.hasOwnProperty.call(item, 'value')
              && !Object.prototype.hasOwnProperty.call(item, 'label');
            if (hasKeyValuePair) {
              const key = String((item as any).key ?? '').trim();
              const label = String((item as any).value ?? '').trim();
              if (key.length === 0 && label.length === 0) {
                return null;
              }

              return {
                value: key || label,
                label: label || key
              };
            }

            const value = String((item as any).value ?? (item as any).id ?? (item as any).key ?? (item as any).label ?? (item as any).name ?? '');
            const label = String((item as any).label ?? (item as any).name ?? (item as any).text ?? (item as any).value ?? value);
            if (!value && !label) {
              return null;
            }

            return {
              label: label || value,
              value: value || label
            };
          })
          .filter((item): item is { label: string; value: string } => item !== null);
      }

      if (parsed && typeof parsed === 'object') {
        return Object.entries(parsed)
          .map(([key, value]) => ({
            value: String(key ?? '').trim(),
            label: String(value ?? '').trim() || String(key ?? '').trim()
          }))
          .filter(item => item.value.length > 0 || item.label.length > 0)
          .map(item => ({
            value: item.value || item.label,
            label: item.label || item.value
          }));
      }
    } catch {
      // fallback to tokenized text
    }

    return payload
      .split(/[|,;\n]+/g)
      .map(item => item.trim())
      .filter(item => item.length > 0)
      .map(item => ({ label: item, value: item }));
  }

  getPreviewGroupTitle(group: PreviewGroupRenderItem): string {
    const title = String(group.groupName ?? '').trim();
    return title.length > 0 ? title : `مجموعة ${group.groupId}`;
  }

  isInvalid(form: FormGroup, controlName: string): boolean {
    const control = form.get(controlName);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  getValidationMessage(form: FormGroup, controlName: string, label: string): string {
    const control = form.get(controlName);
    if (!control?.errors) {
      return '';
    }

    if (control.errors['required']) {
      return `${label} مطلوب.`;
    }

    if (control.errors['maxlength']) {
      return `${label} يجب ألا يزيد عن ${control.errors['maxlength'].requiredLength} حرفًا.`;
    }

    if (control.errors['min']) {
      return `${label} يجب أن يكون ${control.errors['min'].min} أو أكبر.`;
    }

    if (control.errors['max']) {
      return `${label} يجب أن يكون ${control.errors['max'].max} أو أقل.`;
    }

    return `قيمة ${label} غير صالحة.`;
  }

  hasRequiredError(form: FormGroup, controlName: string): boolean {
    const control = form.get(controlName);
    return !!control?.errors?.['required'] && (control.touched || control.dirty);
  }

  trackByGroupId(_index: number, group: SubjectAdminGroupDto): number {
    return group.groupId;
  }

  trackByLink(index: number, item: SubjectCategoryFieldLinkAdminDto): string {
    const mendSql = Number(item.mendSql ?? 0);
    if (mendSql > 0) {
      return `m-${mendSql}`;
    }

    return `${item.groupId}-${item.fieldKey}-${index}`;
  }

  trackByPreviewInspection(_index: number, item: PreviewInspectionItem): string {
    const mendSql = Number(item.mendSql ?? 0);
    if (mendSql > 0) {
      return `p-${mendSql}`;
    }

    return `${item.groupName}-${item.fieldKey}`;
  }

  private initializeTreeContextMenu(): void {
    this.treeContextMenuItems = [
      {
        label: 'إضافة طلب ابن',
        icon: 'pi pi-plus',
        command: () => {
          this.openCreateCategoryDialog(this.contextMenuNode);
        }
      },
      {
        label: 'تعديل الطلب الحالي',
        icon: 'pi pi-pencil',
        command: () => {
          if (!this.contextMenuNode) {
            return;
          }

          this.selectCategoryNode(this.contextMenuNode);
          this.activeTabIndex = this.tabEditIndex;
        }
      },
      {
        separator: true
      },
      {
        label: 'حذف الطلب',
        icon: 'pi pi-trash',
        command: () => {
          if (!this.contextMenuNode?.data) {
            return;
          }

          this.deleteCategory(this.contextMenuNode.data);
        }
      }
    ];
  }

  private selectCategoryNode(node: AdminTreeNode): void {
    this.markNodeBranchExpanded(node.key);
    this.applyExpandedState(this.categoryTree);

    this.selectedCategoryNode = node;
    this.selectedCategory = node.data;
    this.contextMenuNode = node;
    this.focusedGroupId = null;
    this.previewTicketForm = this.fb.group({});
    this.previewDynamicGroups = [];
    this.previewCategoryMand = [];

    this.categoryForm.patchValue({
      categoryName: node.data.categoryName,
      applicationId: node.data.applicationId || '',
      catMend: node.data.catMend || '',
      catWorkFlow: node.data.catWorkFlow,
      catSms: node.data.catSms,
      catMailNotification: node.data.catMailNotification,
      to: node.data.to || '',
      cc: node.data.cc || '',
      isActive: node.data.isActive
    });

    this.settingsForm.patchValue({
      referencePolicyEnabled: node.data.referencePolicyEnabled,
      referencePrefix: node.data.referencePrefix || `SUBJ${node.data.categoryId}`,
      referenceSeparator: node.data.referenceSeparator || '-',
      sourceFieldKeys: node.data.sourceFieldKeys || '',
      includeYear: node.data.includeYear,
      useSequence: node.data.useSequence,
      sequenceName: node.data.sequenceName || 'Seq_Tickets'
    });

    this.loadLinks(node.data.categoryId);
    this.loadPreview(node.data.categoryId, node.data.applicationId || undefined);
    this.syncTreeViewport(node.key, { ensureVisible: true, behavior: 'auto' });
  }

  private buildCategoryTree(items: SubjectTypeAdminDto[]): AdminTreeNode[] {
    const byId = new Map<number, AdminTreeNode>();

    (items ?? []).forEach(item => {
      byId.set(item.categoryId, {
        key: String(item.categoryId),
        label: item.categoryName,
        expanded: this.expandedNodeKeys.has(String(item.categoryId)) || Number(item.parentCategoryId ?? 0) <= 0,
        data: item,
        icon: item.isActive ? 'pi pi-folder' : 'pi pi-folder-open',
        children: []
      });
    });

    const roots: AdminTreeNode[] = [];

    (items ?? []).forEach(item => {
      const current = byId.get(item.categoryId);
      if (!current) {
        return;
      }

      const parent = byId.get(item.parentCategoryId);
      if (!parent) {
        roots.push(current);
        return;
      }

      parent.children = parent.children || [];
      parent.children.push(current);
    });

    const sorter = (a: AdminTreeNode, b: AdminTreeNode) => {
      const orderDiff = Number(a.data.displayOrder ?? 0) - Number(b.data.displayOrder ?? 0);
      if (orderDiff !== 0) {
        return orderDiff;
      }

      return String(a.label ?? '').localeCompare(String(b.label ?? ''));
    };

    const sortChildren = (nodes: AdminTreeNode[]) => {
      nodes.sort(sorter);
      nodes.forEach(node => {
        if (node.children && node.children.length > 0) {
          sortChildren(node.children);
        }
      });
    };

    sortChildren(roots);
    return roots;
  }

  private loadGroups(): void {
    const requestSeq = ++this.groupsRequestSeq;
    this.dynamicSubjectsController.getAdminGroups().subscribe({
      next: response => {
        if (requestSeq !== this.groupsRequestSeq) {
          return;
        }

        if (response?.errors?.length) {
          this.appNotification.showApiErrors(response.errors, 'تعذر تحميل الجروبات.');
          return;
        }

        this.groups = response?.data ?? [];
        this.applyGroupMetadataToLinks();
        this.rebuildFinalPreviewForm();
      },
      error: () => {
        if (requestSeq !== this.groupsRequestSeq) {
          return;
        }

        this.appNotification.error('حدث خطأ أثناء تحميل الجروبات.');
      }
    });
  }

  private reloadFieldsAndCurrentCategoryLinks(): void {
    const requestSeq = ++this.fieldsRequestSeq;
    this.dynamicSubjectsController.getAdminFields().subscribe({
      next: response => {
        if (requestSeq !== this.fieldsRequestSeq) {
          return;
        }

        if (response?.errors?.length) {
          this.appNotification.showApiErrors(response.errors, 'تعذر تحديث قائمة الحقول.');
          return;
        }

        this.allFields = response?.data ?? [];
        this.rebuildFinalPreviewForm();
        if (this.selectedCategory) {
          this.loadLinks(this.selectedCategory.categoryId);
          this.loadPreview(this.selectedCategory.categoryId, this.selectedCategory.applicationId || undefined);
        }
      },
      error: () => {
        if (requestSeq !== this.fieldsRequestSeq) {
          return;
        }

        this.appNotification.error('حدث خطأ أثناء تحديث قائمة الحقول.');
      }
    });
  }

  private loadLinks(categoryId: number): void {
    const requestSeq = ++this.linksRequestSeq;
    this.loadingLinks = true;
    const normalizedCategoryId = Number(categoryId ?? 0);
    this.dynamicSubjectsController.getAdminCategoryFieldLinks(categoryId).subscribe({
      next: response => {
        const selectedCategoryId = Number(this.selectedCategory?.categoryId ?? 0);
        if (requestSeq !== this.linksRequestSeq || selectedCategoryId !== normalizedCategoryId) {
          return;
        }

        if (response?.errors?.length) {
          this.editableLinks = [];
          this.rebuildFinalPreviewForm();
          this.appNotification.showApiErrors(response.errors, 'تعذر تحميل ربط الحقول بالجروبات.');
          return;
        }

        this.editableLinks = this.getEditableActiveLinks(response?.data ?? [], categoryId);
        this.normalizeLinksByGroup();
        this.applyGroupMetadataToLinks();
        this.rebuildFinalPreviewForm();
      },
      error: () => {
        const selectedCategoryId = Number(this.selectedCategory?.categoryId ?? 0);
        if (requestSeq !== this.linksRequestSeq || selectedCategoryId !== normalizedCategoryId) {
          return;
        }

        this.editableLinks = [];
        this.rebuildFinalPreviewForm();
        this.appNotification.error('حدث خطأ أثناء تحميل ربط الحقول.');
      },
      complete: () => {
        if (requestSeq === this.linksRequestSeq) {
          this.loadingLinks = false;
        }
      }
    });
  }

  private loadPreview(categoryId: number, appId?: string): void {
    const requestSeq = ++this.previewRequestSeq;
    this.loadingPreview = true;
    const normalizedCategoryId = Number(categoryId ?? 0);
    this.dynamicSubjectsController.getAdminCategoryPreview(categoryId, appId).subscribe({
      next: response => {
        const selectedCategoryId = Number(this.selectedCategory?.categoryId ?? 0);
        if (requestSeq !== this.previewRequestSeq || selectedCategoryId !== normalizedCategoryId) {
          return;
        }

        if (response?.errors?.length) {
          this.previewDefinition = null;
          this.previewGroups = [];
          this.previewForm = this.fb.group({});
          this.appNotification.showApiErrors(response.errors, 'تعذر تحميل المعاينة.');
          return;
        }

        this.previewDefinition = response?.data ?? null;
        this.rebuildPreviewForm(this.previewDefinition);
      },
      error: () => {
        const selectedCategoryId = Number(this.selectedCategory?.categoryId ?? 0);
        if (requestSeq !== this.previewRequestSeq || selectedCategoryId !== normalizedCategoryId) {
          return;
        }

        this.previewDefinition = null;
        this.previewGroups = [];
        this.previewForm = this.fb.group({});
        this.appNotification.error('حدث خطأ أثناء تحميل المعاينة.');
      },
      complete: () => {
        if (requestSeq === this.previewRequestSeq) {
          this.loadingPreview = false;
        }
      }
    });
  }

  private rebuildPreviewForm(definition: SubjectFormDefinitionDto | null): void {
    const form = this.fb.group({});
    const groupsMap = new Map<number, PreviewFieldRenderItem[]>();

    (definition?.fields ?? []).forEach(field => {
      if (!field.isVisible) {
        return;
      }

      const controlName = `${field.fieldKey}__${field.mendGroup}__${field.mendSql}`;
      const defaultValue = this.resolvePreviewDefaultValue(field);
      form.addControl(controlName, this.fb.control(defaultValue));

      if (!groupsMap.has(field.mendGroup)) {
        groupsMap.set(field.mendGroup, []);
      }

      groupsMap.get(field.mendGroup)?.push({ controlName, definition: field });
    });

    const allGroupIds = [...new Set([
      ...(definition?.groups ?? []).map(group => group.groupId),
      ...Array.from(groupsMap.keys())
    ])];

    this.previewGroups = allGroupIds
      .map(groupId => {
        const meta = (definition?.groups ?? []).find(group => group.groupId === groupId);
        const fields = groupsMap.get(groupId) ?? [];

        return {
          groupId,
          groupName: meta?.groupName || '',
          fields
        };
      })
      .filter(group => group.fields.length > 0);

    this.previewForm = form;
  }

  getPreviewFormArrayControls(formArrayName: string): AbstractControl[] {
    const formArray = this.getPreviewFormArrayInstance(formArrayName);
    return formArray?.controls ?? [];
  }

  getPreviewFormArrayInstance(formArrayName: string): FormArray | null {
    try {
      return this.genericFormService.getFormArray(formArrayName, this.previewTicketForm) ?? null;
    } catch {
      return null;
    }
  }

  trackByPreviewGroup(_index: number, group: GroupInfo): number {
    return Number(group.groupId ?? 0);
  }

  private rebuildFinalPreviewForm(): void {
    if (this.managementMode) {
      this.previewTicketForm = this.fb.group({});
      this.previewDynamicGroups = [];
      this.previewCategoryMand = [];
      return;
    }

    const categoryId = Number(this.selectedCategory?.categoryId ?? 0);
    if (categoryId <= 0) {
      this.previewTicketForm = this.fb.group({});
      this.previewDynamicGroups = [];
      this.previewCategoryMand = [];
      return;
    }

    const activeLinks = (this.editableLinks ?? [])
      .filter(link => this.isLinkForCategory(link, categoryId))
      .filter(link => String(link.fieldKey ?? '').trim().length > 0)
      .sort((a, b) => Number(a.groupId ?? 0) - Number(b.groupId ?? 0) || Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0));

    if (activeLinks.length === 0) {
      this.previewTicketForm = this.fb.group({});
      this.previewDynamicGroups = [];
      this.previewCategoryMand = [];
      return;
    }

    const groupMeta = new Map<number, SubjectAdminGroupDto>();
    (this.groups ?? []).forEach(group => {
      groupMeta.set(group.groupId, group);
    });

    const previewCategoryMand: CdCategoryMandDto[] = activeLinks.map(link => {
      const groupId = Number(link.groupId ?? 0);
      const group = groupMeta.get(groupId);
      return {
        mendSql: Number(link.mendSql ?? 0),
        mendCategory: categoryId,
        mendField: String(link.fieldKey ?? '').trim(),
        mendStat: !Boolean(link.isActive),
        mendGroup: groupId,
        applicationId: this.selectedCategory?.applicationId || link.applicationId,
        groupName: group?.groupName || link.groupName || `جروب #${groupId}`,
        isExtendable: group?.isExtendable ?? false,
        groupWithInRow: group?.groupWithInRow ?? 2
      };
    });
    this.previewCategoryMand = previewCategoryMand;

    const seen = new Set<string>();
    const previewCdmend: CdmendDto[] = [];
    previewCategoryMand.forEach(link => {
      const key = String(link.mendField ?? '').trim().toLowerCase();
      if (!key || seen.has(key)) {
        return;
      }

      seen.add(key);
      const fieldKey = String(link.mendField ?? '').trim();
      const meta = this.allFields.find(field =>
        String(field.fieldKey ?? '').trim().toLowerCase() === key
      );
      previewCdmend.push(this.mapToLegacyCdmend(meta, fieldKey));
    });

    this.genericFormService.resetDynamicRuntimeState(false);
    this.genericFormService.cdmendDto = previewCdmend;
    this.genericFormService.cdCategoryMandDto = previewCategoryMand;
    this.genericFormService.organizeFieldsByGroups(previewCategoryMand);

    this.previewDynamicGroups = [...(this.genericFormService.dynamicGroups ?? [])];
    this.previewTicketForm = this.genericFormService.createDynamicFormShell(this.previewDynamicGroups, {
      includeAttachments: false,
      createdBy: ''
    });

    this.previewDynamicGroups.forEach(group => {
      const formArray = this.getPreviewFormArrayInstance(group.formArrayName);
      if (!formArray) {
        return;
      }

      group.fields.forEach((field, index) => {
        const controlName = `${field.mendField}|${index}`;
        this.genericFormService.addFormArrayWithValidators(controlName, formArray, true);
      });
    });

    this.previewTicketForm.disable({ emitEvent: false });
  }

  private mapToLegacyCdmend(meta: SubjectAdminFieldDto | undefined, fieldKey: string): CdmendDto {
    const resolvedType = this.mapToLegacyFieldType(meta?.fieldType);
    const normalizedFieldKey = String(fieldKey ?? '').trim();
    return {
      cdmendSql: Number(meta?.cdmendSql ?? 0),
      cdmendType: resolvedType,
      cdmendTxt: normalizedFieldKey,
      cdMendLbl: String(meta?.fieldLabel ?? normalizedFieldKey).trim() || normalizedFieldKey,
      placeholder: meta?.placeholder ?? undefined,
      defaultValue: meta?.defaultValue ?? undefined,
      cdmendTbl: meta?.optionsPayload ?? undefined,
      cdmendDatatype: this.mapToLegacyDataType(meta?.dataType, resolvedType),
      required: Boolean(meta?.required),
      requiredTrue: Boolean(meta?.requiredTrue),
      email: Boolean(meta?.email),
      pattern: Boolean(meta?.pattern),
      min: undefined,
      max: undefined,
      minxLenght: undefined,
      maxLenght: undefined,
      cdmendmask: meta?.mask ?? undefined,
      cdmendStat: !Boolean(meta?.isActive ?? true),
      maxValue: meta?.maxValue ?? undefined,
      minValue: meta?.minValue ?? undefined,
      width: Number(meta?.width ?? 12),
      height: Number(meta?.height ?? 1),
      isDisabledInit: false,
      isSearchable: Boolean(meta?.isSearchable),
      applicationId: meta?.applicationId ?? undefined
    };
  }

  private mapToLegacyFieldType(fieldType: string | undefined): string {
    const normalized = this.normalizeType(fieldType);
    if (normalized.includes('label')) return 'LABLE';
    if (normalized.includes('domainuser')) return 'DomainUser';
    if (normalized.includes('file')) return 'FileUpload';
    if (normalized.includes('textarea') || normalized.includes('multiline')) return 'Textarea';
    if (normalized.includes('radio')) return 'RadioButton';
    if (normalized.includes('dropdown') || normalized.includes('select') || normalized.includes('combo')) return 'Dropdown';
    if (normalized.includes('tree')) return 'DropdownTree';
    if (normalized.includes('datetime') || (normalized.includes('date') && normalized.includes('time'))) return 'DateTime';
    if (normalized.includes('date')) return 'Date';
    if (normalized.includes('toggle') || normalized.includes('switch') || normalized.includes('check') || normalized.includes('bool')) return 'ToggleSwitch';
    if (normalized.includes('number') || normalized.includes('int') || normalized.includes('decimal')) return 'InputText-integeronly';
    return 'InputText';
  }

  private mapToLegacyDataType(dataType: string | undefined, resolvedType: string): string {
    const normalized = this.normalizeType(dataType);
    if (normalized.includes('number') || normalized.includes('int') || normalized.includes('decimal')) {
      return 'number';
    }
    if (normalized.includes('date') || resolvedType === 'Date' || resolvedType === 'DateTime') {
      return 'date';
    }
    if (resolvedType === 'InputText-integeronly') {
      return 'number';
    }
    return 'string';
  }

  private resolvePreviewDefaultValue(field: SubjectFieldDefinitionDto): unknown {
    if (this.isBooleanField(field)) {
      return String(field.defaultValue ?? '').toLowerCase() === 'true';
    }

    return field.defaultValue ?? '';
  }

  private get selectableFields(): SubjectAdminFieldDto[] {
    if (!this.selectedCategory) {
      return [];
    }

    const appId = String(this.selectedCategory.applicationId ?? '').trim().toLowerCase();
    return (this.allFields ?? [])
      .filter(field => {
        const fieldApp = String(field.applicationId ?? '').trim().toLowerCase();
        if (!appId) {
          return true;
        }

        return fieldApp.length === 0 || fieldApp === appId;
      })
      .sort((a, b) => String(a.fieldLabel || a.fieldKey).localeCompare(String(b.fieldLabel || b.fieldKey)));
  }

  private getUnlinkedSelectableFields(): SubjectAdminFieldDto[] {
    const linked = new Set(
      this.editableLinks
        .map(item => String(item.fieldKey ?? '').trim().toLowerCase())
        .filter(item => item.length > 0)
    );

    return this.selectableFields.filter(field => !linked.has(String(field.fieldKey ?? '').trim().toLowerCase()));
  }

  private getAvailableFieldsForGroup(_groupId: number): SubjectAdminFieldDto[] {
    return this.getUnlinkedSelectableFields();
  }

  private getNextDisplayOrderForGroup(groupId: number): number {
    const maxOrder = this.editableLinks
      .filter(item => Number(item.groupId ?? 0) === Number(groupId))
      .map(item => Number(item.displayOrder ?? 0))
      .reduce((acc, current) => (current > acc ? current : acc), 0);

    return maxOrder + 1;
  }

  private normalizeGroupDisplayOrder(groupId: number): void {
    const links = this.getGroupLinks(groupId)
      .sort((a, b) => Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0));

    links.forEach((item, idx) => {
      item.displayOrder = idx + 1;
    });
  }

  private normalizeLinksByGroup(): SubjectCategoryFieldLinkAdminDto[] {
    const selectedCategoryId = Number(this.selectedCategory?.categoryId ?? 0);
    const grouped = new Map<number, SubjectCategoryFieldLinkAdminDto[]>();
    const dedupPerGroup = new Map<number, Set<string>>();

    (this.editableLinks ?? []).forEach(rawLink => {
      if (!this.isLinkForCategory(rawLink, selectedCategoryId)) {
        return;
      }

      const groupId = Number(rawLink.groupId ?? 0);
      const fieldKey = String(rawLink.fieldKey ?? '').trim();
      if (groupId <= 0 || fieldKey.length === 0) {
        return;
      }

      if (!dedupPerGroup.has(groupId)) {
        dedupPerGroup.set(groupId, new Set<string>());
      }

      const mendSql = Number(rawLink.mendSql ?? 0);
      const dedupKey = mendSql > 0 ? `m:${mendSql}` : `f:${fieldKey.toLowerCase()}`;
      const groupDedupSet = dedupPerGroup.get(groupId)!;
      if (groupDedupSet.has(dedupKey)) {
        return;
      }
      groupDedupSet.add(dedupKey);

      if (!grouped.has(groupId)) {
        grouped.set(groupId, []);
      }
      grouped.get(groupId)?.push({
        ...rawLink,
        groupId,
        fieldKey
      });
    });

    const normalized: SubjectCategoryFieldLinkAdminDto[] = [];
    Array.from(grouped.entries())
      .sort((a, b) => a[0] - b[0])
      .forEach(([groupId, links]) => {
        links
          .sort((a, b) => Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0))
          .forEach((link, idx) => {
            const safeOrder = Number(link.displayOrder ?? 0) > 0 ? Number(link.displayOrder) : idx + 1;
            normalized.push({
              ...link,
              groupId,
              groupName: this.getGroupName(groupId),
              displayOrder: safeOrder,
              isActive: Boolean(link.isActive),
              isVisible: Boolean(link.isVisible)
            });
          });
      });

    this.editableLinks = normalized;
    return normalized;
  }

  private validateCategoryMoveTarget(draggedCategoryId: number, newParentCategoryId: number): boolean {
    if (draggedCategoryId <= 0) {
      return false;
    }

    if (draggedCategoryId === newParentCategoryId) {
      return false;
    }

    if (newParentCategoryId <= 0) {
      return true;
    }

    const descendants = this.getDescendantCategoryIds(draggedCategoryId);
    return !descendants.has(newParentCategoryId);
  }

  private getDescendantCategoryIds(categoryId: number): Set<number> {
    const byParent = new Map<number, number[]>();

    (this.categoryItems ?? []).forEach(item => {
      const parentId = Number(item.parentCategoryId ?? 0);
      const existing = byParent.get(parentId) ?? [];
      existing.push(item.categoryId);
      byParent.set(parentId, existing);
    });

    const result = new Set<number>();
    const queue: number[] = [categoryId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const children = byParent.get(current) ?? [];
      children.forEach(childId => {
        if (!result.has(childId)) {
          result.add(childId);
          queue.push(childId);
        }
      });
    }

    return result;
  }

  private findNodeLocation(
    nodes: AdminTreeNode[],
    key: string,
    parentId: number = 0
  ): { parentId: number; index: number } | null {
    for (let index = 0; index < nodes.length; index++) {
      const node = nodes[index];
      if (String(node.key) === key) {
        return { parentId, index };
      }

      if (node.children && node.children.length > 0) {
        const found = this.findNodeLocation(node.children, key, Number(node.key));
        if (found) {
          return found;
        }
      }
    }

    return null;
  }

  private findNodeByKey(nodes: AdminTreeNode[], key: string): AdminTreeNode | null {
    for (const node of nodes) {
      if (String(node.key) === key) {
        return node;
      }

      if (node.children?.length) {
        const found = this.findNodeByKey(node.children, key);
        if (found) {
          return found;
        }
      }
    }

    return null;
  }

  private findDuplicateFieldKey(items: SubjectCategoryFieldLinkAdminDto[]): string | null {
    const seen = new Set<string>();
    for (const item of items) {
      const key = String(item.fieldKey ?? '').trim().toLowerCase();
      if (!key) {
        continue;
      }

      if (seen.has(key)) {
        return item.fieldKey;
      }

      seen.add(key);
    }

    return null;
  }

  private normalizeType(type: string | undefined): string {
    return String(type ?? '').trim().toLowerCase();
  }

  private isSameLink(left: SubjectCategoryFieldLinkAdminDto, right: SubjectCategoryFieldLinkAdminDto): boolean {
    const leftMend = Number(left.mendSql ?? 0);
    const rightMend = Number(right.mendSql ?? 0);

    if (leftMend > 0 && rightMend > 0) {
      return leftMend === rightMend;
    }

    return Number(left.groupId ?? 0) === Number(right.groupId ?? 0)
      && String(left.fieldKey ?? '').trim().toLowerCase() === String(right.fieldKey ?? '').trim().toLowerCase();
  }

  private applyGroupMetadataToLinks(): void {
    const names = new Map<number, string>();
    (this.groups ?? []).forEach(group => {
      names.set(group.groupId, group.groupName?.trim() || `جروب #${group.groupId}`);
    });

    this.editableLinks = (this.editableLinks ?? []).map(link => ({
      ...link,
      groupName: names.get(Number(link.groupId ?? 0)) || link.groupName || `جروب #${link.groupId}`
    }));
  }

  private filterLinksByCategory(
    links: SubjectCategoryFieldLinkAdminDto[],
    categoryId: number
  ): SubjectCategoryFieldLinkAdminDto[] {
    const normalizedCategoryId = Number(categoryId ?? 0);
    if (normalizedCategoryId <= 0) {
      return [...(links ?? [])];
    }

    const hasExplicitCategory = (links ?? []).some(item => Number(item.categoryId ?? 0) > 0);
    if (!hasExplicitCategory) {
      return [...(links ?? [])];
    }

    return (links ?? []).filter(item => Number(item.categoryId ?? 0) === normalizedCategoryId);
  }

  private getEditableActiveLinks(
    links: SubjectCategoryFieldLinkAdminDto[],
    categoryId: number
  ): SubjectCategoryFieldLinkAdminDto[] {
    return this.filterLinksByCategory(links ?? [], categoryId)
      .filter(item => Boolean(item?.isActive) && String(item?.fieldKey ?? '').trim().length > 0);
  }

  private isLinkForCategory(link: SubjectCategoryFieldLinkAdminDto, selectedCategoryId: number): boolean {
    const normalizedCategoryId = Number(selectedCategoryId ?? 0);
    if (normalizedCategoryId <= 0) {
      return false;
    }

    const linkCategoryId = Number(link?.categoryId ?? 0);
    return linkCategoryId <= 0 || linkCategoryId === normalizedCategoryId;
  }

  private isNodeInBranch(root: AdminTreeNode, targetKey: string): boolean {
    if (String(root?.key ?? '') === String(targetKey ?? '')) {
      return true;
    }

    for (const child of root.children ?? []) {
      if (this.isNodeInBranch(child, targetKey)) {
        return true;
      }
    }

    return false;
  }

  private markNodeBranchExpanded(nodeKey: string): void {
    let currentCategoryId = Number(nodeKey ?? 0);
    if (currentCategoryId <= 0) {
      return;
    }

    const mapByCategoryId = new Map<number, SubjectTypeAdminDto>();
    (this.categoryItems ?? []).forEach(item => {
      mapByCategoryId.set(item.categoryId, item);
    });

    while (currentCategoryId > 0) {
      const asKey = String(currentCategoryId);
      this.expandedNodeKeys.add(asKey);

      const currentNode = mapByCategoryId.get(currentCategoryId);
      if (!currentNode || Number(currentNode.parentCategoryId ?? 0) <= 0) {
        break;
      }

      currentCategoryId = Number(currentNode.parentCategoryId);
    }
  }

  private applyExpandedState(nodes: AdminTreeNode[]): void {
    (nodes ?? []).forEach(node => {
      node.expanded = this.expandedNodeKeys.has(String(node.key))
        || Number(node.data?.parentCategoryId ?? 0) <= 0;
      if (node.children && node.children.length > 0) {
        this.applyExpandedState(node.children);
      }
    });
  }

  private scrollGroupIntoViewport(groupId: number, behavior: ScrollBehavior): void {
    setTimeout(() => {
      const element = this.document.getElementById(`group-card-${groupId}`);
      if (!(element instanceof HTMLElement)) {
        return;
      }

      const scrollContainer = this.resolveScrollContainer(element);
      if (!scrollContainer) {
        return;
      }

      const containerRect = scrollContainer.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      const desiredTop = scrollContainer.scrollTop + (elementRect.top - containerRect.top) - 12;
      const maxScrollTop = Math.max(scrollContainer.scrollHeight - scrollContainer.clientHeight, 0);
      const safeTop = Math.max(0, Math.min(desiredTop, maxScrollTop));
      scrollContainer.scrollTo({ top: safeTop, behavior });
    }, 40);
  }

  private resolveScrollContainer(element: HTMLElement): HTMLElement | null {
    return (element.closest('.tab-scroll--relations') as HTMLElement | null)
      || (element.closest('.management-content') as HTMLElement | null);
  }

  private resolveBestScrollTarget(container: HTMLElement | null): HTMLElement | null {
    if (!container) {
      const scrollingElement = this.document.scrollingElement;
      return scrollingElement instanceof HTMLElement ? scrollingElement : null;
    }

    const candidates: HTMLElement[] = [container];
    candidates.push(...Array.from(container.querySelectorAll<HTMLElement>(
      '.groups-relations, .links-table-wrap, .tab-scroll, .management-content, .tree-scroll'
    )));

    const scrollableCandidate = candidates.find(
      candidate => candidate.scrollHeight > (candidate.clientHeight + 2)
    );

    return scrollableCandidate ?? container;
  }

  private syncTreeViewport(
    preferredNodeKey?: string,
    options?: { ensureVisible?: boolean; behavior?: ScrollBehavior }
  ): void {
    const ensureVisible = options?.ensureVisible ?? false;
    const behavior = options?.behavior ?? 'auto';

    setTimeout(() => {
      const treeScrollElement = this.document.querySelector('.tree-scroll') as HTMLElement | null;
      if (!treeScrollElement) {
        return;
      }

      const clampScrollTop = () => {
        const maxScrollTop = Math.max(treeScrollElement.scrollHeight - treeScrollElement.clientHeight, 0);
        if (treeScrollElement.scrollTop > maxScrollTop) {
          treeScrollElement.scrollTop = maxScrollTop;
        }
      };

      requestAnimationFrame(() => {
        clampScrollTop();
        requestAnimationFrame(() => {
          clampScrollTop();
          if (!ensureVisible) {
            return;
          }

          const targetElement =
            (preferredNodeKey
              ? treeScrollElement.querySelector(`.p-treenode[data-key="${preferredNodeKey}"] .p-treenode-content`)
              : null)
            || treeScrollElement.querySelector('.p-treenode-content.p-highlight')
            || treeScrollElement.querySelector('.p-treenode-content[aria-selected="true"]');

          if (!(targetElement instanceof HTMLElement)) {
            return;
          }

          const containerRect = treeScrollElement.getBoundingClientRect();
          const targetRect = targetElement.getBoundingClientRect();
          const outOfViewTop = targetRect.top < containerRect.top + 8;
          const outOfViewBottom = targetRect.bottom > containerRect.bottom - 8;

          if (!outOfViewTop && !outOfViewBottom) {
            return;
          }

          const desiredTop = treeScrollElement.scrollTop + (targetRect.top - containerRect.top) - 12;
          const maxScrollTop = Math.max(treeScrollElement.scrollHeight - treeScrollElement.clientHeight, 0);
          const safeTop = Math.max(0, Math.min(desiredTop, maxScrollTop));
          treeScrollElement.scrollTo({ top: safeTop, behavior });
        });
      });
    }, 25);
  }
}
