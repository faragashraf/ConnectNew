import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TreeNode } from 'primeng/api';
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

@Component({
  selector: 'app-dynamic-subject-type-admin',
  templateUrl: './dynamic-subject-type-admin.component.html',
  styleUrls: ['./dynamic-subject-type-admin.component.scss']
})
export class DynamicSubjectTypeAdminComponent implements OnInit {
  loading = false;
  savingCategory = false;
  savingSettings = false;
  savingLinks = false;
  loadingLinks = false;
  loadingPreview = false;

  activeTabIndex = 0;

  categoryTree: AdminTreeNode[] = [];
  categoryItems: SubjectTypeAdminDto[] = [];
  selectedCategoryNode: AdminTreeNode | null = null;
  selectedCategory: SubjectTypeAdminDto | null = null;

  allFields: SubjectAdminFieldDto[] = [];
  groups: SubjectAdminGroupDto[] = [];

  editableLinks: SubjectCategoryFieldLinkAdminDto[] = [];

  previewDefinition: SubjectFormDefinitionDto | null = null;
  previewForm: FormGroup;
  previewGroups: PreviewGroupRenderItem[] = [];

  categoryForm: FormGroup;
  settingsForm: FormGroup;
  groupForm: FormGroup;
  createCategoryForm: FormGroup;

  groupDialogVisible = false;
  createCategoryDialogVisible = false;
  editingGroupId: number | null = null;

  constructor(
    private readonly fb: FormBuilder,
    private readonly dynamicSubjectsController: DynamicSubjectsController,
    private readonly appNotification: AppNotificationService
  ) {
    this.previewForm = this.fb.group({});

    this.categoryForm = this.fb.group({
      categoryName: ['', Validators.required],
      applicationId: [''],
      catMend: [''],
      catWorkFlow: [0, Validators.required],
      catSms: [false],
      catMailNotification: [false],
      to: [''],
      cc: [''],
      isActive: [true]
    });

    this.settingsForm = this.fb.group({
      referencePolicyEnabled: [true],
      referencePrefix: ['', Validators.required],
      referenceSeparator: ['-'],
      sourceFieldKeys: [''],
      includeYear: [true],
      useSequence: [true],
      sequenceName: ['Seq_Tickets']
    });

    this.groupForm = this.fb.group({
      groupName: ['', Validators.required],
      groupDescription: [''],
      isExtendable: [false],
      groupWithInRow: [1]
    });

    this.createCategoryForm = this.fb.group({
      parentCategoryId: [0],
      categoryName: ['', Validators.required],
      applicationId: [''],
      catMend: [''],
      catWorkFlow: [0, Validators.required],
      catSms: [false],
      catMailNotification: [false],
      to: [''],
      cc: [''],
      isActive: [true]
    });
  }

  ngOnInit(): void {
    this.loadWorkspace();
  }

  loadWorkspace(): void {
    this.loading = true;

    forkJoin({
      categories: this.dynamicSubjectsController.getAdminCategoryTree(),
      fields: this.dynamicSubjectsController.getAdminFields(),
      groups: this.dynamicSubjectsController.getAdminGroups()
    }).subscribe({
      next: result => {
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

        if (this.categoryTree.length > 0) {
          const firstNode = this.categoryTree[0];
          this.selectCategoryNode(firstNode);
          this.selectedCategoryNode = firstNode;
        } else {
          this.selectedCategory = null;
          this.selectedCategoryNode = null;
          this.previewDefinition = null;
          this.editableLinks = [];
        }
      },
      error: () => {
        this.appNotification.error('حدث خطأ أثناء تحميل لوحة الإدارة.');
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  onCategoryNodeSelect(event: { node: AdminTreeNode }): void {
    this.selectCategoryNode(event.node);
  }

  openCreateCategoryDialog(): void {
    this.createCategoryForm.reset({
      parentCategoryId: this.selectedCategory?.categoryId ?? 0,
      categoryName: '',
      applicationId: this.selectedCategory?.applicationId ?? '',
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

        this.createCategoryDialogVisible = false;
        this.appNotification.success('تم إنشاء النوع بنجاح.');
        this.loadWorkspace();
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
        this.loadWorkspace();
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
    const payload: SubjectTypeAdminUpsertRequestDto = {
      isActive: Boolean(this.categoryForm.get('isActive')?.value),
      referencePolicyEnabled: Boolean(value.referencePolicyEnabled),
      referencePrefix: String(value.referencePrefix ?? '').trim(),
      referenceSeparator: String(value.referenceSeparator ?? '-').trim() || '-',
      sourceFieldKeys: String(value.sourceFieldKeys ?? '').trim() || undefined,
      includeYear: Boolean(value.includeYear),
      useSequence: Boolean(value.useSequence),
      sequenceName: String(value.sequenceName ?? '').trim() || undefined
    };

    this.savingSettings = true;
    this.dynamicSubjectsController.upsertSubjectTypeAdminConfig(this.selectedCategory.categoryId, payload).subscribe({
      next: response => {
        if (response?.errors?.length) {
          this.appNotification.showApiErrors(response.errors, 'تعذر حفظ إعدادات النوع.');
          return;
        }

        this.appNotification.success('تم حفظ إعدادات النوع بنجاح.');
        this.loadWorkspace();
      },
      error: () => {
        this.appNotification.error('حدث خطأ أثناء حفظ إعدادات النوع.');
      },
      complete: () => {
        this.savingSettings = false;
      }
    });
  }

  deleteCategory(): void {
    if (!this.selectedCategory) {
      return;
    }

    const confirmed = window.confirm(`هل أنت متأكد من حذف النوع "${this.selectedCategory.categoryName}"؟`);
    if (!confirmed) {
      return;
    }

    this.dynamicSubjectsController.deleteAdminCategory(this.selectedCategory.categoryId).subscribe({
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
      this.loadWorkspace();
      return;
    }

    this.dynamicSubjectsController.moveAdminCategory(draggedId, {
      newParentCategoryId: location.parentId,
      newIndex: location.index
    }).subscribe({
      next: response => {
        if (response?.errors?.length) {
          this.appNotification.showApiErrors(response.errors, 'تعذر نقل النوع داخل الشجرة.');
          this.loadWorkspace();
          return;
        }

        this.categoryItems = response?.data ?? [];
        this.categoryTree = this.buildCategoryTree(this.categoryItems);
        this.appNotification.success('تم تحديث ترتيب الشجرة بنجاح.');
      },
      error: () => {
        this.appNotification.error('حدث خطأ أثناء نقل النوع داخل الشجرة.');
        this.loadWorkspace();
      }
    });
  }

  onFieldsChanged(): void {
    this.reloadFieldsAndCurrentCategoryLinks();
  }

  addEmptyLink(): void {
    if (!this.selectedCategory) {
      return;
    }

    const candidateField = this.selectableFields[0];
    const candidateGroup = this.groups[0];
    if (!candidateField || !candidateGroup) {
      this.appNotification.warning('لا يمكن إضافة ربط بدون وجود حقول وجروبات.');
      return;
    }

    this.editableLinks = [
      ...this.editableLinks,
      {
        mendSql: 0,
        categoryId: this.selectedCategory.categoryId,
        fieldKey: candidateField.fieldKey,
        fieldLabel: candidateField.fieldLabel,
        fieldType: candidateField.fieldType,
        groupId: candidateGroup.groupId,
        groupName: candidateGroup.groupName,
        isActive: true,
        displayOrder: this.editableLinks.length + 1,
        isVisible: true,
        displaySettingsJson: undefined,
        applicationId: candidateField.applicationId
      }
    ];
  }

  removeLink(index: number): void {
    this.editableLinks = this.editableLinks.filter((_item, idx) => idx !== index);
    this.reindexLinks();
  }

  saveLinks(): void {
    if (!this.selectedCategory) {
      return;
    }

    const duplicatedField = this.findDuplicateFieldKey(this.editableLinks);
    if (duplicatedField) {
      this.appNotification.warning(`الحقل ${duplicatedField} مكرر أكثر من مرة داخل نفس النوع.`);
      return;
    }

    const payloadLinks: SubjectCategoryFieldLinkUpsertItemDto[] = this.editableLinks
      .filter(item => String(item.fieldKey ?? '').trim().length > 0 && Number(item.groupId ?? 0) > 0)
      .map(item => ({
        mendSql: item.mendSql > 0 ? item.mendSql : undefined,
        fieldKey: item.fieldKey,
        groupId: Number(item.groupId),
        isActive: Boolean(item.isActive),
        displayOrder: Number(item.displayOrder ?? 0),
        isVisible: Boolean(item.isVisible),
        displaySettingsJson: String(item.displaySettingsJson ?? '').trim() || undefined
      }));

    this.savingLinks = true;
    this.dynamicSubjectsController.upsertAdminCategoryFieldLinks(this.selectedCategory.categoryId, { links: payloadLinks }).subscribe({
      next: response => {
        if (response?.errors?.length) {
          this.appNotification.showApiErrors(response.errors, 'تعذر حفظ ربط الحقول بالجروبات.');
          return;
        }

        this.editableLinks = response?.data ?? [];
        this.reindexLinks();
        this.loadPreview(this.selectedCategory!.categoryId);
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

        this.groupDialogVisible = false;
        this.loadGroups();
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
          this.loadPreview(this.selectedCategory.categoryId);
        }
        this.appNotification.success('تم حذف الجروب بنجاح.');
      },
      error: () => {
        this.appNotification.error('حدث خطأ أثناء حذف الجروب.');
      }
    });
  }

  get selectableFields(): SubjectAdminFieldDto[] {
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

  toFieldOptions(): Array<{ label: string; value: string }> {
    return this.selectableFields.map(field => ({
      label: `${field.fieldLabel || field.fieldKey} (${field.fieldKey})`,
      value: field.fieldKey
    }));
  }

  toGroupOptions(): Array<{ label: string; value: number }> {
    return (this.groups ?? []).map(group => ({
      label: group.groupName || `جروب ${group.groupId}`,
      value: group.groupId
    }));
  }

  trackByLink(index: number, _item: SubjectCategoryFieldLinkAdminDto): number {
    return index;
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

            const value = String(item.value ?? item.id ?? item.key ?? item.label ?? item.name ?? '');
            const label = String(item.label ?? item.name ?? item.text ?? value);
            if (!value && !label) {
              return null;
            }

            return { label: label || value, value: value || label };
          })
          .filter((item): item is { label: string; value: string } => item !== null);
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

  private selectCategoryNode(node: AdminTreeNode): void {
    this.selectedCategoryNode = node;
    this.selectedCategory = node.data;

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
    this.loadPreview(node.data.categoryId);
  }

  private buildCategoryTree(items: SubjectTypeAdminDto[]): AdminTreeNode[] {
    const byId = new Map<number, AdminTreeNode>();

    (items ?? []).forEach(item => {
      byId.set(item.categoryId, {
        key: String(item.categoryId),
        label: item.categoryName,
        expanded: true,
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
    this.dynamicSubjectsController.getAdminGroups().subscribe({
      next: response => {
        if (response?.errors?.length) {
          this.appNotification.showApiErrors(response.errors, 'تعذر تحميل الجروبات.');
          return;
        }

        this.groups = response?.data ?? [];
      },
      error: () => {
        this.appNotification.error('حدث خطأ أثناء تحميل الجروبات.');
      }
    });
  }

  private reloadFieldsAndCurrentCategoryLinks(): void {
    this.dynamicSubjectsController.getAdminFields().subscribe({
      next: response => {
        if (response?.errors?.length) {
          this.appNotification.showApiErrors(response.errors, 'تعذر تحديث قائمة الحقول.');
          return;
        }

        this.allFields = response?.data ?? [];
        if (this.selectedCategory) {
          this.loadLinks(this.selectedCategory.categoryId);
          this.loadPreview(this.selectedCategory.categoryId);
        }
      },
      error: () => {
        this.appNotification.error('حدث خطأ أثناء تحديث قائمة الحقول.');
      }
    });
  }

  private loadLinks(categoryId: number): void {
    this.loadingLinks = true;
    this.dynamicSubjectsController.getAdminCategoryFieldLinks(categoryId).subscribe({
      next: response => {
        if (response?.errors?.length) {
          this.editableLinks = [];
          this.appNotification.showApiErrors(response.errors, 'تعذر تحميل ربط الحقول بالجروبات.');
          return;
        }

        this.editableLinks = response?.data ?? [];
        this.reindexLinks();
      },
      error: () => {
        this.editableLinks = [];
        this.appNotification.error('حدث خطأ أثناء تحميل ربط الحقول.');
      },
      complete: () => {
        this.loadingLinks = false;
      }
    });
  }

  private loadPreview(categoryId: number): void {
    this.loadingPreview = true;
    this.dynamicSubjectsController.getAdminCategoryPreview(categoryId, this.selectedCategory?.applicationId || undefined).subscribe({
      next: response => {
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
        this.previewDefinition = null;
        this.previewGroups = [];
        this.previewForm = this.fb.group({});
        this.appNotification.error('حدث خطأ أثناء تحميل المعاينة.');
      },
      complete: () => {
        this.loadingPreview = false;
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

  private resolvePreviewDefaultValue(field: SubjectFieldDefinitionDto): any {
    if (this.isBooleanField(field)) {
      return String(field.defaultValue ?? '').toLowerCase() === 'true';
    }

    return field.defaultValue ?? '';
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

  private reindexLinks(): void {
    this.editableLinks = this.editableLinks.map((item, idx) => ({
      ...item,
      displayOrder: item.displayOrder > 0 ? item.displayOrder : idx + 1
    }));
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
}
