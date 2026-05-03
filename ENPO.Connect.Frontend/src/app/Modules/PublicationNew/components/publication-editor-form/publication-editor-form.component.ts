import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { Subscription, forkJoin } from 'rxjs';
import { MenuItem } from 'primeng/api';
import { ComponentConfig } from 'src/app/shared/models/Component.Config.model';
import { SubjectRoutingOrgUnitWithCountTreeNodeDto } from 'src/app/shared/services/BackendServices/DynamicSubjectsAdminRouting/DynamicSubjectsAdminRouting.dto';
import {
  AttachmentList,
  DocumentResp,
  PUB_MENU_ITEMS,
  ResponseDetail
} from 'src/app/shared/services/BackendServices/Publications/Publications.dto';
import { FileParameter } from 'src/app/shared/services/BackendServices/dto-shared';
import { AttchedObjectService } from 'src/app/shared/services/helper/attched-object.service';
import { AuthObjectsService, TreeNode } from 'src/app/shared/services/helper/auth-objects.service';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { PublicationNewApiService } from '../../shared/services/publication-new-api.service';

interface LookupOption {
  label: string;
  value: number;
}

interface AuthorizedOrgUnit {
  unitId: number;
  unitName: string;
  parentId: number;
  parentUnitName: string;
}

export type PublicationEditorMode = 'add' | 'edit' | 'view';

@Component({
  selector: 'app-publication-editor-form',
  templateUrl: './publication-editor-form.component.html',
  styleUrls: ['./publication-editor-form.component.scss']
})
export class PublicationEditorFormComponent implements OnInit, OnChanges, OnDestroy {
  private readonly addMenuItemStatementId = 34;
  private readonly deleteMenuItemStatementId = 35;
  private readonly supplementalPublicationTypeId = 2;
  // Keep null until the backend statement ID for "deactivate menu item" is confirmed.
  private readonly deactivateMenuItemStatementId: number | null = null;

  @Input() mode: PublicationEditorMode = 'add';
  @Input() publication: DocumentResp | null = null;

  @Output() saved = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  readonly attachmentUiConfig: ComponentConfig = {
    attachmentConfig: {
      showAttachmentSection: true,
      AllowedExtensions: ['.doc', '.docx'],
      maximumFileSize: 2,
      maxFileCount: 2,
      isMandatory: true,
      allowAdd: true,
      allowMultiple: true
    },
    fieldsConfiguration: {
      isDivDisabled: false,
      dateFormat: 'yy-mm-dd',
      showTime: false,
      timeOnly: false,
      maxDate: new Date(2099, 11, 31),
      useDefaultRadioView: false,
      isNotRequired: false
    }
  } as ComponentConfig;

  lookupsLoading = false;
  authorizedUnitTreeLoading = false;
  submitting = false;
  formSubmitted = false;
  menuMutationInProgress = false;
  activationDateMin = this.getTomorrowDateStart();

  selectedMenuNode: TreeNode | null = null;
  selectedMenuPath = '';
  menuTree: TreeNode[] = [];
  authorizedUnitTree: TreeNode[] = [];
  contextMenuNode: TreeNode | null = null;
  selectedAuthorizedUnitNode: TreeNode | null = null;
  selectedAuthorizedUnitPath = '';
  treeContextMenuItems: MenuItem[] = [];
  districtOptions: LookupOption[] = [];
  publicationTypeOptions: LookupOption[] = [];
  editorFileParameters: FileParameter[] = [];
  menuDialogVisible = false;

  private pendingMenuSelectionId: number | null = null;
  private internalOrgUnitsRows: SubjectRoutingOrgUnitWithCountTreeNodeDto[] = [];
  private publicationTypeSelectionSubscription?: Subscription;

  readonly menuDialogForm: FormGroup = this.fb.group({
    menuItemName: ['', Validators.required],
    application: ['', Validators.required],
    authorizedUnitId: [null, Validators.required]
  });

  readonly editorForm: FormGroup = this.fb.group({
    documentId: [0],
    districtId: [null, Validators.required],
    publicationTypeId: [null, Validators.required],
    menuItemId: [null, Validators.required],
    workingStartDate: [null, [Validators.required, (control: AbstractControl) => this.validateFutureActivationDate(control)]],
    miniDoc: ['', Validators.required],
    allTextDoc: ['', Validators.required],
    documentParentId: ['']
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly publicationNewApiService: PublicationNewApiService,
    private readonly msgsService: MsgsService,
    private readonly attchedObjectService: AttchedObjectService,
    private readonly authObjectsService: AuthObjectsService
  ) { }

  get isViewMode(): boolean {
    return this.mode === 'view';
  }

  get canSubmit(): boolean {
    return this.mode === 'add' || this.mode === 'edit';
  }

  get canManageTreeContextMenuItems(): boolean {
    return this.mode === 'add' && this.authObjectsService.checkAuthFun('AddMenuItemsFunc');
  }

  get hasAnyAttachment(): boolean {
    return this.editorFileParameters.length > 0;
  }

  get isDocumentParentIdRequired(): boolean {
    return this.isSupplementalPublicationTypeSelected() && !this.isViewMode;
  }

  get hasFutureActivationDateError(): boolean {
    const control = this.editorForm.get('workingStartDate');
    if (!control || this.isViewMode) {
      return false;
    }

    return control.hasError('futureDateOnly') && (control.touched || this.formSubmitted);
  }

  ngOnInit(): void {
    this.bindPublicationTypeSelection();
    this.loadAuthorizedUnitTree();
    this.resetForCurrentInputs();
    this.loadLookups();
  }

  ngOnDestroy(): void {
    this.publicationTypeSelectionSubscription?.unsubscribe();
    this.publicationTypeSelectionSubscription = undefined;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['mode'] || changes['publication']) {
      this.resetForCurrentInputs();
      this.applyPendingMenuSelection();
    }
  }

  submit(): void {
    if (!this.canSubmit) {
      return;
    }

    this.formSubmitted = true;
    this.editorForm.markAllAsTouched();

    if (this.editorForm.invalid) {
      return;
    }

    if (!this.hasAnyAttachment) {
      this.msgsService.msgError('البيانات غير مكتملة', 'المرفقات إلزامية ويجب إرفاق ملف واحد على الأقل.', true);
      return;
    }

    const rawDocumentId = Number(this.editorForm.get('documentId')?.value ?? 0);
    const workingStartDate = this.normalizeToStartOfDay(
      this.parseToDate(this.editorForm.get('workingStartDate')?.value) ?? new Date()
    );
    const miniDoc = String(this.editorForm.get('miniDoc')?.value ?? '').trim();
    const allTextDoc = String(this.editorForm.get('allTextDoc')?.value ?? '').trim();
    const districtId = Number(this.editorForm.get('districtId')?.value ?? 0);
    const publicationTypeId = Number(this.editorForm.get('publicationTypeId')?.value ?? 0);
    const menuItemId = Number(this.editorForm.get('menuItemId')?.value ?? 0);
    const documentParentId = String(this.editorForm.get('documentParentId')?.value ?? '').trim();
    const { existingAttachments, newFiles } = this.splitAttachments(this.editorFileParameters);

    this.submitting = true;

    const request$ = this.mode === 'add'
      ? this.publicationNewApiService.saveDocument(
        workingStartDate,
        miniDoc,
        districtId,
        publicationTypeId,
        allTextDoc,
        menuItemId,
        documentParentId,
        newFiles
      )
      : this.publicationNewApiService.editDocument(
        rawDocumentId,
        workingStartDate,
        miniDoc,
        districtId,
        publicationTypeId,
        allTextDoc,
        menuItemId,
        documentParentId,
        existingAttachments,
        newFiles
      );

    request$.subscribe({
      next: (response) => {
        if (response?.IsSuccess) {
          this.msgsService.msgSuccess('تم الحفظ بنجاح', 4000);
          this.saved.emit();
          return;
        }

        this.msgsService.msgError('فشل الحفظ', this.collectErrors(response?.ResponseDetails), true);
      },
      error: (error: unknown) => {
        this.msgsService.msgError('تعذر حفظ البيانات', this.extractErrorMessage(error), true);
      },
      complete: () => {
        this.submitting = false;
      }
    });
  }

  cancel(): void {
    this.cancelled.emit();
  }

  onMenuNodeSelect(event: any): void {
    const node: TreeNode | null = (event?.node ?? event) as TreeNode;
    if (!node) {
      return;
    }

    this.selectedMenuNode = node;
    const selectedId = Number(node.key ?? node.data?.['MENU_ITEM_ID'] ?? 0);
    if (selectedId > 0) {
      this.editorForm.patchValue({ menuItemId: selectedId });
      this.pendingMenuSelectionId = selectedId;
      this.selectedMenuPath = this.getPathByKey(String(selectedId));
    }
  }

  onMenuNodeUnselect(): void {
    if (this.isViewMode) {
      return;
    }

    this.selectedMenuNode = null;
    this.selectedMenuPath = '';
    this.pendingMenuSelectionId = null;
    this.editorForm.patchValue({ menuItemId: null });
  }

  onMenuNodeContextMenuSelect(event: any): void {
    if (!this.canManageTreeContextMenuItems) {
      return;
    }

    const node: TreeNode | null = (event?.node ?? event) as TreeNode;
    if (!node) {
      return;
    }

    this.contextMenuNode = node;
    this.onMenuNodeSelect({ node });
    const hasChildren = Array.isArray(node.children) && node.children.length > 0;

    this.treeContextMenuItems = [
      {
        label: 'إضافة عنصر فرعي',
        icon: 'pi pi-plus',
        command: () => this.openAddChildDialog()
      },
      {
        label: 'حذف العنصر',
        icon: 'pi pi-trash',
        command: () => this.confirmDeleteContextNode(),
        disabled: hasChildren
      },
      {
        label: 'تعطيل العنصر',
        icon: 'pi pi-ban',
        command: () => this.confirmDeactivateContextNode()
      }
    ];
  }

  openAddChildDialog(): void {
    const nodeId = this.resolveNodeMenuItemId(this.contextMenuNode);
    if (nodeId <= 0) {
      this.msgsService.msgInfo('اختر عنصرًا صحيحًا من الشجرة أولاً.', 'تنبيه', 'warn');
      return;
    }

    if (this.authorizedUnitTree.length === 0 && !this.authorizedUnitTreeLoading) {
      this.loadAuthorizedUnitTree();
    }
    this.menuDialogForm.reset({
      menuItemName: '',
      application: this.resolveNodeApplication(this.contextMenuNode),
      authorizedUnitId: null
    });
    this.selectedAuthorizedUnitNode = null;
    this.selectedAuthorizedUnitPath = '';
    this.menuDialogVisible = true;
  }

  closeAddChildDialog(): void {
    this.menuDialogVisible = false;
    this.selectedAuthorizedUnitNode = null;
    this.selectedAuthorizedUnitPath = '';
    this.menuDialogForm.reset({
      menuItemName: '',
      application: '',
      authorizedUnitId: null
    });
  }

  onAuthorizedUnitNodeSelect(event: any): void {
    const node: TreeNode | null = (event?.node ?? event) as TreeNode;
    if (!node) {
      return;
    }

    const selectedId = this.resolveTreeNodeUnitId(node);
    if (selectedId <= 0) {
      return;
    }

    this.selectedAuthorizedUnitNode = node;
    this.menuDialogForm.patchValue({ authorizedUnitId: selectedId });
    this.selectedAuthorizedUnitPath = this.getPathByKeyFromTree(this.authorizedUnitTree, String(selectedId));
  }

  onAuthorizedUnitNodeUnselect(): void {
    this.selectedAuthorizedUnitNode = null;
    this.selectedAuthorizedUnitPath = '';
    this.menuDialogForm.patchValue({ authorizedUnitId: null });
  }

  submitAddChildMenuDialog(): void {
    const parentId = this.resolveNodeMenuItemId(this.contextMenuNode);
    if (parentId <= 0) {
      this.msgsService.msgInfo('اختر عنصرًا صحيحًا من الشجرة أولاً.', 'تنبيه', 'warn');
      return;
    }

    this.menuDialogForm.markAllAsTouched();
    if (this.menuDialogForm.invalid) {
      return;
    }

    const menuItemName = String(this.menuDialogForm.get('menuItemName')?.value ?? '').trim();
    const application = String(this.menuDialogForm.get('application')?.value ?? '').trim();
    const authorizedUnitId = this.toPositiveInt(this.menuDialogForm.get('authorizedUnitId')?.value);
    const parameters = `${menuItemName}|${parentId}|${application}|${authorizedUnitId}`;

    this.menuMutationInProgress = true;
    this.publicationNewApiService.executeMenuStatement(this.addMenuItemStatementId, parameters).subscribe({
      next: (response) => {
        if (response?.isSuccess) {
          this.msgsService.msgSuccess(response?.data || 'تمت إضافة العنصر الفرعي بنجاح.', 4000);
          this.closeAddChildDialog();
          this.pendingMenuSelectionId = parentId;
          this.loadMenuTreeWithFallback(this.resolveUnitIds());
          return;
        }

        this.msgsService.msgError(
          'تعذر إضافة عنصر فرعي',
          this.collectPowerBiErrors(response?.errors, 'فشل تنفيذ عملية الإضافة.'),
          true
        );
      },
      error: (error: unknown) => {
        this.msgsService.msgError('تعذر إضافة عنصر فرعي', this.extractErrorMessage(error), true);
      },
      complete: () => {
        this.menuMutationInProgress = false;
      }
    });
  }

  private confirmDeleteContextNode(): void {
    const nodeId = this.resolveNodeMenuItemId(this.contextMenuNode);
    if (nodeId <= 0) {
      this.msgsService.msgInfo('اختر عنصرًا صحيحًا من الشجرة أولاً.', 'تنبيه', 'warn');
      return;
    }

    this.msgsService.msgConfirm('هل تريد حذف العنصر المحدد؟', 'تأكيد الحذف').then((confirmed) => {
      if (!confirmed) {
        return;
      }

      this.deleteContextNode(nodeId);
    });
  }

  private deleteContextNode(nodeId: number): void {
    const parentId = this.resolveNodeParentMenuItemId(this.contextMenuNode);
    this.menuMutationInProgress = true;

    this.publicationNewApiService.executeMenuStatement(this.deleteMenuItemStatementId, `${nodeId}`).subscribe({
      next: (response) => {
        if (response?.isSuccess) {
          this.msgsService.msgSuccess(response?.data || 'تم حذف العنصر بنجاح.', 4000);

          if (this.resolveNodeMenuItemId(this.selectedMenuNode) === nodeId) {
            this.onMenuNodeUnselect();
          }

          this.pendingMenuSelectionId = parentId > 0 ? parentId : null;
          this.loadMenuTreeWithFallback(this.resolveUnitIds());
          return;
        }

        this.msgsService.msgError(
          'تعذر حذف العنصر',
          this.collectPowerBiErrors(response?.errors, 'فشل تنفيذ عملية الحذف.'),
          true
        );
      },
      error: (error: unknown) => {
        this.msgsService.msgError('تعذر حذف العنصر', this.extractErrorMessage(error), true);
      },
      complete: () => {
        this.menuMutationInProgress = false;
      }
    });
  }

  private confirmDeactivateContextNode(): void {
    const nodeId = this.resolveNodeMenuItemId(this.contextMenuNode);
    if (nodeId <= 0) {
      this.msgsService.msgInfo('اختر عنصرًا صحيحًا من الشجرة أولاً.', 'تنبيه', 'warn');
      return;
    }

    if (!this.deactivateMenuItemStatementId) {
      this.msgsService.msgInfo(
        'تم إضافة خيار التعطيل في القائمة، لكن رقم Statement الخاص بالتعطيل غير مُعرّف بعد.',
        'تنبيه',
        'warn'
      );
      return;
    }

    this.msgsService.msgConfirm('هل تريد تعطيل العنصر المحدد؟', 'تأكيد التعطيل').then((confirmed) => {
      if (!confirmed) {
        return;
      }

      this.deactivateContextNode(nodeId, this.deactivateMenuItemStatementId as number);
    });
  }

  private deactivateContextNode(nodeId: number, statementId: number): void {
    const parentId = this.resolveNodeParentMenuItemId(this.contextMenuNode);
    this.menuMutationInProgress = true;

    this.publicationNewApiService.executeMenuStatement(statementId, `${nodeId}`).subscribe({
      next: (response) => {
        if (response?.isSuccess) {
          this.msgsService.msgSuccess(response?.data || 'تم تعطيل العنصر بنجاح.', 4000);
          this.pendingMenuSelectionId = parentId > 0 ? parentId : null;
          this.loadMenuTreeWithFallback(this.resolveUnitIds());
          return;
        }

        this.msgsService.msgError(
          'تعذر تعطيل العنصر',
          this.collectPowerBiErrors(response?.errors, 'فشل تنفيذ عملية التعطيل.'),
          true
        );
      },
      error: (error: unknown) => {
        this.msgsService.msgError('تعذر تعطيل العنصر', this.extractErrorMessage(error), true);
      },
      complete: () => {
        this.menuMutationInProgress = false;
      }
    });
  }

  onAttachmentsChanged(files: FileParameter[]): void {
    this.editorFileParameters = [...(files ?? [])];
  }

  downloadExistingAttachment(event: { id: number; fileName: string }): void {
    if (!event || !event.id) {
      return;
    }

    this.publicationNewApiService.getFileContent(event.id).subscribe({
      next: (response) => {
        if (response?.IsSuccess && response.FILE_CONTENT) {
          this.attchedObjectService.createObjectURL(response.FILE_CONTENT, event.fileName);
          return;
        }

        this.msgsService.msgError('تعذر تنزيل الملف', this.collectErrors(response?.ResponseDetails), true);
      },
      error: (error: unknown) => {
        this.msgsService.msgError('تعذر تنزيل الملف', this.extractErrorMessage(error), true);
      }
    });
  }

  isControlInvalid(controlName: string): boolean {
    if (this.isViewMode) {
      return false;
    }

    const control = this.editorForm.get(controlName);
    if (!control) {
      return false;
    }

    return control.invalid && (control.touched || this.formSubmitted);
  }

  isMenuDialogControlInvalid(controlName: string): boolean {
    const control = this.menuDialogForm.get(controlName);
    if (!control) {
      return false;
    }

    return control.invalid && (control.touched || control.dirty);
  }

  private resetForCurrentInputs(): void {
    this.formSubmitted = false;
    this.submitting = false;
    this.menuMutationInProgress = false;
    this.selectedMenuNode = null;
    this.selectedMenuPath = '';
    this.contextMenuNode = null;
    this.treeContextMenuItems = [];
    this.menuDialogVisible = false;
    this.pendingMenuSelectionId = null;
    this.selectedAuthorizedUnitNode = null;
    this.selectedAuthorizedUnitPath = '';

    if (this.mode === 'add' || !this.publication) {
      this.editorFileParameters = [];
      this.editorForm.reset({
        documentId: 0,
        districtId: null,
        publicationTypeId: null,
        menuItemId: null,
        workingStartDate: null,
        miniDoc: '',
        allTextDoc: '',
        documentParentId: ''
      });
      this.applyModeState();
      return;
    }

    const menuItemId = Number(this.publication.MENUITEMID ?? 0) || null;
    this.editorFileParameters = this.mapExistingAttachments(this.publication.AttachmentList);
    this.editorForm.reset({
      documentId: Number(this.publication.DocumentId ?? 0),
      districtId: Number(this.publication.DISTRICT_ID ?? 0) || null,
      publicationTypeId: Number(this.publication.PUBLICATION_TYPE_ID ?? 0) || null,
      menuItemId,
      workingStartDate: this.parseToDate(this.publication.WORKING_START_DATE),
      miniDoc: this.publication.MINI_DOC ?? '',
      allTextDoc: this.publication.ALL_TEXT_DOC ?? '',
      documentParentId: this.publication.DOCUMENT_PARENT_ID ?? ''
    });

    this.pendingMenuSelectionId = menuItemId;
    this.applyModeState();
  }

  private applyModeState(): void {
    const readOnly = this.isViewMode;
    this.attachmentUiConfig.fieldsConfiguration.isDivDisabled = readOnly;
    this.attachmentUiConfig.attachmentConfig.allowAdd = !readOnly;
    this.attachmentUiConfig.attachmentConfig.allowMultiple = !readOnly;

    if (readOnly) {
      this.editorForm.disable({ emitEvent: false });
    } else {
      this.editorForm.enable({ emitEvent: false });
    }

    this.updateDocumentParentIdState();
  }

  private bindPublicationTypeSelection(): void {
    this.publicationTypeSelectionSubscription?.unsubscribe();
    const publicationTypeControl = this.editorForm.get('publicationTypeId');
    if (!publicationTypeControl) {
      return;
    }

    this.publicationTypeSelectionSubscription = publicationTypeControl.valueChanges.subscribe(() => {
      this.updateDocumentParentIdState();
    });
  }

  private updateDocumentParentIdState(): void {
    const parentIdControl = this.editorForm.get('documentParentId');
    if (!parentIdControl) {
      return;
    }

    const shouldBeEnabled = this.isSupplementalPublicationTypeSelected() && !this.isViewMode;
    parentIdControl.clearValidators();

    if (shouldBeEnabled) {
      parentIdControl.setValidators([Validators.required]);
      parentIdControl.enable({ emitEvent: false });
    } else {
      parentIdControl.disable({ emitEvent: false });
    }

    parentIdControl.updateValueAndValidity({ emitEvent: false });
  }

  private isSupplementalPublicationTypeSelected(): boolean {
    const publicationTypeId = Number(this.editorForm.get('publicationTypeId')?.value ?? 0);
    return Number.isFinite(publicationTypeId) && publicationTypeId === this.supplementalPublicationTypeId;
  }

  private validateFutureActivationDate(control: AbstractControl): ValidationErrors | null {
    const parsedDate = this.parseToDate(control?.value);
    if (!parsedDate) {
      return null;
    }

    const selectedDate = this.normalizeToStartOfDay(parsedDate);
    const today = this.normalizeToStartOfDay(new Date());
    return selectedDate > today ? null : { futureDateOnly: true };
  }

  private loadLookups(): void {
    this.lookupsLoading = true;
    const unitIds = this.resolveUnitIds();

    forkJoin({
      publicationTypesResponse: this.publicationNewApiService.getCriteria('PublicationTypes'),
      districtsResponse: this.publicationNewApiService.getCriteria('Districts')
    }).subscribe({
      next: ({ publicationTypesResponse, districtsResponse }) => {
        this.publicationTypeOptions = this.mapPublicationTypeOptions(publicationTypesResponse?.Data);
        this.districtOptions = this.mapDistrictOptions(districtsResponse?.Data);
        this.loadMenuTreeWithFallback(unitIds);
      },
      error: (error: unknown) => {
        this.msgsService.msgError('تعذر تحميل بيانات النموذج', this.extractErrorMessage(error), true);
        this.lookupsLoading = false;
      }
    });
  }

  private loadMenuTreeWithFallback(unitIds: number[]): void {
    const canLoadAllMenuItemsInAddMode =
      (this.mode === 'add' || this.mode === 'edit')
      && (
        this.authObjectsService.checkAuthFun('PublSuperAdminFunc')
      );

    if (canLoadAllMenuItemsInAddMode) {
      this.loadMenuTreeFromGetMenuItems();
      return;
    }

    const adminOnlyMode = this.mode === 'add';

    this.publicationNewApiService.getAdminMenuItems(unitIds).subscribe({
      next: (adminResponse) => {
        const adminItems = adminResponse?.Data ?? [];

        if (adminOnlyMode) {
          this.menuTree = this.buildMenuTree(adminItems);
          this.applyPendingMenuSelection();
          this.lookupsLoading = false;
          return;
        }

        if (adminItems.length > 0) {
          this.menuTree = this.buildMenuTree(adminItems);
          this.applyPendingMenuSelection();
          this.lookupsLoading = false;
          return;
        }

        this.loadMenuTreeFromGetMenuItems();
      },
      error: () => {
        if (adminOnlyMode) {
          this.menuTree = [];
          this.applyPendingMenuSelection();
          this.lookupsLoading = false;
          return;
        }

        this.loadMenuTreeFromGetMenuItems();
      }
    });
  }

  private loadMenuTreeFromGetMenuItems(): void {
    this.publicationNewApiService.getMenuItems().subscribe({
      next: (response) => {
        this.menuTree = this.buildMenuTree(response?.Data ?? []);
        this.applyPendingMenuSelection();
      },
      error: (error: unknown) => {
        this.msgsService.msgError('تعذر تحميل القائمة الرئيسية', this.extractErrorMessage(error), true);
      },
      complete: () => {
        this.lookupsLoading = false;
      }
    });
  }

  private mapPublicationTypeOptions(data: unknown): LookupOption[] {
    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .map((item: any) => ({
        value: Number(item?.PublicationTypeId ?? item?.PUBLICATION_TYPE_ID ?? item?.Id ?? 0),
        label: String(item?.PublicationTypeNameAr ?? item?.NameAr ?? item?.name ?? '').trim()
      }))
      .filter(option => option.value > 0 && option.label.length > 0);
  }

  private mapDistrictOptions(data: unknown): LookupOption[] {
    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .map((item: any) => ({
        value: Number(item?.DistrictId ?? item?.DISTRICT_ID ?? item?.Id ?? 0),
        label: String(item?.DistrictNameAr ?? item?.NameAr ?? item?.name ?? '').trim()
      }))
      .filter(option => option.value > 0 && option.label.length > 0);
  }

  private buildMenuTree(data: unknown): TreeNode[] {
    if (!Array.isArray(data)) {
      return [];
    }

    const rawItems = data as PUB_MENU_ITEMS[];
    const nodeMap = new Map<number, TreeNode>();
    const roots: TreeNode[] = [];

    rawItems.forEach(item => {
      const id = Number(item?.MENU_ITEM_ID ?? 0);
      if (id <= 0) {
        return;
      }

      nodeMap.set(id, {
        key: String(id),
        label: String(item?.MENU_ITEM_NAME ?? '').trim() || `عنصر ${id}`,
        data: item,
        children: [],
        expanded: true
      });
    });

    rawItems.forEach(item => {
      const id = Number(item?.MENU_ITEM_ID ?? 0);
      const parentId = Number(item?.PARENT_MENU_ITEM_ID ?? 0);
      const node = nodeMap.get(id);
      if (!node) {
        return;
      }

      if (parentId > 0 && nodeMap.has(parentId)) {
        const parentNode = nodeMap.get(parentId);
        parentNode?.children?.push(node);
      } else {
        roots.push(node);
      }
    });

    this.markLeafNodes(roots);
    return roots;
  }

  private markLeafNodes(nodes: TreeNode[]): void {
    nodes.forEach(node => {
      const hasChildren = !!(node.children && node.children.length > 0);
      node.leaf = !hasChildren;
      if (hasChildren) {
        this.markLeafNodes(node.children as TreeNode[]);
      }
    });
  }

  private applyPendingMenuSelection(): void {
    if (!this.pendingMenuSelectionId || this.menuTree.length === 0) {
      return;
    }

    const key = String(this.pendingMenuSelectionId);
    const found = this.findNodeByKey(this.menuTree, key);
    if (!found) {
      return;
    }

    this.expandPathToNode(this.menuTree, key);
    this.selectedMenuNode = found;
    this.selectedMenuPath = this.getPathByKey(key);
  }

  private findNodeByKey(nodes: TreeNode[], key: string): TreeNode | null {
    for (const node of nodes) {
      if (String(node.key) === key) {
        return node;
      }

      const children = node.children as TreeNode[] | undefined;
      if (children && children.length > 0) {
        const found = this.findNodeByKey(children, key);
        if (found) {
          return found;
        }
      }
    }

    return null;
  }

  private expandPathToNode(nodes: TreeNode[], key: string): boolean {
    for (const node of nodes) {
      if (String(node.key) === key) {
        node.expanded = true;
        return true;
      }

      const children = node.children as TreeNode[] | undefined;
      if (children && children.length > 0) {
        const foundInChildren = this.expandPathToNode(children, key);
        if (foundInChildren) {
          node.expanded = true;
          return true;
        }
      }
    }

    return false;
  }

  private getPathByKey(key: string): string {
    return this.getPathByKeyFromTree(this.menuTree, key);
  }

  private getPathByKeyFromTree(nodes: TreeNode[], key: string): string {
    const labels = this.findPathLabels(nodes, key, []);
    return labels.join(' > ');
  }

  private findPathLabels(nodes: TreeNode[], key: string, stack: string[]): string[] {
    for (const node of nodes) {
      const nextStack = [...stack, String(node.label ?? '').trim()];
      if (String(node.key) === key) {
        return nextStack;
      }

      const children = node.children as TreeNode[] | undefined;
      if (children && children.length > 0) {
        const result = this.findPathLabels(children, key, nextStack);
        if (result.length > 0) {
          return result;
        }
      }
    }

    return [];
  }

  private mapExistingAttachments(attachments: AttachmentList[] | undefined): FileParameter[] {
    if (!attachments || attachments.length === 0) {
      return [];
    }

    return attachments.map(item => ({
      data: new File([], item.FILE_NAME ?? 'attachment.doc'),
      fileName: item.FILE_NAME ?? 'attachment.doc',
      fileID: item.ATTACHMENT_ID,
      originalSize: item.FILE_SIZE_BYTES
    }));
  }

  private splitAttachments(files: FileParameter[]): { existingAttachments: AttachmentList[]; newFiles: FileParameter[] } {
    const existingAttachments: AttachmentList[] = [];
    const newFiles: FileParameter[] = [];

    files.forEach(file => {
      const hasServerId = file.fileID !== null && file.fileID !== undefined && String(file.fileID).trim() !== '';
      const isNewUpload = file.data instanceof File && file.data.size > 0;

      if (hasServerId && !isNewUpload) {
        existingAttachments.push({
          ATTACHMENT_ID: Number(file.fileID),
          FILE_NAME: file.fileName ?? '',
          FILE_SIZE_BYTES: file.originalSize ?? 0
        });
        return;
      }

      if (isNewUpload) {
        newFiles.push(file);
      }
    });

    return { existingAttachments, newFiles };
  }

  private parseToDate(value: unknown): Date | null {
    if (!value) {
      return null;
    }

    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : value;
    }

    const parsed = new Date(String(value));
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  private normalizeToStartOfDay(value: Date): Date {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  private getTomorrowDateStart(): Date {
    const today = this.normalizeToStartOfDay(new Date());
    return new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  }

  private resolveNodeMenuItemId(node: TreeNode | null): number {
    const rawId = Number(node?.key ?? node?.data?.['MENU_ITEM_ID'] ?? 0);
    return Number.isFinite(rawId) && rawId > 0 ? Math.trunc(rawId) : 0;
  }

  private resolveNodeParentMenuItemId(node: TreeNode | null): number {
    const rawParentId = Number((node?.data as any)?.PARENT_MENU_ITEM_ID ?? 0);
    return Number.isFinite(rawParentId) && rawParentId > 0 ? Math.trunc(rawParentId) : 0;
  }

  private resolveNodeApplication(node: TreeNode | null): string {
    return String((node?.data as any)?.APPLICATION ?? '').trim();
  }

  private resolveTreeNodeUnitId(node: TreeNode | null): number {
    const data = (node?.data ?? {}) as Record<string, unknown>;
    return this.toPositiveInt(
      node?.key
      ?? data['unitId']
      ?? data['UnitId']
      ?? data['UNIT_ID']
      ?? 0
    );
  }

  private applyDialogAuthorizedUnitSelection(): void {
    const selectedUnitId = this.toPositiveInt(this.menuDialogForm.get('authorizedUnitId')?.value);
    if (selectedUnitId <= 0) {
      this.selectedAuthorizedUnitNode = null;
      this.selectedAuthorizedUnitPath = '';
      return;
    }

    const key = String(selectedUnitId);
    this.expandPathToNode(this.authorizedUnitTree, key);
    const foundNode = this.findNodeByKey(this.authorizedUnitTree, key);
    if (!foundNode) {
      this.selectedAuthorizedUnitNode = null;
      this.selectedAuthorizedUnitPath = '';
      return;
    }

    this.selectedAuthorizedUnitNode = foundNode;
    this.selectedAuthorizedUnitPath = this.getPathByKeyFromTree(this.authorizedUnitTree, key);
  }

  private buildAuthorizedUnitsTree(): TreeNode[] {
    if (this.internalOrgUnitsRows.length > 0) {
      return this.buildAuthorizedUnitsTreeFromRows(this.internalOrgUnitsRows);
    }

    const resolvedUnits = this.resolveAuthorizedOrgUnits();
    const units = resolvedUnits.length > 0
      ? resolvedUnits
      : this.resolveUnitIds().map((id) => ({
        unitId: id,
        unitName: `وحدة ${id}`,
        parentId: 0,
        parentUnitName: ''
      }));

    if (units.length === 0) {
      return [];
    }

    const nodeById = new Map<number, TreeNode>();
    const roots: TreeNode[] = [];
    const parentGroupNodes = new Map<string, TreeNode>();

    units.forEach((item) => {
      nodeById.set(item.unitId, {
        key: String(item.unitId),
        label: item.unitName,
        selectable: true,
        expanded: false,
        children: [],
        data: {
          UNIT_ID: item.unitId,
          UNIT_NAME: item.unitName,
          PARENT_ID: item.parentId,
          PARENT_UNIT_NAME: item.parentUnitName
        }
      });
    });

    units.forEach((item) => {
      const node = nodeById.get(item.unitId);
      if (!node) {
        return;
      }

      if (item.parentId > 0 && item.parentId !== item.unitId && nodeById.has(item.parentId)) {
        nodeById.get(item.parentId)?.children?.push(node);
        return;
      }

      const parentName = item.parentUnitName.trim();
      if (parentName.length > 0) {
        let groupNode = parentGroupNodes.get(parentName);
        if (!groupNode) {
          groupNode = {
            key: `org-parent-group-${parentGroupNodes.size + 1}`,
            label: parentName,
            selectable: false,
            expanded: false,
            children: []
          };
          parentGroupNodes.set(parentName, groupNode);
          roots.push(groupNode);
        }

        groupNode.children?.push(node);
        return;
      }

      roots.push(node);
    });

    this.sortTreeByLabel(roots);
    this.markLeafNodes(roots);
    return roots;
  }

  private loadAuthorizedUnitTree(): void {
    if (this.authorizedUnitTreeLoading) {
      return;
    }

    this.authorizedUnitTreeLoading = true;
    this.publicationNewApiService.getInternalOrgUnitsTree(true).subscribe({
      next: (response) => {
        if (response?.isSuccess && Array.isArray(response.data) && response.data.length > 0) {
          this.internalOrgUnitsRows = this.filterToInternalOrgUnits(response.data);
          this.authorizedUnitTree = this.buildAuthorizedUnitsTreeFromRows(this.internalOrgUnitsRows);
          this.applyDialogAuthorizedUnitSelection();
          return;
        }

        this.internalOrgUnitsRows = [];
        this.authorizedUnitTree = this.buildAuthorizedUnitsTree();
        this.applyDialogAuthorizedUnitSelection();
      },
      error: () => {
        this.internalOrgUnitsRows = [];
        this.authorizedUnitTree = this.buildAuthorizedUnitsTree();
        this.applyDialogAuthorizedUnitSelection();
      },
      complete: () => {
        this.authorizedUnitTreeLoading = false;
      }
    });
  }

  private filterToInternalOrgUnits(
    rows: SubjectRoutingOrgUnitWithCountTreeNodeDto[]
  ): SubjectRoutingOrgUnitWithCountTreeNodeDto[] {
    if (!Array.isArray(rows) || rows.length === 0) {
      return [];
    }

    const internalRootId = 1;

    const rowsByParent = new Map<number, SubjectRoutingOrgUnitWithCountTreeNodeDto[]>();
    const rowsById = new Map<number, SubjectRoutingOrgUnitWithCountTreeNodeDto>();

    rows.forEach((row) => {
      const unitId = this.toPositiveInt(row?.unitId);
      if (unitId <= 0) {
        return;
      }

      rowsById.set(unitId, row);
      const parentId = this.toPositiveInt(row?.parentId ?? 0);
      if (!rowsByParent.has(parentId)) {
        rowsByParent.set(parentId, []);
      }

      rowsByParent.get(parentId)?.push(row);
    });

    if (!rowsById.has(internalRootId)) {
      return [];
    }

    const includedIds = new Set<number>();
    const stack = [internalRootId];
    while (stack.length > 0) {
      const currentId = stack.pop() as number;
      if (includedIds.has(currentId)) {
        continue;
      }

      includedIds.add(currentId);
      const children = rowsByParent.get(currentId) ?? [];
      children.forEach((child) => {
        const childId = this.toPositiveInt(child?.unitId);
        if (childId > 0 && !includedIds.has(childId)) {
          stack.push(childId);
        }
      });
    }

    const filtered = rows.filter((row) => includedIds.has(this.toPositiveInt(row?.unitId)));
    return filtered;
  }

  private buildAuthorizedUnitsTreeFromRows(rows: SubjectRoutingOrgUnitWithCountTreeNodeDto[]): TreeNode[] {
    const nodeById = new Map<number, TreeNode>();
    const roots: TreeNode[] = [];

    rows.forEach((row) => {
      const unitId = this.toPositiveInt(row?.unitId);
      if (unitId <= 0) {
        return;
      }

      const unitName = String(row?.unitName ?? '').trim() || `وحدة ${unitId}`;
      nodeById.set(unitId, {
        key: String(unitId),
        label: unitName,
        selectable: true,
        expanded: false,
        children: [],
        data: {
          UNIT_ID: unitId,
          UNIT_NAME: unitName,
          PARENT_ID: this.toPositiveInt(row?.parentId ?? 0)
        }
      });
    });

    rows.forEach((row) => {
      const unitId = this.toPositiveInt(row?.unitId);
      if (unitId <= 0) {
        return;
      }

      const node = nodeById.get(unitId);
      if (!node) {
        return;
      }

      const parentId = this.toPositiveInt(row?.parentId ?? 0);
      if (parentId > 0 && parentId !== unitId && nodeById.has(parentId)) {
        nodeById.get(parentId)?.children?.push(node);
      } else {
        roots.push(node);
      }
    });

    this.sortTreeByLabel(roots);
    this.markLeafNodes(roots);
    return roots;
  }

  private resolveAuthorizedOrgUnits(): AuthorizedOrgUnit[] {
    const unitMap = new Map<number, AuthorizedOrgUnit>();

    const mergeUnit = (rawItem: any): void => {
      const unitId = this.toPositiveInt(
        rawItem?.unitId
        ?? rawItem?.UnitId
        ?? rawItem?.UNIT_ID
        ?? rawItem?.id
        ?? rawItem?.Id
      );
      if (unitId <= 0) {
        return;
      }

      const unitName = this.pickFirstText(
        rawItem?.unitName,
        rawItem?.UnitName,
        rawItem?.UNIT_NAME,
        rawItem?.name,
        rawItem?.Name,
        `وحدة ${unitId}`
      );

      const parentId = this.toPositiveInt(
        rawItem?.parentId
        ?? rawItem?.ParentId
        ?? rawItem?.PARENT_ID
        ?? rawItem?.parentUnitId
        ?? rawItem?.ParentUnitId
        ?? rawItem?.PARENT_UNIT_ID
        ?? rawItem?.parentOrgUnitId
        ?? rawItem?.ParentOrgUnitId
        ?? rawItem?.PARENT_ORG_UNIT_ID
      );

      const parentUnitName = this.pickFirstText(
        rawItem?.parentUnitName,
        rawItem?.ParentUnitName,
        rawItem?.PARENT_UNIT_NAME,
        rawItem?.parentName,
        rawItem?.ParentName,
        rawItem?.PARENT_NAME
      );

      const existing = unitMap.get(unitId);
      if (!existing) {
        unitMap.set(unitId, {
          unitId,
          unitName,
          parentId,
          parentUnitName
        });
        return;
      }

      unitMap.set(unitId, {
        unitId,
        unitName: existing.unitName.length >= unitName.length ? existing.unitName : unitName,
        parentId: existing.parentId > 0 ? existing.parentId : parentId,
        parentUnitName: existing.parentUnitName.length > 0 ? existing.parentUnitName : parentUnitName
      });
    };

    const profile = (this.authObjectsService.getUserProfile() ?? {}) as Record<string, unknown>;
    const profileUnits = profile['vwOrgUnitsWithCounts'];
    if (Array.isArray(profileUnits)) {
      profileUnits.forEach((item) => mergeUnit(item));
    }

    const rawAuth = localStorage.getItem('AuthObject') || localStorage.getItem('authObject');
    if (rawAuth) {
      try {
        const parsedAuth = JSON.parse(rawAuth) as any;
        const root = parsedAuth?.authObject ?? parsedAuth;
        const authUnits = root?.vwOrgUnitsWithCounts ?? root?.exchangeUserInfo?.vwOrgUnitsWithCounts;
        if (Array.isArray(authUnits)) {
          authUnits.forEach((item: any) => mergeUnit(item));
        }
      } catch {
        // Fall back to profile or localStorage IDs.
      }
    }

    return Array.from(unitMap.values());
  }

  private sortTreeByLabel(nodes: TreeNode[]): void {
    if (!Array.isArray(nodes) || nodes.length === 0) {
      return;
    }

    nodes.sort((left, right) => String(left.label ?? '').localeCompare(String(right.label ?? ''), 'ar'));
    nodes.forEach((node) => {
      const children = Array.isArray(node.children) ? node.children as TreeNode[] : [];
      this.sortTreeByLabel(children);
    });
  }

  private pickFirstText(...values: unknown[]): string {
    for (const value of values) {
      const normalized = String(value ?? '').trim();
      if (!normalized) {
        continue;
      }

      const lowered = normalized.toLowerCase();
      if (lowered !== 'null' && lowered !== 'undefined') {
        return normalized;
      }
    }

    return '';
  }

  private toPositiveInt(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 0;
    }

    return Math.trunc(parsed);
  }

  private resolveUnitIds(): number[] {
    const ids = new Set<number>();
    const pushId = (value: unknown): void => {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed > 0) {
        ids.add(Math.trunc(parsed));
      }
    };

    const rawAuth = localStorage.getItem('AuthObject') || localStorage.getItem('authObject');
    if (rawAuth) {
      try {
        const parsedAuth = JSON.parse(rawAuth) as any;
        const root = parsedAuth?.authObject ?? parsedAuth;
        const unitsList =
          root?.vwOrgUnitsWithCounts
          ?? root?.exchangeUserInfo?.vwOrgUnitsWithCounts
          ?? [];

        if (Array.isArray(unitsList)) {
          unitsList.forEach((item: any) => {
            pushId(item?.unitId);
            pushId(item?.UnitId);
            pushId(item?.UNIT_ID);
          });
        }
      } catch {
        // keep fallback below
      }
    }

    pushId(localStorage.getItem('unitId'));
    pushId(localStorage.getItem('UnitId'));

    return Array.from(ids);
  }

  private collectErrors(details: ResponseDetail[] | undefined): string {
    const messages = (details ?? [])
      .map(detail => detail?.responseMessage?.trim() ?? '')
      .filter(message => message.length > 0);

    if (messages.length === 0) {
      return 'حدث خطأ أثناء تنفيذ العملية.';
    }

    return messages.join('<br>');
  }

  private collectPowerBiErrors(
    errors: Array<{ message?: string | undefined }> | undefined,
    fallback: string
  ): string {
    const messages = (errors ?? [])
      .map(error => String(error?.message ?? '').trim())
      .filter(message => message.length > 0);

    return messages.length > 0 ? messages.join('<br>') : fallback;
  }

  private extractErrorMessage(error: unknown): string {
    if (typeof error === 'string' && error.trim().length > 0) {
      return error;
    }

    if (error && typeof error === 'object') {
      const candidate = (error as { message?: string }).message;
      if (candidate && candidate.trim().length > 0) {
        return candidate;
      }
    }

    return 'حدث خطأ غير متوقع أثناء الاتصال بالخدمة.';
  }
}
