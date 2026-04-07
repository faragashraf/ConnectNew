import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { auditTime } from 'rxjs/operators';
import {
  AccessVisibilityConfig,
  AccessVisibilityValidationResult
} from '../../domain/models/access-visibility.models';
import {
  ControlCenterStepViewModel,
  ControlCenterViewModel
} from '../../domain/models/admin-control-center.view-models';
import { AccessVisibilityEngine } from '../../domain/access-visibility/access-visibility.engine';
import { AdminControlCenterFacade } from '../../facades/admin-control-center.facade';

@Component({
  selector: 'app-access-visibility-page',
  templateUrl: './access-visibility-page.component.html',
  styleUrls: ['./access-visibility-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccessVisibilityPageComponent implements OnInit, OnDestroy {
  readonly stepKey = 'access-visibility' as const;

  readonly accessForm: FormGroup = this.fb.group({
    createScope: ['', [Validators.required, Validators.maxLength(800)]],
    readScope: ['', [Validators.required, Validators.maxLength(800)]],
    workScope: ['', [Validators.maxLength(800)]],
    adminScope: ['', [Validators.required, Validators.maxLength(800)]],
    publishScope: ['', [Validators.required, Validators.maxLength(800)]],
    visibilityNotes: ['', [Validators.maxLength(1200)]]
  });

  vm: ControlCenterViewModel | null = null;
  step: ControlCenterStepViewModel | null = null;
  validation: AccessVisibilityValidationResult = {
    isValid: false,
    blockingIssues: [],
    warnings: [],
    normalizedScopes: {
      create: [],
      read: [],
      work: [],
      admin: [],
      publish: []
    }
  };
  stepMessage = '';
  stepMessageSeverity: 'success' | 'warn' = 'warn';

  private readonly subscriptions = new Subscription();
  private syncingFromStore = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly facade: AdminControlCenterFacade,
    private readonly router: Router,
    private readonly accessEngine: AccessVisibilityEngine
  ) {}

  ngOnInit(): void {
    this.facade.initialize(this.stepKey);

    this.subscriptions.add(
      this.facade.vm$.subscribe(vm => {
        this.vm = vm;
        const matchingStep = vm.steps.find(step => step.key === this.stepKey) ?? null;
        this.step = matchingStep;
        if (!matchingStep) {
          return;
        }

        this.patchFormFromStep(matchingStep.values);
        this.evaluateAccess(false);
      })
    );

    this.subscriptions.add(
      this.accessForm.valueChanges
        .pipe(auditTime(80))
        .subscribe(() => {
          if (this.syncingFromStore) {
            return;
          }

          this.evaluateAccess(true);
        })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  get requiredProgressText(): string {
    if (!this.step) {
      return '0 / 0';
    }

    return `${this.step.requiredCompleted} / ${this.step.requiredTotal}`;
  }

  controlHasError(controlName: string): boolean {
    const control = this.accessForm.get(controlName);
    if (!control) {
      return false;
    }

    return control.invalid && (control.dirty || control.touched);
  }

  controlErrorMessage(controlName: string): string {
    const control = this.accessForm.get(controlName);
    if (!control) {
      return 'قيمة غير صحيحة.';
    }

    if (control.hasError('required')) {
      return 'هذا الحقل إلزامي.';
    }
    if (control.hasError('maxlength')) {
      return 'القيمة أطول من الحد المسموح.';
    }

    return 'قيمة غير صحيحة.';
  }

  onSaveDraft(): void {
    this.evaluateAccess(true);
    this.facade.saveDraft();
    this.stepMessageSeverity = 'success';
    this.stepMessage = 'تم حفظ إعدادات Access & Visibility.';
  }

  onGoNext(): void {
    this.accessForm.markAllAsTouched();
    this.evaluateAccess(true);

    if (this.accessForm.invalid || !this.validation.isValid || !this.step?.isCompleted) {
      this.stepMessageSeverity = 'warn';
      this.stepMessage = 'لا يمكن المتابعة قبل حل مشكلات النطاقات والصلاحيات.';
      return;
    }

    const nextStep = this.facade.getNextStepKey(this.stepKey);
    if (!nextStep) {
      return;
    }

    this.stepMessage = '';
    this.router.navigate(['/Admin/ControlCenter', nextStep]);
  }

  private evaluateAccess(syncToStore: boolean): void {
    const config = this.buildConfigFromForm();
    this.validation = this.accessEngine.validate(config);

    if (!syncToStore) {
      return;
    }

    const token = this.validation.isValid ? 'valid' : null;
    this.facade.updateFieldValue(this.stepKey, 'createScope', config.createScope);
    this.facade.updateFieldValue(this.stepKey, 'readScope', config.readScope);
    this.facade.updateFieldValue(this.stepKey, 'workScope', config.workScope);
    this.facade.updateFieldValue(this.stepKey, 'adminScope', config.adminScope);
    this.facade.updateFieldValue(this.stepKey, 'publishScope', config.publishScope);
    this.facade.updateFieldValue(this.stepKey, 'visibilityNotes', config.visibilityNotes);
    this.facade.updateFieldValue(this.stepKey, 'accessVisibilityToken', token);
  }

  private patchFormFromStep(values: Record<string, unknown>): void {
    const nextValue = {
      createScope: String(values['createScope'] ?? '').trim(),
      readScope: String(values['readScope'] ?? '').trim(),
      workScope: String(values['workScope'] ?? '').trim(),
      adminScope: String(values['adminScope'] ?? '').trim(),
      publishScope: String(values['publishScope'] ?? '').trim(),
      visibilityNotes: String(values['visibilityNotes'] ?? '').trim()
    };

    this.syncingFromStore = true;
    this.accessForm.patchValue(nextValue, { emitEvent: false });
    this.syncingFromStore = false;
  }

  private buildConfigFromForm(): AccessVisibilityConfig {
    const raw = this.accessForm.getRawValue();
    return {
      createScope: String(raw.createScope ?? '').trim(),
      readScope: String(raw.readScope ?? '').trim(),
      workScope: String(raw.workScope ?? '').trim(),
      adminScope: String(raw.adminScope ?? '').trim(),
      publishScope: String(raw.publishScope ?? '').trim(),
      visibilityNotes: String(raw.visibilityNotes ?? '').trim()
    };
  }
}
