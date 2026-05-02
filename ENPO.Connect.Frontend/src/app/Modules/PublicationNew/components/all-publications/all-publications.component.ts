import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DocumentResp, ResponseDetail } from 'src/app/shared/services/BackendServices/Publications/Publications.dto';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { PublicationNewApiService } from '../../shared/services/publication-new-api.service';
import { PublicationEditorMode } from '../publication-editor-form/publication-editor-form.component';

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
  readonly rowsPerPageOptions: number[] = [5, 10, 25];

  documents: DocumentResp[] = [];
  loading = false;
  totalRecords = 0;
  pageSize = 5;
  currentPage = 1;

  editorDialogVisible = false;
  editorDialogTitle = '';
  editorDialogMode: PublicationEditorMode = 'edit';
  selectedPublication: DocumentResp | null = null;

  constructor(
    private readonly publicationNewApiService: PublicationNewApiService,
    private readonly msgsService: MsgsService,
    private readonly router: Router
  ) { }

  get firstRecordIndex(): number {
    return (this.currentPage - 1) * this.pageSize;
  }

  ngOnInit(): void {
    this.loadDocuments();
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
    this.router.navigate(['/PublicationNew/create']);
  }

  openViewDialog(row: DocumentResp): void {
    this.openEditorDialog('view', row, `عرض المنشور رقم ${row.DocumentId}`);
  }

  openEditDialog(row: DocumentResp): void {
    this.openEditorDialog('edit', row, `تعديل المنشور رقم ${row.DocumentId}`);
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

  private openEditorDialog(mode: PublicationEditorMode, publication: DocumentResp, title: string): void {
    this.editorDialogMode = mode;
    this.selectedPublication = publication;
    this.editorDialogTitle = title;
    this.editorDialogVisible = true;
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
