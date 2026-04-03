import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { FileParameter } from 'src/app/shared/services/BackendServices/dto-shared';
import { DynamicSubjectsController } from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.service';
import {
  EnvelopeSummaryDto,
  SubjectCategoryTreeNodeDto,
  SubjectDetailDto,
  SubjectFieldValueDto,
  SubjectFormDefinitionDto,
  SubjectUpsertRequest
} from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.dto';
import { AppNotificationService } from 'src/app/shared/services/notifications/app-notification.service';
import {
  DynamicFieldRenderItem,
  DynamicGroupRenderItem
} from '../shared/dynamic-fields-section/dynamic-fields-section.component';
import { DynamicSubjectsRealtimeService } from '../../services/dynamic-subjects-realtime.service';

@Component({
  selector: 'app-dynamic-subject-editor',
  templateUrl: './dynamic-subject-editor.component.html',
  styleUrls: ['./dynamic-subject-editor.component.scss']
})
export class DynamicSubjectEditorComponent implements OnInit, OnDestroy {
  editorForm: FormGroup;
  dynamicControls: FormGroup;
  stakeholdersArray: FormArray;
  tasksArray: FormArray;

  loading = false;
  saving = false;
  isEditMode = false;
  messageId = 0;
  formDefinition: SubjectFormDefinitionDto | null = null;
  renderGroups: DynamicGroupRenderItem[] = [];
  categoryOptions: Array<{ id: number; name: string }> = [];
  pendingFiles: FileParameter[] = [];
  existingAttachments: Array<{ attachmentId: number; fileName: string }> = [];
  availableEnvelopes: EnvelopeSummaryDto[] = [];
  liveEventNotice = '';
  submitAttempted = false;

  private controlMap = new Map<string, { fieldKey: string; instanceGroupId: number }>();
  private readonly subscriptions: Subscription[] = [];

  constructor(
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly dynamicSubjectsController: DynamicSubjectsController,
    private readonly realtimeService: DynamicSubjectsRealtimeService,
    private readonly appNotification: AppNotificationService
  ) {
    this.editorForm = this.fb.group({
      categoryId: [0, Validators.required],
      subject: [''],
      description: [''],
      envelopeId: [null]
    });

    this.dynamicControls = this.fb.group({});
    this.stakeholdersArray = this.fb.array([]);
    this.tasksArray = this.fb.array([]);
  }

  ngOnInit(): void {
    this.loadCategoryOptions();
    this.loadEnvelopeOptions();

    const routeId = Number(this.route.snapshot.paramMap.get('id') ?? 0);
    this.isEditMode = routeId > 0;
    this.messageId = routeId;

    if (this.isEditMode) {
      this.realtimeService.joinSubjectGroup(routeId);
      this.loadSubject(routeId);
    } else {
      this.subscriptions.push(
        this.route.queryParamMap.subscribe(params => {
          const categoryId = Number(params.get('categoryId') ?? 0);
          if (categoryId > 0) {
            this.editorForm.patchValue({ categoryId });
            this.loadFormDefinition(categoryId);
          }
        })
      );
    }

    this.subscriptions.push(
      this.realtimeService.events$().subscribe(eventItem => {
        if (Number(eventItem.messageId ?? 0) !== this.messageId || !this.messageId) {
          return;
        }

        const formattedTime = new Date(eventItem.timestampUtc).toLocaleTimeString('ar-EG');
        this.liveEventNotice = `تم استلام تحديث مباشر: ${this.toArabicEventType(eventItem.eventType)} - ${formattedTime}`;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  get stakeholdersControls(): FormGroup[] {
    return this.stakeholdersArray.controls as FormGroup[];
  }

  get tasksControls(): FormGroup[] {
    return this.tasksArray.controls as FormGroup[];
  }

  onCategoryChanged(): void {
    const categoryId = Number(this.editorForm.get('categoryId')?.value ?? 0);
    if (categoryId > 0) {
      this.loadFormDefinition(categoryId);
      this.realtimeService.joinCategoryGroup(categoryId);
    }
  }

  addStakeholder(): void {
    this.stakeholdersArray.push(this.fb.group({
      stockholderId: [0, Validators.required],
      partyType: ['Viewer'],
      requiredResponse: [false],
      status: [null],
      dueDate: [null],
      notes: ['']
    }));
  }

  removeStakeholder(index: number): void {
    this.stakeholdersArray.removeAt(index);
  }

  addTask(): void {
    this.tasksArray.push(this.fb.group({
      actionTitle: ['', Validators.required],
      actionDescription: [''],
      assignedToUserId: [''],
      assignedUnitId: [''],
      dueDateUtc: [null],
      status: [0]
    }));
  }

  removeTask(index: number): void {
    this.tasksArray.removeAt(index);
  }

  onFilesChanged(event: Event): void {
    const input = event.target as HTMLInputElement;
    const selected = Array.from(input.files ?? []);
    this.pendingFiles = selected.map(file => ({ data: file, fileName: file.name }));
  }

  removeExistingAttachment(attachmentId: number): void {
    if (!this.messageId || attachmentId <= 0) {
      return;
    }

    this.dynamicSubjectsController.removeAttachment(this.messageId, attachmentId).subscribe({
      next: response => {
        if (response?.errors?.length) {
          this.appNotification.showApiErrors(response.errors, 'تعذر حذف المرفق.');
          return;
        }

        this.existingAttachments = this.existingAttachments.filter(item => item.attachmentId !== attachmentId);
        this.appNotification.success('تم حذف المرفق بنجاح.');
      },
      error: () => {
        this.appNotification.error('حدث خطأ أثناء حذف المرفق.');
      }
    });
  }

  saveDraft(): void {
    this.save(false);
  }

  submitSubject(): void {
    this.save(true);
  }

  private save(submit: boolean): void {
    this.submitAttempted = true;
    const categoryId = Number(this.editorForm.get('categoryId')?.value ?? 0);
    if (categoryId <= 0) {
      this.editorForm.get('categoryId')?.markAsTouched();
      this.appNotification.warning('يرجى اختيار نوع الموضوع/الطلب.');
      return;
    }

    if (this.dynamicControls.invalid) {
      this.dynamicControls.markAllAsTouched();
      this.appNotification.warning('يرجى استكمال الحقول الديناميكية المطلوبة.');
      return;
    }

    const request: SubjectUpsertRequest = {
      categoryId,
      subject: this.editorForm.get('subject')?.value ?? '',
      description: this.editorForm.get('description')?.value ?? '',
      envelopeId: Number(this.editorForm.get('envelopeId')?.value ?? 0) || undefined,
      saveAsDraft: !submit,
      submit,
      dynamicFields: this.buildDynamicFieldValues(),
      stakeholders: this.buildStakeholdersPayload(),
      tasks: this.buildTasksPayload()
    };

    this.saving = true;
    const request$ = this.isEditMode
      ? this.dynamicSubjectsController.updateSubject(this.messageId, request, this.pendingFiles)
      : this.dynamicSubjectsController.createSubject(request, this.pendingFiles);

    request$.subscribe({
      next: response => {
        if (response?.errors?.length) {
          this.appNotification.showApiErrors(response.errors, 'تعذر حفظ الموضوع/الطلب.');
          return;
        }

        const createdId = Number(response?.data?.messageId ?? this.messageId ?? 0);
        if (createdId > 0) {
          this.appNotification.success(submit ? 'تم إرسال الموضوع/الطلب بنجاح.' : 'تم حفظ الموضوع/الطلب كمسودة.');
          this.router.navigate(['/DynamicSubjects/subjects', createdId]);
        }
      },
      error: () => {
        this.appNotification.error('حدث خطأ أثناء حفظ الموضوع/الطلب.');
      },
      complete: () => {
        this.saving = false;
      }
    });
  }

  private loadSubject(messageId: number): void {
    this.loading = true;
    this.dynamicSubjectsController.getSubject(messageId).subscribe({
      next: response => {
        if (response?.errors?.length) {
          this.appNotification.showApiErrors(response.errors, 'تعذر تحميل بيانات الموضوع/الطلب.');
          return;
        }

        const detail = response?.data;
        if (!detail) {
          return;
        }

        this.editorForm.patchValue({
          categoryId: detail.categoryId,
          subject: detail.subject ?? '',
          description: detail.description ?? '',
          envelopeId: detail.linkedEnvelopes?.[0]?.envelopeId ?? null
        });
        this.existingAttachments = (detail.attachments ?? []).map(item => ({
          attachmentId: item.attachmentId,
          fileName: item.fileName
        }));

        this.loadFormDefinition(detail.categoryId, detail);
      },
      error: () => {
        this.appNotification.error('حدث خطأ أثناء تحميل بيانات الموضوع/الطلب.');
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  private loadFormDefinition(categoryId: number, detail?: SubjectDetailDto): void {
    this.dynamicSubjectsController.getFormDefinition(categoryId).subscribe({
      next: response => {
        if (response?.errors?.length) {
          this.appNotification.showApiErrors(response.errors, 'تعذر تحميل إعدادات الحقول الديناميكية.');
          this.formDefinition = null;
          this.dynamicControls = this.fb.group({});
          this.renderGroups = [];
          return;
        }

        this.formDefinition = response?.data ?? null;
        this.rebuildDynamicControls(this.formDefinition, detail?.dynamicFields ?? []);
        this.populateStakeholders(detail);
        this.populateTasks(detail);
      },
      error: () => {
        this.appNotification.error('حدث خطأ أثناء تحميل إعدادات الحقول الديناميكية.');
      }
    });
  }

  private rebuildDynamicControls(definition: SubjectFormDefinitionDto | null, values: SubjectFieldValueDto[]): void {
    this.dynamicControls = this.fb.group({});
    this.renderGroups = [];
    this.controlMap.clear();

    const groupsMap = new Map<number, DynamicFieldRenderItem[]>();
    (definition?.fields ?? []).forEach(field => {
      const controlName = `${field.fieldKey}__${field.mendGroup}__1`;
      const existingValue = values.find(valueItem =>
        String(valueItem.fieldKey ?? '').toLowerCase() === String(field.fieldKey ?? '').toLowerCase()
        && Number(valueItem.instanceGroupId ?? 1) === 1);
      const isBoolean = String(field.fieldType ?? '').toLowerCase().includes('bool')
        || String(field.fieldType ?? '').toLowerCase().includes('check')
        || String(field.fieldType ?? '').toLowerCase().includes('toggle');
      const initial = existingValue?.value ?? field.defaultValue ?? (isBoolean ? false : '');

      this.dynamicControls.addControl(controlName, this.fb.control(initial, this.buildFieldValidators(field)));

      this.controlMap.set(controlName, { fieldKey: field.fieldKey, instanceGroupId: 1 });
      if (!groupsMap.has(field.mendGroup)) {
        groupsMap.set(field.mendGroup, []);
      }

      groupsMap.get(field.mendGroup)?.push({ controlName, definition: field });
    });

    this.renderGroups = (definition?.groups ?? [])
      .map(group => ({
        groupId: group.groupId,
        groupName: group.groupName,
        fields: groupsMap.get(group.groupId) ?? []
      }))
      .filter(group => group.fields.length > 0);
  }

  private populateStakeholders(detail?: SubjectDetailDto): void {
    this.stakeholdersArray.clear();
    (detail?.stakeholders ?? []).forEach(item => {
      this.stakeholdersArray.push(this.fb.group({
        stockholderId: [item.stockholderId, Validators.required],
        partyType: [item.partyType || 'Viewer'],
        requiredResponse: [Boolean(item.requiredResponse)],
        status: [item.status ?? null],
        dueDate: [item.dueDate ?? null],
        notes: [item.notes ?? '']
      }));
    });

    if (this.stakeholdersArray.length === 0) {
      this.addStakeholder();
    }
  }

  private populateTasks(detail?: SubjectDetailDto): void {
    this.tasksArray.clear();
    (detail?.tasks ?? []).forEach(item => {
      this.tasksArray.push(this.fb.group({
        actionTitle: [item.actionTitle, Validators.required],
        actionDescription: [item.actionDescription ?? ''],
        assignedToUserId: [item.assignedToUserId ?? ''],
        assignedUnitId: [item.assignedUnitId ?? ''],
        dueDateUtc: [item.dueDateUtc ?? null],
        status: [item.status ?? 0]
      }));
    });

    if (this.tasksArray.length === 0) {
      this.addTask();
    }
  }

  private buildDynamicFieldValues(): SubjectFieldValueDto[] {
    return Array.from(this.controlMap.entries()).map(([controlName, key]) => ({
      fieldKey: key.fieldKey,
      value: this.dynamicControls.get(controlName)?.value,
      instanceGroupId: key.instanceGroupId
    }));
  }

  private loadEnvelopeOptions(): void {
    this.dynamicSubjectsController.listEnvelopes({ pageNumber: 1, pageSize: 200 }).subscribe({
      next: response => {
        if (response?.errors?.length) {
          this.availableEnvelopes = [];
          return;
        }

        this.availableEnvelopes = response?.data?.items ?? [];
      },
      error: () => {
        this.availableEnvelopes = [];
      }
    });
  }

  private loadCategoryOptions(): void {
    this.dynamicSubjectsController.getCategoryTree().subscribe({
      next: response => {
        if (response?.errors?.length) {
          this.categoryOptions = [];
          this.appNotification.showApiErrors(response.errors, 'تعذر تحميل أنواع الموضوعات والطلبات.');
          return;
        }

        this.categoryOptions = this.flattenCategoryTree(response?.data ?? []);
      },
      error: () => {
        this.categoryOptions = [];
        this.appNotification.error('حدث خطأ أثناء تحميل أنواع الموضوعات والطلبات.');
      }
    });
  }

  private flattenCategoryTree(tree: SubjectCategoryTreeNodeDto[], prefix = ''): Array<{ id: number; name: string }> {
    const result: Array<{ id: number; name: string }> = [];
    (tree ?? []).forEach(node => {
      const name = prefix ? `${prefix} / ${node.categoryName}` : node.categoryName;
      if (node.canCreate) {
        result.push({ id: node.categoryId, name });
      }

      result.push(...this.flattenCategoryTree(node.children ?? [], name));
    });

    return result;
  }

  shouldShowEditorError(controlName: string): boolean {
    const control = this.editorForm.get(controlName);
    if (!control) {
      return false;
    }

    return control.invalid && (control.touched || this.submitAttempted);
  }

  getEditorErrorMessage(controlName: string): string {
    const control = this.editorForm.get(controlName);
    if (!control || !control.errors) {
      return '';
    }

    if (control.errors['required']) {
      return 'هذا الحقل مطلوب.';
    }

    return 'القيمة المدخلة غير صحيحة.';
  }

  private buildFieldValidators(field: { required?: boolean; requiredTrue?: boolean; email?: boolean; pattern?: boolean; minValue?: string; maxValue?: string }): ValidatorFn[] {
    const validators: ValidatorFn[] = [];
    if (field.required) {
      validators.push(Validators.required);
    }
    if (field.requiredTrue) {
      validators.push(Validators.requiredTrue);
    }
    if (field.email) {
      validators.push(Validators.email);
    }
    if (field.pattern && field.minValue) {
      try {
        validators.push(Validators.pattern(field.minValue));
      } catch {
        // ignore invalid pattern metadata
      }
    }

    const minValueAsNumber = Number(field.minValue);
    if (Number.isFinite(minValueAsNumber)) {
      validators.push(Validators.min(minValueAsNumber));
    }

    const maxValueAsNumber = Number(field.maxValue);
    if (Number.isFinite(maxValueAsNumber)) {
      validators.push(Validators.max(maxValueAsNumber));
    }

    return validators;
  }

  private buildStakeholdersPayload(): Array<{ stockholderId: number; partyType: string; requiredResponse: boolean; status?: number; dueDate?: string; notes?: string }> {
    return (this.stakeholdersArray.value ?? [])
      .map((item: any) => ({
        stockholderId: Number(item?.stockholderId ?? 0),
        partyType: String(item?.partyType ?? 'Viewer') || 'Viewer',
        requiredResponse: Boolean(item?.requiredResponse),
        status: item?.status ?? undefined,
        dueDate: item?.dueDate ?? undefined,
        notes: String(item?.notes ?? '').trim() || undefined
      }))
      .filter((item: any) => item.stockholderId > 0);
  }

  private buildTasksPayload(): Array<{ actionTitle: string; actionDescription?: string; assignedToUserId?: string; assignedUnitId?: string; dueDateUtc?: string; status: number }> {
    return (this.tasksArray.value ?? [])
      .map((item: any) => ({
        actionTitle: String(item?.actionTitle ?? '').trim(),
        actionDescription: String(item?.actionDescription ?? '').trim() || undefined,
        assignedToUserId: String(item?.assignedToUserId ?? '').trim() || undefined,
        assignedUnitId: String(item?.assignedUnitId ?? '').trim() || undefined,
        dueDateUtc: item?.dueDateUtc ?? undefined,
        status: Number(item?.status ?? 0)
      }))
      .filter((item: any) => item.actionTitle.length > 0);
  }

  private toArabicEventType(eventType?: string): string {
    switch (String(eventType ?? '').trim()) {
      case 'SubjectCreated': return 'إنشاء موضوع/طلب';
      case 'SubjectUpdated': return 'تحديث موضوع/طلب';
      case 'SubjectStatusChanged': return 'تغيير حالة الموضوع/الطلب';
      case 'AttachmentAdded': return 'إضافة مرفق';
      case 'AttachmentRemoved': return 'حذف مرفق';
      case 'StakeholderAssigned': return 'إسناد جهة معنية';
      case 'TaskUpdated': return 'تحديث مهمة';
      case 'EnvelopeLinked': return 'ربط ظرف وارد';
      case 'EnvelopeUnlinked': return 'فك ارتباط الظرف';
      case 'EnvelopeCreated': return 'إنشاء ظرف وارد';
      case 'EnvelopeUpdated': return 'تحديث ظرف وارد';
      default: return 'تحديث';
    }
  }
}
