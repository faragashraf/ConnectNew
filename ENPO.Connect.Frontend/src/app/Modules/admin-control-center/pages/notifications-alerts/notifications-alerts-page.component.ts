import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { auditTime } from 'rxjs/operators';
import {
  CommonResponse,
  SubjectNotificationRuleDto,
  SubjectNotificationRuleUpsertDto
} from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.dto';
import { DynamicSubjectsController } from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.service';
import { ControlCenterStepViewModel, ControlCenterViewModel } from '../../domain/models/admin-control-center.view-models';
import { AdminControlCenterFacade } from '../../facades/admin-control-center.facade';

type NotificationEventKey = 'create' | 'update' | 'forward';
type RecipientType = 'USER' | 'ROLE' | 'UNIT' | 'GROUP';

@Component({
  selector: 'app-notifications-alerts-page',
  templateUrl: './notifications-alerts-page.component.html',
  styleUrls: ['./notifications-alerts-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotificationsAlertsPageComponent implements OnInit, OnDestroy {
  readonly stepKey = 'notifications-alerts' as const;

  readonly recipientTypeOptions: Array<{ label: string; value: RecipientType }> = [
    { label: 'مستخدم (USER)', value: 'USER' },
    { label: 'دور (ROLE)', value: 'ROLE' },
    { label: 'وحدة (UNIT)', value: 'UNIT' },
    { label: 'مجموعة (GROUP)', value: 'GROUP' }
  ];

  readonly notificationsForm: FormGroup = this.fb.group({
    create: this.buildEventGroup('تم إنشاء طلب رقم {requestId} بعنوان "{requestTitle}".'),
    update: this.buildEventGroup('تم تحديث الطلب رقم {requestId} بعنوان "{requestTitle}".'),
    forward: this.buildEventGroup('تم تحويل الطلب رقم {requestId} بعنوان "{requestTitle}" إلى {unitName}.')
  });

  vm: ControlCenterViewModel | null = null;
  step: ControlCenterStepViewModel | null = null;
  categoryId: number | null = null;

  loading = false;
  saving = false;
  stepMessage = '';
  stepMessageSeverity: 'success' | 'warn' = 'warn';

  private readonly subscriptions = new Subscription();
  private syncingFromStore = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly facade: AdminControlCenterFacade,
    private readonly router: Router,
    private readonly dynamicSubjectsController: DynamicSubjectsController
  ) {}

  ngOnInit(): void {
    this.facade.initialize(this.stepKey);

    this.subscriptions.add(
      this.facade.vm$.subscribe(vm => {
        this.vm = vm;
        this.step = vm.steps.find(item => item.key === this.stepKey) ?? null;

        const nextCategoryId = this.toPositiveInt(vm.context.categoryId);
        if (nextCategoryId && nextCategoryId !== this.categoryId) {
          this.categoryId = nextCategoryId;
          this.loadRules(nextCategoryId);
          return;
        }

        if (!nextCategoryId) {
          this.categoryId = null;
        }
      })
    );

    this.subscriptions.add(
      this.notificationsForm.valueChanges
        .pipe(auditTime(120))
        .subscribe(() => {
          if (this.syncingFromStore) {
            return;
          }

          this.syncStepValues('draft');
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

  get categoryReady(): boolean {
    return (this.categoryId ?? 0) > 0;
  }

  eventGroup(eventKey: NotificationEventKey): FormGroup {
    return this.notificationsForm.get(eventKey) as FormGroup;
  }

  controlHasError(eventKey: NotificationEventKey, controlName: string): boolean {
    const control = this.eventGroup(eventKey).get(controlName);
    if (!control) {
      return false;
    }

    return control.invalid && (control.touched || control.dirty);
  }

  controlErrorMessage(eventKey: NotificationEventKey, controlName: string): string {
    const control = this.eventGroup(eventKey).get(controlName);
    if (!control) {
      return 'قيمة غير صحيحة.';
    }

    if (control.hasError('required')) {
      return 'هذا الحقل إلزامي.';
    }

    if (control.hasError('maxlength')) {
      return 'القيمة أطول من الحد المسموح.';
    }

    return `قيمة غير صحيحة في ${eventKey}.`;
  }

  onSaveRules(): void {
    if (!this.categoryReady || !this.categoryId) {
      this.stepMessageSeverity = 'warn';
      this.stepMessage = 'يجب اختيار نوع طلب (Category) من خطوة Scope Definition أولًا.';
      return;
    }

    this.notificationsForm.markAllAsTouched();
    const validationError = this.validateEnabledRules();
    if (validationError) {
      this.stepMessageSeverity = 'warn';
      this.stepMessage = validationError;
      return;
    }

    const payload = this.buildUpsertPayload();
    this.saving = true;
    this.dynamicSubjectsController.upsertAdminNotificationRules(this.categoryId, { rules: payload }).subscribe({
      next: response => {
        this.saving = false;
        if (response?.errors?.length) {
          this.stepMessageSeverity = 'warn';
          this.stepMessage = response.errors[0]?.message ?? 'تعذر حفظ قواعد الإشعارات.';
          return;
        }

        this.patchFormFromRules(response);
        this.syncStepValues('synced');
        this.stepMessageSeverity = 'success';
        this.stepMessage = 'تم حفظ قواعد الإشعارات والتنبيهات بنجاح.';
      },
      error: () => {
        this.saving = false;
        this.stepMessageSeverity = 'warn';
        this.stepMessage = 'حدث خطأ أثناء حفظ قواعد الإشعارات.';
      }
    });
  }

  onGoNext(): void {
    const nextStep = this.facade.getNextStepKey(this.stepKey);
    if (!nextStep) {
      this.stepMessageSeverity = 'success';
      this.stepMessage = 'هذه آخر خطوة قبل النشر. يمكنك العودة إلى مركز النشر والإطلاق.';
      return;
    }

    this.router.navigate(['/Admin/ControlCenter', nextStep]);
  }

  private loadRules(categoryId: number): void {
    this.loading = true;
    this.stepMessage = '';
    this.dynamicSubjectsController.getAdminNotificationRules(categoryId).subscribe({
      next: response => {
        this.loading = false;
        if (response?.errors?.length) {
          this.stepMessageSeverity = 'warn';
          this.stepMessage = response.errors[0]?.message ?? 'تعذر تحميل قواعد الإشعارات.';
          return;
        }

        this.patchFormFromRules(response);
        this.syncStepValues('synced');
      },
      error: () => {
        this.loading = false;
        this.stepMessageSeverity = 'warn';
        this.stepMessage = 'حدث خطأ أثناء تحميل قواعد الإشعارات.';
      }
    });
  }

  private patchFormFromRules(response: CommonResponse<SubjectNotificationRuleDto[]>): void {
    const rules = Array.isArray(response?.data) ? response.data : [];
    const byEvent = new Map<string, SubjectNotificationRuleDto>();
    rules.forEach(rule => {
      const eventType = String(rule.eventType ?? '').trim().toUpperCase();
      if (!byEvent.has(eventType)) {
        byEvent.set(eventType, rule);
      }
    });

    this.syncingFromStore = true;
    this.notificationsForm.patchValue(
      {
        create: this.toFormEventValue(byEvent.get('CREATE')),
        update: this.toFormEventValue(byEvent.get('UPDATE')),
        forward: this.toFormEventValue(byEvent.get('FORWARD'))
      },
      { emitEvent: false }
    );
    this.syncingFromStore = false;
  }

  private toFormEventValue(rule: SubjectNotificationRuleDto | undefined): Record<string, unknown> {
    return {
      enabled: rule?.isActive ?? false,
      recipientType: this.normalizeRecipientType(rule?.recipientType),
      recipientValue: String(rule?.recipientValue ?? '').trim(),
      template: String(rule?.template ?? '').trim()
    };
  }

  private buildUpsertPayload(): SubjectNotificationRuleUpsertDto[] {
    const create = this.eventGroup('create').getRawValue();
    const update = this.eventGroup('update').getRawValue();
    const forward = this.eventGroup('forward').getRawValue();

    return [
      this.toUpsertRule('CREATE', create),
      this.toUpsertRule('UPDATE', update),
      this.toUpsertRule('FORWARD', forward)
    ];
  }

  private toUpsertRule(
    eventType: 'CREATE' | 'UPDATE' | 'FORWARD',
    value: Record<string, unknown>
  ): SubjectNotificationRuleUpsertDto {
    return {
      eventType,
      recipientType: this.normalizeRecipientType(value['recipientType']) as RecipientType,
      recipientValue: String(value['recipientValue'] ?? '').trim(),
      template: String(value['template'] ?? '').trim(),
      isActive: value['enabled'] === true
    };
  }

  private validateEnabledRules(): string | null {
    const labels: Record<NotificationEventKey, string> = {
      create: 'الإنشاء',
      update: 'التعديل',
      forward: 'التحويل'
    };

    const keys: NotificationEventKey[] = ['create', 'update', 'forward'];
    for (const key of keys) {
      const group = this.eventGroup(key);
      const enabled = group.get('enabled')?.value === true;
      if (!enabled) {
        continue;
      }

      const recipientType = this.normalizeRecipientType(group.get('recipientType')?.value);
      const recipientValue = String(group.get('recipientValue')?.value ?? '').trim();
      if (!recipientType || recipientValue.length === 0) {
        return `يرجى تحديد نوع المستلم وقيمة المستلم لحدث ${labels[key]}.`;
      }
    }

    return null;
  }

  private syncStepValues(syncToken: 'draft' | 'synced'): void {
    const payload = this.buildUpsertPayload();
    this.facade.updateFieldValue(this.stepKey, 'notificationsRulesPayload', JSON.stringify(payload));
    this.facade.updateFieldValue(this.stepKey, 'notificationsSyncToken', syncToken);
  }

  private buildEventGroup(defaultTemplate: string): FormGroup {
    return this.fb.group({
      enabled: [false],
      recipientType: ['UNIT', [Validators.required]],
      recipientValue: ['', [Validators.maxLength(200)]],
      template: [defaultTemplate, [Validators.maxLength(2000)]]
    });
  }

  private normalizeRecipientType(value: unknown): RecipientType {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (normalized === 'USER' || normalized === 'ROLE' || normalized === 'UNIT' || normalized === 'GROUP') {
      return normalized;
    }

    return 'UNIT';
  }

  private toPositiveInt(value: unknown): number | null {
    const normalized = Number(value ?? 0);
    if (!Number.isFinite(normalized) || normalized <= 0) {
      return null;
    }

    return Math.trunc(normalized);
  }
}
