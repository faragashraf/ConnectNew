import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonResponse } from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.dto';
import {
  AdminCatalogCategoryDisplaySettingsDto,
  AdminCatalogCategoryDisplaySettingsUpsertRequestDto
} from 'src/app/shared/services/BackendServices/DynamicSubjectsAdminCatalog/DynamicSubjectsAdminCatalog.dto';
import { DynamicSubjectsAdminCatalogController } from 'src/app/shared/services/BackendServices/DynamicSubjectsAdminCatalog/DynamicSubjectsAdminCatalog.service';

type MessageSeverity = 'success' | 'warn' | 'error';
type ViewMode = 'standard' | 'tabbed';

type SelectOption<T = string> = {
  label: string;
  value: T;
};

@Component({
  selector: 'app-admin-control-center-catalog-display-settings-workspace',
  templateUrl: './admin-control-center-catalog-display-settings-workspace.component.html',
  styleUrls: ['./admin-control-center-catalog-display-settings-workspace.component.scss']
})
export class AdminControlCenterCatalogDisplaySettingsWorkspaceComponent implements OnChanges {
  @Input() requestTypeId: number | null = null;
  @Input() requestTypeLabel = '';

  readonly settingsForm: FormGroup = this.fb.group({
    defaultViewMode: ['standard', [Validators.required]],
    allowRequesterOverride: [false]
  });

  readonly viewModeOptions: SelectOption<ViewMode>[] = [
    { label: 'Standard', value: 'standard' },
    { label: 'Tabbed', value: 'tabbed' }
  ];

  loading = false;
  saving = false;

  message = '';
  messageSeverity: MessageSeverity = 'success';

  private persistedSnapshot = '';

  constructor(
    private readonly fb: FormBuilder,
    private readonly adminCatalogController: DynamicSubjectsAdminCatalogController
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['requestTypeId']) {
      return;
    }

    this.message = '';
    this.persistedSnapshot = '';

    if (!this.canManageWorkspace) {
      this.resetForm();
      return;
    }

    this.loadSettings();
  }

  get requestContextLabel(): string {
    if (this.requestTypeLabel.trim().length > 0) {
      return this.requestTypeLabel;
    }

    return this.requestTypeId ? `Request Type #${this.requestTypeId}` : 'لم يتم اختيار نوع طلب';
  }

  get canManageWorkspace(): boolean {
    return !!this.requestTypeId && this.requestTypeId > 0;
  }

  get canSave(): boolean {
    return this.canManageWorkspace
      && !this.loading
      && !this.saving
      && this.settingsForm.valid
      && this.hasUnsavedChanges;
  }

  get hasUnsavedChanges(): boolean {
    if (!this.canManageWorkspace || this.loading) {
      return false;
    }

    return this.buildSnapshot() !== this.persistedSnapshot;
  }

  get saveDisabledReason(): string {
    if (!this.canManageWorkspace) {
      return 'اختر Request Type أولًا.';
    }

    if (this.loading) {
      return 'جاري تحميل الإعدادات...';
    }

    if (this.saving) {
      return 'جاري الحفظ...';
    }

    if (!this.hasUnsavedChanges) {
      return 'لا توجد تغييرات جديدة للحفظ.';
    }

    return '';
  }

  get activeViewModeLabel(): string {
    return this.normalizeViewMode(this.settingsForm.get('defaultViewMode')?.value) === 'tabbed'
      ? 'Tabbed'
      : 'Standard';
  }

  get allowRequesterOverride(): boolean {
    return this.settingsForm.get('allowRequesterOverride')?.value === true;
  }

  onRefresh(): void {
    if (!this.canManageWorkspace || this.loading) {
      return;
    }

    this.loadSettings();
  }

  onSave(): void {
    if (!this.canSave || !this.requestTypeId) {
      return;
    }

    const request: AdminCatalogCategoryDisplaySettingsUpsertRequestDto = {
      defaultViewMode: this.normalizeViewMode(this.settingsForm.get('defaultViewMode')?.value),
      allowRequesterOverride: this.settingsForm.get('allowRequesterOverride')?.value === true
    };

    this.saving = true;
    this.adminCatalogController.upsertCategoryDisplaySettings(this.requestTypeId, request).subscribe({
      next: response => {
        if (!this.ensureSuccess(response, 'تعذر حفظ إعدادات العرض.')) {
          return;
        }

        this.applyLoadedSettings(response.data);
        this.showMessage('success', 'تم حفظ إعدادات العرض بنجاح.');
      },
      error: () => this.showMessage('error', 'حدث خطأ أثناء حفظ إعدادات العرض.'),
      complete: () => {
        this.saving = false;
      }
    });
  }

  private loadSettings(): void {
    if (!this.requestTypeId) {
      this.resetForm();
      return;
    }

    this.loading = true;

    this.adminCatalogController.getCategoryDisplaySettings(this.requestTypeId).subscribe({
      next: response => {
        if (!this.ensureSuccess(response, 'تعذر تحميل إعدادات العرض.')) {
          this.resetForm();
          return;
        }

        this.applyLoadedSettings(response.data);
      },
      error: () => {
        this.resetForm();
        this.showMessage('error', 'حدث خطأ أثناء تحميل إعدادات العرض.');
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  private applyLoadedSettings(data: AdminCatalogCategoryDisplaySettingsDto | null | undefined): void {
    this.settingsForm.reset(
      {
        defaultViewMode: this.normalizeViewMode(data?.defaultViewMode),
        allowRequesterOverride: data?.allowRequesterOverride === true
      },
      { emitEvent: false }
    );

    this.persistedSnapshot = this.buildSnapshot();
  }

  private resetForm(): void {
    this.settingsForm.reset(
      {
        defaultViewMode: 'standard',
        allowRequesterOverride: false
      },
      { emitEvent: false }
    );

    this.persistedSnapshot = this.buildSnapshot();
  }

  private buildSnapshot(): string {
    const payload = {
      defaultViewMode: this.normalizeViewMode(this.settingsForm.get('defaultViewMode')?.value),
      allowRequesterOverride: this.settingsForm.get('allowRequesterOverride')?.value === true
    };

    return JSON.stringify(payload);
  }

  private normalizeViewMode(value: unknown): ViewMode {
    const normalized = String(value ?? '').trim().toLowerCase();
    return normalized === 'tabbed' ? 'tabbed' : 'standard';
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

  private normalizeString(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : null;
  }
}
