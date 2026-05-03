import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  DocumentResp,
  DocumentRespPagedResult,
  ExpressionDto,
  PUB_MENU_ITEMS,
  ResponseDetail
} from 'src/app/shared/services/BackendServices/Publications/Publications.dto';
import { AuthObjectsService, TreeNode } from 'src/app/shared/services/helper/auth-objects.service';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { PublicationNewApiService } from '../../shared/services/publication-new-api.service';
import { PublicationEditorMode } from '../publication-editor-form/publication-editor-form.component';

interface LookupOption {
  label: string;
  value: number;
}

interface PaginatorEvent {
  first: number;
  rows: number;
}

@Component({
  selector: 'app-all-publications',
  templateUrl: './all-publications.component.html',
  styleUrls: ['./all-publications.component.scss']
})
export class AllPublicationsComponent implements OnInit {
  private readonly publicationSuperAdminRoleId = '2011';

  readonly rowsPerPageOptions: number[] = [5, 10, 25];

  searchFiltersCollapsed = true;
  lookupsLoading = false;
  loading = false;
  totalRecords = 0;
  currentPage = 1;
  pageSize = 5;
  canEditActivation = false;

  documents: DocumentResp[] = [];
  publicationTypeOptions: LookupOption[] = [];
  districtOptions: LookupOption[] = [];
  activationStatusOptions: Array<{ label: string; value: string }> = [
    { label: 'مفعل', value: '1' },
    { label: 'غير مفعل', value: '0' }
  ];
  menuTree: TreeNode[] = [];

  selectedMenuNode: TreeNode | null = null;
  selectedMenuItemId: number | null = null;
  selectedMenuPath = '';

  editorDialogVisible = false;
  editorDialogTitle = '';
  editorDialogMode: PublicationEditorMode = 'edit';
  selectedPublication: DocumentResp | null = null;

  private activeExpressions: ExpressionDto[] = [];
  private readonly activationLoadingDocumentIds = new Set<number>();

  readonly searchForm: FormGroup = this.fb.group({
    documentNumber: [''],
    districtId: [null],
    publicationTypeId: [null],
    activationStatus: [null],
    miniDoc: [''],
    allTextDoc: [''],
    workingStartDate: [null]
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly publicationNewApiService: PublicationNewApiService,
    private readonly msgsService: MsgsService,
    private readonly authObjectsService: AuthObjectsService,
    private readonly router: Router
  ) { }

  get firstRecordIndex(): number {
    return (this.currentPage - 1) * this.pageSize;
  }

  get activeFilterCount(): number {
    return this.activeExpressions.length;
  }

  ngOnInit(): void {
    this.canEditActivation =
      this.authObjectsService.checkAuthFun('PublSuperAdminFunc')
      && this.authObjectsService.checkAuthRole(this.publicationSuperAdminRoleId);

    this.loadInitialData();
  }

  onSearch(): void {
    this.currentPage = 1;
    this.pageSize = 25;
    this.activeExpressions = this.buildExpressionsFromFilters();
    this.loadDocuments();
  }

  onResetFilters(): void {
    this.searchForm.reset({
      documentNumber: '',
      districtId: null,
      publicationTypeId: null,
      activationStatus: null,
      miniDoc: '',
      allTextDoc: '',
      workingStartDate: null
    });

    this.clearMenuSelection();
    this.currentPage = 1;
    this.pageSize = 5;
    this.activeExpressions = [];
    this.loadDocuments();
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

  onMenuNodeSelect(event: any): void {
    const node: TreeNode | null = (event?.node ?? event) as TreeNode;
    if (!node) {
      return;
    }

    this.selectedMenuNode = node;
    const selectedId = Number(node.key ?? node.data?.['MENU_ITEM_ID'] ?? 0);
    this.selectedMenuItemId = selectedId > 0 ? selectedId : null;
    this.selectedMenuPath = this.selectedMenuItemId ? this.getPathByKey(String(this.selectedMenuItemId)) : '';
  }

  clearMenuSelection(): void {
    this.selectedMenuNode = null;
    this.selectedMenuItemId = null;
    this.selectedMenuPath = '';
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

  goToCreateRoute(): void {
    this.router.navigate(['/PublicationNew/AdminCreate']);
  }

  openViewDialog(row: DocumentResp): void {
    const documentType = this.displayValue(row.DocumentType);
    const title = documentType !== '-'
      ? `عرض المنشور رقم ${row.DocumentId} - نوع الوثيقة: ${documentType}`
      : `عرض المنشور رقم ${row.DocumentId}`;
    this.openEditorDialog('view', row, title);
  }

  openEditDialog(row: DocumentResp): void {
    this.openEditorDialog('edit', row, `تعديل المنشور رقم ${row.DocumentId}`);
  }

  async toggleActivation(row: DocumentResp): Promise<void> {
    const documentId = Number(row?.DocumentId ?? 0);
    if (documentId <= 0 || this.activationLoadingDocumentIds.has(documentId)) {
      return;
    }

    const currentlyActive = this.isDocumentActive(row);
    const nextVal = currentlyActive ? '0' : '1';
    const actionText = currentlyActive ? 'تعطيل' : 'تفعيل';

    const confirmed = await this.msgsService.msgConfirm(
      `سيتم ${actionText} المنشور رقم ${documentId}. هل تريد المتابعة؟`,
      actionText
    );

    if (!confirmed) {
      return;
    }

    this.activationLoadingDocumentIds.add(documentId);

    this.publicationNewApiService.editActivation(documentId, nextVal).subscribe({
      next: (response) => {
        if (response?.IsSuccess) {
          row.VAL = nextVal;
          if (response.Document_Number && response.Document_Number.trim().length > 0) {
            row.DOCUMENT_NUMBER = response.Document_Number.trim();
          }

          this.msgsService.msgSuccess(
            nextVal === '1' ? 'تم تفعيل المنشور بنجاح' : 'تم تعطيل المنشور بنجاح',
            4000
          );
          return;
        }

        this.msgsService.msgError('تعذر تحديث حالة المنشور', this.collectErrors(response?.ResponseDetails), true);
      },
      error: (error: unknown) => {
        this.msgsService.msgError('تعذر تحديث حالة المنشور', this.extractErrorMessage(error), true);
      },
      complete: () => {
        this.activationLoadingDocumentIds.delete(documentId);
      }
    });
  }

  getActivationButtonLabel(row: DocumentResp): string {
    return this.isDocumentActive(row) ? 'تعطيل المنشور' : 'تفعيل المنشور';
  }

  isActivationLoading(documentId: number): boolean {
    return this.activationLoadingDocumentIds.has(Number(documentId));
  }

  closeEditorDialog(): void {
    this.editorDialogVisible = false;
    this.selectedPublication = null;
  }

  onEditorSaved(): void {
    this.closeEditorDialog();
    this.loadDocuments();
  }

  onEditorCancelled(): void {
    this.closeEditorDialog();
  }

  trackByDocumentId(_index: number, row: DocumentResp): number {
    return row.DocumentId;
  }

  loadDocuments(): void {
    this.loading = true;
    this.publicationNewApiService.getAdminDocuments(this.currentPage, this.pageSize, this.activeExpressions).subscribe({
      next: (response) => {
        this.applyDocumentsResponse(response);
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

  private loadInitialData(): void {
    this.lookupsLoading = true;

    forkJoin({
      publicationTypesResponse: this.publicationNewApiService.getCriteria('PublicationTypes'),
      districtsResponse: this.publicationNewApiService.getCriteria('Districts'),
      menuItemsResponse: this.publicationNewApiService.getMenuItems(),
      documentsResponse: this.publicationNewApiService.getAdminDocuments(this.currentPage, this.pageSize, [])
    }).subscribe({
      next: ({ publicationTypesResponse, districtsResponse, menuItemsResponse, documentsResponse }) => {
        this.publicationTypeOptions = this.mapPublicationTypeOptions(publicationTypesResponse?.Data);
        this.districtOptions = this.mapDistrictOptions(districtsResponse?.Data);
        this.menuTree = this.buildMenuTree(menuItemsResponse?.Data ?? []);
        this.applyDocumentsResponse(documentsResponse);
      },
      error: (error: unknown) => {
        this.documents = [];
        this.totalRecords = 0;
        this.msgsService.msgError('تعذر تحميل بيانات البحث', this.extractErrorMessage(error), true);
      },
      complete: () => {
        this.lookupsLoading = false;
      }
    });
  }

  private applyDocumentsResponse(response: DocumentRespPagedResult | null | undefined): void {
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
  }

  private buildExpressionsFromFilters(): ExpressionDto[] {
    const expressions: ExpressionDto[] = [];
    const raw = this.searchForm.value;

    const pushStringExpression = (propertyName: string, value: unknown): void => {
      const normalized = String(value ?? '').trim();
      if (normalized.length > 0) {
        expressions.push({
          PropertyName: propertyName,
          PropertyStringValue: normalized
        } as ExpressionDto);
      }
    };

    const pushIntegerExpression = (propertyName: string, value: unknown): void => {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed > 0) {
        expressions.push({
          PropertyName: propertyName,
          PropertyIntValue: Math.trunc(parsed)
        } as ExpressionDto);
      }
    };

    const pushDateExpression = (propertyName: string, value: unknown): void => {
      const parsedDate = this.parseToDate(value);
      if (!parsedDate) {
        return;
      }

      expressions.push({
        PropertyName: propertyName,
        PropertyDateValue: parsedDate
      } as ExpressionDto);
    };

    pushStringExpression('DOCUMENT_NUMBER', raw?.['documentNumber']);
    pushIntegerExpression('DISTRICT_ID', raw?.['districtId']);
    pushIntegerExpression('PUBLICATION_TYPE_ID', raw?.['publicationTypeId']);
    pushStringExpression('VAL', raw?.['activationStatus']);
    pushStringExpression('MINI_DOC', raw?.['miniDoc']);
    pushStringExpression('ALL_TEXT_DOC', raw?.['allTextDoc']);
    pushDateExpression('WORKING_START_DATE', raw?.['workingStartDate']);

    if (this.selectedMenuItemId && this.selectedMenuItemId > 0) {
      expressions.push({
        PropertyName: 'MENUITEMID',
        PropertyIntValue: this.selectedMenuItemId
      } as ExpressionDto);
    }

    return expressions;
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
        nodeMap.get(parentId)?.children?.push(node);
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

  private openEditorDialog(mode: PublicationEditorMode, publication: DocumentResp, title: string): void {
    this.editorDialogMode = mode;
    this.selectedPublication = publication;
    this.editorDialogTitle = title;
    this.editorDialogVisible = true;
  }

  private isDocumentActive(row: DocumentResp): boolean {
    return String(row?.VAL ?? '').trim() === '1';
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
