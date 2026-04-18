import { Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Table } from 'primeng/table';
import { finalize, forkJoin } from 'rxjs';
import { PowerBiController as SharedPowerBiController } from 'src/app/shared/services/BackendServices/PowerBi/PowerBi.service';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';
import {
  ApiCommonResponse,
  ApiErrorDto,
  PowerBiStatementLookupsDto,
  PredefinedSqlStatementDto,
  PredefinedSqlStatementUpsertRequestDto
} from '../../models/power-bi-statements.models';
import { PowerBiStatementsApiService } from '../../services/power-bi-statements-api.service';

interface DropdownOption {
  label: string;
  value: string;
}

interface PreviewParameterInput {
  key: string;
  label: string;
  value: string;
  required: boolean;
}

type PromptParameterMode = 'template' | 'jsonObject' | 'pipe' | 'comma' | 'single' | 'raw';
type ExecutionKind = 'select' | 'execute';

interface PromptParameterConfig {
  mode: PromptParameterMode;
  original: string;
  delimiter?: string;
  inputs: PreviewParameterInput[];
}

@Component({
  selector: 'app-power-bi-statements',
  templateUrl: './power-bi-statements.component.html',
  styleUrls: ['./power-bi-statements.component.scss']
})
export class PowerBiStatementsComponent implements OnInit {
  dialogVisible = false;
  isEditMode = false;
  isSaving = false;

  statements: PredefinedSqlStatementDto[] = [];
  selectedStatement: PredefinedSqlStatementDto | null = null;
  selectedSqlTypeFilter: string | null = null;
  selectedApplicationFilter: string | null = null;
  selectedDatabaseFilter: string | null = null;
  sqlTypeDashboard: Array<{ sqlType: string; count: number }> = [];
  expandedApplicationGroups: Record<string, boolean> = {};

  previewRows: Array<Record<string, unknown>> = [];
  previewColumns: string[] = [];
  previewStatementId: number | null = null;
  previewPromptVisible = false;
  previewPromptInputs: PreviewParameterInput[] = [];

  lookups: PowerBiStatementLookupsDto = {
    applicationIds: [],
    schemaNames: [],
    sqlTypes: ['SELECT'],
    databases: ['ORACLE', 'SQL']
  };

  applicationOptions: DropdownOption[] = [];
  schemaOptions: DropdownOption[] = [];
  sqlTypeOptions: DropdownOption[] = [];
  databaseOptions: DropdownOption[] = this.toOptions(['ORACLE', 'SQL']);
  dashboardApplicationOptions: DropdownOption[] = [];
  dashboardDatabaseOptions: DropdownOption[] = this.toOptions(['ORACLE', 'SQL']);

  @ViewChild('statementsTable') statementsTableRef?: Table;
  statementForm: FormGroup;
  private editingStatementId: number | null = null;
  private pendingPreviewStatement: PredefinedSqlStatementDto | null = null;
  private pendingExecutionKind: ExecutionKind | null = null;
  private pendingPromptConfig: PromptParameterConfig | null = null;

  constructor(
    private readonly fb: FormBuilder,
    private readonly statementsApi: PowerBiStatementsApiService,
    private readonly msg: MsgsService,
    private readonly spinner: SpinnerService,
    private readonly sharedPowerBiController: SharedPowerBiController
  ) {
    this.statementForm = this.fb.group({
      statementId: [null],
      applicationId: [null, Validators.required],
      schemaName: [null, Validators.required],
      sqlType: ['SELECT', Validators.required],
      database: ['ORACLE', Validators.required],
      sqlStatement: ['', Validators.required],
      parameters: [''],
      description: [''],
      createdAt: [{ value: '', disabled: true }]
    });
  }

  ngOnInit(): void {
    this.loadScreenData();
  }

  get filteredStatements(): PredefinedSqlStatementDto[] {
    const source = this.applyDashboardBaseFilters(this.statements);

    if (!this.selectedSqlTypeFilter) {
      return source;
    }

    return source.filter(item =>
      String(item.sqlType ?? '').trim().toUpperCase() === this.selectedSqlTypeFilter
    );
  }

  get totalStatementsCount(): number {
    return this.applyDashboardBaseFilters(this.statements).length;
  }

  onGlobalFilter(table: Table, event: Event): void {
    const input = event.target as HTMLInputElement;
    table.first = 0;
    table.filterGlobal(input.value, 'contains');
    this.expandedApplicationGroups = {};
  }

  onSelectSqlTypeFilter(sqlType: string | null): void {
    this.selectedSqlTypeFilter = sqlType;
    this.expandedApplicationGroups = {};
  }

  onDashboardFilterChanged(table?: Table): void {
    if (table) {
      table.first = 0;
    } else if (this.statementsTableRef) {
      this.statementsTableRef.first = 0;
    }

    this.expandedApplicationGroups = {};
    this.refreshSqlTypeDashboard();
  }

  clearDashboardFilters(table?: Table): void {
    this.selectedApplicationFilter = null;
    this.selectedDatabaseFilter = null;
    this.onDashboardFilterChanged(table);
  }

  hasDashboardFilters(): boolean {
    return !!this.selectedApplicationFilter || !!this.selectedDatabaseFilter;
  }

  isSqlTypeFilterActive(sqlType: string | null): boolean {
    return this.selectedSqlTypeFilter === sqlType;
  }

  hasExpandedApplicationGroup(): boolean {
    return Object.keys(this.expandedApplicationGroups).length > 0;
  }

  getApplicationGroupLabel(applicationId: string | null | undefined): string {
    const normalized = String(applicationId ?? '').trim();
    return normalized.length > 0 ? normalized : 'N/A';
  }

  getApplicationGroupCount(applicationId: string | null | undefined, table?: Table): number {
    const target = String(applicationId ?? '').trim().toUpperCase();
    const source =
      (table?.filteredValue as PredefinedSqlStatementDto[] | null | undefined)
      ?? this.filteredStatements;

    return source.filter(item =>
      String(item.applicationId ?? '').trim().toUpperCase() === target
    ).length;
  }

  isApplicationGroupExpanded(applicationId: string | null | undefined): boolean {
    const key = this.getApplicationGroupKey(applicationId);
    return this.expandedApplicationGroups[key] === true;
  }

  onToggleApplicationGroup(applicationId: string | null | undefined): void {
    const key = this.getApplicationGroupKey(applicationId);

    if (this.expandedApplicationGroups[key]) {
      this.expandedApplicationGroups = {};
      return;
    }

    // Accordion behavior: keep a single expanded application group.
    this.expandedApplicationGroups = { [key]: true };
  }

  openCreateDialog(): void {
    this.isEditMode = false;
    this.editingStatementId = null;
    this.selectedStatement = null;

    this.statementForm.reset({
      statementId: null,
      applicationId: null,
      schemaName: null,
      sqlType: this.lookups.sqlTypes[0] ?? 'SELECT',
      database: this.normalizeDatabaseValue(this.lookups.databases[0] ?? 'ORACLE'),
      sqlStatement: '',
      parameters: '',
      description: '',
      createdAt: ''
    });

    this.dialogVisible = true;
  }

  openEditDialog(statement: PredefinedSqlStatementDto): void {
    this.isEditMode = true;
    this.editingStatementId = statement.statementId;
    this.selectedStatement = statement;

    this.statementForm.reset({
      statementId: statement.statementId,
      applicationId: statement.applicationId ?? null,
      schemaName: statement.schemaName ?? null,
      sqlType: statement.sqlType ?? 'SELECT',
      database: this.normalizeDatabaseValue(statement.database),
      sqlStatement: statement.sqlStatement ?? '',
      parameters: statement.parameters ?? '',
      description: statement.description ?? '',
      createdAt: this.formatDateForDisplay(statement.createdAt)
    });

    this.dialogVisible = true;
  }

  openDuplicateDialog(statement: PredefinedSqlStatementDto): void {
    this.isEditMode = false;
    this.editingStatementId = null;
    this.selectedStatement = null;

    this.statementForm.reset({
      statementId: null,
      applicationId: statement.applicationId ?? null,
      schemaName: statement.schemaName ?? null,
      sqlType: statement.sqlType ?? (this.lookups.sqlTypes[0] ?? 'SELECT'),
      database: this.normalizeDatabaseValue(statement.database),
      sqlStatement: statement.sqlStatement ?? '',
      parameters: statement.parameters ?? '',
      description: statement.description ?? '',
      createdAt: ''
    });

    this.dialogVisible = true;
  }

  onDialogHide(): void {
    this.isSaving = false;
    this.editingStatementId = null;
    this.selectedStatement = null;
  }

  onSave(previewAfterSave = false): void {
    if (this.statementForm.invalid) {
      this.statementForm.markAllAsTouched();
      this.msg.msgError('بيانات غير مكتملة', 'يرجى استكمال الحقول المطلوبة.', true);
      return;
    }

    const payload = this.buildUpsertPayload();
    if (payload === null) {
      this.msg.msgError('رقم غير صالح', 'رقم الاستعلام يجب أن يكون رقمًا صحيحًا أو يترك فارغًا.', true);
      return;
    }

    const saveRequest = this.isEditMode && this.editingStatementId !== null
      ? this.statementsApi.updateStatement(this.editingStatementId, payload)
      : this.statementsApi.createStatement(payload);

    this.isSaving = true;
    this.spinner.show('جاري حفظ الاستعلام ...');

    saveRequest
      .pipe(finalize(() => {
        this.isSaving = false;
        this.spinner.hide();
      }))
      .subscribe({
        next: (response) => {
          const savedStatement = this.extractData(response, 'تعذر حفظ الاستعلام.');
          if (savedStatement === null) {
            return;
          }

          this.msg.msgSuccess('تم حفظ الاستعلام بنجاح.');
          this.dialogVisible = false;
          this.loadScreenData();

          if (previewAfterSave && this.canPreview(savedStatement)) {
            this.onPreviewStatement(savedStatement);
          }
        },
        error: (error) => {
          this.msg.msgError('تعذر الحفظ', this.getHttpErrorMessage(error), true);
        }
      });
  }

  async onDeleteStatement(statement: PredefinedSqlStatementDto): Promise<void> {
    const statementId = Number(statement.statementId);
    if (!Number.isFinite(statementId) || statementId <= 0) {
      this.msg.msgError('رقم غير صالح', 'لا يمكن حذف سجل بدون رقم استعلام صحيح.', true);
      return;
    }

    const confirmDelete = await this.msg.msgConfirm(
      `سيتم حذف الاستعلام رقم <strong>${statementId}</strong>.`,
      'حذف'
    );

    if (!confirmDelete) {
      return;
    }

    this.spinner.show('جاري حذف الاستعلام ...');
    this.statementsApi.deleteStatement(statementId)
      .pipe(finalize(() => this.spinner.hide()))
      .subscribe({
        next: (response) => {
          const deleted = this.extractData(response, 'تعذر حذف الاستعلام.');
          if (deleted === null) {
            return;
          }

          this.msg.msgSuccess('تم حذف الاستعلام.');
          this.statements = this.statements.filter(item => item.statementId !== statementId);
          this.refreshDashboardFilterOptions();
          this.refreshSqlTypeDashboard();
          if (this.previewStatementId === statementId) {
            this.previewStatementId = null;
            this.previewRows = [];
            this.previewColumns = [];
          }
        },
        error: (error) => {
          this.msg.msgError('تعذر الحذف', this.getHttpErrorMessage(error), true);
        }
      });
  }

  onRunStatement(statement: PredefinedSqlStatementDto): void {
    const statementId = Number(statement.statementId);
    if (!Number.isFinite(statementId) || statementId <= 0) {
      this.msg.msgError('رقم غير صالح', 'لا يمكن تحميل البيانات بدون رقم استعلام صحيح.', true);
      return;
    }

    const executionKind = this.resolveExecutionKind(statement.sqlType);
    if (executionKind === null) {
      this.msg.msgError('نوع SQL غير مدعوم', 'التشغيل متاح فقط لأنواع SELECT و UPDATE و DELETE.', true);
      return;
    }

    const promptConfig = this.tryBuildPromptConfig(statement.parameters, statement.sqlStatement);
    if (promptConfig !== null) {
      this.pendingPreviewStatement = statement;
      this.pendingExecutionKind = executionKind;
      this.pendingPromptConfig = promptConfig;
      this.previewPromptInputs = promptConfig.inputs.map(item => ({ ...item }));
      this.previewPromptVisible = true;
      return;
    }

    this.executeStatement(statement, statement.parameters ?? '', executionKind);
  }

  onPreviewStatement(statement: PredefinedSqlStatementDto): void {
    this.onRunStatement(statement);
  }

  submitPreviewPrompt(): void {
    if (!this.pendingPreviewStatement || !this.pendingPromptConfig || !this.pendingExecutionKind) {
      this.previewPromptVisible = false;
      return;
    }

    const missingRequired = this.previewPromptInputs.find(
      item => item.required && String(item.value ?? '').trim().length === 0
    );
    if (missingRequired) {
      this.msg.msgError('بيانات مطلوبة', `يرجى إدخال قيمة للحقل ${missingRequired.label}.`, true);
      return;
    }

    const resolvedParameters = this.buildPromptPayload(this.pendingPromptConfig, this.previewPromptInputs);
    const statement = this.pendingPreviewStatement;
    const executionKind = this.pendingExecutionKind;
    this.clearPreviewPromptState();
    this.executeStatement(statement, resolvedParameters, executionKind);
  }

  onPreviewPromptHide(): void {
    this.clearPreviewPromptState();
  }

  private executeStatement(
    statement: PredefinedSqlStatementDto,
    parameters: string,
    executionKind: ExecutionKind
  ): void {
    if (executionKind === 'select') {
      this.executeSelectRequest(statement, parameters);
      return;
    }

    this.executeNonQueryRequest(statement, parameters);
  }

  private executeSelectRequest(statement: PredefinedSqlStatementDto, parameters: string): void {
    const statementId = Number(statement.statementId);
    this.spinner.show('جاري تحميل بيانات الاستعلام ...');
    this.sharedPowerBiController.getGenericDataById(statementId, parameters)
      .pipe(finalize(() => this.spinner.hide()))
      .subscribe({
        next: (response) => {
          if (!response?.isSuccess) {
            if (this.shouldPromptForParametersFromErrors(response?.errors)) {
              this.openRawParametersPrompt(statement, 'select', parameters);
              return;
            }

            this.showErrors(response?.errors, 'تعذر تحميل بيانات الاستعلام.');
            return;
          }

          const rows = (response.data ?? []) as Array<Record<string, unknown>>;
          this.previewRows = rows;
          this.previewColumns = rows.length > 0 ? Object.keys(rows[0]) : [];
          this.previewStatementId = statementId;
        },
        error: (error) => {
          const errorMessage = this.getHttpErrorMessage(error);
          if (this.shouldPromptForParametersFromText(errorMessage)) {
            this.openRawParametersPrompt(statement, 'select', parameters);
            return;
          }

          this.msg.msgError('تعذر تحميل البيانات', errorMessage, true);
        }
      });
  }

  private executeNonQueryRequest(statement: PredefinedSqlStatementDto, parameters: string): void {
    const statementId = Number(statement.statementId);
    this.spinner.show('جاري تنفيذ الاستعلام ...');

    this.sharedPowerBiController.excuteGenericStatmentById(statementId, parameters)
      .pipe(finalize(() => this.spinner.hide()))
      .subscribe({
        next: (response) => {
          if (!response?.isSuccess) {
            if (this.shouldPromptForParametersFromErrors(response?.errors)) {
              this.openRawParametersPrompt(statement, 'execute', parameters);
              return;
            }

            this.showErrors(response?.errors, 'تعذر تنفيذ الاستعلام.');
            return;
          }

          const serverMessage = String(response.data ?? '').trim();
          this.msg.msgSuccess(serverMessage.length > 0 ? serverMessage : 'تم تنفيذ الاستعلام بنجاح.');
          this.previewStatementId = null;
          this.previewRows = [];
          this.previewColumns = [];
        },
        error: (error) => {
          const errorMessage = this.getHttpErrorMessage(error);
          if (this.shouldPromptForParametersFromText(errorMessage)) {
            this.openRawParametersPrompt(statement, 'execute', parameters);
            return;
          }

          this.msg.msgError('تعذر تنفيذ الاستعلام', errorMessage, true);
        }
      });
  }

  canPreview(statement: PredefinedSqlStatementDto): boolean {
    return this.isSelectType(statement.sqlType);
  }

  canExecute(statement: PredefinedSqlStatementDto): boolean {
    return this.resolveExecutionKind(statement.sqlType) !== null;
  }

  isSelectType(sqlType: string | null | undefined): boolean {
    return String(sqlType ?? '').trim().toUpperCase() === 'SELECT';
  }

  private resolveExecutionKind(sqlType: string | null | undefined): ExecutionKind | null {
    const normalizedType = String(sqlType ?? '').trim().toUpperCase();
    if (normalizedType === 'SELECT') {
      return 'select';
    }

    if (normalizedType === 'UPDATE' || normalizedType === 'DELETE') {
      return 'execute';
    }

    return null;
  }

  private loadScreenData(): void {
    this.spinner.show('جاري تحميل شاشة Power BI ...');

    forkJoin({
      statementsResponse: this.statementsApi.getStatements(),
      lookupsResponse: this.statementsApi.getLookups()
    })
      .pipe(finalize(() => this.spinner.hide()))
      .subscribe({
        next: ({ statementsResponse, lookupsResponse }) => {
          const loadedStatements = this.extractData(statementsResponse, 'تعذر تحميل الاستعلامات.');
          if (loadedStatements !== null) {
            this.statements = loadedStatements;
            this.refreshDashboardFilterOptions();
            this.refreshSqlTypeDashboard();
            this.expandedApplicationGroups = {};
          }

          const loadedLookups = this.extractData(lookupsResponse, 'تعذر تحميل قوائم الاختيار.');
          if (loadedLookups !== null) {
            this.lookups = this.normalizeLookups(loadedLookups);
            this.refreshDropdownOptions();

            if (this.lookups.schemaNames.length === 0) {
              this.loadSchemasFromExistingPowerBiService();
            }
          }
        },
        error: (error) => {
          this.msg.msgError('تعذر التحميل', this.getHttpErrorMessage(error), true);
        }
      });
  }

  private buildUpsertPayload(): PredefinedSqlStatementUpsertRequestDto | null {
    const raw = this.statementForm.getRawValue() as {
      statementId: number | null;
      applicationId: string | null;
      schemaName: string | null;
      sqlType: string | null;
      database: string | null;
      sqlStatement: string | null;
      parameters: string | null;
      description: string | null;
      createdAt: string | null;
    };

    const normalizedStatementId = this.normalizeOptionalNumber(raw.statementId);
    if (raw.statementId !== null && raw.statementId !== undefined && normalizedStatementId === undefined) {
      return null;
    }

    return {
      statementId: normalizedStatementId ?? null,
      applicationId: this.normalizeOptionalString(raw.applicationId),
      schemaName: this.normalizeOptionalString(raw.schemaName),
      sqlType: this.normalizeOptionalString(raw.sqlType),
      database: this.normalizeDatabaseValue(raw.database),
      sqlStatement: this.normalizeOptionalString(raw.sqlStatement),
      parameters: this.normalizeOptionalString(raw.parameters),
      description: this.normalizeOptionalString(raw.description)
    };
  }

  private extractData<T>(response: ApiCommonResponse<T> | null | undefined, fallbackMessage: string): T | null {
    if (response?.isSuccess) {
      return response.data;
    }

    this.showErrors(response?.errors, fallbackMessage);
    return null;
  }

  private showErrors(errors: ApiErrorDto[] | undefined, fallbackMessage: string): void {
    const merged = (errors ?? [])
      .map(item => String(item?.message ?? '').trim())
      .filter(item => item.length > 0)
      .join('<br>');

    this.msg.msgError('هناك خطأ ما', merged.length > 0 ? merged : fallbackMessage, true);
  }

  private toOptions(values: string[]): DropdownOption[] {
    return (values ?? []).map(value => ({
      label: value,
      value
    }));
  }

  private loadSchemasFromExistingPowerBiService(): void {
    this.sharedPowerBiController.schemaList().subscribe({
      next: (response) => {
        if (!response?.isSuccess) {
          return;
        }

        const externalSchemas = (response.data ?? [])
          .map(item => String(item.schemA_NAME ?? '').trim())
          .filter(item => item.length > 0);

        if (externalSchemas.length === 0) {
          return;
        }

        this.lookups = {
          ...this.lookups,
          schemaNames: this.mergeDistinctStrings(this.lookups.schemaNames, externalSchemas)
        };
        this.schemaOptions = this.toOptions(this.lookups.schemaNames);
      },
      error: () => {
        // Keep screen functional even if external schema list is unavailable.
      }
    });
  }

  private formatDateForDisplay(value: string | undefined): string {
    if (!value) {
      return '';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString();
  }

  private normalizeOptionalString(value: string | null | undefined): string | null {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : null;
  }

  private normalizeDatabaseValue(value: string | null | undefined): string {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (normalized === 'SQLSERVER' || normalized === 'SQL') {
      return 'SQL';
    }

    return normalized === 'ORACLE' ? 'ORACLE' : 'ORACLE';
  }

  private normalizeOptionalNumber(value: unknown): number | undefined {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }

    const normalized = Number(value);
    if (!Number.isFinite(normalized) || normalized <= 0) {
      return undefined;
    }

    return Math.trunc(normalized);
  }

  private mergeDistinctStrings(baseValues: string[], additionalValues: string[]): string[] {
    const map = new Map<string, string>();

    [...baseValues, ...additionalValues].forEach(item => {
      const normalized = String(item ?? '').trim();
      if (!normalized) {
        return;
      }

      const key = normalized.toUpperCase();
      if (!map.has(key)) {
        map.set(key, normalized);
      }
    });

    return Array.from(map.values()).sort((left, right) => left.localeCompare(right));
  }

  private normalizeLookups(lookups: PowerBiStatementLookupsDto): PowerBiStatementLookupsDto {
    return {
      applicationIds: lookups.applicationIds ?? [],
      schemaNames: lookups.schemaNames ?? [],
      sqlTypes: lookups.sqlTypes ?? ['SELECT'],
      databases: ['ORACLE', 'SQL']
    };
  }

  private refreshDropdownOptions(): void {
    this.applicationOptions = this.toOptions(this.lookups.applicationIds);
    this.schemaOptions = this.toOptions(this.lookups.schemaNames);
    this.sqlTypeOptions = this.toOptions(this.lookups.sqlTypes);
    this.databaseOptions = this.toOptions(['ORACLE', 'SQL']);
  }

  private getHttpErrorMessage(error: unknown): string {
    if (typeof error === 'string') {
      return error;
    }

    if (typeof error === 'object' && error !== null) {
      const typed = error as { message?: string };
      if (typed.message) {
        return typed.message;
      }
    }

    return 'حدث خطأ غير متوقع.';
  }

  private tryBuildPromptConfig(
    parameters: string | null | undefined,
    sqlStatement?: string | null | undefined
  ): PromptParameterConfig | null {
    const normalized = String(parameters ?? '').trim();
    if (normalized.length === 0) {
      return this.tryBuildPromptConfigFromSql(sqlStatement);
    }

    const templateMatches = [...normalized.matchAll(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g)];
    if (templateMatches.length > 0) {
      const names = Array.from(new Set(templateMatches.map(item => item[1])));
      return {
        mode: 'template',
        original: normalized,
        inputs: names.map(name => ({
          key: name,
          label: name,
          value: '',
          required: true
        }))
      };
    }

    const jsonConfig = this.tryBuildPromptConfigFromJson(normalized);
    if (jsonConfig !== null) {
      return jsonConfig;
    }

    const pipeConfig = this.tryBuildDelimitedPromptConfig(normalized, '|', 'pipe');
    if (pipeConfig !== null) {
      return pipeConfig;
    }

    const commaConfig = this.tryBuildDelimitedPromptConfig(normalized, ',', 'comma');
    if (commaConfig !== null) {
      return commaConfig;
    }

    if (this.isLikelyParameterName(normalized)) {
      return {
        mode: 'single',
        original: normalized,
        inputs: [{
          key: normalized,
          label: normalized,
          value: '',
          required: true
        }]
      };
    }

    // Fallback: if parameters is not empty and no specific pattern was detected,
    // still ask user to confirm/edit the full payload before execution.
    return {
      mode: 'raw',
      original: normalized,
      inputs: [{
        key: 'parameters',
        label: 'PARAMETERS',
        value: normalized,
        required: true
      }]
    };
  }

  private tryBuildPromptConfigFromJson(parameters: string): PromptParameterConfig | null {
    let parsed: unknown;
    try {
      parsed = JSON.parse(parameters);
    } catch {
      return null;
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    const source = parsed as Record<string, unknown>;
    const keys = Object.keys(source);
    if (keys.length === 0) {
      return null;
    }

    const inputs: PreviewParameterInput[] = keys.map(key => {
      const value = source[key];
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        const valueConfig = value as Record<string, unknown>;
        const nestedKey = this.normalizeOptionalString(String(valueConfig['key'] ?? key)) ?? key;
        const nestedLabel = this.normalizeOptionalString(String(valueConfig['label'] ?? nestedKey)) ?? nestedKey;
        const nestedDefault =
          this.normalizeOptionalString(String(valueConfig['defaultValue'] ?? valueConfig['default'] ?? '')) ?? '';
        const isRequired = valueConfig['required'] !== false;

        return {
          key: nestedKey,
          label: nestedLabel,
          value: nestedDefault,
          required: isRequired
        };
      }

      return {
        key,
        label: key,
        value: this.normalizeOptionalString(String(value ?? '')) ?? '',
        required: true
      };
    });

    const needsPrompt = inputs.some(item => item.required && item.value.trim().length === 0);
    if (!needsPrompt) {
      return null;
    }

    return {
      mode: 'jsonObject',
      original: parameters,
      inputs
    };
  }

  private tryBuildDelimitedPromptConfig(
    parameters: string,
    delimiter: string,
    mode: 'pipe' | 'comma'
  ): PromptParameterConfig | null {
    if (!parameters.includes(delimiter)) {
      return null;
    }

    const tokens = parameters.split(delimiter).map(item => item.trim()).filter(item => item.length > 0);
    if (tokens.length === 0) {
      return null;
    }

    const allTokensAreNames = tokens.every(item => this.isLikelyParameterName(item));
    if (!allTokensAreNames) {
      return null;
    }

    return {
      mode,
      original: parameters,
      delimiter,
      inputs: tokens.map(token => ({
        key: token,
        label: token,
        value: '',
        required: true
      }))
    };
  }

  private buildPromptPayload(config: PromptParameterConfig, inputs: PreviewParameterInput[]): string {
    switch (config.mode) {
      case 'template': {
        let resolved = config.original;
        inputs.forEach(item => {
          const tokenPattern = new RegExp(`\\{\\{\\s*${this.escapeRegExp(item.key)}\\s*\\}\\}`, 'g');
          resolved = resolved.replace(tokenPattern, item.value);
        });
        return resolved;
      }
      case 'jsonObject': {
        const payload: Record<string, string> = {};
        inputs.forEach(item => {
          payload[item.key] = item.value;
        });
        return JSON.stringify(payload);
      }
      case 'pipe':
      case 'comma': {
        const delimiter = config.delimiter ?? (config.mode === 'pipe' ? '|' : ',');
        return inputs.map(item => item.value).join(delimiter);
      }
      case 'single':
      case 'raw':
      default:
        return inputs[0]?.value ?? '';
    }
  }

  private isLikelyParameterName(value: string): boolean {
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private clearPreviewPromptState(): void {
    this.previewPromptVisible = false;
    this.previewPromptInputs = [];
    this.pendingPreviewStatement = null;
    this.pendingExecutionKind = null;
    this.pendingPromptConfig = null;
  }

  private tryBuildPromptConfigFromSql(sqlStatement: string | null | undefined): PromptParameterConfig | null {
    const sql = String(sqlStatement ?? '').trim();
    if (sql.length === 0) {
      return null;
    }

    const placeholders = this.extractSqlPlaceholders(sql);
    if (placeholders.length === 0) {
      return null;
    }

    const placeholdersHint = placeholders.join(', ');
    return {
      mode: 'raw',
      original: '',
      inputs: [{
        key: 'parameters',
        label: `PARAMETERS (${placeholdersHint})`,
        value: '',
        required: true
      }]
    };
  }

  private extractSqlPlaceholders(sqlStatement: string): string[] {
    const names = new Set<string>();

    const colonNamedRegex = /:([A-Za-z_][A-Za-z0-9_]*)/g;
    let match: RegExpExecArray | null;
    while ((match = colonNamedRegex.exec(sqlStatement)) !== null) {
      names.add(match[1]);
    }

    const atNamedRegex = /@([A-Za-z_][A-Za-z0-9_]*)/g;
    while ((match = atNamedRegex.exec(sqlStatement)) !== null) {
      names.add(match[1]);
    }

    const colonNumericRegex = /:(\d+)/g;
    while ((match = colonNumericRegex.exec(sqlStatement)) !== null) {
      names.add(`P${match[1]}`);
    }

    return Array.from(names).sort((left, right) => left.localeCompare(right));
  }

  private shouldPromptForParametersFromErrors(errors: ApiErrorDto[] | undefined): boolean {
    const merged = (errors ?? [])
      .map(item => String(item?.message ?? '').trim())
      .join(' ');

    return this.shouldPromptForParametersFromText(merged);
  }

  private shouldPromptForParametersFromText(message: string | null | undefined): boolean {
    const normalized = String(message ?? '').trim().toLowerCase();
    if (!normalized) {
      return false;
    }

    return normalized.includes('parameters are null')
      || normalized.includes('parameter is null')
      || normalized.includes('parameter')
      && normalized.includes('null');
  }

  private openRawParametersPrompt(
    statement: PredefinedSqlStatementDto,
    executionKind: ExecutionKind,
    currentParameters: string
  ): void {
    this.pendingPreviewStatement = statement;
    this.pendingExecutionKind = executionKind;
    this.pendingPromptConfig = {
      mode: 'raw',
      original: currentParameters,
      inputs: [{
        key: 'parameters',
        label: 'PARAMETERS',
        value: currentParameters,
        required: true
      }]
    };
    this.previewPromptInputs = this.pendingPromptConfig.inputs.map(item => ({ ...item }));
    this.previewPromptVisible = true;
  }

  private refreshSqlTypeDashboard(): void {
    const map = new Map<string, number>();

    this.applyDashboardBaseFilters(this.statements).forEach(item => {
      const normalizedType = String(item.sqlType ?? '').trim().toUpperCase();
      if (!normalizedType) {
        return;
      }

      map.set(normalizedType, (map.get(normalizedType) ?? 0) + 1);
    });

    this.sqlTypeDashboard = Array.from(map.entries())
      .map(([sqlType, count]) => ({ sqlType, count }))
      .sort((left, right) => left.sqlType.localeCompare(right.sqlType));

    if (this.selectedSqlTypeFilter) {
      const filterStillExists = this.sqlTypeDashboard.some(item => item.sqlType === this.selectedSqlTypeFilter);
      if (!filterStillExists) {
        this.selectedSqlTypeFilter = null;
      }
    }
  }

  private applyDashboardBaseFilters(source: PredefinedSqlStatementDto[]): PredefinedSqlStatementDto[] {
    return source.filter(item => {
      const matchesApplication = !this.selectedApplicationFilter
        || String(item.applicationId ?? '').trim().toUpperCase()
        === String(this.selectedApplicationFilter).trim().toUpperCase();

      if (!matchesApplication) {
        return false;
      }

      if (!this.selectedDatabaseFilter) {
        return true;
      }

      return this.normalizeDatabaseForFilter(item.database)
        === this.normalizeDatabaseForFilter(this.selectedDatabaseFilter);
    });
  }

  private refreshDashboardFilterOptions(): void {
    const applicationIds = this.mergeDistinctStrings(
      [],
      this.statements
        .map(item => String(item.applicationId ?? '').trim())
        .filter(item => item.length > 0)
    );

    this.dashboardApplicationOptions = this.toOptions(applicationIds);
    this.dashboardDatabaseOptions = this.toOptions(['ORACLE', 'SQL']);

    if (this.selectedApplicationFilter) {
      const selectedApp = String(this.selectedApplicationFilter).trim().toUpperCase();
      const appStillExists = applicationIds.some(item => item.toUpperCase() === selectedApp);
      if (!appStillExists) {
        this.selectedApplicationFilter = null;
      }
    }

    if (this.selectedDatabaseFilter) {
      const normalizedDb = this.normalizeDatabaseForFilter(this.selectedDatabaseFilter);
      if (normalizedDb !== 'ORACLE' && normalizedDb !== 'SQL') {
        this.selectedDatabaseFilter = null;
      }
    }
  }

  private normalizeDatabaseForFilter(value: string | null | undefined): string {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (normalized === 'SQLSERVER' || normalized === 'SQL') {
      return 'SQL';
    }

    if (normalized === 'ORACLE') {
      return 'ORACLE';
    }

    return normalized;
  }

  private getApplicationGroupKey(applicationId: string | null | undefined): string {
    return String(applicationId ?? '');
  }
}
