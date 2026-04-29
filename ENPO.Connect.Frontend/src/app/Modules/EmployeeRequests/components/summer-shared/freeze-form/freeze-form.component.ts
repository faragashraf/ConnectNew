import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { SummerDestinationConfig } from '../../summer-requests-workspace/summer-requests-workspace.config';
import {
  AdminUnitFreezeCreatePayload,
  SummerUnitsAvailableCountDto
} from 'src/app/shared/services/BackendServices/SummerWorkflow/SummerWorkflow.dto';
import { SummerWorkflowController } from 'src/app/shared/services/BackendServices/SummerWorkflow/SummerWorkflow.service';

@Component({
  selector: 'app-freeze-form',
  templateUrl: './freeze-form.component.html',
  styleUrls: ['./freeze-form.component.scss']
})
export class FreezeFormComponent implements OnInit, OnChanges, OnDestroy {
  @Input() destinations: SummerDestinationConfig[] = [];
  @Input() submitLoading = false;
  @Input() submitLabel = 'تنفيذ التجميد';
  @Input() initialValues: Partial<AdminUnitFreezeCreatePayload> | null = null;

  @Output() formSubmitted = new EventEmitter<AdminUnitFreezeCreatePayload>();
  @Output() formCancelled = new EventEmitter<void>();

  form: FormGroup;
  loadingAvailableCount = false;
  availableCountError = '';
  availableCount: SummerUnitsAvailableCountDto | null = null;

  private readonly subscriptions = new Subscription();
  private initialValuesApplied = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly summerWorkflowController: SummerWorkflowController
  ) {
    this.form = this.fb.group({
      resortId: [null, Validators.required],
      waveId: ['', Validators.required],
      capacity: [null, [Validators.required, Validators.min(1)]],
      unitsCount: [null, [Validators.required, Validators.min(1)]],
      reason: [''],
      notes: ['']
    });
  }

  ngOnInit(): void {
    const resortSub = this.form.get('resortId')?.valueChanges.subscribe(() => {
      this.form.patchValue({ waveId: '', capacity: null, unitsCount: null }, { emitEvent: false });
      this.clearAvailableCount();
    });
    if (resortSub) {
      this.subscriptions.add(resortSub);
    }

    const criteriaSub = this.form.valueChanges.subscribe(() => {
      this.syncUnitsCountValidation();
      this.refreshAvailableCount();
    });
    this.subscriptions.add(criteriaSub);

    this.tryApplyInitialValues();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.initialValuesApplied && (changes['initialValues'] || changes['destinations'])) {
      this.tryApplyInitialValues();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  get selectedDestination(): SummerDestinationConfig | undefined {
    const resortId = Number(this.form.get('resortId')?.value ?? 0);
    return this.destinations.find(item => item.categoryId === resortId);
  }

  get availableWaves() {
    return this.selectedDestination?.waves ?? [];
  }

  get availableCapacities(): number[] {
    return this.selectedDestination?.familyOptions ?? [];
  }

  submit(): void {
    this.form.markAllAsTouched();
    this.syncUnitsCountValidation();
    if (this.form.invalid) {
      return;
    }

    const raw = this.form.getRawValue();
    this.formSubmitted.emit({
      resortId: Number(raw.resortId ?? 0),
      waveId: String(raw.waveId ?? '').trim(),
      capacity: Number(raw.capacity ?? 0),
      unitsCount: Number(raw.unitsCount ?? 0),
      reason: String(raw.reason ?? '').trim(),
      notes: String(raw.notes ?? '').trim()
    });
  }

  cancel(): void {
    this.formCancelled.emit();
  }

  private refreshAvailableCount(): void {
    const resortId = Number(this.form.get('resortId')?.value ?? 0);
    const waveId = String(this.form.get('waveId')?.value ?? '').trim();
    const capacity = Number(this.form.get('capacity')?.value ?? 0);

    if (resortId <= 0 || waveId.length === 0 || capacity <= 0) {
      this.clearAvailableCount();
      return;
    }

    this.loadingAvailableCount = true;
    this.availableCountError = '';
    this.summerWorkflowController.getAdminAvailableCount({
      resortId,
      waveId,
      capacity,
      includeFrozenUnits: false
    }).subscribe({
      next: response => {
        if (response?.isSuccess && response.data) {
          this.availableCount = response.data;
          this.syncUnitsCountValidation();
          return;
        }

        this.availableCount = null;
        this.availableCountError = this.collectErrors(response?.errors);
      },
      error: () => {
        this.availableCount = null;
        this.availableCountError = 'تعذر تحميل الوحدات المتاحة حالياً.';
      },
      complete: () => {
        this.loadingAvailableCount = false;
      }
    });
  }

  private syncUnitsCountValidation(): void {
    const unitsCountControl = this.form.get('unitsCount');
    if (!unitsCountControl) {
      return;
    }

    const rawCount = Number(unitsCountControl.value ?? 0);
    const available = Number(this.availableCount?.availableUnits ?? 0);
    const hasCriteria = this.availableCount !== null;

    const errors = { ...(unitsCountControl.errors ?? {}) } as Record<string, unknown>;
    delete errors['exceedsAvailable'];

    if (hasCriteria && rawCount > 0 && rawCount > available) {
      errors['exceedsAvailable'] = true;
    }

    const hasErrors = Object.keys(errors).length > 0;
    unitsCountControl.setErrors(hasErrors ? errors : null);
  }

  private clearAvailableCount(): void {
    this.loadingAvailableCount = false;
    this.availableCount = null;
    this.availableCountError = '';
    this.syncUnitsCountValidation();
  }

  private collectErrors(errors: Array<{ message?: string }> | null | undefined): string {
    const messages = (errors ?? [])
      .map(item => String(item?.message ?? '').trim())
      .filter(item => item.length > 0);

    return messages.length > 0 ? messages.join(' | ') : 'تعذر تحميل الوحدات المتاحة.';
  }

  private tryApplyInitialValues(): void {
    if (this.initialValuesApplied || !this.initialValues) {
      return;
    }

    const resortId = Number(this.initialValues.resortId ?? 0);
    if (!Number.isFinite(resortId) || resortId <= 0) {
      return;
    }

    const destination = this.destinations.find(item => item.categoryId === resortId);
    if (!destination) {
      return;
    }

    const waveValue = String(this.initialValues.waveId ?? '').trim();
    const capacityValue = Number(this.initialValues.capacity ?? 0);
    const unitsCountValue = Number(this.initialValues.unitsCount ?? 0);

    const waveId = destination.waves.some(item => item.code === waveValue)
      ? waveValue
      : '';
    const capacity = destination.familyOptions.includes(capacityValue)
      ? capacityValue
      : null;
    const unitsCount = Number.isFinite(unitsCountValue) && unitsCountValue > 0
      ? unitsCountValue
      : null;

    this.form.patchValue(
      {
        resortId,
        waveId,
        capacity,
        unitsCount,
        reason: String(this.initialValues.reason ?? '').trim(),
        notes: String(this.initialValues.notes ?? '').trim()
      },
      { emitEvent: false }
    );

    this.syncUnitsCountValidation();
    this.refreshAvailableCount();
    this.initialValuesApplied = true;
  }
}
