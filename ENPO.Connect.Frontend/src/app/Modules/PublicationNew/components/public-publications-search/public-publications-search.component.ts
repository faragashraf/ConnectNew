import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { forkJoin } from 'rxjs';
import {
  AttachmentList,
  DocumentResp,
  DocumentRespPagedResult,
  ExpressionDto,
  PUB_MENU_ITEMS,
  ResponseDetail
} from 'src/app/shared/services/BackendServices/Publications/Publications.dto';
import { TreeNode } from 'src/app/shared/services/helper/auth-objects.service';
import { AttchedObjectService } from 'src/app/shared/services/helper/attched-object.service';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { PublicationNewApiService } from '../../shared/services/publication-new-api.service';

interface LookupOption {
  label: string;
  value: number;
}

interface PaginatorEvent {
  first: number;
  rows: number;
}

@Component({
  selector: 'app-public-publications-search',
  templateUrl: './public-publications-search.component.html',
  styleUrls: ['./public-publications-search.component.scss']
})
export class PublicPublicationsSearchComponent implements OnInit {
  readonly rowsPerPageOptions: number[] = [5, 10, 25];

  searchFiltersCollapsed = true;
  lookupsLoading = false;
  loading = false;
  totalRecords = 0;
  currentPage = 1;
  pageSize = 5;

  documents: DocumentResp[] = [];
  publicationTypeOptions: LookupOption[] = [];
  districtOptions: LookupOption[] = [];
  menuTree: TreeNode[] = [];
  detailsDialogVisible = false;
  selectedPublication: DocumentResp | null = null;
  selectedPublicationAttachments: AttachmentList[] = [];

  selectedMenuNode: TreeNode | null = null;
  selectedMenuItemId: number | null = null;
  selectedMenuPath = '';

  private activeExpressions: ExpressionDto[] = [];
  private readonly downloadingAttachmentIds = new Set<number>();

  readonly searchForm: FormGroup = this.fb.group({
    documentNumber: [''],
    districtId: [null],
    publicationTypeId: [null],
    miniDoc: [''],
    allTextDoc: [''],
    workingStartDate: [null]
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly publicationNewApiService: PublicationNewApiService,
    private readonly attchedObjectService: AttchedObjectService,
    private readonly msgsService: MsgsService
  ) { }

  get firstRecordIndex(): number {
    return (this.currentPage - 1) * this.pageSize;
  }

  get activeFilterCount(): number {
    return this.activeExpressions.length;
  }

  ngOnInit(): void {
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

  displayValue(value: string | number | null | undefined): string {
    if (value === null || value === undefined) {
      return '-';
    }

    const normalized = String(value).trim();
    return normalized.length > 0 ? normalized : '-';
  }

  getRowNumber(rowIndex: number): number {
    return this.firstRecordIndex + rowIndex + 1;
  }

  hasAttachments(row: DocumentResp | null): boolean {
    return this.normalizeAttachments(row?.AttachmentList).length > 0;
  }

  getFirstAttachmentId(row: DocumentResp | null): number {
    const firstAttachment = this.normalizeAttachments(row?.AttachmentList)[0];
    return Number(firstAttachment?.ATTACHMENT_ID ?? 0);
  }

  isAttachmentLoading(attachmentId: number): boolean {
    return this.downloadingAttachmentIds.has(Number(attachmentId));
  }

  openDetailsDialog(row: DocumentResp): void {
    this.selectedPublication = row;
    this.selectedPublicationAttachments = this.normalizeAttachments(row?.AttachmentList);
    this.detailsDialogVisible = true;
  }

  closeDetailsDialog(): void {
    this.detailsDialogVisible = false;
    this.selectedPublication = null;
    this.selectedPublicationAttachments = [];
  }

  downloadFirstAttachment(row: DocumentResp): void {
    const firstAttachment = this.normalizeAttachments(row?.AttachmentList)[0];
    if (!firstAttachment) {
      this.msgsService.msgInfo('لا يوجد مرفق لهذا المنشور.', 'تنبيه', 'warn');
      return;
    }

    this.downloadAttachment(firstAttachment);
  }

  downloadAttachmentItem(attachment: AttachmentList): void {
    this.downloadAttachment(attachment);
  }

  private loadInitialData(): void {
    this.lookupsLoading = true;

    forkJoin({
      publicationTypesResponse: this.publicationNewApiService.getCriteria('PublicationTypes'),
      districtsResponse: this.publicationNewApiService.getCriteria('Districts'),
      menuItemsResponse: this.publicationNewApiService.getMenuItems(),
      documentsResponse: this.publicationNewApiService.getUserDocuments(this.currentPage, this.pageSize, [])
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

  private loadDocuments(): void {
    this.loading = true;

    this.publicationNewApiService.getUserDocuments(this.currentPage, this.pageSize, this.activeExpressions).subscribe({
      next: (response) => {
        this.applyDocumentsResponse(response);
      },
      error: (error: unknown) => {
        this.documents = [];
        this.totalRecords = 0;
        this.msgsService.msgError('تعذر تحميل المنشورات', this.extractErrorMessage(error), true);
      },
      complete: () => {
        this.loading = false;
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
    this.msgsService.msgError('تعذر تحميل المنشورات', this.collectErrors(response?.ResponseDetails), true);
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

  private normalizeAttachments(attachments: AttachmentList[] | undefined): AttachmentList[] {
    return (attachments ?? []).filter(item => Number(item?.ATTACHMENT_ID ?? 0) > 0);
  }

  private downloadAttachment(attachment: AttachmentList): void {
    const attachmentId = Number(attachment?.ATTACHMENT_ID ?? 0);
    if (attachmentId <= 0 || this.downloadingAttachmentIds.has(attachmentId)) {
      return;
    }

    const fallbackName = `attachment-${attachmentId}.doc`;
    const fileName = String(attachment.FILE_NAME ?? '').trim() || fallbackName;
    this.downloadingAttachmentIds.add(attachmentId);

    this.publicationNewApiService.getFileContent(attachmentId).subscribe({
      next: (response) => {
        if (response?.IsSuccess && response.FILE_CONTENT) {
          this.attchedObjectService.createObjectURL(response.FILE_CONTENT, fileName);
          return;
        }

        this.msgsService.msgError('تعذر تنزيل المرفق', this.collectErrors(response?.ResponseDetails), true);
      },
      error: (error: unknown) => {
        this.msgsService.msgError('تعذر تنزيل المرفق', this.extractErrorMessage(error), true);
      },
      complete: () => {
        this.downloadingAttachmentIds.delete(attachmentId);
      }
    });
  }
}
