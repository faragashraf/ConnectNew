import { Component, OnInit } from '@angular/core';
import {
  normalizeRequestViewMode,
  RequestViewMode,
  REQUEST_VIEW_MODE_OPTIONS_AR,
  REQUEST_VIEW_MODE_STANDARD,
  resolveRequestViewModeLabel
} from 'src/app/shared/models/request-view-mode';
import { CommonResponse } from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.dto';
import { DynamicSubjectsAdminCatalogController } from 'src/app/shared/services/BackendServices/DynamicSubjectsAdminCatalog/DynamicSubjectsAdminCatalog.service';
import {
  AdminCatalogCategoryTreeNodeDto,
  AdminControlCenterDiagnosticMessageDto,
  AdminControlCenterRequestPreviewDto
} from 'src/app/shared/services/BackendServices/DynamicSubjectsAdminCatalog/DynamicSubjectsAdminCatalog.dto';

type MessageSeverity = 'success' | 'warn' | 'error';

type RequestTypeOption = {
  label: string;
  value: number;
  pathLabel: string;
  isActive: boolean;
  applicationId?: string;
  defaultViewMode: RequestViewMode;
  allowRequesterOverride: boolean;
};

@Component({
  selector: 'app-admin-control-center-request-preview-page',
  templateUrl: './admin-control-center-request-preview-page.component.html',
  styleUrls: ['./admin-control-center-request-preview-page.component.scss']
})
export class AdminControlCenterRequestPreviewPageComponent implements OnInit {
  requestTypeOptions: RequestTypeOption[] = [];
  selectedRequestTypeId: number | null = null;
  previewSelectedViewMode: RequestViewMode = REQUEST_VIEW_MODE_STANDARD;

  readonly viewModeOptions: Array<{ label: string; value: RequestViewMode }> = [...REQUEST_VIEW_MODE_OPTIONS_AR];

  preview: AdminControlCenterRequestPreviewDto | null = null;

  loadingRequestTypes = false;
  loadingPreview = false;

  message = '';
  messageSeverity: MessageSeverity = 'success';

  constructor(private readonly adminCatalogController: DynamicSubjectsAdminCatalogController) {}

  ngOnInit(): void {
    this.loadRequestTypes();
  }

  get selectedRequestType(): RequestTypeOption | null {
    if (!this.selectedRequestTypeId) {
      return null;
    }

    return this.requestTypeOptions.find(item => item.value === this.selectedRequestTypeId) ?? null;
  }

  get canLoadPreview(): boolean {
    return this.selectedRequestTypeId != null && this.selectedRequestTypeId > 0 && !this.loadingPreview;
  }

  get selectedRequestTypeDefaultViewModeLabel(): string {
    const selected = this.selectedRequestType;
    if (!selected) {
      return '-';
    }

    return resolveRequestViewModeLabel(selected.defaultViewMode);
  }

  get selectedRequestTypeAllowRequesterOverride(): boolean {
    return this.selectedRequestType?.allowRequesterOverride === true;
  }

  get activePreviewViewModeLabel(): string {
    return resolveRequestViewModeLabel(this.previewSelectedViewMode);
  }

  get visibleFieldsCount(): number {
    return (this.preview?.fields ?? []).filter(item => item.isVisible).length;
  }

  get hiddenFieldsCount(): number {
    return (this.preview?.fields ?? []).filter(item => !item.isVisible).length;
  }

  get requiredFieldsCount(): number {
    return (this.preview?.fields ?? []).filter(item => item.isRequired).length;
  }

  get optionalFieldsCount(): number {
    return (this.preview?.fields ?? []).filter(item => !item.isRequired).length;
  }

  get userUnitsLabel(): string {
    const units = this.preview?.userUnitIds ?? [];
    return units.length > 0 ? units.join(' , ') : '-';
  }

  get userPositionsLabel(): string {
    const positions = this.preview?.userPositionIds ?? [];
    return positions.length > 0 ? positions.join(' , ') : '-';
  }

  get requestInfoDiagnostics(): AdminControlCenterDiagnosticMessageDto[] {
    return (this.preview?.diagnostics ?? []).filter(item => item.severity === 'Info');
  }

  get requestWarningDiagnostics(): AdminControlCenterDiagnosticMessageDto[] {
    return (this.preview?.diagnostics ?? []).filter(item => item.severity === 'Warning');
  }

  get requestConflictDiagnostics(): AdminControlCenterDiagnosticMessageDto[] {
    return (this.preview?.diagnostics ?? []).filter(item => item.severity === 'Conflict');
  }

  get requestWarningsCount(): number {
    return this.preview?.warnings?.length ?? 0;
  }

  get requestConflictsCount(): number {
    return this.preview?.conflicts?.length ?? 0;
  }

  resolveFieldInfoCount(field: { diagnostics?: AdminControlCenterDiagnosticMessageDto[] }): number {
    return (field.diagnostics ?? []).filter(item => item.severity === 'Info').length;
  }

  onRefreshRequestTypes(): void {
    this.loadRequestTypes();
  }

  onRequestTypeChange(requestTypeId: number | null): void {
    this.selectedRequestTypeId = this.normalizeNumber(requestTypeId);
    this.preview = null;
    this.message = '';
    this.initializePreviewViewModeForSelection();

    if (!this.selectedRequestTypeId) {
      return;
    }

    this.loadPreview();
  }

  onRefreshPreview(): void {
    this.loadPreview();
  }

  onPreviewViewModeChange(nextMode: RequestViewMode | null | undefined): void {
    this.previewSelectedViewMode = this.normalizeViewMode(nextMode);
  }

  trackByFieldId(_index: number, item: { fieldId: number }): number {
    return item.fieldId;
  }

  trackByString(_index: number, item: string): string {
    return item;
  }

  trackByDiagnostic(_index: number, item: AdminControlCenterDiagnosticMessageDto): string {
    return `${item.severity}:${item.code ?? '-'}:${item.message}`;
  }

  private loadRequestTypes(): void {
    this.loadingRequestTypes = true;

    this.adminCatalogController.getCategoryTree().subscribe({
      next: response => {
        if (!this.ensureSuccess(response, 'تعذر تحميل قائمة أنواع الطلبات.')) {
          this.requestTypeOptions = [];
          this.preview = null;
          return;
        }

        const options = this.flattenRequestTypeTree(response.data ?? []);
        this.requestTypeOptions = options;

        const selectedStillExists = this.selectedRequestTypeId
          ? options.some(item => item.value === this.selectedRequestTypeId)
          : false;

        if (!selectedStillExists) {
          this.selectedRequestTypeId = options.length > 0 ? options[0].value : null;
        }
        this.initializePreviewViewModeForSelection();

        if (this.selectedRequestTypeId) {
          this.loadPreview();
        }
      },
      error: () => {
        this.showMessage('error', 'حدث خطأ أثناء تحميل أنواع الطلبات.');
        this.requestTypeOptions = [];
        this.preview = null;
      },
      complete: () => {
        this.loadingRequestTypes = false;
      }
    });
  }

  private loadPreview(): void {
    const requestTypeId = this.normalizeNumber(this.selectedRequestTypeId);
    if (!requestTypeId || requestTypeId <= 0) {
      return;
    }

    this.loadingPreview = true;
    this.preview = null;

    this.adminCatalogController.getRequestPreview(requestTypeId).subscribe({
      next: response => {
        if (!this.ensureSuccess(response, 'تعذر تحميل المعاينة التشغيلية الفعالة للطلب.')) {
          this.preview = null;
          return;
        }

        this.preview = response.data ?? null;
      },
      error: () => {
        this.showMessage('error', 'حدث خطأ أثناء تحميل المعاينة التشغيلية الفعالة للطلب.');
        this.preview = null;
      },
      complete: () => {
        this.loadingPreview = false;
      }
    });
  }

  private flattenRequestTypeTree(nodes: AdminCatalogCategoryTreeNodeDto[]): RequestTypeOption[] {
    const options: RequestTypeOption[] = [];

    const walk = (items: AdminCatalogCategoryTreeNodeDto[], ancestorPath: string): void => {
      for (const node of items ?? []) {
        const categoryId = this.normalizeNumber(node.categoryId);
        if (!categoryId || categoryId <= 0) {
          continue;
        }

        const nodeName = this.normalizeText(node.categoryName) ?? `عقدة ${categoryId}`;
        const pathLabel = ancestorPath.length > 0 ? `${ancestorPath} / ${nodeName}` : nodeName;

        options.push({
          label: `${pathLabel} (#${categoryId})`,
          value: categoryId,
          pathLabel,
          isActive: node.isActive === true,
          applicationId: this.normalizeText(node.applicationId) ?? undefined,
          defaultViewMode: this.normalizeViewMode(node.defaultViewMode),
          allowRequesterOverride: node.allowRequesterOverride === true
        });

        walk(node.children ?? [], pathLabel);
      }
    };

    walk(nodes ?? [], '');

    return options.sort((left, right) => left.label.localeCompare(right.label, 'ar'));
  }

  private ensureSuccess<T>(response: CommonResponse<T>, fallbackMessage: string): response is CommonResponse<T> {
    if (!response) {
      this.showMessage('error', fallbackMessage);
      return false;
    }

    if (response.isSuccess && (response.errors?.length ?? 0) === 0) {
      return true;
    }

    const firstError = response.errors?.find(error => this.normalizeText(error.message) != null);
    this.showMessage('error', this.normalizeText(firstError?.message) ?? fallbackMessage);
    return false;
  }

  private showMessage(severity: MessageSeverity, message: string): void {
    this.messageSeverity = severity;
    this.message = message;
  }

  private normalizeText(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : null;
  }

  private normalizeNumber(value: unknown): number | null {
    if (value == null || value === '') {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }

  private initializePreviewViewModeForSelection(): void {
    const selected = this.selectedRequestType;
    if (!selected) {
      this.previewSelectedViewMode = REQUEST_VIEW_MODE_STANDARD;
      return;
    }

    this.previewSelectedViewMode = this.normalizeViewMode(selected.defaultViewMode);
  }

  private normalizeViewMode(value: unknown): RequestViewMode {
    return normalizeRequestViewMode(value);
  }
}
