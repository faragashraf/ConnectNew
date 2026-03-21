import { Component, Input, ViewChild } from '@angular/core';
import { AbstractControl, FormArray, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TreeNode } from 'primeng/api';
import { GenericFormsService, GroupInfo, GenericFormsIsolationProvider } from 'src/app/Modules/GenericComponents/GenericForms.service';
import { ComponentConfig, getConfigByRoute, processRequestsAndPopulate, routeKey, getAnyNode } from 'src/app/shared/models/Component.Config.model';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { ConditionalDate } from 'src/app/shared/Pipe/Conditional-date.pipe';
import { EmailPayload } from 'src/app/Modules/GenericComponents/GenericComponent/mail-composer/mail-composer.component';
import { ComponentConfigService } from 'src/app/Modules/admins/services/component-config.service';
import { CdCategoryMandDto, CdmendDto, DynamicFormCreateRequestFormRequest, MessageStockholder } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.dto';
import { MessageDto, TkmendField } from 'src/app/shared/services/BackendServices/AdministrativeCertificate/AdministrativeCertificate.dto';
import { PowerBiController } from 'src/app/shared/services/BackendServices/PowerBi/PowerBi.service';
import { DynamicFormController } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.service';
import { HttpClient } from '@angular/common/http';
import { FileParameter } from 'src/app/shared/services/BackendServices/dto-shared';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';
import { AuthObjectsService } from 'src/app/shared/services/helper/auth-objects.service';
import { FormDetailsComponent } from 'src/app/Modules/GenericComponents/ConnectComponents/form-details/form-details.component';
import { environment } from 'src/environments/environment';

type SummerPolicyConfig = {
    apartments: { count: number; apts: number }[];
    maxFamilyMembers: number;
    maxExtraMembers: number;
};

type SummerRequestSummary = {
    messageId: number;
    requestRef: string;
    categoryId: number;
    categoryName: string;
    waveCode: string;
    employeeId: string;
    status: string;
    createdAt?: string;
    paymentDueAtUtc?: string;
    paidAtUtc?: string;
    transferUsed: boolean;
};

@Component({
    selector: 'app-employee-summer-requests',
    templateUrl: './employee-summer-requests.component.html',
    styleUrls: ['./employee-summer-requests.component.scss'],
    providers: [GenericFormsIsolationProvider]
})
export class EmployeeSummerRequestsComponent {

    @ViewChild(FormDetailsComponent) formDetailsRef!: FormDetailsComponent;

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
    selectedNodePath: string = '';

    private static readonly RESORT_RULES: Record<string, {
        apartments: { count: number; apts: number }[];
        maxFamilyMembers: number;
        maxExtraMembers: number;
    }> = {
            '147': {
                apartments: [{ count: 5, apts: 5 }, { count: 6, apts: 5 }, { count: 8, apts: 8 }, { count: 9, apts: 5 }],
                maxFamilyMembers: 9, maxExtraMembers: 2
            }, '148': {
                apartments: [{ count: 2, apts: 2 }, { count: 4, apts: 6 }, { count: 6, apts: 2 }],
                maxFamilyMembers: 6, maxExtraMembers: 1
            },
            '149': {
                apartments: [{ count: 4, apts: 24 }, { count: 6, apts: 23 }, { count: 7, apts: 24 }],
                maxFamilyMembers: 7, maxExtraMembers: 2
            }
        };
    resortRules: {
        apartments: { count: number; apts: number }[];
        maxFamilyMembers: number;
        maxExtraMembers: number;
        resortName: string;
    } | null = null;

    workflowLoading: boolean = false;
    workflowRequests: SummerRequestSummary[] = [];
    selectedWorkflowMessageId: number | null = null;
    cancelReason: string = '';
    payDateUtc: string = '';
    payForceOverride: boolean = false;
    payNotes: string = '';
    transferToCategoryId: number | null = null;
    transferToWaveCode: string = '';
    transferFamilyCount: number | null = null;
    transferExtraCount: number | null = null;
    transferNotes: string = '';
    cancelFiles: File[] = [];
    payFiles: File[] = [];
    transferFiles: File[] = [];

    constructor(public genericFormService: GenericFormsService, private dynamicFormController: DynamicFormController,
        private router: Router, private route: ActivatedRoute, private powerBiController: PowerBiController, private conditionalDate: ConditionalDate,
        private http: HttpClient,
        private appConfigService: ComponentConfigService, private msg: MsgsService, private spinner: SpinnerService, public authObjectsService: AuthObjectsService
    ) {
        // Detect edit mode from route params
        const idParam = this.route.snapshot.paramMap.get('id');
        if (idParam) {
            // if numeric -> old behavior, else treat as token and resolve via API
            const asNum = parseInt(idParam, 10);
            if (!isNaN(asNum) && String(asNum) === idParam) {
                this.isEditMode = true;
                this.editMessageId = asNum;
            } else {
                this.isEditMode = true;
                // resolve token into full MessageDto
                this.http.get<any>(environment.ConnectApiURL + `/api/AdministrativeCertificate/GetRequestByToken?token=${encodeURIComponent(idParam)}`)
                .subscribe({
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
                const userprofile = this.authObjectsService.getUserProfile();
                this.config.genericFormName = userprofile.vwOrgUnitsWithCounts[0].unitId.toString();
                this.config.menuId = userprofile.vwOrgUnitsWithCounts[0].unitId.toString();
                this.config.listRequestModel.type = userprofile.vwOrgUnitsWithCounts[0].unitId.toString();

                this.config.genericFormName = userprofile.vwOrgUnitsWithCounts[0].unitId.toString();
                this.config.unitId.push(userprofile.vwOrgUnitsWithCounts[0].unitId.toString());
            }
            processRequestsAndPopulate(this, this.genericFormService, spinner).subscribe({
                next: () => {
                    this.genericFormService.cdCategoryMandDto = this.genericFormService.cdCategoryMandDto.filter(f => f.mendGroup !== 25);
                },
                complete: () => {
                    if (this.isEditMode && this.editMessageId) {
                        this.setResortRulesByCategory();
                    } else {
                        if (this.authObjectsService.checkAuthFun('NonWorkerEnpoUsersFunc')) {
                            this.genericFormService.cdmendDto.forEach((item: CdmendDto) => {
                                if (item.cdmendTxt !== 'RequestRef')
                                    item.isDisabledInit = false
                            });
                            this.setResortRulesByCategory();
                        }
                    }
                    this.loadWorkflowRequests();
                }
            });

        });
    }


    goBack(): void {
        const routeParts = (this.config.routeKey || '').split('/');
        const modulePath = routeParts[0] || '';
        const subPath = routeParts[1] || '';
        this.router.navigate(['/EmployeeRequests/MyRequests']);
    }

    private forEachNamedControl(root: AbstractControl | null | undefined, visitor: (name: string, control: AbstractControl) => void): void {
        if (!root) return;
        if (root instanceof FormGroup) {
            Object.keys(root.controls).forEach(name => {
                const ctrl = root.controls[name];
                if (ctrl instanceof FormGroup || ctrl instanceof FormArray) {
                    this.forEachNamedControl(ctrl, visitor);
                } else {
                    visitor(name, ctrl);
                }
            });
            return;
        }
        if (root instanceof FormArray) {
            root.controls.forEach(ctrl => this.forEachNamedControl(ctrl, visitor));
        }
    }

    private findNamedControl(predicate: (name: string) => boolean): { name: string; control: AbstractControl } | null {
        let found: { name: string; control: AbstractControl } | null = null;
        this.forEachNamedControl(this.ticketForm, (name, control) => {
            if (!found && predicate(name)) {
                found = { name, control };
            }
        });
        return found;
    }

    private findControlAnyIndex(baseName: string): AbstractControl | null {
        if (!this.ticketForm) return null;
        for (let i = 0; i <= 20; i++) {
            try {
                const ctrl = this.genericFormService.GetControl(this.ticketForm, `${baseName}|${i}`);
                if (ctrl) return ctrl;
            } catch (e) { }
        }

        const startsWith = this.findNamedControl(name => name.startsWith(`${baseName}|`));
        if (startsWith) return startsWith.control;

        try {
            return this.genericFormService.GetControlContaining(this.ticketForm, `${baseName}|`);
        } catch (e) {
            return null;
        }
    }

    private findAgeControlByRelationControl(controlFullName: string): { name: string; control: AbstractControl } | null {
        const indexPart = (controlFullName.split('|')[1] || '').trim();
        const candidates: string[] = [];
        if (indexPart.length > 0) {
            candidates.push(`FamilyMember_Age|${indexPart}`);
            const prefix = indexPart.includes('_') ? indexPart.split('_')[0] : '';
            if (prefix) {
                candidates.push(`FamilyMember_Age|${prefix}_`);
            }
        }

        for (const candidate of candidates) {
            const isPrefixSearch = candidate.endsWith('_');
            const match = this.findNamedControl(name => isPrefixSearch ? name.startsWith(candidate) : name === candidate);
            if (match) return match;
        }

        return this.findNamedControl(name => name.startsWith('FamilyMember_Age|'));
    }

    private applyResortValidators(rules: { maxFamilyMembers: number; maxExtraMembers: number } | null): void {
        if (!this.ticketForm || !rules) return;

        // --- Over_Count: disabled by default, enabled only when FamilyCount === maxFamilyMembers ---
        let overKey = 'Over_Count';
        let overResult = this.genericFormService.GetControlContaining(this.ticketForm, overKey);

        // if (!overResult) {
        //     overKey = 'Over_Count';
        //     overResult = this.genericFormService.GetControlContaining(this.ticketForm, overKey);
        // }

        if (overResult) {
            try {
                // overResult.setValue(0);
                // Preserve existing validator(s) and append min/max
                const currentValidator = overResult.validator ? [overResult.validator] as any[] : [] as any[];
                overResult.setValidators([...currentValidator, Validators.min(0), Validators.max(rules.maxExtraMembers)]);
                overResult.updateValueAndValidity();
                console.log('Applied validators to Over_Count:', overResult.validator);
            } catch (e) { }

            try {
                const maxMsg = { key: 'max', value: `الحد الأقصى لعدد الأفراد الإضافيين هو ${rules.maxExtraMembers}` };

                // Update indexed VM entry
                const existingVM = this.genericFormService.validationMessages.find(vm => vm.key === overKey);
                if (existingVM) {
                    existingVM.validators = existingVM.validators.filter((v: any) => v.key !== 'max');
                    existingVM.validators.push(maxMsg);
                } else {
                    this.genericFormService.validationMessages.push({ key: overKey, validators: [maxMsg] });
                }

                // Also ensure the base (non-indexed) field has the same message so logging/lookup works
                const existingBaseVM = this.genericFormService.validationMessages.find(vm => vm.key === overKey);
                if (existingBaseVM) {
                    existingBaseVM.validators = existingBaseVM.validators.filter((v: any) => v.key !== 'max');
                    existingBaseVM.validators.push(maxMsg);
                } else {
                    this.genericFormService.validationMessages.push({ key: overKey, validators: [maxMsg] });
                }
            } catch (e) { }
        }

        // --- Update instance limit (will be recalculated on FamilyCount / Over_Count change) ---
        this.updateInstanceLimit();
    }

    /** Recalculate the max allowed FamilyMember instances based on current FamilyCount + Over_Count */
    private updateInstanceLimit(): void {
        try {
            const familyCtrl = this.findControlAnyIndex('FamilyCount');
            const overCtrl = this.findControlAnyIndex('Over_Count');
            const familyVal = parseInt(familyCtrl?.value, 10) || 0;
            const overVal = parseInt(overCtrl?.value, 10) || 0;
            const total = Math.max(0, familyVal - 1) + overVal;
            if (total > 0) {
                this.genericFormService.instanceLimits['FamilyMember_Name'] = total;
            } else {
                delete this.genericFormService.instanceLimits['FamilyMember_Name'];
            }
        } catch (e) { }
    }

    /** Handle FamilyCount value changes – enable/disable Over_Count and update instance limits */
    private onFamilyCountChanged(): void {
        if (!this.ticketForm || !this.resortRules) return;

        const familyCtrl = this.findControlAnyIndex('FamilyCount');
        const overCtrl = this.findControlAnyIndex('Over_Count');
        if (!familyCtrl || !overCtrl) return;

        const selectedCount = parseInt(familyCtrl.value, 10) || 0;

        if (selectedCount === this.resortRules.maxFamilyMembers) {
            // User selected the maximum → enable extra members
            overCtrl.enable();
        } else {
            // Not maximum → disable extra members, reset to 0
            overCtrl.setValue(0);
            overCtrl.disable();
        }
        overCtrl.updateValueAndValidity();
        this.updateInstanceLimit();
    }

    /** Handle Over_Count value changes – update instance limits */
    private onOverCountChanged(): void {
        this.updateInstanceLimit();
    }

    /** Sync extendable group instances to match FamilyCount + Over_Count */
    private syncFamilyInstances(): void {

        if (!this.ticketForm || !this.formDetailsRef || !this.config.isNew) return;
        try {
            const familyCtrl = this.findControlAnyIndex('FamilyCount');
            const overCtrl = this.findControlAnyIndex('Over_Count');
            const familyVal = parseInt(familyCtrl?.value, 10) || 0;
            const overVal = parseInt(overCtrl?.value, 10) || 0;
            const desiredCount = (familyVal + overVal) - 1;
            if (desiredCount <= 0) return;

            // Find the extendable group that contains FamilyRelation or FamilyMember_Name
            const extGroup = this.genericFormService.dynamicGroups.find(g =>
                g.isExtendable && g.fields.some(f =>
                    f.mendField === 'FamilyRelation' || f.mendField === 'FamilyMember_Name'
                )
            );
            if (!extGroup) return;

            // Count current instances: 1 (base) + instances.length
            const currentCount = 1 + (extGroup.instances?.length || 0);

            if (desiredCount > currentCount) {
                // Add missing instances via form-details
                const fieldsPerInstance = extGroup.fields.length;
                for (let i = currentCount; i < desiredCount; i++) {
                    this.formDetailsRef.duplicateGroup(extGroup.groupId, fieldsPerInstance);
                }
            } else if (desiredCount < currentCount) {
                // Remove excess instances from the end
                const toRemove = currentCount - desiredCount;
                const instances = extGroup.instances || [];
                for (let i = 0; i < toRemove && instances.length > 0; i++) {
                    const last = instances[instances.length - 1];
                    if ((this.ticketForm as FormGroup).contains(last.formArrayName)) {
                        (this.ticketForm as FormGroup).removeControl(last.formArrayName);
                    }
                    instances.pop();
                }
            }
        } catch (e) { }
    }

    /** Handle FamilyRelation changes – Age is required & enabled only for ابن/ابنة, otherwise disabled */
    private onFamilyRelationChanged(controlFullName: string, value: any): void {
        if (!this.ticketForm) return;
        try {
            const ageTarget = this.findAgeControlByRelationControl(controlFullName);
            if (!ageTarget) return;
            const ageCtrlName = ageTarget.name;
            const ageCtrl = ageTarget.control;

            const requiresAge = value === 'ابن' || value === 'ابنة';
            this.genericFormService.EnableDisableControl(ageCtrl, requiresAge);

            // Update validation messages
            this.genericFormService.validationMessages = this.genericFormService.validationMessages.filter(vm => vm.key !== ageCtrlName);
            if (requiresAge) {
                this.genericFormService.validationMessages.push({
                    key: ageCtrlName,
                    validators: [{ key: 'required', value: 'السن مطلوب عند اختيار ابن أو ابنة' }]
                });
            }
            this.genericFormService.formErrors = this.genericFormService.formErrors.filter(fe => fe.key !== ageCtrlName);
            this.genericFormService.formErrors.push({ key: ageCtrlName, value: '' });
        } catch (e) { }
    }

    private clearResortValidators(): void {
        if (!this.ticketForm) return;
        const familyCtrl = this.findControlAnyIndex('FamilyCount');
        if (familyCtrl) {
            try { familyCtrl.setValidators(null); familyCtrl.updateValueAndValidity(); } catch (e) { }
        }
        const overCtrl = this.findControlAnyIndex('Over_Count');
        if (overCtrl) {
            try {
                overCtrl.setValue(0);
                overCtrl.enable();
                overCtrl.setValidators(null);
                overCtrl.updateValueAndValidity();
            } catch (e) { }
        }
        // Remove custom validation messages (preserve original ones from setErrorsObjects)
        try {
            this.genericFormService.validationMessages = this.genericFormService.validationMessages
                .map(vm => {
                    // Remove our custom 'max'/'min' validators from Over_Count (base) and Over_Count|N entries
                    if (vm.key.startsWith('Over_Count')) {
                        return { ...vm, validators: vm.validators.filter((v: any) => v.key !== 'max' && v.key !== 'min') };
                    }
                    return vm;
                })
                .filter(vm => !vm.key.startsWith('FamilyMember_Age|'));
            // clear instance limits
            delete this.genericFormService.instanceLimits['FamilyMember_Name'];
        } catch (e) { }
        // Clear age validators on all FamilyMember_Age controls
        try {
            this.forEachNamedControl(this.ticketForm, (name, control) => {
                if (name.startsWith('FamilyMember_Age|')) {
                    control.clearValidators();
                    control.updateValueAndValidity();
                }
            });
        } catch (e) { }
    }
    formChanges($event: FormGroup<any>) {
        this.ticketForm = $event;
        this.setResortRulesByCategory();
    }

    private refreshFamilyCountSelection(categoryValue: any): void {
        if (categoryValue === null || categoryValue === undefined || String(categoryValue).trim().length === 0) return;
        this.powerBiController.getGenericDataById(51, categoryValue).subscribe(res => {
            if (res.isSuccess && res.data) {
                const _selection = this.genericFormService.mapArrayToSelectionArray('FamilyCount', res.data);
                if (this.resortRules?.apartments?.length) {
                    const allowed = this.resortRules.apartments.map((a: any) => a.count.toString());
                    _selection.items = _selection.items.filter((item: any) => allowed.includes(item.key));
                }
                try {
                    const existingIdx = this.genericFormService.selectionArrays.findIndex(a => a.nameProp === _selection.nameProp);
                    if (existingIdx >= 0) {
                        this.genericFormService.selectionArrays[existingIdx].items = [];
                        this.genericFormService.selectionArrays[existingIdx].items.push(..._selection.items);
                    } else {
                        this.genericFormService.selectionArrays.push(_selection);
                    }
                } catch (e) {
                    this.genericFormService.selectionArrays.push(_selection);
                }
            }
        });
    }

    setResortRulesByCategory(): void {
        const categoryValue = this.ticketForm?.get('tkCategoryCd')?.value ?? this.messageDto.categoryCd;
        this.refreshFamilyCountSelection(categoryValue);
        const rules = EmployeeSummerRequestsComponent.RESORT_RULES[String(categoryValue)] as SummerPolicyConfig | undefined;
        if (rules) {
            this.resortRules = { ...rules, resortName: String(categoryValue) };
            try {
                const infoItem = this.genericFormService.cdmendDto.find(
                    (f: any) => f.cdmendTxt === 'Resort_Info'
                );
                if (infoItem) {
                    const lines = rules.apartments.map(
                        (a: any) => `${a.count} أفراد: ${a.apts} شقة`
                    );
                    const extra = rules.maxExtraMembers > 0
                        ? ` (+ ${rules.maxExtraMembers} أفراد إضافيين عند الحد الأقصى)`
                        : '';
                    (infoItem as any).defaultValue =
                        `${categoryValue} — ` + lines.join(' | ') + extra;
                }
            } catch (e) { }
            try { this.applyResortValidators(this.resortRules); } catch (e) { }
        } else {
            this.resortRules = null;
            try { this.clearResortValidators(); } catch (e) { }
            try {
                const infoItem = this.genericFormService.cdmendDto.find(
                    (f: any) => f.cdmendTxt === 'Resort_Info'
                );
                if (infoItem) { (infoItem as any).defaultValue = ''; }
            } catch (e) { }
        }
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
        // Normalize event shapes from child components: top-level object
        // is usually { event, controlFullName, eventType, control }
        const controlFullName: string = event?.controlFullName ?? event?.event?.controlFullName ?? '';
        let selectedValue: any = event?.event?.event?.value ?? event?.event?.value ?? event?.control?.value ?? null;
        // Apply dynamic validators (disables Over_Count by default)
        try { this.applyResortValidators(this.resortRules); } catch (e) { }

        // ─── FamilyCount changed ───
        if (controlFullName && controlFullName.startsWith('FamilyCount|')) {
            this.onFamilyCountChanged();
            this.syncFamilyInstances();
            return;
        }

        // ─── Over_Count changed ───
        if (controlFullName && controlFullName.startsWith('Over_Count|')) {
            this.onOverCountChanged();
            this.syncFamilyInstances();
            return;
        }

        // ─── FamilyRelation changed → age required only for ابن/ابنة ───
        if (controlFullName && controlFullName.startsWith('FamilyRelation|')) {
            this.onFamilyRelationChanged(controlFullName, selectedValue);
            return;
        }
    }

    private getNumericFieldValue(fields: TkmendField[], fieldKind: string, fallback: number = 0): number {
        const parsed = fields
            .filter(f => f.fildKind === fieldKind)
            .map(f => parseInt((f.fildTxt ?? '').toString(), 10))
            .find(v => !isNaN(v));
        return parsed ?? fallback;
    }

    private validateSummerBusinessRules(fields: TkmendField[] | undefined): string | null {
        if (!Array.isArray(fields)) return null;
        const categoryId = Number(this.ticketForm?.get('tkCategoryCd')?.value ?? this.messageDto?.categoryCd ?? 0);
        if (!this.resortRules) {
            try { this.setResortRulesByCategory(); } catch (e) { }
        }
        if (!this.resortRules) {
            const isSummerCategory = Array.isArray(this.config?.tkCategoryCds)
                && this.config.tkCategoryCds.some(c => Number(c.key) === categoryId);
            if (isSummerCategory) {
                return 'تعذر تحميل قواعد الحجز الخاصة بالمصيف. يرجى تحديث الصفحة والمحاولة مرة أخرى.';
            }
            return null;
        }

        const familyMembersCount = fields.filter(f =>
            f.fildKind === 'FamilyMember_Name' &&
            (f.fildTxt ?? '').toString().trim().length > 0
        ).length;

        if (this.resortRules.maxFamilyMembers > 0 && familyMembersCount > this.resortRules.maxFamilyMembers) {
            return `الحد الأقصى لعدد أفراد الأسرة في ${this.resortRules.resortName} هو ${this.resortRules.maxFamilyMembers} فقط`;
        }

        const overCount = this.getNumericFieldValue(fields, 'Over_Count', 0);
        if (this.resortRules.maxExtraMembers >= 0 && overCount > this.resortRules.maxExtraMembers) {
            return `الحد الأقصى لعدد الأفراد الإضافيين في ${this.resortRules.resortName} هو ${this.resortRules.maxExtraMembers} فقط`;
        }

        const familyCount = this.getNumericFieldValue(fields, 'FamilyCount', 0);
        if (familyCount > 0 && this.resortRules.apartments?.length) {
            const allowedCounts = this.resortRules.apartments.map(a => Number(a.count));
            if (!allowedCounts.includes(familyCount)) {
                return `عدد أفراد الأسرة المختار (${familyCount}) غير متاح في ${this.resortRules.resortName}`;
            }
        }

        return null;
    }

    messageDto: MessageDto = {} as MessageDto;
    onFileUpload(event: FileParameter[]) {
        this.fileParameters = event;
        this.messageRequest.files = event;
    }
    onSubmit(): void {
        if (this.isEditMode) {
            // In edit mode, form-details Save() handles update via editFields() internally.
            // This button just shows a confirmation or is a no-op.
            this.msg.msgError('تنبيه', '<h5>لحفظ التعديلات استخدم زر الحفظ (💾) أعلى النموذج</h5>', true);
            return;
        }
        const prepared = this.prepareRequestModel();
        this.mapRequestFromForm();
        console.log(this.messageRequest.fields)

        const validationError = this.validateSummerBusinessRules(this.messageRequest.fields);
        if (validationError) {
            this.msg.msgError('خطأ', `<h5>${validationError}</h5>`, true);
            return;
        }

        this.spinner.show('جاري تسجيل الطلب ... ');
        if (this.ticketForm.valid) {
            this.dynamicFormController.createRequest(this.messageRequest.messageId, this.messageRequest.requestRef, this.messageRequest.subject, this.messageRequest.description, this.messageRequest.createdBy, this.messageRequest.assignedSectorId, this.config.unitId, this.messageRequest.currentResponsibleSectorId, this.messageRequest.type, this.messageRequest.categoryCd, this.messageRequest.fields, this.messageRequest.files)
                .subscribe({
                    next: (res) => {
                        if (res.isSuccess) {
                            this.messageDto = res.data
                            this.ticketForm.get('messageID')?.patchValue(res.data.messageId)
                            this.config.fieldsConfiguration.isDivDisabled = true
                            this.loadWorkflowRequests();
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

    loadWorkflowRequests(): void {
        this.workflowLoading = true;
        const seasonYear = new Date().getFullYear();
        const url = `${environment.ConnectApiURL}/api/SummerWorkflow/GetMyRequests?seasonYear=${seasonYear}`;
        this.http.get<any>(url).subscribe({
            next: (res) => {
                if (res?.isSuccess && Array.isArray(res.data)) {
                    this.workflowRequests = res.data as SummerRequestSummary[];
                    if (this.selectedWorkflowMessageId === null && this.workflowRequests.length > 0) {
                        this.selectedWorkflowMessageId = this.workflowRequests[0].messageId;
                    }
                } else {
                    this.workflowRequests = [];
                }
            },
            error: () => {
                this.workflowRequests = [];
            },
            complete: () => {
                this.workflowLoading = false;
            }
        });
    }

    onActionFilesChange(event: Event, action: 'cancel' | 'pay' | 'transfer'): void {
        const input = event.target as HTMLInputElement | null;
        const files = input?.files ? Array.from(input.files) : [];
        if (action === 'cancel') this.cancelFiles = files;
        if (action === 'pay') this.payFiles = files;
        if (action === 'transfer') this.transferFiles = files;
    }

    submitCancel(): void {
        if (!this.selectedWorkflowMessageId) {
            this.msg.msgError('Error', '<h5>Please select a request first.</h5>', true);
            return;
        }
        const formData = new FormData();
        formData.append('MessageId', String(this.selectedWorkflowMessageId));
        formData.append('Reason', this.cancelReason ?? '');
        this.cancelFiles.forEach(file => formData.append('files', file, file.name));

        this.http.post<any>(`${environment.ConnectApiURL}/api/SummerWorkflow/Cancel`, formData).subscribe({
            next: (res) => {
                if (res?.isSuccess) {
                    this.msg.msgSuccess('Cancellation completed');
                    this.cancelReason = '';
                    this.cancelFiles = [];
                    this.loadWorkflowRequests();
                } else {
                    const errors = res?.errors?.map((e: any) => e.message).join('\n') || 'Failed to cancel';
                    this.msg.msgError('Error', `<h5>${errors}</h5>`, true);
                }
            },
            error: () => this.msg.msgError('Error', '<h5>Failed to cancel request</h5>', true)
        });
    }

    submitPay(): void {
        if (!this.selectedWorkflowMessageId) {
            this.msg.msgError('Error', '<h5>Please select a request first.</h5>', true);
            return;
        }
        const formData = new FormData();
        formData.append('MessageId', String(this.selectedWorkflowMessageId));
        if (this.payDateUtc) formData.append('PaidAtUtc', new Date(this.payDateUtc).toISOString());
        formData.append('ForceOverride', String(this.payForceOverride));
        formData.append('Notes', this.payNotes ?? '');
        this.payFiles.forEach(file => formData.append('files', file, file.name));

        this.http.post<any>(`${environment.ConnectApiURL}/api/SummerWorkflow/Pay`, formData).subscribe({
            next: (res) => {
                if (res?.isSuccess) {
                    this.msg.msgSuccess('Payment recorded');
                    this.payNotes = '';
                    this.payDateUtc = '';
                    this.payForceOverride = false;
                    this.payFiles = [];
                    this.loadWorkflowRequests();
                } else {
                    const errors = res?.errors?.map((e: any) => e.message).join('\n') || 'Failed to record payment';
                    this.msg.msgError('Error', `<h5>${errors}</h5>`, true);
                }
            },
            error: () => this.msg.msgError('Error', '<h5>Failed to record payment</h5>', true)
        });
    }

    submitTransfer(): void {
        if (!this.selectedWorkflowMessageId) {
            this.msg.msgError('Error', '<h5>Please select a request first.</h5>', true);
            return;
        }
        if (!this.transferToCategoryId || !this.transferToWaveCode) {
            this.msg.msgError('Error', '<h5>Target destination and wave are required.</h5>', true);
            return;
        }

        const formData = new FormData();
        formData.append('MessageId', String(this.selectedWorkflowMessageId));
        formData.append('ToCategoryId', String(this.transferToCategoryId));
        formData.append('ToWaveCode', this.transferToWaveCode.trim());
        if (this.transferFamilyCount !== null && this.transferFamilyCount !== undefined) {
            formData.append('NewFamilyCount', String(this.transferFamilyCount));
        }
        if (this.transferExtraCount !== null && this.transferExtraCount !== undefined) {
            formData.append('NewExtraCount', String(this.transferExtraCount));
        }
        formData.append('Notes', this.transferNotes ?? '');
        this.transferFiles.forEach(file => formData.append('files', file, file.name));

        this.http.post<any>(`${environment.ConnectApiURL}/api/SummerWorkflow/Transfer`, formData).subscribe({
            next: (res) => {
                if (res?.isSuccess) {
                    this.msg.msgSuccess('Transfer completed');
                    this.transferToCategoryId = null;
                    this.transferToWaveCode = '';
                    this.transferFamilyCount = null;
                    this.transferExtraCount = null;
                    this.transferNotes = '';
                    this.transferFiles = [];
                    this.loadWorkflowRequests();
                } else {
                    const errors = res?.errors?.map((e: any) => e.message).join('\n') || 'Failed to transfer';
                    this.msg.msgError('Error', `<h5>${errors}</h5>`, true);
                }
            },
            error: () => this.msg.msgError('Error', '<h5>Failed to transfer request</h5>', true)
        });
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
    }
}

