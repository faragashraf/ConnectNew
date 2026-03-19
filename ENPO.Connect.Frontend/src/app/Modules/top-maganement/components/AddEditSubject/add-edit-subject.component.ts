import { Component, Input } from '@angular/core';
import { AbstractControl, FormArray, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TreeNode } from 'primeng/api';
import { GenericFormsService, GroupInfo, GenericFormsIsolationProvider } from 'src/app/Modules/GenericComponents/GenericForms.service';
import { ComponentConfig, getConfigByRoute, processRequestsAndPopulate, routeKey } from 'src/app/shared/models/Component.Config.model';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { ConditionalDate } from 'src/app/shared/Pipe/Conditional-date.pipe';
import { EmailPayload } from 'src/app/Modules/GenericComponents/GenericComponent/mail-composer/mail-composer.component';
import { ComponentConfigService } from 'src/app/Modules/admins/services/component-config.service';
import { CdCategoryMandDto, DynamicFormCreateRequestFormRequest, MessageStockholder } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.dto';
import { MessageDto, TkmendField } from 'src/app/shared/services/BackendServices/AdministrativeCertificate/AdministrativeCertificate.dto';
import { PowerBiController } from 'src/app/shared/services/BackendServices/PowerBi/PowerBi.service';
import { DynamicFormController } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.service';
import { HttpClient } from '@angular/common/http';
import { FileParameter } from 'src/app/shared/services/BackendServices/dto-shared';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';
import { AuthObjectsService } from 'src/app/shared/services/helper/auth-objects.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-add-edit-subject',
  templateUrl: './add-edit-subject.component.html',
  styleUrls: ['./add-edit-subject.component.scss'],
  providers: [GenericFormsIsolationProvider]
})
export class AddEditSubjectComponent {

  // controls visibility of the mail composer dialog
  showMailDialog: boolean = false;

  config: ComponentConfig = {} as ComponentConfig;
  categoryTree: TreeNode[] = [];

  @Input() isCurrentUser: boolean = false;
  @Input() tree: any[] = [];
  @Input() unitTree: TreeNode[] = [];

  selectedNode: TreeNode = {} as TreeNode;
  filtered_CategoryMand: CdCategoryMandDto[] = [];
  ticketForm!: FormGroup;
  fileParameters: FileParameter[] = [];
  isEditMode: boolean = false;
  editMessageId: number = 0;


  constructor(public genericFormService: GenericFormsService, private dynamicFormController: DynamicFormController,
    private router: Router, private route: ActivatedRoute, private powerBiController: PowerBiController, private conditionalDate: ConditionalDate,
    private http: HttpClient,
    private appConfigService: ComponentConfigService, private msg: MsgsService, private spinner: SpinnerService, public authService: AuthObjectsService
  ) {
    // Detect edit mode from route params
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      const asNum = parseInt(idParam, 10);
      if (!isNaN(asNum) && String(asNum) === idParam) {
        this.isEditMode = true;
        this.editMessageId = asNum;
      } else {
        this.isEditMode = true;
        // resolve token
        this.http.get<any>(environment.ConnectApiURL+`/api/AdministrativeCertificate/GetRequestByToken?token=${encodeURIComponent(idParam)}`).subscribe({
          next: (res) => {
            if (res?.isSuccess && res.data) {
              this.messageDto = res.data;
            } else {
              const errors = res?.errors?.map((e: any) => e.message).join('\n') || 'لم يتم العثور على الطلب';
              this.msg.msgError('خطأ', '<h5>' + errors + '</h5>', true);
            }
          },
          error: (err) => {
            this.msg.msgError('خطأ', '<h5>حدث خطأ أثناء تحميل الطلب بواسطة الرابط</h5>', true);
          }
        });
      }
    }

    const _route = this.route.snapshot.data['configRouteKey'] || routeKey(this.router.url);
    this.appConfigService.getAll().subscribe(items => {
      const cfg = getConfigByRoute(_route, items || []);
      if (!cfg) return;
      this.config = cfg;
      if (this.isEditMode) {
        this.config.isNew = false;
        this.config.fieldsConfiguration = this.config.fieldsConfiguration || {} as any;
        this.config.fieldsConfiguration.isDivDisabled = false;
        this.config.submitButtonText = 'حفظ التعديلات';
      }
      this.genericFormService.applicationName = this.config.genericFormName as string;

      if (this.config.menuId == null || this.config.menuId == 0) {
        const userprofile = this.authService.getUserProfile();
        this.config.genericFormName = userprofile.vwOrgUnitsWithCounts[0].unitId.toString();
        this.config.menuId = userprofile.vwOrgUnitsWithCounts[0].unitId.toString();
        this.config.listRequestModel.type = userprofile.vwOrgUnitsWithCounts[0].unitId.toString();

        this.config.genericFormName = userprofile.vwOrgUnitsWithCounts[0].unitId.toString();
        this.config.unitId.push(userprofile.vwOrgUnitsWithCounts[0].unitId.toString());
      }
      processRequestsAndPopulate(this, this.genericFormService, spinner).subscribe({
        next: () => {
        },
        complete: () => {
          this.config.fieldsConfiguration.maxDate = new Date();
          this.config.fieldsConfiguration.showTime = true;
          if (this.isEditMode && this.editMessageId) {
            this.fetchMessageForEdit();
          }
        }
      });

    });
  }

  private fetchMessageForEdit(): void {
    this.dynamicFormController.getRequestById(this.editMessageId).subscribe({
      next: (res) => {
        if (res.isSuccess && res.data) {
          this.messageDto = res.data;
        } else {
          const errors = res.errors?.map((e: any) => e.message).join('\n') || 'لم يتم العثور على الطلب';
          this.msg.msgError('خطأ', '<h5>' + errors + '</h5>', true);
        }
      },
      error: (err) => {
        this.msg.msgError('خطأ', '<h5>حدث خطأ أثناء تحميل الطلب</h5>', true);
      }
    });
  }
  goBack(): void {
    const routeParts = (this.config.routeKey || '').split('/');
    const modulePath = routeParts[0] || '';
    const subPath = routeParts[1] || '';
    this.router.navigate(['/' + modulePath, subPath]);
  }
  formChanges($event: FormGroup<any>) {
    this.ticketForm = $event;
    this.generateMessageID(['SECURITY_LEVEL|1', 'DOC_SOURCE|0', 'TOPICDIRECTION|0'], '/');
  }

  generateMessageID(fieldsOrStockholder?: string[] | string, separator: '-' | '/' = '-') {
    try {
      const safeGet = (ctrlName?: string) => {
        if (!ctrlName) return '';
        try {
          const c = this.genericFormService.GetControl(this.ticketForm, ctrlName);
          return c?.value ?? '';
        } catch (e) {
          return '';
        }
      };

      // compute date suffix from token expiry when possible
      let dateSuffix = '';
      try {
        const getExpiryFromStoredToken = (): Date | null => {
          const keysToTry = ['ConnectToken'];
          for (const key of keysToTry) {
            try {
              const raw = localStorage.getItem(key);
              if (!raw) continue;

              // Try JWT (base64url) first
              const parts = raw.split('.');
              if (parts.length === 3) {
                try {
                  const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
                  const jsonStr = atob(payloadB64);
                  const payload = JSON.parse(jsonStr);
                  if (payload && (payload.exp || payload.exp === 0)) {
                    return new Date(Number(payload.exp) * 1000);
                  }
                } catch (e) {
                }
              }

              // Try JSON string containing expiry fields
              try {
                const obj = JSON.parse(raw);
                if (obj) {
                  const val = obj.exp ?? obj.expires ?? obj.expiry ?? obj.expires_at;
                  if (val !== undefined && val !== null) {
                    const n = Number(val);
                    if (!isNaN(n)) {
                      return n > 1e12 ? new Date(n) : new Date(n * 1000);
                    }
                  }
                }
              } catch (e) {
              }
            } catch (e) {
            }
          }
          return null;
        };

        const expiryDate = getExpiryFromStoredToken();
        const parsed = expiryDate ?? new Date();
        if (!isNaN(parsed.getTime())) {
          const d = parsed.getDate();
          const m = parsed.getMonth() + 1;
          const yy = String(parsed.getFullYear() % 100).padStart(2, '0');
          const dStr = String(d).padStart(2, '0');
          const mStr = String(m).padStart(2, '0');
          dateSuffix = `${dStr}${mStr}${yy}`;
        }
      } catch (e) {
      }
      // If caller provided an explicit list of control names, use that to build the id
      if (Array.isArray(fieldsOrStockholder)) {
        const parts: string[] = [];
        fieldsOrStockholder.forEach(f => {
          const v = safeGet(f);
          if (v !== null && v !== undefined && String(v).trim() !== '') {
            parts.push(String(v));
          }
        });
        if (dateSuffix) parts.push(dateSuffix);
        const newMessageId = parts.join(separator);
        this.ticketForm.get('messageID')?.patchValue(newMessageId, { emitEvent: false });
        const ctrl = this.genericFormService.GetControl(this.ticketForm, 'RequestRef|1');
        ctrl?.patchValue(newMessageId);
        ctrl?.disable();
        return;
      }

      // Legacy / default behavior
      const securityLevelCtrl = this.genericFormService.GetControl(this.ticketForm, 'SECURITY_LEVEL|1');
      const docSourceCtrl = this.genericFormService.GetControl(this.ticketForm, 'DOC_SOURCE|0');
      const topicDirectionCtrl = this.genericFormService.GetControl(this.ticketForm, 'TOPICDIRECTION|0');

      const securityLevelMarker = (securityLevelCtrl?.value === 'سري') ? '#' : '';
      const docSourceValue = docSourceCtrl?.value ?? '';
      const topicValue = topicDirectionCtrl?.value ?? '';

      const messageParts: string[] = [];
      const prefixPart = `${securityLevelMarker}${docSourceValue}`.trim();
      if (prefixPart) messageParts.push(prefixPart);

      if (fieldsOrStockholder !== undefined && typeof fieldsOrStockholder === 'string') {
        const stockholderLocationCtrl = fieldsOrStockholder;
        if (stockholderLocationCtrl) {
          if (messageParts.length >= 1) {
            messageParts.splice(1, 0, String(stockholderLocationCtrl));
          } else {
            messageParts.push(String(stockholderLocationCtrl));
          }
        }
      } else {
        // preserve existing part 2 when available (split on both '-' and '/')
        try {
          const existingMessageId = String(this.ticketForm.get('messageID')?.value ?? '');
          if (existingMessageId) {
            const existingMessageParts = existingMessageId.split(/[-\/]/).map(p => p.trim()).filter(p => p !== '');
            const preservedPart2 = existingMessageParts.length >= 2 ? existingMessageParts[1] : '';
            if (preservedPart2) {
              if (messageParts.length >= 1) {
                messageParts.splice(1, 0, preservedPart2);
              } else {
                messageParts.push(preservedPart2);
              }
            }
          }
        } catch (e) {
          // ignore
        }
      }

      if (topicValue) messageParts.push(topicValue);
      if (dateSuffix) messageParts.push(dateSuffix);

      const newMessageId = messageParts.join(separator);
      this.ticketForm.get('messageID')?.patchValue(newMessageId, { emitEvent: false });
      const ctrl = this.genericFormService.GetControl(this.ticketForm, 'RequestRef|1');
      ctrl?.patchValue(newMessageId);
      ctrl?.disable();
    } catch (e) {
      // ignore safe errors
    }
  }

  handleGenericEvent(event: any) {
    if (event.controlFullName == 'DOC_SOURCE|1') {
      this.generateMessageID(event.event.parent?.key)
    }
    this.genericFormService.updateNextControlLabel(this.ticketForm, event, 'TOPICDIRECTION', 'ORG_OUT_NUMBER', 'رقم {value} الجهة', this.filtered_CategoryMand);
    this.genericFormService.updateNextControlLabel(this.ticketForm, event, 'TOPICDIRECTION', 'RECEIVE_DATE', 'تاريخ الـ{value}', this.filtered_CategoryMand);
  }

  messageDto: MessageDto = {} as MessageDto;
  onFileUpload(event: FileParameter[]) {
    this.fileParameters = event;
    this.messageRequest.files = event;
  }
  onSubmit(): void {
    if (this.isEditMode) {
      // In edit mode, form-details Save() handles update via editFields() internally.
      this.msg.msgError('تنبيه', '<h5>لحفظ التعديلات استخدم زر الحفظ (💾) أعلى النموذج</h5>', true);
      return;
    }
    const prepared = this.prepareRequestModel();
    this.mapRequestFromForm();
    console.log(this.messageRequest.fields)
    if (this.ticketForm.valid) {
      this.dynamicFormController.createRequest(this.messageRequest.messageId, this.messageRequest.requestRef, this.messageRequest.subject, this.messageRequest.description, this.messageRequest.createdBy, this.messageRequest.assignedSectorId, this.config.unitId, this.messageRequest.currentResponsibleSectorId, this.messageRequest.type, this.messageRequest.categoryCd, this.messageRequest.fields, this.messageRequest.files)
        .subscribe({
          next: (res) => {
            if (res.isSuccess) {
              this.messageDto = res.data
              this.ticketForm.get('messageID')?.patchValue(res.data.messageId)
              this.config.fieldsConfiguration.isDivDisabled = true
            }
            else {
              let errors = "";
              res.errors?.forEach(e => {
                errors += e.message + '\n';
              });
              this.msg.msgError('Error', '<h5>' + errors + '</h5>', true)
            }
          },
          error: (error) => {
            this.msg.msgError('Error', '<h5>' + error + '</h5>', true)
          },
          complete: () => {

          }
        })
    }
  }

  private prepareRequestModel(): Array<{ formId: string; fieldName: string; fieldValue: any }> {
    const result: Array<{ formId: string; fieldName: string; fieldValue: any }> = [];
    this.genericFormService.dynamicGroups.forEach(group => {
      const formArray = this.genericFormService.getFormArray(group.formArrayName, this.ticketForm);
      formArray.controls.forEach((control: AbstractControl, index: number) => {
        const field = group.fields[index];
        if (!field) return;

        const controlName = field.mendField;
        const controlKey = `${controlName}|${index}`;
        let value: any = '';
        try {
          // Prefer using the generic helper to find the control anywhere in the form
          const foundCtrl = this.genericFormService.GetControl(this.ticketForm, controlKey);
          if (foundCtrl !== null && foundCtrl !== undefined) {
            value = foundCtrl.value ?? '';
          } else {
            // Fallback to previous strategy when helper didn't find the control
            const hasContains = typeof (control as FormGroup).contains === 'function';
            if (hasContains && (control as FormGroup).contains(controlKey)) {
              value = (control as FormGroup).get(controlKey)?.value;
            } else {
              value = (control as any).value?.[controlKey] ?? (control as any).value;
            }
          }
        } catch (e) {
          value = (control as any).value ?? '';
        }

        result.push({ formId: group.formArrayName, fieldName: controlName as string, fieldValue: value });
      });
    });

    return result;
  }

  messageRequest: DynamicFormCreateRequestFormRequest = {} as DynamicFormCreateRequestFormRequest;
  mailInitialHtml: string = '';

  mapRequestFromForm(instances?: GroupInfo[]) {
    this.messageRequest.messageId = 0
    // this.messageRequest.requestRef = '';
    this.messageRequest.subject = '';
    this.messageRequest.description = '';
    this.messageRequest.currentResponsibleSectorId = '';
    this.messageRequest.assignedSectorId = '';
    this.messageRequest.createdBy = localStorage.getItem('UserId') ?? ''
    this.messageRequest.type = 0
    this.messageRequest.categoryCd = this.ticketForm.get('tkCategoryCd')?.value

    this.messageRequest.fields = []
    let fildSqlCounter = 1;
    // Walk groups recursively; allow caller to pass a subset via `instances`
    const groupsToProcess = instances ?? this.genericFormService.dynamicGroups;

    const processGroups = (groups: GroupInfo[] | undefined) => {
      if (!groups || !Array.isArray(groups)) return;
      groups.forEach(group => {
        const formArray = this.ticketForm.get(group.formArrayName) as FormArray | null;
        if (formArray && formArray.controls) {
          // determine group instance id: use explicit instanceGroupId for duplicated instances, otherwise default to 1
          const currentGroupInstanceId = ((group as any).instanceGroupId ?? 0);

          formArray.controls.forEach((control: AbstractControl, index: number) => {
            const field = group.fields[index];
            if (!field) return;

            const controlName = field.mendField as string;
            // Prefer control name with mendSql (stable id) then fallback to index
            const candidateKeys = [
              `${controlName}|${(field as any).__clientIndex ?? (field as any).mendSql ?? index}`,
              `${controlName}|${(field as any).mendSql ?? index}`,
              `${controlName}|${index}`
            ];

            let value: any = '';
            let foundCtrl: AbstractControl | null = null;
            for (const key of candidateKeys) {
              try {
                const c = this.genericFormService.GetControl(this.ticketForm, key);
                if (c) { foundCtrl = c; break; }
              } catch { }
            }

            try {
              if (foundCtrl) {
                value = foundCtrl.value ?? '';
              } else if ((control as FormGroup).contains && (control as FormGroup).contains(candidateKeys[0])) {
                value = (control as FormGroup).get(candidateKeys[0])?.value ?? '';
              } else {
                value = (control as any).value?.[candidateKeys[0]] ?? (control as any).value ?? '';
              }
            } catch (e) {
              value = (control as any).value ?? '';
            }

            if (controlName === 'Subject') {
              this.messageRequest.subject = value ?? '';
            } else if (controlName === 'RequestRef') {
              this.messageRequest.requestRef = value ?? '';
            }
            // Determine instanceGroupId per-field using client index if available
            let perFieldInstanceId = currentGroupInstanceId;
            try {
              const ci = (field as any).__clientIndex;
              if (ci) {
                const parts = String(ci).split('_');
                const parsed = parseInt(parts[0], 10);
                if (!isNaN(parsed)) perFieldInstanceId = parsed;
              }
            } catch { }
            // Ensure instance id starts from 1
            // if (!perFieldInstanceId || perFieldInstanceId <= 0) perFieldInstanceId = 1;

            const _item = {
              fildSql: fildSqlCounter++,
              fildRelted: 0,
              fildKind: controlName,
              fildTxt: value,
              mendSql: (field as any).mendSql ?? index,
              mendGroup: group.originGroupId ?? group.groupId,
              instanceGroupId: perFieldInstanceId
            } as TkmendField;
            this.messageRequest.fields?.push(_item);
          });
        }

        // Recurse into nested instances (if any)
        if (group.instances && group.instances.length > 0) {
          processGroups(group.instances);
        }
      });
    };

    processGroups(groupsToProcess);
    // this.messageRequest.files = this.fileParameters;
    // Keep `fildKind` as the internal control key (mendField).
    // Previously we replaced it with the human label which breaks server-side mapping.
    // If a human label is needed for display, keep it in `fildTxtLabel` instead.
    try {
      if (Array.isArray(this.genericFormService.cdmendDto) && Array.isArray(this.messageRequest.fields)) {
        this.messageRequest.fields.forEach(f => {
          try {
            const meta = this.genericFormService.cdmendDto.find(c => String(c.cdmendTxt) === String(f.fildKind));
            if (meta && meta.cdMendLbl) {
              (f as any).fildTxtLabel = meta.cdMendLbl; // preserve label separately
            }
          } catch { }
        });
      }
    } catch { }

    // After mapping fields, build a rich HTML to seed the mail composer
    try {
      this.mailInitialHtml = this.buildInitialHtmlFromFields();
    } catch (e) { this.mailInitialHtml = ''; }
  }

  private safeFieldValue(kind: string, instanceGroupId?: number): any {
    if (!this.messageRequest || !Array.isArray(this.messageRequest.fields)) return '';
    const found = this.messageRequest.fields.find(f => String(f.fildKind) === String(kind) && (instanceGroupId === undefined || f.instanceGroupId === instanceGroupId));
    return found ? (found.fildTxt ?? '') : '';
  }

  private buildInitialHtmlFromFields(): string {
    const escape = (s: any) => s === null || s === undefined ? '' : String(s);

    const subject = escape(this.messageRequest.subject || this.safeFieldValue('Subject'));
    const messageId = escape(this.messageRequest.messageId ?? this.safeFieldValue('messageID'));
    const requestRef = escape(this.messageRequest.requestRef ?? this.safeFieldValue('RequestRef'));
    const createdBy = escape(this.messageRequest.createdBy);
    const category = escape(this.messageRequest.categoryCd);

    // Build structured tables, grouping nested instances under 'الجهات المعنية'
    const cells: string[] = [];
    const cellNameStyle = 'padding:8px 12px;background-color:#ffffff;background:linear-gradient(180deg,#ffffff 0%,#f3f6fb 50%,#e6eefb 100%);border-radius:6px;box-shadow:0 1px 0 rgba(255,255,255,0.6) inset,0 4px 10px rgba(16,36,88,0.06);border:1px solid rgba(16,36,88,0.06);font-weight:600;color:#24323a;font-size:15px;width:16.66%';
    const cellValueStyle = 'padding:8px 12px;background-color:#fbfdff;background:linear-gradient(180deg,#ffffff,#fbfdff);border-radius:6px;box-shadow:0 1px 0 rgba(255,255,255,0.6) inset,0 4px 10px rgba(16,36,88,0.04);border:1px solid rgba(16,36,88,0.04);color:#333;width:16.66%';
    const instancesMap = new Map<number, TkmendField[]>();

    // First pass: determine per-mendGroup which instanceGroupId values exist (include 0)
    const mendGroupInstances = new Map<number, Set<number>>();
    if (Array.isArray(this.messageRequest.fields)) {
      this.messageRequest.fields.forEach((f) => {
        const mg = Number(f.mendGroup ?? 0);
        const instId = Number(f.instanceGroupId ?? 0);
        if (!mendGroupInstances.has(mg)) mendGroupInstances.set(mg, new Set<number>());
        mendGroupInstances.get(mg)!.add(instId);
      });
    }

    // Identify groups that should be treated as multi-instance (more than one distinct instanceGroupId)
    const multiGroups = new Set<number>();
    for (const [mg, setIds] of mendGroupInstances.entries()) {
      if (setIds.size > 1) multiGroups.add(mg);
    }

    // Second pass: build main rows and instance buckets. If a field's mendGroup is in multiGroups,
    // place it into instancesMap under its instanceGroupId (including 0) so it will be rendered as an instance block.
    if (Array.isArray(this.messageRequest.fields)) {
      this.messageRequest.fields.forEach((f) => {
        const instId = Number(f.instanceGroupId ?? 0);
        const mg = Number(f.mendGroup ?? 0);

        if (multiGroups.has(mg) || instId > 0) {
          // ensure bucket exists (including instId === 0 when group is multi-instance)
          if (!instancesMap.has(instId)) instancesMap.set(instId, []);
          instancesMap.get(instId)!.push(f);
        } else {
          // non-instance fields appear in main rows
          const meta = this.genericFormService.cdmendDto?.find(c => String(c.cdmendTxt) === String(f.fildKind) || String(c.cdMendLbl) === String(f.fildKind));
          let displayVal = '';
          try {
            if (meta) {
              const options = this.genericFormService.implementControlSelection(meta.cdmendTxt ?? String(f.fildKind)) || [];
              const found = options.find(o => String(o.key) === String(f.fildTxt) || String(o.name) === String(f.fildTxt));
              displayVal = found ? found.name : String(f.fildTxt ?? '');
            } else {
              displayVal = String(f.fildTxt ?? '');
            }
            const isCalendar = meta && meta.cdmendType && String(meta.cdmendType).toLowerCase().includes('date');
            if (isCalendar) displayVal = this.conditionalDate.transform(displayVal, 'full') as string;
          } catch { displayVal = String(f.fildTxt ?? ''); }
          const name = escape(f.fildKind || ('field_' + (f.mendSql ?? f.fildSql ?? '')));
          cells.push(`<td style="${cellNameStyle}">${name}</td><td style="${cellValueStyle}">${escape(displayVal)}</td>`);
        }
      });
    }

    // Build instances HTML grouped under الجهات المعنية
    const instancesHtml: string[] = [];
    try {
      // Determine which mendGroup (origin group) have multiple distinct instanceGroupId values
      const groupInstanceMap = new Map<number, Set<number>>();
      for (const f of Array.from(this.messageRequest.fields || []).filter(x => Number(x.instanceGroupId || 0) > 0)) {
        const instId = Number(f.instanceGroupId || 0);
        const mg = Number(f.mendGroup || 0);
        if (!groupInstanceMap.has(mg)) groupInstanceMap.set(mg, new Set<number>());
        groupInstanceMap.get(mg)!.add(instId);
      }

      const multiGroups = new Map<number, number[]>();
      for (const [mg, setIds] of groupInstanceMap.entries()) {
        const arr = Array.from(setIds).sort((a, b) => a - b);
        if (arr.length > 1) multiGroups.set(mg, arr);
      }

      for (const [instId, fields] of Array.from(instancesMap.entries()).sort((a, b) => a[0] - b[0])) {
        const instRows: string[] = [];

        fields.forEach(f => {
          const meta = this.genericFormService.cdmendDto?.find(c => String(c.cdmendTxt) === String(f.fildKind) || String(c.cdMendLbl) === String(f.fildKind));
          let displayVal = '';
          try {
            if (meta) {
              const options = this.genericFormService.implementControlSelection(meta.cdmendTxt ?? String(f.fildKind)) || [];
              const found = options.find(o => String(o.key) === String(f.fildTxt) || String(o.name) === String(f.fildTxt));
              displayVal = found ? found.name : String(f.fildTxt ?? '');
              const isCalendar = meta && meta.cdmendType && String(meta.cdmendType).toLowerCase().includes('date');
              if (isCalendar) displayVal = this.conditionalDate.transform(displayVal, 'full') as string;
            } else {
              displayVal = String(f.fildTxt ?? '');
            }
            const isCalendar = meta && meta.cdmendType && String(meta.cdmendType).toLowerCase().includes('calendar');
            if (isCalendar) displayVal = this.conditionalDate.transform(displayVal, 'full') as string;
          } catch { displayVal = String(f.fildTxt ?? ''); }

          const name = escape(f.fildKind || ('field_' + (f.mendSql ?? f.fildSql ?? '')));
          instRows.push(`<td style="${cellNameStyle}">${name}</td><td style="${cellValueStyle}">${escape(displayVal)}</td>`);
        });

        // Detect whether this instance belongs to a mendGroup that has multiple instances
        const mendGroupsForThisInst = Array.from(new Set(fields.map(f => Number(f.mendGroup || 0))));
        const primaryMg = mendGroupsForThisInst.length > 0 ? mendGroupsForThisInst[0] : 0;
        let headerText = ``;
        // prefer the second field value; fall back to the first when available
        const rawInstHtml = (instRows[0] ?? '');
        let instanceLabelValue = '';
        try {
          const tdInnerMatches = Array.from(rawInstHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)).map(m => (m[1] ?? '').replace(/<[^>]*>/g, '').trim()).filter(x => x !== '');
          instanceLabelValue = (tdInnerMatches[1] ?? tdInnerMatches[0] ?? '').trim();
          if (tdInnerMatches.length === 1) {
            const nameMatch = rawInstHtml.match(/<td[^>]*>([\s\S]*?)<\/td>/i);
            const nameText = nameMatch ? nameMatch[1].replace(/<[^>]*>/g, '').trim() : '';
            if (nameText && instanceLabelValue.startsWith(nameText)) {
              instanceLabelValue = instanceLabelValue.slice(nameText.length).trim();
            }
          }
        } catch {
          instanceLabelValue = rawInstHtml.replace(/<[^>]*>/g, '').trim();
        }
        if (instanceLabelValue) {
          headerText += ` <span style="font-weight:800;color:orange">${escape(instanceLabelValue)}</span>`;
        }
        let containerStyle = 'margin-top:12px;border:1px solid #eef3f7;border-radius:8px;padding:8px;background:#fff';

        if (multiGroups.has(primaryMg)) {
          const arr = multiGroups.get(primaryMg)!;
          headerText = ` ${headerText}`;
          containerStyle = 'margin-top:12px;border:2px solid #cfe8ff;border-radius:8px;padding:8px;background:linear-gradient(90deg,#fff 0%,#f7fbff 100%)';
        }

        // pair instance cells into rows of 6 columns (three name/value pairs)
        const pairedInstRows: string[] = [];
        const fillerPairInst = `<td style="${cellNameStyle}"></td><td style="${cellValueStyle}"></td>`;
        for (let i = 0; i < instRows.length; i += 3) {
          const left = instRows[i];
          const mid1 = instRows[i + 1] ?? fillerPairInst;
          const right = instRows[i + 2] ?? fillerPairInst;
          pairedInstRows.push(`<tr>${left}${mid1}${right}</tr>`);
        }

        instancesHtml.push(`
          <div style="${containerStyle};box-shadow:0 10px 20px rgba(16,24,40,0.06);padding:12px;border-radius:10px;background:linear-gradient(180deg,#ffffff,#fbfdff)">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
              <div style="flex:1;min-width:0">
                <div style="font-weight:800;color:orange;font-size:25px;line-height:1.1">${headerText}</div>
              </div>
              <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
                <div style="background:rgba(3,102,214,0.08);color:#0366d6;padding:6px 10px;border-radius:999px;font-weight:700;font-size:13px">جهة ${instId + 1}</div>
                <div style="font-size:11px;color:#9aa6ad">معاينة تلقائية</div>
              </div>
            </div>

                <div style="background:#fff;border-radius:8px;padding:10px;border:1px solid #eef6ff">
                  <table cellpadding="0" style="width:100%;border-collapse:separate;border-spacing:8px 8px">${pairedInstRows.join('\n')}</table>
            </div>
          </div>
        `);
      }
    } catch { }

    // pair main cells into rows of 6 columns (three name/value pairs)
    const pairedRows: string[] = [];
    const fillerPair = `<td style="${cellNameStyle}"></td><td style="${cellValueStyle}"></td>`;
    for (let i = 0; i < cells.length; i += 3) {
      const left = cells[i];
      const mid1 = cells[i + 1] ?? fillerPair;
      const right = cells[i + 2] ?? fillerPair;
      pairedRows.push(`<tr>${left}${mid1}${right}</tr>`);
    }

    const html = `
      <div style="font-family: Arial, Helvetica, sans-serif; color:orange;direction:rtl">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;">
          <div style="width:56px;height:56px;background:#f3f6fb;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:700;color:#0078d4">EN</div>
          <div>
            <div style="font-size:18px;font-weight:800;color:#0f1720">${subject || 'New Message'}</div>
            <div style="font-size:12px;color:#6b7a80;margin-top:4px">${requestRef}</div>
          </div>
        </div>

        <div style="border-radius:8px;overflow:hidden;border:1px solid #eef3f7;background:#fff;margin-bottom:14px">
          <table cellpadding="0" style="width:90%;border-collapse:separate;border-spacing:8px 8px">
            <tbody>
              <tr style="background:#fbfdff"><td style="padding:12px 16px;color:#4b5563;font-weight:700;width:30">Created by</td><td style="padding:12px 16px">${createdBy}</td></tr>
              <tr><td style="padding:12px 16px;color:#4b5563;font-weight:700">Category</td><td style="padding:12px 16px">${category}</td></tr>
                </tbody>
            </table>
          </div>

        <div style="margin-bottom:8px;font-size:14px;font-weight:700;color:#24323a">تفاصيل الموضوع</div>
        <div style="border:1px solid #f0f3f5;border-radius:8px;background:#fff;padding:4px 0;">
          <table cellpadding="0" style="width:90%;border-collapse:separate;border-spacing:8px 8px">${pairedRows.join('\n')}</table>
        </div>

        ${instancesHtml.length ? `<div style="margin-top:12px"><div style="font-weight:900;font-size:18px;margin-bottom:10px">الجهات المعنية</div>${instancesHtml.join('\n')}</div>` : ''}

        <div style="margin-top:18px;color:blue;font-size:18px">هذه معاينة رسالة تم إنشاؤها تلقائياً. قم بتعديلها إذا لزم الأمر قبل الإرسال.</div>
      </div>
    `;

    return html;
  }

  sendMail(event: EmailPayload) {
    console.debug('Send mail payload:', event);
    // close dialog after send (caller can change behavior)
    this.showMailDialog = false;
  }
}
