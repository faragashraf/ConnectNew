import { Component, OnInit } from '@angular/core';
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

interface PaginatorEvent {
  first: number;
  rows: number;
}

interface LookupOption {
  label: string;
  value: number;
}

type EditorMode = 'add' | 'edit';

@Component({
  selector: 'app-all-publications',
  templateUrl: './all-publications.component.html',
  styleUrls: ['./all-publications.component.scss']
})
export class AllPublicationsComponent implements OnInit {
  readonly rowsPerPageOptions: number[] = [5, 10, 25];
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

  documents: DocumentResp[] = [];
  loading = false;
  totalRecords = 0;
  pageSize = 5;
  currentPage = 1;

  editorDialogVisible = false;
  editorDialogLoading = false;
  editorSubmitting = false;
  formSubmitted = false;
  editorMode: EditorMode = 'add';
  editorTitle = 'إضافة منشور جديد';
  selectedMenuNode: TreeNode | null = null;
  selectedMenuPath = '';
  menuTree: TreeNode[] = [];
  districtOptions: LookupOption[] = [];
  publicationTypeOptions: LookupOption[] = [];
  editorFileParameters: FileParameter[] = [];
  editingRow: DocumentResp | null = null;
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

  get firstRecordIndex(): number {
    return (this.currentPage - 1) * this.pageSize;
  }

  get hasAnyAttachment(): boolean {
    return this.editorFileParameters.length > 0;
  }

  ngOnInit(): void {
    this.loadDocuments();
    this.loadEditorLookups();
  }

  loadDocuments(): void {
    this.loading = true;
    this.publicationNewApiService.getAdminDocuments(this.currentPage, this.pageSize).subscribe({
      next: (response) => {
        if (response?.IsSuccess) {
          this.documents = response.Data ?? [];
          this.totalRecords = Number(response.TotalCount ?? 0);

          if (this.totalRecords === 0 && this.documents.length > 0) {
            this.totalRecords = this.firstRecordIndex + this.documents.length;
          }
          return;
        }

        this.documents = [];
        this.totalRecords = 0;
        this.msgsService.msgError('تعذر تحميل البيانات', this.collectErrors(response?.ResponseDetails), true);
      },
      error: (error: unknown) => {
        this.documents = [];
        this.totalRecords = 0;
        this.msgsService.msgError('تعذر تحميل البيانات', this.extractErrorMessage(error), true);
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  onPageChange(event: PaginatorEvent): void {
    const rows = Number(event?.rows ?? this.pageSize);
    const first = Number(event?.first ?? 0);

    if (rows > 0) {
      this.pageSize = rows;
    }

    this.currentPage = Math.floor(first / this.pageSize) + 1;
    this.loadDocuments();
  }

  loadEditorLookups(): void {
    this.editorDialogLoading = true;
    const unitIds = this.resolveUnitIds();

    forkJoin({
      publicationTypesResponse: this.publicationNewApiService.getCriteria('PublicationTypes'),
      districtsResponse: this.publicationNewApiService.getCriteria('Districts'),
      menuItemsResponse: this.publicationNewApiService.getAdminMenuItems(unitIds)
    }).subscribe({
      next: ({ publicationTypesResponse, districtsResponse, menuItemsResponse }) => {
        this.publicationTypeOptions = this.mapPublicationTypeOptions(publicationTypesResponse?.Data);
        this.districtOptions = this.mapDistrictOptions(districtsResponse?.Data);
        this.menuTree = this.buildMenuTree(menuItemsResponse?.Data ?? []);
        this.applyPendingMenuSelection();
      },
      error: (error: unknown) => {
        this.msgsService.msgError('تعذر تحميل بيانات النموذج', this.extractErrorMessage(error), true);
      },
      complete: () => {
        this.editorDialogLoading = false;
      }
    });
  }

  getRowNumber(rowIndex: number): number {
    return this.firstRecordIndex + rowIndex + 1;
  }

  displayValue(value: string | number | null | undefined): string {
    if (value === null || value === undefined) {
      return '-';
    }

    const normalized = String(value).trim();
    return normalized.length > 0 ? normalized : '-';
  }

  viewPublication(row: DocumentResp): void {
    this.msgsService.msgInfo(`سيتم إضافة شاشة عرض المنشور رقم ${row.DocumentId} في الخطوة التالية.`, 'عرض المنشور');
  }

  openAddDialog(): void {
    this.formSubmitted = false;
    this.editorMode = 'add';
    this.editorTitle = 'إضافة منشور جديد';
    this.editingRow = null;
    this.pendingMenuSelectionId = null;
    this.selectedMenuNode = null;
    this.selectedMenuPath = '';
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

    if (this.districtOptions.length === 0 || this.publicationTypeOptions.length === 0 || this.menuTree.length === 0) {
      this.loadEditorLookups();
    }
    this.editorDialogVisible = true;
  }

  editPublication(row: DocumentResp): void {
    this.formSubmitted = false;
    this.editorMode = 'edit';
    this.editorTitle = `تعديل المنشور رقم ${row.DocumentId}`;
    this.editingRow = row;
    this.editorFileParameters = this.mapExistingAttachments(row.AttachmentList);
    const menuItemId = Number(row.MENUITEMID ?? 0) || null;

    this.editorForm.reset({
      documentId: Number(row.DocumentId ?? 0),
      districtId: Number(row.DISTRICT_ID ?? 0) || null,
      publicationTypeId: Number(row.PUBLICATION_TYPE_ID ?? 0) || null,
      menuItemId,
      workingStartDate: this.parseToDate(row.WORKING_START_DATE),
      miniDoc: row.MINI_DOC ?? '',
      allTextDoc: row.ALL_TEXT_DOC ?? '',
      documentParentId: row.DOCUMENT_PARENT_ID ?? ''
    });

    this.pendingMenuSelectionId = menuItemId;
    this.applyPendingMenuSelection();

    if (this.districtOptions.length === 0 || this.publicationTypeOptions.length === 0 || this.menuTree.length === 0) {
      this.loadEditorLookups();
    }
    this.editorDialogVisible = true;
  }

  closeEditorDialog(): void {
    this.editorDialogVisible = false;
    this.editorSubmitting = false;
    this.formSubmitted = false;
  }

  submitEditor(): void {
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

    this.editorSubmitting = true;

    const request$ = this.editorMode === 'add'
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
          this.closeEditorDialog();
          this.loadDocuments();
          return;
        }

        this.msgsService.msgError('فشل الحفظ', this.collectErrors(response?.ResponseDetails), true);
      },
      error: (error: unknown) => {
        this.msgsService.msgError('تعذر حفظ البيانات', this.extractErrorMessage(error), true);
      },
      complete: () => {
        this.editorSubmitting = false;
      }
    });
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

  trackByDocumentId(_index: number, row: DocumentResp): number {
    return row.DocumentId;
  }

  isControlInvalid(controlName: string): boolean {
    const control = this.editorForm.get(controlName);
    if (!control) {
      return false;
    }

    return control.invalid && (control.touched || this.formSubmitted);
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
      if (value === null || value === undefined) {
        return;
      }

      if (Array.isArray(value)) {
        value.forEach(item => pushId(item));
        return;
      }

      if (typeof value === 'string') {
        const normalized = value.trim();
        if (!normalized) {
          return;
        }

        if ((normalized.startsWith('[') && normalized.endsWith(']'))
          || (normalized.startsWith('{') && normalized.endsWith('}'))) {
          try {
            const parsedJson = JSON.parse(normalized);
            pushId(parsedJson);
            return;
          } catch {
            // keep parsing as primitive number
          }
        }
      }

      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed > 0) {
        ids.add(Math.trunc(parsed));
      }
    };

    const rawAuthCandidates: string[] = [];
    const authObjectUpper = localStorage.getItem('AuthObject');
    const authObjectLower = localStorage.getItem('authObject');

    if (authObjectUpper) {
      rawAuthCandidates.push(authObjectUpper);
    }
    if (authObjectLower && authObjectLower !== authObjectUpper) {
      rawAuthCandidates.push(authObjectLower);
    }

    rawAuthCandidates.forEach(rawCandidate => {
      try {
        const authObject = JSON.parse(rawCandidate) as any;

        this.collectUnitIdsFromList(authObject?.vwOrgUnitsWithCounts, pushId);
        this.collectUnitIdsFromList(authObject?.exchangeUserInfo?.vwOrgUnitsWithCounts, pushId);

        // Some environments wrap the payload under `authObject`
        this.collectUnitIdsFromList(authObject?.authObject?.vwOrgUnitsWithCounts, pushId);
        this.collectUnitIdsFromList(authObject?.authObject?.exchangeUserInfo?.vwOrgUnitsWithCounts, pushId);

        // Fallback: when the parsed payload itself is already the units array
        this.collectUnitIdsFromList(authObject, pushId);
      } catch {
        // ignore invalid local storage object
      }
    });

    pushId(localStorage.getItem('UnitId'));
    pushId(localStorage.getItem('unitId'));
    return Array.from(ids);
  }

  private collectUnitIdsFromList(source: unknown, pushId: (value: unknown) => void): void {
    if (!Array.isArray(source)) {
      return;
    }

    source.forEach((item: any) => {
      pushId(item?.UNIT_ID);
      pushId(item?.UnitId);
      pushId(item?.unitId);
      pushId(item?.ID);
      pushId(item?.Id);
    });
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
