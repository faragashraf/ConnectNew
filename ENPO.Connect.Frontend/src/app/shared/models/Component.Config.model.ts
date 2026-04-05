import { TreeNode } from 'primeng/api';
import { forkJoin, map, Observable, of } from 'rxjs';
import { BuildRequestsFromConfigService } from '../services/helper/build-requests-from-config.service';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';
import { GenericFormsService } from 'src/app/Modules/GenericComponents/GenericForms.service';
import { ColumnConfig } from 'src/app/Modules/enpopower-bi/services/generate-query.service';
import { ListRequestModel, MessageStatus, RequestedData, Search, SearchKind } from '../services/BackendServices/DynamicForm/DynamicForm.dto';

export interface TableColumn {
    key: string;
    value: string;
}
export interface TableField {
    header: string; // column header label
    field: string; // property name on message or requester field key
    useRequester?: boolean; // when true always use genericFormService.getRequesterFieldTxt
    width?: string;
    sortable?: boolean;
    visible?: boolean;
    renderAsStatus?: boolean; // when true render with adminStatusToStringPipe and severity tag
}
export interface TkCategoryCd {
    key: number;
    value: string;
}
export interface StatusChangeOption {
    label: string;
    value: number;
}
export interface AttachmentConfig {
    showAttachmentSection: boolean;
    AllowedExtensions: string[];
    maximumFileSize: number;
    // allowAdd: enables showing the add button/flow; allowMultiple: enables multiple file selection
    allowAdd?: boolean;
    allowMultiple?: boolean;
    maxFileCount?: number;
    isMandatory?: boolean;
}
export interface FieldsConfiguration {
    isDivDisabled: boolean;
    dateFormat: string;
    showTime: boolean;
    timeOnly: boolean;
    maxDate: Date;
    useDefaultRadioView: boolean;
    isNotRequired: boolean;
    isCategoryTreeMode?: boolean;
    sticky?: boolean; // when true, table header/paginator become sticky inside table container

}
export interface UserConfiguration {
    currentUser: string;
    currentUserName: string;
    userGroup: string;
}

export interface DynamicFormSettings {
    applicationId?: string;
    aliases?: Record<string, string[]>;
    traceRequests?: boolean;
}

export class ComponentConfig {
    routeKey!: string;
    componentTitle?: string;
    // show a signature section on forms
    showFormSignature: boolean = false;
    // custom text for submit button shown on forms
    submitButtonText?: string = 'تسجيل';
    // custom text for submission confirmation shown on forms
    submissionLabel?: string = 'تسجيل جديد';
    // show a view toggle section on forms
    showViewToggle: boolean = true;
    formDisplayOption: 'fullscreen' | 'tabs' = 'fullscreen';
    listRequestModel!: ListRequestModel;
    genericFormName?: string;
    globalFilterFields!: string[];
    isNew!: boolean;
    isAttachmentsEnabled?: boolean;
    menuId!: number;
    unitId!: number[];
    selectedNodeKey?: string;

    userConfiguration!: UserConfiguration;
    fieldsConfiguration!: FieldsConfiguration;
    dynamicFormSettings?: DynamicFormSettings;
    requestsarray: RequestArrayItem[] = [];

    // Attachment configuration grouped under one object
    // Provide sensible defaults for the newly added allowAdd/allowMultiple
    attachmentConfig: AttachmentConfig = { showAttachmentSection: false, AllowedExtensions: [], maximumFileSize: 2, maxFileCount: 2, isMandatory: false, allowAdd: false, allowMultiple: true };
    allowStatusChange: boolean = true;
    allowDefaultNextResponsibleSectorID: boolean = true;
    statusChangeOptions: StatusChangeOption[] = [];
    deadStatus!: number[];
    totalRecords!: number;
    pageSizes: number[] = [5, 10, 25, 50, 100];
    tableColumns!: TableColumn[];
    tableFields?: TableField[];
    tkCategoryCds: TkCategoryCd[] = [{ key: 102, value: 'بريدية' }, { key: 103, value: 'حكومية' }, { key: 104, value: 'مالية' }, { key: 124, value: 'التظلمات' }];

    constructor(init?: Partial<ComponentConfig>) {
        Object.assign(this, init);
        // Support legacy top-level attachment fields by migrating into attachmentConfig
        try {
            if (init && Object.prototype.hasOwnProperty.call(init, 'attachmentConfig') && init!.attachmentConfig) {
                this.attachmentConfig = { ...this.attachmentConfig, ...(init!.attachmentConfig as any) };
            } else {
                // migrate legacy fields if present (exclude legacy AttchmentAllowed key)
                const legacyMax = (init as any)?.maximumFileSize;
                const legacyShow = (init as any)?.showAttachmentSection;
                const legacyMandatory = (init as any)?.isMandatory;
                // Accept both legacy "maxFiles" and the new "maxFileCount"
                const legacyMaxFileCount = (init as any)?.maxFileCount;
                if (legacyMax !== undefined || legacyShow !== undefined || legacyMandatory !== undefined || legacyMaxFileCount !== undefined || (init as any)?.allowAdd !== undefined || (init as any)?.allowMultiple !== undefined) {
                    const legacyAllowAdd = (init as any)?.allowAdd;
                    const legacyAllowMultiple = (init as any)?.allowMultiple;
                    this.attachmentConfig = {
                        showAttachmentSection: legacyShow === undefined ? this.attachmentConfig.showAttachmentSection : !!legacyShow,
                        AllowedExtensions: this.attachmentConfig.AllowedExtensions || [],
                        maximumFileSize: (typeof legacyMax === 'number' && !isNaN(legacyMax)) ? legacyMax : this.attachmentConfig.maximumFileSize,
                        maxFileCount: (typeof legacyMaxFileCount === 'number' && !isNaN(legacyMaxFileCount)) ? legacyMaxFileCount : this.attachmentConfig.maxFileCount,
                        isMandatory: legacyMandatory === undefined ? this.attachmentConfig.isMandatory : !!legacyMandatory,
                        allowAdd: legacyAllowAdd === undefined ? this.attachmentConfig.allowAdd : !!legacyAllowAdd,
                        allowMultiple: legacyAllowMultiple === undefined ? this.attachmentConfig.allowMultiple : !!legacyAllowMultiple
                    };
                }
            }
        } catch (e) { /* ignore */ }
        // When saving/updating, if caller provided these props but they are null/undefined/empty,
        // normalize them to empty arrays to avoid sending nulls.
        if (init && Object.prototype.hasOwnProperty.call(init, 'globalFilterFields')) {
            if (!Array.isArray(this.globalFilterFields) || this.globalFilterFields.length === 0) {
                this.globalFilterFields = [];
            }
        }
        if (init && Object.prototype.hasOwnProperty.call(init, 'pageSizes')) {
            if (!Array.isArray(this.pageSizes) || this.pageSizes.length === 0) {
                this.pageSizes = [];
            }
        }
        if (this.attachmentConfig && Object.prototype.hasOwnProperty.call(this.attachmentConfig, 'AllowedExtensions')) {
            if (!Array.isArray((this.attachmentConfig as any).AllowedExtensions) || (this.attachmentConfig as any).AllowedExtensions.length === 0) {
                (this.attachmentConfig as any).AllowedExtensions = [];
            }
        }
        if (this.attachmentConfig && Object.prototype.hasOwnProperty.call(this.attachmentConfig, 'maximumFileSize')) {
            const m = (this.attachmentConfig as any).maximumFileSize;
            this.attachmentConfig.maximumFileSize = (typeof m === 'number' && !isNaN(m)) ? m : this.attachmentConfig.maximumFileSize;
        }
        // Normalize legacy or new file-count properties into `maxFileCount`
        if (this.attachmentConfig && Object.prototype.hasOwnProperty.call(this.attachmentConfig, 'maxFiles')) {
            const mf = (this.attachmentConfig as any).maxFiles;
            this.attachmentConfig.maxFileCount = (typeof mf === 'number' && !isNaN(mf) && mf > 0) ? mf : this.attachmentConfig.maxFileCount;
        }
        if (this.attachmentConfig && Object.prototype.hasOwnProperty.call(this.attachmentConfig, 'maxFileCount')) {
            const mf = (this.attachmentConfig as any).maxFileCount;
            this.attachmentConfig.maxFileCount = (typeof mf === 'number' && !isNaN(mf) && mf > 0) ? mf : this.attachmentConfig.maxFileCount;
        }
        // Ensure new boolean flags have sensible defaults if missing
        if (this.attachmentConfig && (this.attachmentConfig.allowAdd === undefined || this.attachmentConfig.allowAdd === null)) {
            this.attachmentConfig.allowAdd = false;
        }
        if (this.attachmentConfig && (this.attachmentConfig.allowMultiple === undefined || this.attachmentConfig.allowMultiple === null)) {
            this.attachmentConfig.allowMultiple = true;
        }
        if (init && Object.prototype.hasOwnProperty.call(init, 'showFormSignature')) {
            this.showFormSignature = !!(init as any).showFormSignature;
        }
        if (init && Object.prototype.hasOwnProperty.call(init, 'submitButtonText')) {
            const t = (init as any).submitButtonText;
            this.submitButtonText = (t === undefined || t === null) ? this.submitButtonText : String(t);
        }
        if (init && Object.prototype.hasOwnProperty.call(init, 'submissionLabel')) {
            const l = (init as any).submissionLabel;
            this.submissionLabel = (l === undefined || l === null) ? this.submissionLabel : String(l);
        }
        if (init && Object.prototype.hasOwnProperty.call(init, 'isAttachmentsEnabled')) {
            this.isAttachmentsEnabled = !!(init as any).isAttachmentsEnabled;
        }
        if (init && Object.prototype.hasOwnProperty.call(init, 'showViewToggle')) {
            this.showViewToggle = !!(init as any).showViewToggle;
        }
        if (init && Object.prototype.hasOwnProperty.call(init, 'allowStatusChange')) {
            this.allowStatusChange = !!(init as any).allowStatusChange;
        }
        if (init && Object.prototype.hasOwnProperty.call(init, 'allowDefaultNextResponsibleSectorID')) {
            this.allowDefaultNextResponsibleSectorID = !!(init as any).allowDefaultNextResponsibleSectorID;
        }
        if (init && Object.prototype.hasOwnProperty.call(init, 'dynamicFormSettings')) {
            const dfs = (init as any).dynamicFormSettings || {};
            const aliasesRaw = dfs.aliases && typeof dfs.aliases === 'object' ? dfs.aliases : {};
            const aliases: Record<string, string[]> = {};
            Object.keys(aliasesRaw || {}).forEach(key => {
                const arr = aliasesRaw[key];
                if (Array.isArray(arr)) {
                    aliases[key] = arr.map((x: any) => String(x ?? '').trim()).filter((x: string) => x.length > 0);
                }
            });
            this.dynamicFormSettings = {
                applicationId: String(dfs.applicationId ?? '').trim() || undefined,
                aliases,
                traceRequests: Boolean(dfs.traceRequests)
            };
        }
        if (init && Object.prototype.hasOwnProperty.call(init, 'statusChangeOptions')) {
            const options = (init as any).statusChangeOptions;
            this.statusChangeOptions = Array.isArray(options)
                ? options
                    .map((o: any) => ({ label: String(o?.label ?? ''), value: Number(o?.value) }))
                    .filter((o: any) => o.label.length > 0 && !isNaN(o.value))
                : [];
        }
    }
}

export type RequestTrigger = 'onInit' | 'onCategoryChanged' | 'onDemand' | string;

export interface RequestRunConditions {
    categoryIdIn?: number[];
    categoryIdNotIn?: number[];
    dependsOn?: string[];
}

export interface RequestBindingMap {
    valuePath?: string;
    labelPath?: string;
}

export interface RequestBindingTarget {
    type?: 'dynamicField' | 'contextPath';
    fieldKey?: string;
    path?: string;
}

export interface RequestBindingRule {
    bindType?: 'options' | 'value' | string;
    targetFieldKey?: string;
    target?: RequestBindingTarget;
    responsePath?: string;
    responseMap?: RequestBindingMap;
    clearOnEmpty?: boolean;
}

export interface RequestArrayItem {
    method: string;
    args: any[];
    requestsSelectionFields: string[];
    // `arrName` is the optional config string/function that points to the target
    // array (e.g. 'this.messageDtos') or a function that returns an array.
    // `arrValue` is the runtime array reference populated by the request pipeline.
    arrName?: string | ((...args: any[]) => any[]);
    arrValue?: any[];
    populateMethod?: string;
    populateArgs?: any[];
    wrapBodyAsArray?: boolean;
    requestId?: string;
    enabled?: boolean;
    trigger?: RequestTrigger | RequestTrigger[];
    conditions?: RequestRunConditions;
    bindings?: RequestBindingRule[];
    trace?: boolean;
}

export interface ProcessRequestsAndPopulateOptions {
    trigger?: RequestTrigger;
    runtime?: Record<string, any>;
    trace?: boolean;
    preserveDynamicMetadata?: boolean;
}

// Helper to find a config by a route key
export function getConfigByRoute(routeKey: string, configs: ComponentConfig[]): ComponentConfig | undefined {
    return configs.find(c => c.routeKey === routeKey);
}

// Example default factory (can be imported and adjusted by the component)
export const defaultModel: ListRequestModel = {
    pageNumber: 1,
    pageSize: 5,
    status: MessageStatus.جديد,
    categoryCd: 0,
    type: 0,
    requestedData: RequestedData.Inbox,
    search: {
        isSearch: false,
        searchKind: SearchKind.NoSearch,
        searchField: '',
        searchText: '',
        searchType: '',
    } as Search
};

export const userConfigFromLocalStorage: UserConfiguration = {
    currentUser: localStorage.getItem('UserId') as string,
    currentUserName: localStorage.getItem('firstName') as string,
    userGroup: ''
};


export function getAnyNode(key: string, nodes: TreeNode[]): TreeNode | undefined {
    for (let node of nodes) {
        if (node.key === key) {
            return node;
        }
        if (node.children) {
            let matchedNode = getAnyNode(key, node.children);
            if (matchedNode) {
                return matchedNode;
            }
        }
    }
    return undefined;
}

export const defaultGlobalFilterFields = ['messageId', 'requestRef', 'categoryCd', 'inquiryType', 'status', 'createdDate'];

export const defaultAdminCerAreaConfigs: ComponentConfig[] = [];


export function parseToDate(val: any): Date | null {
    if (val === null || val === undefined || val === '') return null;
    if (val instanceof Date) return val;
    if (typeof val === 'number') return new Date(val);
    if (typeof val === 'string') {
        const s = val.trim();
        // Try native parse first
        const d = new Date(s);
        if (!isNaN(d.getTime())) return d;

        // Try YYYY-MM-DD explicitly
        const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    }

    return null;
}

export function isRouteEndWith(route: string, substr: string): boolean {
    try {
        return route ? route.endsWith(substr) : false;
    } catch (e) {
        return false;
    }
}

export function routeKey(route: string): string {
    try {
        const parts = route.split('/').filter(Boolean);
        if (parts.length >= 2) {
            return parts.slice(-2).join('/');
        } else {
            return route;
        }
    } catch (e) {
        return '';
    }
}
export function populateTreeGeneric<T>(
    items: T[],
    idKey: keyof T,
    parentIdKey: keyof T,
    labelKey: keyof T,
    treeArray: TreeNode[],
    selectableParent: boolean = false,
    expandFirstParent: boolean = true
) {
    treeArray.length = 0; // Clear the array
    const sortedItems = [...items].sort((a, b) => {
        const aIdNum = Number(a[idKey]);
        const bIdNum = Number(b[idKey]);
        return aIdNum - bIdNum;
    });
    sortedItems.forEach(item => {
        const id = item[idKey];
        const parentId = item[parentIdKey];
        const label = item[labelKey];

        let node: TreeNode = {
            key: id?.toString(),
            label: label as string,
            selectable: true,
            children: [],
            data: item
        };


        let parentNode = getAnyNode(parentId?.toString() || '', treeArray);
        if (parentNode) {
            parentNode.selectable = selectableParent;
            parentNode.children?.push(node);
        }
        else {
            treeArray.push(node);
        }
    });

    if (treeArray.length > 0) {
        treeArray[0].expanded = expandFirstParent;
    }
}

// Moved helper: make the processRequestsAndPopulate logic reusable by components
export function processRequestsAndPopulate(
    context: any,
    genericFormService?: GenericFormsService,
    spinner?: SpinnerService,
    options?: ProcessRequestsAndPopulateOptions
): Observable<void> {
    try {
        try { context.spinner?.show('جاري تحميل الإعدادات ...'); } catch (e) { /* swallow */ }

        const preserveDynamicMetadata = Boolean(options?.preserveDynamicMetadata);
        if (!preserveDynamicMetadata && context?.genericFormService) {
            context.genericFormService.cdmendDto = [];
            context.genericFormService.cdcategoryDtos = [];
            context.genericFormService.filteredCdcategoryDtos = [];
        }

        const allRequestItems: RequestArrayItem[] = Array.isArray(context?.config?.requestsarray)
            ? context.config.requestsarray
            : [];
        const filteredRequestItems = filterRequestsByExecutionContext(allRequestItems, context, options);
        traceConfigRequest(context, options, 'pipeline.start', {
            routeKey: context?.config?.routeKey,
            trigger: String(options?.trigger ?? 'onInit'),
            requested: allRequestItems.length,
            executing: filteredRequestItems.length
        });

        const requestBuilder = new BuildRequestsFromConfigService();
        const requests: any[] = requestBuilder.buildRequestsFromConfig(filteredRequestItems, context);
        if (!Array.isArray(requests) || requests.length === 0) {
            try { context.spinner?.hide(); } catch (e) { /* swallow */ }
            try { spinner?.hide(); } catch (e) { /* swallow */ }
            return of(void 0);
        }

        const obs = getData ? getData(requests) : null;
        if (!obs) {
            try { context.spinner?.hide(); } catch (e) { /* swallow */ }
            try { spinner?.hide(); } catch (e) { /* swallow */ }
            return of(void 0);
        }

        return new Observable<void>((subscriber) => {
            (obs as Observable<any[]>).subscribe({
                next: (responses: any[]) => {
                    try {
                        if (responses.length > 0) {
                            responses.forEach((resp: any, idx: number) => {
                                const reqConfig = filteredRequestItems[idx] ?? ({} as RequestArrayItem);
                                responses[idx] = resp;
                                try {
                                    const total = resp?.TotalCount ?? resp?.totalCount ?? resp?.data?.TotalCount ?? resp?.Data?.TotalCount;
                                    if (total !== undefined && total !== null && String(total).trim() !== '' && context && context.config) {
                                        const parsed = Number(total);
                                        if (!isNaN(parsed) && context.config.totalRecords == 0) context.config.totalRecords = parsed;
                                    }
                                } catch (e) { /* swallow */ }

                                const normalized = normalizeCommonResponse(resp);
                                const reqLabel = reqConfig?.requestId || reqConfig?.method || `request#${idx + 1}`;
                                traceConfigRequest(context, options, 'request.response', {
                                    request: reqLabel,
                                    success: normalized.isSuccess,
                                    hasData: normalized.data !== undefined && normalized.data !== null
                                }, reqConfig);

                                if (normalized.isSuccess) {
                                    const respData = normalized.data;
                                    applyLegacyResponseBindings(reqConfig, respData, requestBuilder, context, genericFormService, options);
                                    applyDeclarativeBindings(reqConfig, respData, context, genericFormService, options);
                                } else {
                                    const errors = Array.isArray(normalized.errors) ? normalized.errors : [];
                                    const errText = errors.map((e: any) => String(e?.message ?? e ?? '')).filter((x: string) => x.length > 0).join('<br>');
                                    if (errText.length > 0) {
                                        try { context?.msg?.msgError(errText, 'هناك خطا ما', true); } catch (e) { /* swallow */ }
                                    }
                                    traceConfigRequest(context, options, 'request.failed', {
                                        request: reqLabel,
                                        errors
                                    }, reqConfig);
                                }
                            });
                        }

                        subscriber.next();
                        subscriber.complete();
                        try { spinner?.hide(); } catch (e) { /* swallow */ }
                        try { context.spinner?.hide(); } catch (e) { /* swallow */ }
                    } catch (e) {
                        subscriber.error(e);
                    }
                },
                error: (error: any) => {
                    try {
                        context?.msg?.msgError('Error', '<h5>' + error + '</h5>', true);
                    } catch (e) { /* swallow */ }
                    try { spinner?.hide(); } catch (e) { /* swallow */ }
                    try { context.spinner?.hide(); } catch (e) { /* swallow */ }
                    traceConfigRequest(context, options, 'pipeline.error', { error: String(error ?? '') });
                    subscriber.error(error);
                }
            });
        });
    } catch (e) {
        try { spinner?.hide(); } catch (err) { /* swallow */ }
        try { context.spinner?.hide(); } catch (err) { /* swallow */ }
        traceConfigRequest(context, options, 'pipeline.exception', { error: String(e ?? '') });
        return of(void 0);
    }
}

function applyLegacyResponseBindings(
    reqConfig: RequestArrayItem,
    respData: any,
    requestBuilder: BuildRequestsFromConfigService,
    context: any,
    genericFormService?: GenericFormsService,
    options?: ProcessRequestsAndPopulateOptions
): void {
    if (respData === undefined) {
        return;
    }

    if (reqConfig.populateMethod) {
        const invoker = requestBuilder.getPopulateInvoker(reqConfig, context);
        if (invoker) {
            try {
                invoker(respData, reqConfig.populateArgs);
            } catch (e) {
                traceConfigRequest(context, options, 'legacy.populateMethod.failed', {
                    request: reqConfig.requestId || reqConfig.method,
                    method: reqConfig.populateMethod,
                    error: String(e ?? '')
                }, reqConfig);
            }
        } else {
            traceConfigRequest(context, options, 'legacy.populateMethod.missing', {
                request: reqConfig.requestId || reqConfig.method,
                method: reqConfig.populateMethod
            }, reqConfig);
        }
    }

    if (Array.isArray(reqConfig.arrValue) && Array.isArray(respData)) {
        if (reqConfig.method != 'powerBiController.getGenericDataById' && respData.length > 0) {
            reqConfig.arrValue.length = 0;
        }
        if (reqConfig.arrValue.length == 0) {
            reqConfig.arrValue.push(...respData);
        }
    }

    (reqConfig.requestsSelectionFields ?? []).forEach((fieldName: string) => {
        if (!genericFormService || !fieldName) {
            return;
        }

        const selectionSource = Array.isArray(respData) ? respData : [];
        const selectionsArr = genericFormService.mapArrayToSelectionArray(fieldName, selectionSource);
        upsertSelectionArray(genericFormService, fieldName, selectionsArr?.items ?? []);
        traceConfigRequest(context, options, 'legacy.selectionField.bound', {
            request: reqConfig.requestId || reqConfig.method,
            field: fieldName,
            count: selectionsArr?.items?.length ?? 0
        }, reqConfig);
    });
}

function applyDeclarativeBindings(
    reqConfig: RequestArrayItem,
    respData: any,
    context: any,
    genericFormService?: GenericFormsService,
    options?: ProcessRequestsAndPopulateOptions
): void {
    const bindings = Array.isArray(reqConfig.bindings) ? reqConfig.bindings : [];
    if (bindings.length === 0) {
        return;
    }

    bindings.forEach((binding, bindingIndex) => {
        const bindType = String(binding?.bindType ?? '').trim().toLowerCase();
        const targetFieldKey = String(binding?.targetFieldKey ?? binding?.target?.fieldKey ?? '').trim();
        const responseChunk = binding?.responsePath
            ? resolvePathValue(respData, binding.responsePath)
            : respData;

        if (!targetFieldKey && bindType !== 'value') {
            traceConfigRequest(context, options, 'binding.skipped.noTarget', {
                request: reqConfig.requestId || reqConfig.method,
                bindingIndex
            }, reqConfig);
            return;
        }

        if (bindType === 'options') {
            if (!genericFormService) {
                traceConfigRequest(context, options, 'binding.skipped.noGenericFormService', {
                    request: reqConfig.requestId || reqConfig.method,
                    field: targetFieldKey
                }, reqConfig);
                return;
            }

            const items = coerceToArray(responseChunk);
            const mappedItems = buildSelectionItemsFromMapping(items, binding?.responseMap);
            if (mappedItems.length === 0 && !binding?.clearOnEmpty) {
                traceConfigRequest(context, options, 'binding.options.emptyIgnored', {
                    request: reqConfig.requestId || reqConfig.method,
                    field: targetFieldKey
                }, reqConfig);
                return;
            }

            upsertSelectionArray(genericFormService, targetFieldKey, mappedItems);
            traceConfigRequest(context, options, 'binding.options.success', {
                request: reqConfig.requestId || reqConfig.method,
                field: targetFieldKey,
                count: mappedItems.length
            }, reqConfig);
            return;
        }

        if (bindType === 'value') {
            const valuePath = String(binding?.responseMap?.valuePath ?? '').trim();
            const value = valuePath.length > 0 ? resolvePathValue(responseChunk, valuePath) : responseChunk;
            const patched = patchDynamicFieldValueIfExists(context, genericFormService, targetFieldKey, value);
            traceConfigRequest(context, options, patched ? 'binding.value.success' : 'binding.value.deferred', {
                request: reqConfig.requestId || reqConfig.method,
                field: targetFieldKey,
                patched
            }, reqConfig);
            return;
        }

        traceConfigRequest(context, options, 'binding.skipped.unsupportedType', {
            request: reqConfig.requestId || reqConfig.method,
            bindType,
            field: targetFieldKey
        }, reqConfig);
    });
}

function filterRequestsByExecutionContext(
    requests: RequestArrayItem[],
    context: any,
    options?: ProcessRequestsAndPopulateOptions
): RequestArrayItem[] {
    return (requests ?? []).filter((request, index) => {
        const accepted = shouldRunRequest(request, context, options);
        if (!accepted) {
            traceConfigRequest(context, options, 'request.skipped', {
                request: request?.requestId || request?.method || `request#${index + 1}`,
                trigger: request?.trigger,
                conditions: request?.conditions
            }, request);
        }
        return accepted;
    });
}

function shouldRunRequest(
    request: RequestArrayItem | undefined,
    context: any,
    options?: ProcessRequestsAndPopulateOptions
): boolean {
    if (!request || typeof request !== 'object') {
        return true;
    }
    if (request.enabled === false) {
        return false;
    }

    const requestedTrigger = String(options?.trigger ?? 'onInit');
    if (!matchesTrigger(request.trigger, requestedTrigger)) {
        return false;
    }

    return matchesConditions(request.conditions, context, options?.runtime);
}

function matchesTrigger(
    requestTrigger: RequestTrigger | RequestTrigger[] | undefined,
    requestedTrigger: string
): boolean {
    if (requestTrigger === undefined || requestTrigger === null || requestTrigger === '') {
        return true;
    }

    const normalize = (v: unknown): string => String(v ?? '').trim().toLowerCase();
    const target = normalize(requestedTrigger);
    if (target.length === 0) {
        return true;
    }

    if (Array.isArray(requestTrigger)) {
        return requestTrigger.map(item => normalize(item)).includes(target);
    }

    return normalize(requestTrigger) === target;
}

function matchesConditions(
    conditions: RequestRunConditions | undefined,
    context: any,
    runtime?: Record<string, any>
): boolean {
    if (!conditions || typeof conditions !== 'object') {
        return true;
    }

    const currentCategoryId = Number(runtime?.['categoryId'] ?? NaN);
    const includes = parseNumberSet(conditions.categoryIdIn);
    if (includes.length > 0) {
        if (!Number.isFinite(currentCategoryId) || !includes.includes(currentCategoryId)) {
            return false;
        }
    }

    const excludes = parseNumberSet(conditions.categoryIdNotIn);
    if (excludes.length > 0 && Number.isFinite(currentCategoryId) && excludes.includes(currentCategoryId)) {
        return false;
    }

    const deps = Array.isArray(conditions.dependsOn) ? conditions.dependsOn : [];
    if (deps.length > 0) {
        const everyDependencyResolved = deps.every(dep => {
            const resolved = resolvePathValue(
                String(dep ?? '').trim().startsWith('runtime.')
                    ? runtime
                    : context,
                String(dep ?? '').trim().replace(/^runtime\./i, '').replace(/^this\./i, '')
            );
            return Boolean(resolved);
        });

        if (!everyDependencyResolved) {
            return false;
        }
    }

    return true;
}

function parseNumberSet(values: number[] | undefined): number[] {
    return (values ?? [])
        .map(value => Number(value))
        .filter(value => Number.isFinite(value));
}

function normalizeCommonResponse(resp: any): { isSuccess: boolean; data: any; errors: any[] } {
    const explicit = resp?.isSuccess ?? resp?.IsSuccess;
    const isSuccess = explicit === undefined
        ? resp !== null && resp !== undefined
        : Boolean(explicit);
    const data = resp?.data ?? resp?.Data ?? resp;
    const errors = Array.isArray(resp?.errors)
        ? resp.errors
        : (Array.isArray(resp?.Errors) ? resp.Errors : []);

    return { isSuccess, data, errors };
}

function resolvePathValue(source: any, path: string): any {
    const normalizedPath = String(path ?? '').trim();
    if (!normalizedPath) {
        return source;
    }

    const parts = normalizedPath.replace(/^this\./, '').split('.').filter(Boolean);
    let cursor = source;
    for (const part of parts) {
        if (cursor === null || cursor === undefined) {
            return undefined;
        }
        cursor = cursor[part];
    }
    return cursor;
}

function coerceToArray(value: any): any[] {
    if (Array.isArray(value)) {
        return value;
    }
    if (value === null || value === undefined) {
        return [];
    }
    return [value];
}

function buildSelectionItemsFromMapping(items: any[], map?: RequestBindingMap): Array<{ key: string; name: string }> {
    if (!Array.isArray(items) || items.length === 0) {
        return [];
    }

    const valuePath = String(map?.valuePath ?? '').trim();
    const labelPath = String(map?.labelPath ?? '').trim();

    return items.map((item, index) => {
        if (!item || typeof item !== 'object') {
            const value = String(item ?? '');
            return { key: value, name: value };
        }

        const mappedValue = valuePath ? resolvePathValue(item, valuePath) : (item['key'] ?? item['value'] ?? item['id'] ?? item['code'] ?? index);
        const mappedLabel = labelPath ? resolvePathValue(item, labelPath) : (item['name'] ?? item['label'] ?? item['text'] ?? mappedValue);
        return {
            key: String(mappedValue ?? ''),
            name: String(mappedLabel ?? mappedValue ?? '')
        };
    }).filter(option => option.key.length > 0 || option.name.length > 0);
}

function upsertSelectionArray(
    genericFormService: GenericFormsService,
    fieldName: string,
    items: Array<{ key: string; name: string }>
): void {
    if (!genericFormService || !fieldName) {
        return;
    }

    if (!Array.isArray(genericFormService.selectionArrays)) {
        genericFormService.selectionArrays = [];
    }

    const normalizedField = String(fieldName).trim();
    const index = genericFormService.selectionArrays.findIndex(arr => String(arr?.nameProp ?? '').trim() === normalizedField);
    const normalized = { keyProp: 'key', nameProp: normalizedField, items: items ?? [] };
    if (index >= 0) {
        genericFormService.selectionArrays[index] = normalized;
        return;
    }

    genericFormService.selectionArrays.push(normalized);
}

function patchDynamicFieldValueIfExists(
    context: any,
    genericFormService: GenericFormsService | undefined,
    fieldKey: string,
    value: any
): boolean {
    const trimmedFieldKey = String(fieldKey ?? '').trim();
    if (trimmedFieldKey.length === 0) {
        return false;
    }

    if (!context.__configDynamicValueBindings || typeof context.__configDynamicValueBindings !== 'object') {
        context.__configDynamicValueBindings = {};
    }
    context.__configDynamicValueBindings[trimmedFieldKey] = value;

    const controlMap = context?.controlMap;
    const dynamicControls = context?.dynamicControls;
    if (!genericFormService || !controlMap || !dynamicControls || typeof controlMap.forEach !== 'function') {
        return false;
    }

    let patched = false;
    controlMap.forEach((valueMeta: any, controlName: string) => {
        if (String(valueMeta?.fieldKey ?? '').trim().toLowerCase() !== trimmedFieldKey.toLowerCase()) {
            return;
        }

        const control = genericFormService.GetControl(dynamicControls, controlName);
        if (!control) {
            return;
        }

        try {
            control.patchValue(value, { emitEvent: false });
            patched = true;
        } catch (e) { /* swallow */ }
    });

    return patched;
}

function shouldTraceConfigRequests(
    context: any,
    options?: ProcessRequestsAndPopulateOptions,
    request?: RequestArrayItem
): boolean {
    if (options?.trace === true) {
        return true;
    }

    if (request?.trace === true) {
        return true;
    }

    return Boolean(context?.config?.dynamicFormSettings?.traceRequests);
}

function traceConfigRequest(
    context: any,
    options: ProcessRequestsAndPopulateOptions | undefined,
    stage: string,
    payload?: any,
    request?: RequestArrayItem
): void {
    if (!shouldTraceConfigRequests(context, options, request)) {
        return;
    }

    try {
        const label = request?.requestId || request?.method || '';
        if (payload !== undefined) {
            console.debug('[ConfigRequestEngine]', stage, label, payload);
            return;
        }

        console.debug('[ConfigRequestEngine]', stage, label);
    } catch (e) {
        // swallow tracing issues
    }
}

function getData<T>(requests?: Observable<any>[], processor?: (resp: any, idx?: number) => T): Observable<T[]> | void {
    // If caller provided requests -> return forkJoin of them mapped through optional processor
    if (Array.isArray(requests) && requests.length > 0) {
        return forkJoin(requests).pipe(
            map((responses: any[]) => responses.map((r, i) => processor ? processor(r, i) : (r as unknown as T)))
        );
    }
}

export function mapDataToTable<T>(data: T[], config: ColumnConfig[], onlyVisible?: boolean) {
    if (!data || data.length === 0) return [];
    // Step 1: filter visible columns
    const visibleCols = onlyVisible ? config.filter(c => c.visible) : config;
    const mapped = data.map((item, idx) => {
        const row: Record<string, any> = {};
        visibleCols.forEach(col => {
            if (col.field === 'serial') {
                row[col.header] = idx + 1;
            } else {
                if (col.header.toString().includes('تاريخ'))
                    row[col.header] = (item as any)[col.field];
                else
                    row[col.header] = (item as any)[col.field];
            }
        });
        return row;
    });
    return mapped;
}
