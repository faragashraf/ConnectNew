import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { auditTime } from 'rxjs/operators';
import {
  ControlCenterStepViewModel,
  ControlCenterViewModel
} from '../../domain/models/admin-control-center.view-models';
import { PublishChangeSummary, PublishReadinessResult } from '../../domain/models/publish-release.models';
import { PublishReleaseEngine } from '../../domain/publish-release/publish-release.engine';
import { AdminControlCenterFacade } from '../../facades/admin-control-center.facade';

@Component({
  selector: 'app-publish-release-page',
  templateUrl: './publish-release-page.component.html',
  styleUrls: ['./publish-release-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PublishReleasePageComponent implements OnInit, OnDestroy {
  readonly stepKey = 'publish-release' as const;

  readonly publishForm: FormGroup = this.fb.group({
    releaseTitle: ['', [Validators.required, Validators.maxLength(160)]],
    releaseChannel: [null, [Validators.required]],
    publishWindow: ['', [Validators.maxLength(120)]],
    releaseVersion: ['', [Validators.maxLength(60)]],
    releaseNotes: ['', [Validators.maxLength(1500)]]
  });

  vm: ControlCenterViewModel | null = null;
  step: ControlCenterStepViewModel | null = null;
  changeSummary: PublishChangeSummary | null = null;
  publishReadiness: PublishReadinessResult | null = null;
  auditBlockingCount = 0;
  auditWarningCount = 0;

  stepMessage = '';
  stepMessageSeverity: 'success' | 'warn' = 'warn';

  private readonly subscriptions = new Subscription();
  private syncingFromStore = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly facade: AdminControlCenterFacade,
    private readonly publishEngine: PublishReleaseEngine,
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
          return;
        }

        this.patchFormFromStep(matchingStep.values);
        this.evaluatePublish(false);
      })
    );

    this.subscriptions.add(
      this.publishForm.valueChanges
        .pipe(auditTime(80))
        .subscribe(() => {
          if (this.syncingFromStore) {
            return;
          }

          this.evaluatePublish(true);
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
    const control = this.publishForm.get(controlName);
    if (!control) {
      return false;
    }

    return control.invalid && (control.dirty || control.touched);
  }

  controlErrorMessage(controlName: string): string {
    const control = this.publishForm.get(controlName);
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
    this.evaluatePublish(true);
    this.facade.saveDraft();
    this.stepMessageSeverity = 'success';
    this.stepMessage = 'تم حفظ إعدادات النشر والإطلاق.';
  }

  onPublishNow(): void {
    this.publishForm.markAllAsTouched();
    this.evaluatePublish(true);

    if (!this.publishReadiness?.isReady || !this.step?.isCompleted) {
      this.stepMessageSeverity = 'warn';
      this.stepMessage = 'تعذر النشر: توجد متطلبات مانعة لم تكتمل بعد.';
      return;
    }

    const result = this.facade.publish();
    this.stepMessageSeverity = result.success ? 'success' : 'warn';
    this.stepMessage = result.message;
    this.evaluatePublish(false);
  }

  goToSafeStep(): void {
    const safeStep = this.facade.resolveSafeStepKey(this.stepKey);
    this.facade.setActiveStepByKey(safeStep);
    this.router.navigate(['/Admin/ControlCenter', safeStep]);
  }

  resolvePublishStateLabel(state: ControlCenterViewModel['publishState']): string {
    if (state === 'published') {
      return 'منشور';
    }
    if (state === 'ready') {
      return 'جاهز للنشر';
    }
    if (state === 'blocked') {
      return 'متعثر';
    }

    return 'مسودة';
  }

  resolvePublishStateSeverity(state: ControlCenterViewModel['publishState']): 'success' | 'info' | 'danger' {
    if (state === 'published' || state === 'ready') {
      return 'success';
    }
    if (state === 'blocked') {
      return 'danger';
    }

    return 'info';
  }

  private evaluatePublish(syncToStore: boolean): void {
    if (!this.vm) {
      this.changeSummary = null;
      this.publishReadiness = null;
      return;
    }

    const auditStep = this.vm.steps.find(step => step.key === 'readiness-audit');
    const auditBlockingIssues = this.parseIssuesFromPayload(auditStep?.values['auditBlockingPayload']);
    const auditWarnings = this.parseIssuesFromPayload(auditStep?.values['auditWarningsPayload']);

    this.auditBlockingCount = auditBlockingIssues.length;
    this.auditWarningCount = auditWarnings.length;

    this.changeSummary = this.publishEngine.buildChangeSummary(this.vm, this.auditWarningCount);

    const raw = this.publishForm.getRawValue();
    this.publishReadiness = this.publishEngine.evaluateReadiness(
      this.vm,
      String(raw.releaseTitle ?? '').trim(),
      String(raw.releaseChannel ?? '').trim(),
      this.auditBlockingCount
    );

    if (!syncToStore) {
      return;
    }

    const token = this.publishReadiness.isReady ? 'valid' : null;
    const payload = this.publishEngine.serializeChangeSummary(this.changeSummary);

    this.facade.updateFieldValue(this.stepKey, 'releaseTitle', raw.releaseTitle);
    this.facade.updateFieldValue(this.stepKey, 'releaseChannel', raw.releaseChannel);
    this.facade.updateFieldValue(this.stepKey, 'publishWindow', raw.publishWindow);
    this.facade.updateFieldValue(this.stepKey, 'releaseVersion', raw.releaseVersion);
    this.facade.updateFieldValue(this.stepKey, 'releaseNotes', raw.releaseNotes);
    this.facade.updateFieldValue(this.stepKey, 'changeSummaryPayload', payload);
    this.facade.updateFieldValue(this.stepKey, 'publishReadinessToken', token);
  }

  private patchFormFromStep(values: Record<string, unknown>): void {
    const nextValue = {
      releaseTitle: String(values['releaseTitle'] ?? '').trim(),
      releaseChannel: this.normalizeNullable(values['releaseChannel']),
      publishWindow: String(values['publishWindow'] ?? '').trim(),
      releaseVersion: String(values['releaseVersion'] ?? '').trim(),
      releaseNotes: String(values['releaseNotes'] ?? '').trim()
    };

    this.syncingFromStore = true;
    this.publishForm.patchValue(nextValue, { emitEvent: false });
    this.syncingFromStore = false;
  }

  private parseIssuesFromPayload(rawValue: unknown): string[] {
    const raw = String(rawValue ?? '').trim();
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .map(item => {
          if (item && typeof item === 'object') {
            return String((item as Record<string, unknown>)['message'] ?? '').trim();
          }

          return '';
        })
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  private normalizeNullable(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : null;
  }
}
