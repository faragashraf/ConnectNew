import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import {
  AdminControlCenterFacade,
  ControlCenterStepViewModel,
  ControlCenterViewModel
} from '../../facades/admin-control-center.facade';

@Component({
  selector: 'app-control-center-shell',
  templateUrl: './control-center-shell.component.html',
  styleUrls: ['./control-center-shell.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ControlCenterShellComponent implements OnInit {
  readonly vm$: Observable<ControlCenterViewModel> = this.facade.vm$;
  actionMessage = '';
  actionSeverity: 'success' | 'warn' = 'success';

  constructor(
    private readonly facade: AdminControlCenterFacade,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.facade.initialize();
  }

  onNavigateToStep(step: ControlCenterStepViewModel): void {
    if (!step.isUnlocked) {
      this.actionSeverity = 'warn';
      this.actionMessage = 'لا يمكن فتح هذه الخطوة قبل استكمال متطلبات الخطوات السابقة.';
      return;
    }

    this.facade.setActiveStepByKey(step.key);
    this.router.navigate(['/Admin/ControlCenter', step.key]);
  }

  onSaveDraft(): void {
    const draftResult = this.facade.saveDraft();
    this.actionSeverity = draftResult.success ? 'success' : 'warn';
    this.actionMessage = draftResult.message;
  }

  onClearDraft(): void {
    const actionResult = this.facade.clearDraft();
    this.actionSeverity = actionResult.success ? 'success' : 'warn';
    this.actionMessage = actionResult.message;
    this.router.navigate(['/Admin/ControlCenter', actionResult.targetStepKey]);
  }

  onStartNewScope(): void {
    const actionResult = this.facade.startNewScope();
    this.actionSeverity = actionResult.success ? 'success' : 'warn';
    this.actionMessage = actionResult.message;
    this.router.navigate(['/Admin/ControlCenter', actionResult.targetStepKey]);
  }

  onLoadDemoScope(): void {
    const actionResult = this.facade.loadDemoScope();
    this.actionSeverity = actionResult.success ? 'success' : 'warn';
    this.actionMessage = actionResult.message;
    this.router.navigate(['/Admin/ControlCenter', actionResult.targetStepKey]);
  }

  onRetryInitialize(): void {
    this.facade.initialize();
    this.actionSeverity = 'success';
    this.actionMessage = 'تمت إعادة تهيئة مركز التحكم بنجاح.';
  }

  onGoToFirstStep(): void {
    const safeStep = this.facade.resolveSafeStepKey(null);
    this.facade.setActiveStepByKey(safeStep);
    this.router.navigate(['/Admin/ControlCenter', safeStep]);
  }

  async onPublish(): Promise<void> {
    const currentVm = this.facade.getCurrentViewModel();
    if (!this.canPublish(currentVm)) {
      this.actionSeverity = 'warn';
      this.actionMessage = 'لا يمكن النشر قبل إغلاق جميع المشكلات المانعة في التدقيق.';
      return;
    }

    const result = await this.facade.publish();
    this.actionSeverity = result.success ? 'success' : 'warn';
    const firstWarning = result.warnings?.[0];
    this.actionMessage = firstWarning ? `${result.message} - ملاحظة: ${firstWarning}` : result.message;
  }

  canPublish(vm: ControlCenterViewModel): boolean {
    return vm.blockingIssues.length === 0;
  }

  resolvePublishStateLabel(state: ControlCenterViewModel['publishState']): string {
    if (state === 'published') {
      return 'منشور';
    }

    if (state === 'ready') {
      return 'جاهز للنشر';
    }

    if (state === 'blocked') {
      return 'متوقف';
    }

    return 'مسودة';
  }

  resolveStepStatusLabel(step: ControlCenterStepViewModel): string {
    if (!step.isUnlocked) {
      return 'مغلق';
    }

    if (step.status === 'ready') {
      return 'جاهز';
    }

    if (step.status === 'blocked') {
      return 'متعثر';
    }

    return 'مسودة';
  }

  resolveStepStatusSeverity(step: ControlCenterStepViewModel): 'success' | 'warning' | 'danger' | 'info' {
    if (!step.isUnlocked) {
      return 'danger';
    }

    if (step.status === 'ready') {
      return 'success';
    }

    if (step.status === 'blocked') {
      return 'danger';
    }

    return 'info';
  }
}
