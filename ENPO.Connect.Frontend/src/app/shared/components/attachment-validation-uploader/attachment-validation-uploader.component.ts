import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import {
  AttachmentValidationExecutionResultDto,
  AttachmentValidationMode,
  AttachmentValidationResolvedRuleDto,
  AttachmentValidationSettingsDto
} from 'src/app/shared/services/BackendServices/AttachmentValidation/AttachmentValidation.dto';
import { AttachmentValidationController } from 'src/app/shared/services/BackendServices/AttachmentValidation/AttachmentValidation.service';

@Component({
  selector: 'app-attachment-validation-uploader',
  templateUrl: './attachment-validation-uploader.component.html',
  styleUrls: ['./attachment-validation-uploader.component.scss']
})
export class AttachmentValidationUploaderComponent implements OnInit, OnChanges {
  @Input() documentTypeCode = '';
  @Input() label = 'إرفاق المرفقات';
  @Input() required = false;
  @Input() disabled = false;
  @Input() allowMultiple = true;
  @Input() resetToken = 0;

  @Output() filesChange = new EventEmitter<File[]>();
  @Output() validityChange = new EventEmitter<boolean>();
  @Output() validationResultChange = new EventEmitter<AttachmentValidationExecutionResultDto | null>();

  files: File[] = [];
  settings: AttachmentValidationSettingsDto | null = null;
  validationResult: AttachmentValidationExecutionResultDto | null = null;
  loadingSettings = false;
  validating = false;
  errors: string[] = [];
  warnings: string[] = [];
  info = '';

  private readonly fallbackAllowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];

  constructor(private readonly attachmentValidationController: AttachmentValidationController) {}

  ngOnInit(): void {
    this.loadSettings();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['documentTypeCode'] && !changes['documentTypeCode'].firstChange) {
      this.clearState();
      this.loadSettings();
      return;
    }

    if (changes['resetToken'] && !changes['resetToken'].firstChange) {
      this.clearState();
      this.emitCurrentState();
    }
  }

  get acceptAttribute(): string {
    const settings = this.settings;
    if (!settings) {
      return '.pdf,image/*';
    }

    const extensions = this.resolveAllowedExtensions(settings.rules);
    if (!extensions.length) {
      return '.pdf,image/*';
    }

    return extensions.join(',');
  }

  get validationMode(): AttachmentValidationMode {
    return this.settings?.validationMode ?? 'UploadOnly';
  }

  get isValidationRequired(): boolean {
    return this.settings?.isValidationRequired ?? this.required;
  }

  onSelectFiles(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const selectedFiles = Array.from(input?.files ?? []);
    if (!selectedFiles.length) {
      return;
    }

    if (this.allowMultiple) {
      this.files = [...this.files, ...selectedFiles];
    } else {
      this.files = [selectedFiles[0]];
    }

    if (input) {
      input.value = '';
    }

    this.validateCurrentFiles();
  }

  removeFile(index: number): void {
    this.files = this.files.filter((_, current) => current !== index);
    this.validateCurrentFiles();
  }

  private clearState(): void {
    this.files = [];
    this.settings = null;
    this.validationResult = null;
    this.errors = [];
    this.warnings = [];
    this.info = '';
  }

  private loadSettings(): void {
    const code = String(this.documentTypeCode ?? '').trim();
    if (!code) {
      this.info = 'لم يتم تحديد نوع المستند بعد.';
      this.emitCurrentState();
      return;
    }

    this.loadingSettings = true;
    this.attachmentValidationController.getSettings(code).subscribe({
      next: response => {
        if (response?.isSuccess && response.data) {
          this.settings = response.data;
          this.info = this.resolveInfoMessage(response.data);
          this.validateCurrentFiles();
          return;
        }

        this.settings = null;
        this.errors = [];
        this.warnings = this.collectResponseErrors(response?.errors);
        this.info = 'تعذر تحميل إعدادات التحقق حاليًا، سيتم السماح بالرفع فقط.';
        this.emitCurrentState();
      },
      error: () => {
        this.settings = null;
        this.errors = [];
        this.warnings = ['تعذر التحقق من إعدادات المرفقات حاليًا، سيتم السماح بالرفع فقط.'];
        this.info = 'سيتم اعتماد قواعد الرفع الافتراضية مؤقتًا.';
        this.emitCurrentState();
      },
      complete: () => {
        this.loadingSettings = false;
      }
    });
  }

  private validateCurrentFiles(): void {
    const code = String(this.documentTypeCode ?? '').trim();
    if (!code) {
      this.validationResult = null;
      this.errors = [];
      this.warnings = [];
      this.emitCurrentState();
      return;
    }

    const settings = this.settings;
    if (!settings || settings.validationMode === 'UploadOnly') {
      this.validationResult = null;
      this.errors = this.isValidationRequired && this.files.length === 0
        ? ['يلزم إرفاق ملف واحد على الأقل لهذا النوع من المستندات.']
        : [];
      this.warnings = [];
      this.emitCurrentState();
      return;
    }

    this.validating = true;
    this.attachmentValidationController.validate(code, this.files).subscribe({
      next: response => {
        if (response?.isSuccess && response.data) {
          this.validationResult = response.data;
          this.errors = [...(response.data.errors ?? [])];
          this.warnings = [...(response.data.warnings ?? [])];
          this.emitCurrentState();
          return;
        }

        this.validationResult = null;
        this.errors = this.collectResponseErrors(response?.errors);
        this.warnings = [];
        this.emitCurrentState();
      },
      error: () => {
        this.validationResult = null;
        this.errors = ['تعذر تنفيذ التحقق من المرفقات حاليًا.'];
        this.warnings = [];
        this.emitCurrentState();
      },
      complete: () => {
        this.validating = false;
      }
    });
  }

  private emitCurrentState(): void {
    const hasRequiredError = this.isValidationRequired && this.files.length === 0;
    const isValidByRules = this.validationResult ? this.validationResult.isValid : this.errors.length === 0;
    const isValid = !hasRequiredError && isValidByRules;

    this.filesChange.emit([...this.files]);
    this.validityChange.emit(isValid);
    this.validationResultChange.emit(this.validationResult);
  }

  private resolveAllowedExtensions(rules: AttachmentValidationResolvedRuleDto[]): string[] {
    const rule = (rules ?? []).find(item => String(item.ruleCode ?? '').trim().toUpperCase() === 'ALLOWED_EXTENSIONS');
    const extensions = this.readExtensions(rule?.parametersJson);

    return extensions.length ? extensions : this.fallbackAllowedExtensions;
  }

  private readExtensions(parametersJson: string | null | undefined): string[] {
    const normalized = String(parametersJson ?? '').trim();
    if (!normalized) {
      return [];
    }

    try {
      const parsed = JSON.parse(normalized) as { extensions?: unknown };
      const list = Array.isArray(parsed?.extensions) ? parsed.extensions : [];
      return list
        .map(item => String(item ?? '').trim().toLowerCase())
        .filter(item => item.length > 0)
        .map(item => item.startsWith('.') ? item : `.${item}`);
    } catch {
      return [];
    }
  }

  private resolveInfoMessage(settings: AttachmentValidationSettingsDto): string {
    if (settings.validationMode === 'UploadOnly') {
      return settings.isValidationRequired
        ? 'هذا النوع يعتمد الرفع فقط مع إلزامية وجود مرفق.'
        : 'هذا النوع يسمح بالرفع دون تحقق قواعد.';
    }

    if (!Array.isArray(settings.rules) || settings.rules.length === 0) {
      return 'لا توجد قواعد تحقق مفعلة لهذا النوع حاليًا.';
    }

    return `تم تحميل ${settings.rules.length} قاعدة تحقق لهذا النوع.`;
  }

  private collectResponseErrors(errors: Array<{ message?: string }> | undefined): string[] {
    const list = (errors ?? [])
      .map(item => String(item?.message ?? '').trim())
      .filter(item => item.length > 0);

    return list.length ? list : ['تعذر تنفيذ العملية المطلوبة.'];
  }
}
