import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { auditTime } from 'rxjs/operators';
import {
  ControlCenterStepViewModel,
  ControlCenterViewModel
} from '../../domain/models/admin-control-center.view-models';
import {
  PreviewRenderingMap,
  PreviewSimulationDirection,
  PreviewSimulationMode
} from '../../domain/models/preview-simulation.models';
import { AdminControlCenterFacade } from '../../facades/admin-control-center.facade';

@Component({
  selector: 'app-preview-simulation-page',
  templateUrl: './preview-simulation-page.component.html',
  styleUrls: ['./preview-simulation-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PreviewSimulationPageComponent implements OnInit, OnDestroy {
  readonly stepKey = 'preview-simulation' as const;

  readonly previewForm: FormGroup = this.fb.group({
    previewDirection: [null, [Validators.required]],
    previewMode: [null, [Validators.required]],
    sampleReference: ['', [Validators.maxLength(120)]],
    enableSimulationTrace: [false],
    previewNotes: ['', [Validators.maxLength(1200)]]
  });

  vm: ControlCenterViewModel | null = null;
  step: ControlCenterStepViewModel | null = null;
  renderingMap: PreviewRenderingMap | null = null;

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
        const matchingStep = vm.steps.find(step => step.key === this.stepKey) ?? null;
        this.step = matchingStep;
        if (!matchingStep) {
          this.renderingMap = null;
          return;
        }

        this.renderingMap = vm.derived.preview.renderingMap;
        this.patchFormFromStep(matchingStep.values, vm.context.documentDirection);
      })
    );

    this.subscriptions.add(
      this.previewForm.valueChanges
        .pipe(auditTime(80))
        .subscribe(() => {
          if (this.syncingFromStore) {
            return;
          }

          this.syncPreviewInputsToStore();
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

  getOptions(fieldKey: string): Array<{ label: string; value: string }> {
    const field = this.step?.fields.find(item => item.key === fieldKey);
    return [...(field?.options ?? [])];
  }

  controlHasError(controlName: string): boolean {
    const control = this.previewForm.get(controlName);
    if (!control) {
      return false;
    }

    return control.invalid && (control.dirty || control.touched);
  }

  controlErrorMessage(controlName: string): string {
    const control = this.previewForm.get(controlName);
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
    this.syncPreviewInputsToStore();
    const draftResult = this.facade.saveDraft();
    this.stepMessageSeverity = draftResult.success ? 'success' : 'warn';
    this.stepMessage = draftResult.message;
  }

  onGoNext(): void {
    this.previewForm.markAllAsTouched();
    this.syncPreviewInputsToStore();

    const hasBlockingIssues = (this.renderingMap?.blockingIssues.length ?? 0) > 0;
    if (this.previewForm.invalid || hasBlockingIssues || !this.step?.isCompleted) {
      this.stepMessageSeverity = 'warn';
      this.stepMessage = 'لا يمكن المتابعة قبل إغلاق مشاكل المعاينة المانعة.';
      return;
    }

    const nextStep = this.facade.getNextStepKey(this.stepKey);
    if (!nextStep) {
      return;
    }

    this.stepMessage = '';
    this.router.navigate(['/Admin/ControlCenter', nextStep]);
  }

  goToSafeStep(): void {
    const safeStep = this.facade.resolveSafeStepKey(this.stepKey);
    this.facade.setActiveStepByKey(safeStep);
    this.router.navigate(['/Admin/ControlCenter', safeStep]);
  }

  private syncPreviewInputsToStore(): void {
    const raw = this.previewForm.getRawValue();

    this.facade.updateFieldValue(this.stepKey, 'previewDirection', raw.previewDirection);
    this.facade.updateFieldValue(this.stepKey, 'previewMode', raw.previewMode);
    this.facade.updateFieldValue(this.stepKey, 'sampleReference', raw.sampleReference);
    this.facade.updateFieldValue(this.stepKey, 'enableSimulationTrace', raw.enableSimulationTrace);
    this.facade.updateFieldValue(this.stepKey, 'previewNotes', raw.previewNotes);
  }

  private patchFormFromStep(values: Record<string, unknown>, defaultDirection: 'incoming' | 'outgoing' | null): void {
    const resolvedDirection = this.normalizeDirection(values['previewDirection'] ?? defaultDirection ?? 'incoming');
    const resolvedMode = this.normalizeMode(values['previewMode'] ?? 'create');

    const nextValue = {
      previewDirection: resolvedDirection,
      previewMode: resolvedMode,
      sampleReference: String(values['sampleReference'] ?? '').trim(),
      enableSimulationTrace: values['enableSimulationTrace'] === true,
      previewNotes: String(values['previewNotes'] ?? '').trim()
    };

    this.syncingFromStore = true;
    this.previewForm.patchValue(nextValue, { emitEvent: false });
    this.syncingFromStore = false;
  }

  private normalizeMode(value: unknown): PreviewSimulationMode {
    const normalized = String(value ?? '').trim();
    if (normalized === 'edit' || normalized === 'view') {
      return normalized;
    }

    return 'create';
  }

  private normalizeDirection(value: unknown): PreviewSimulationDirection {
    const normalized = String(value ?? '').trim();
    return normalized === 'outgoing' ? 'outgoing' : 'incoming';
  }
}
