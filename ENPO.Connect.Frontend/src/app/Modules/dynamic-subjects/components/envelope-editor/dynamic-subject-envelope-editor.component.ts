import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { DynamicSubjectsController } from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.service';
import { EnvelopeUpsertRequestDto } from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.dto';
import { AppNotificationService } from 'src/app/shared/services/notifications/app-notification.service';
import { DynamicSubjectsRealtimeService } from '../../services/dynamic-subjects-realtime.service';

@Component({
  selector: 'app-dynamic-subject-envelope-editor',
  templateUrl: './dynamic-subject-envelope-editor.component.html',
  styleUrls: ['./dynamic-subject-envelope-editor.component.scss']
})
export class DynamicSubjectEnvelopeEditorComponent implements OnInit, OnDestroy {
  form: FormGroup;
  envelopeId = 0;
  isEditMode = false;
  loading = false;
  saving = false;
  submitAttempted = false;

  private readonly subscriptions: Subscription[] = [];

  constructor(
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly dynamicSubjectsController: DynamicSubjectsController,
    private readonly realtimeService: DynamicSubjectsRealtimeService,
    private readonly appNotification: AppNotificationService
  ) {
    this.form = this.fb.group({
      envelopeRef: ['', Validators.required],
      incomingDate: ['', Validators.required],
      sourceEntity: [''],
      deliveryDelegate: [''],
      notes: [''],
      linkedSubjectIdsText: ['']
    });
  }

  ngOnInit(): void {
    this.envelopeId = Number(this.route.snapshot.paramMap.get('id') ?? 0);
    this.isEditMode = this.envelopeId > 0;
    if (this.isEditMode) {
      this.realtimeService.joinEnvelopeGroup(this.envelopeId);
      this.load();
      this.subscriptions.push(
        this.realtimeService.subscribeByEntity('envelope', this.envelopeId).subscribe(() => this.load())
      );
    } else {
      this.form.patchValue({ incomingDate: new Date().toISOString().slice(0, 10) });
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  load(): void {
    if (!this.envelopeId) {
      return;
    }

    this.loading = true;
    this.dynamicSubjectsController.getEnvelope(this.envelopeId).subscribe({
      next: response => {
        if (response?.errors?.length) {
          this.appNotification.showApiErrors(response.errors, 'تعذر تحميل بيانات الظرف الوارد.');
          return;
        }

        const envelope = response?.data;
        if (!envelope) {
          return;
        }

        this.form.patchValue({
          envelopeRef: envelope.envelopeRef,
          incomingDate: String(envelope.incomingDate ?? '').slice(0, 10),
          sourceEntity: envelope.sourceEntity ?? '',
          deliveryDelegate: envelope.deliveryDelegate ?? '',
          notes: envelope.notes ?? '',
          linkedSubjectIdsText: (envelope.linkedSubjects ?? []).map(item => item.messageId).join(', ')
        });
      },
      error: () => {
        this.appNotification.error('حدث خطأ أثناء تحميل بيانات الظرف.');
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  save(): void {
    this.submitAttempted = true;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.appNotification.warning('يرجى استكمال الحقول المطلوبة قبل الحفظ.');
      return;
    }

    const payload: EnvelopeUpsertRequestDto = {
      envelopeRef: String(this.form.get('envelopeRef')?.value ?? '').trim(),
      incomingDate: String(this.form.get('incomingDate')?.value ?? ''),
      sourceEntity: String(this.form.get('sourceEntity')?.value ?? '').trim() || undefined,
      deliveryDelegate: String(this.form.get('deliveryDelegate')?.value ?? '').trim() || undefined,
      notes: String(this.form.get('notes')?.value ?? '').trim() || undefined,
      linkedSubjectIds: this.parseSubjectIds(this.form.get('linkedSubjectIdsText')?.value)
    };

    this.saving = true;
    const request$ = this.isEditMode
      ? this.dynamicSubjectsController.updateEnvelope(this.envelopeId, payload)
      : this.dynamicSubjectsController.createEnvelope(payload);

    request$.subscribe({
      next: response => {
        if (response?.errors?.length) {
          this.appNotification.showApiErrors(response.errors, 'تعذر حفظ بيانات الظرف الوارد.');
          return;
        }

        this.appNotification.success('تم حفظ بيانات الظرف الوارد بنجاح.');
        const createdId = Number(response?.data?.envelopeId ?? this.envelopeId ?? 0);
        if (createdId > 0) {
          this.router.navigate(['/DynamicSubjects/envelopes', createdId]);
        }
      },
      error: () => {
        this.appNotification.error('حدث خطأ أثناء حفظ بيانات الظرف.');
      },
      complete: () => {
        this.saving = false;
      }
    });
  }

  private parseSubjectIds(value: any): number[] {
    const text = String(value ?? '').trim();
    if (!text) {
      return [];
    }

    return text
      .split(/[,\n;| ]+/g)
      .map(item => Number(item))
      .filter(item => Number.isFinite(item) && item > 0);
  }

  shouldShowError(controlName: string): boolean {
    const control = this.form.get(controlName);
    if (!control) {
      return false;
    }

    return control.invalid && (control.touched || this.submitAttempted);
  }

  getControlErrorMessage(controlName: string): string {
    const control = this.form.get(controlName);
    if (!control || !control.errors) {
      return '';
    }

    if (control.errors['required']) {
      return 'هذا الحقل مطلوب.';
    }

    return 'القيمة المدخلة غير صحيحة.';
  }
}
