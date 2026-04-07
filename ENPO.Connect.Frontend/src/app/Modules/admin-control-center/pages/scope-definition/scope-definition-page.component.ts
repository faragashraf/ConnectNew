import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { auditTime } from 'rxjs/operators';
import {
  ControlCenterStepViewModel,
  ControlCenterViewModel
} from '../../domain/models/admin-control-center.view-models';
import { AdminControlCenterFacade } from '../../facades/admin-control-center.facade';

interface SelectOption {
  readonly label: string;
  readonly value: string;
}

@Component({
  selector: 'app-scope-definition-page',
  templateUrl: './scope-definition-page.component.html',
  styleUrls: ['./scope-definition-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ScopeDefinitionPageComponent implements OnInit, OnDestroy {
  readonly stepKey = 'scope-definition' as const;

  readonly scopeForm: FormGroup = this.fb.group({
    applicationId: [null, [Validators.required]],
    categoryId: [null, [Validators.required]],
    requestMode: [null, [Validators.required]],
    documentDirection: [null, [Validators.required]],
    routeKeyPrefix: ['', [Validators.required, Validators.maxLength(120)]],
    primaryConfigRouteKey: ['', [Validators.required, Validators.maxLength(180)]],
    createUnitScope: ['', [Validators.required, Validators.maxLength(500)]],
    readUnitScope: ['', [Validators.required, Validators.maxLength(500)]],
    creatorUnitDefault: ['', [Validators.maxLength(80)]],
    targetUnitDefault: ['', [Validators.maxLength(80)]],
    runtimeContextJson: ['', [Validators.maxLength(5000), this.optionalJsonValidator()]],
    localizationProfile: [null],
    uiPreset: [null]
  });

  vm: ControlCenterViewModel | null = null;
  scopeStep: ControlCenterStepViewModel | null = null;
  stepMessage = '';
  stepMessageSeverity: 'success' | 'warn' = 'warn';

  private readonly subscriptions = new Subscription();
  private syncingFromStore = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly facade: AdminControlCenterFacade,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.facade.initialize(this.stepKey);

    this.subscriptions.add(
      this.facade.vm$.subscribe(vm => {
        this.vm = vm;
        const scopeStep = vm.steps.find(step => step.key === this.stepKey) ?? null;
        this.scopeStep = scopeStep;
        if (!scopeStep) {
          return;
        }

        this.patchFormFromStore(scopeStep.values);
      })
    );

    this.subscriptions.add(
      this.scopeForm.valueChanges
        .pipe(auditTime(80))
        .subscribe(() => {
          if (this.syncingFromStore) {
            return;
          }

          this.syncFormToStore();
        })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  get mandatoryMissingLabels(): ReadonlyArray<string> {
    return this.scopeStep?.mandatoryMissingFieldLabels ?? [];
  }

  get isScopeCompleted(): boolean {
    return this.scopeStep?.isCompleted === true;
  }

  get requiredProgressText(): string {
    if (!this.scopeStep) {
      return '0 / 0';
    }

    return `${this.scopeStep.requiredCompleted} / ${this.scopeStep.requiredTotal}`;
  }

  get stepStatusLabel(): string {
    if (!this.scopeStep) {
      return 'قيد التحميل';
    }

    return this.scopeStep.isCompleted ? 'جاهز' : 'غير مكتمل';
  }

  get stepStatusSeverity(): 'success' | 'warning' {
    return this.scopeStep?.isCompleted ? 'success' : 'warning';
  }

  getOptionList(fieldKey: string): SelectOption[] {
    const matchingField = this.scopeStep?.fields.find(field => field.key === fieldKey);
    return [...(matchingField?.options ?? [])];
  }

  controlHasError(controlName: string, errorKey?: string): boolean {
    const control = this.scopeForm.get(controlName);
    if (!control) {
      return false;
    }

    if (!(control.touched || control.dirty)) {
      return false;
    }

    if (errorKey) {
      return control.hasError(errorKey);
    }

    return control.invalid;
  }

  controlErrorMessage(controlName: string): string {
    const control = this.scopeForm.get(controlName);
    if (!control) {
      return 'قيمة غير صالحة.';
    }

    if (control.hasError('required')) {
      return 'هذا الحقل إلزامي ولا يمكن تركه فارغًا.';
    }

    if (control.hasError('jsonInvalid')) {
      return 'صيغة JSON غير صحيحة. يرجى إدخال JSON صالح.';
    }

    if (control.hasError('maxlength')) {
      return 'القيمة أطول من الحد المسموح.';
    }

    return 'قيمة غير صالحة.';
  }

  onSaveDraft(): void {
    this.syncFormToStore();
    this.facade.saveDraft();
    this.stepMessageSeverity = 'success';
    this.stepMessage = 'تم حفظ نطاق التكوين بنجاح.';
  }

  onGoNext(): void {
    this.syncFormToStore();
    this.markRequiredControlsAsTouched();

    if (this.scopeForm.invalid || !this.isScopeCompleted) {
      this.stepMessageSeverity = 'warn';
      this.stepMessage = 'لا يمكن المتابعة قبل استكمال البيانات الإلزامية في نطاق التكوين.';
      return;
    }

    const nextStepKey = this.facade.getNextStepKey(this.stepKey);
    if (!nextStepKey) {
      this.stepMessageSeverity = 'warn';
      this.stepMessage = 'لا توجد خطوة متاحة بعد. تحقق من حالة الخطوات.';
      return;
    }

    this.stepMessage = '';
    this.router.navigate(['/Admin/ControlCenter', nextStepKey]);
  }

  private patchFormFromStore(values: Record<string, unknown>): void {
    const nextValue = {
      applicationId: this.normalizeScalar(values['applicationId']),
      categoryId: this.normalizeScalar(values['categoryId']),
      requestMode: this.normalizeScalar(values['requestMode']),
      documentDirection: this.normalizeScalar(values['documentDirection']),
      routeKeyPrefix: this.normalizeString(values['routeKeyPrefix']),
      primaryConfigRouteKey: this.normalizeString(values['primaryConfigRouteKey']),
      createUnitScope: this.normalizeString(values['createUnitScope']),
      readUnitScope: this.normalizeString(values['readUnitScope']),
      creatorUnitDefault: this.normalizeString(values['creatorUnitDefault']),
      targetUnitDefault: this.normalizeString(values['targetUnitDefault']),
      runtimeContextJson: this.normalizeString(values['runtimeContextJson']),
      localizationProfile: this.normalizeScalar(values['localizationProfile']),
      uiPreset: this.normalizeScalar(values['uiPreset'])
    };

    this.syncingFromStore = true;
    this.scopeForm.patchValue(nextValue, { emitEvent: false });
    this.syncingFromStore = false;
  }

  private syncFormToStore(): void {
    const raw = this.scopeForm.getRawValue();
    for (const [fieldKey, value] of Object.entries(raw)) {
      this.facade.updateFieldValue(this.stepKey, fieldKey, value);
    }
  }

  private markRequiredControlsAsTouched(): void {
    const requiredControls = [
      'applicationId',
      'categoryId',
      'requestMode',
      'documentDirection',
      'routeKeyPrefix',
      'primaryConfigRouteKey',
      'createUnitScope',
      'readUnitScope'
    ];

    for (const controlName of requiredControls) {
      this.scopeForm.get(controlName)?.markAsTouched();
    }
  }

  private normalizeString(value: unknown): string {
    return String(value ?? '').trim();
  }

  private normalizeScalar(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : null;
  }

  private optionalJsonValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const rawValue = String(control.value ?? '').trim();
      if (rawValue.length === 0) {
        return null;
      }

      try {
        JSON.parse(rawValue);
        return null;
      } catch {
        return { jsonInvalid: true };
      }
    };
  }
}
