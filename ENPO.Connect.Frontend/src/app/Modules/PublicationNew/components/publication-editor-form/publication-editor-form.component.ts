import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ComponentConfig } from 'src/app/shared/models/Component.Config.model';
import {
  AttachmentList,
  DocumentResp,
  PUB_MENU_ITEMS,
  ResponseDetail
} from 'src/app/shared/services/BackendServices/Publications/Publications.dto';
import { FileParameter } from 'src/app/shared/services/BackendServices/dto-shared';
import { AttchedObjectService } from 'src/app/shared/services/helper/attched-object.service';
import { TreeNode } from 'src/app/shared/services/helper/auth-objects.service';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { PublicationNewApiService } from '../../shared/services/publication-new-api.service';

interface LookupOption {
  label: string;
  value: number;
}

export type PublicationEditorMode = 'add' | 'edit' | 'view';

@Component({
  selector: 'app-publication-editor-form',
  templateUrl: './publication-editor-form.component.html',
  styleUrls: ['./publication-editor-form.component.scss']
})
export class PublicationEditorFormComponent implements OnInit, OnChanges {
  @Input() mode: PublicationEditorMode = 'add';
  @Input() publication: DocumentResp | null = null;

  @Output() saved = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  readonly attachmentUiConfig: ComponentConfig = {
    attachmentConfig: {
      showAttachmentSection: true,
      AllowedExtensions: ['.doc', '.docx'],
      maximumFileSize: 10,
      maxFileCount: 10,
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
  submitting = false;
  formSubmitted = false;

  selectedMenuNode: TreeNode | null = null;
  selectedMenuPath = '';
  menuTree: TreeNode[] = [];
  districtOptions: LookupOption[] = [];
  publicationTypeOptions: LookupOption[] = [];
  editorFileParameters: FileParameter[] = [];

  private pendingMenuSelectionId: number | null = null;

  readonly editorForm: FormGroup = this.fb.group({
    documentId: [0],
    districtId: [null, Validators.required],
    publicationTypeId: [null, Validators.required],
    menuItemId: [null, Validators.required],
    workingStartDate: [null, Validators.required],
    miniDoc: ['', Validators.required],
    allTextDoc: ['', Validators.required],
    documentParentId: ['']
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly publicationNewApiService: PublicationNewApiService,
    private readonly msgsService: MsgsService,
    private readonly attchedObjectService: AttchedObjectService
  ) { }

  get isViewMode(): boolean {
    return this.mode === 'view';
  }

  get canSubmit(): boolean {
    return this.mode === 'add' || this.mode === 'edit';
  }

  get hasAnyAttachment(): boolean {
    return this.editorFileParameters.length > 0;
  }

  ngOnInit(): void {
    this.resetForCurrentInputs();
    this.loadLookups();
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
    const workingStartDate = this.parseToDate(this.editorForm.get('workingStartDate')?.value) ?? new Date();
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

  private resetForCurrentInputs(): void {
    this.formSubmitted = false;
    this.submitting = false;
    this.selectedMenuNode = null;
    this.selectedMenuPath = '';
    this.pendingMenuSelectionId = null;

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
    this.publicationNewApiService.getAdminMenuItems(unitIds).subscribe({
      next: (adminResponse) => {
        const adminItems = adminResponse?.Data ?? [];
        if (adminItems.length > 0) {
          this.menuTree = this.buildMenuTree(adminItems);
          this.applyPendingMenuSelection();
          this.lookupsLoading = false;
          return;
        }

        this.loadMenuTreeFromGetMenuItems();
      },
      error: () => {
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
    const labels = this.findPathLabels(this.menuTree, key, []);
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
