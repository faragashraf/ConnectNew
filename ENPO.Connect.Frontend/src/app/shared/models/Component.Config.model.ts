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
export function processRequestsAndPopulate(context: any, genericFormService?: GenericFormsService, spinner?: SpinnerService): Observable<void> {
    try {
        try { context.spinner?.show('جاري تحميل الإعدادات ...'); } catch (e) { /* swallow */ }
        context.genericFormService.cdmendDto = [];
        context.genericFormService.cdcategoryDtos = [];
        context.genericFormService.filteredCdcategoryDtos = [];

        const requestBuilder = new BuildRequestsFromConfigService();
        const requests: any[] = requestBuilder.buildRequestsFromConfig(context.config.requestsarray, context);
        if (!Array.isArray(requests) || requests.length === 0) { try { context.spinner?.hide(); } catch (e) { }; return of(void 0); }
        const obs = getData ? getData(requests) : null;
        if (!obs) { try { context.spinner?.hide(); } catch (e) { }; return of(void 0); }
        return new Observable<void>((subscriber) => {
            (obs as Observable<any[]>).subscribe({
                next: (responses: any[]) => {
                    try {
                        if (responses.length > 0) {
                            responses.forEach((resp: any, idx: number) => {
                                responses[idx] = resp;
                                try {
                                    const total = resp?.TotalCount ?? resp?.totalCount ?? resp?.data?.TotalCount ?? resp?.Data?.TotalCount;
                                    if (total !== undefined && total !== null && String(total).trim() !== '' && context && context.config) {
                                        const parsed = Number(total);
                                        if (!isNaN(parsed) && context.config.totalRecords == 0) context.config.totalRecords = parsed;
                                    }
                                } catch (e) { /* swallow */ }
                                if (resp.isSuccess || resp.IsSuccess) {
                                    let respData = resp?.data ?? resp?.Data;
                                    if (Array.isArray(respData) || respData !== undefined) {
                                        const reqConfig = context.config.requestsarray[idx];
                                        if (reqConfig.populateMethod) {
                                            const invoker = requestBuilder.getPopulateInvoker(reqConfig, context);
                                            if (invoker) {
                                                try { invoker(respData, reqConfig.populateArgs); } catch (e) { console.warn('populate invoker failed', e); }
                                            }
                                        }
                                        if (Array.isArray(reqConfig.arrValue)) {
                                            if (Array.isArray(respData)) {
                                                if (reqConfig.method != 'powerBiController.getGenericDataById' && respData.length > 0) {
                                                    reqConfig.arrValue.length = 0; // clear while preserving reference
                                                }
                                                // context.config.requestsarray[idx].arrValue = reqConfig.arrValue;
                                                if (reqConfig.arrValue.length == 0)
                                                    reqConfig.arrValue.push(...respData);
                                            }
                                        }
                                        reqConfig.requestsSelectionFields?.forEach((fieldName: string) => {
                                            const selections_arr = genericFormService?.mapArrayToSelectionArray(fieldName, respData);
                                            genericFormService?.selectionArrays.push(selections_arr as any);
                                        });
                                    }
                                } else {
                                    let errr = '';
                                    resp.errors?.forEach((e: any) => errr += e.message + "<br>");
                                    context.msg.msgError(errr, "هناك خطا ما", true);
                                }
                            });
                        }
                        subscriber.next();
                        subscriber.complete();
                        try { spinner?.hide(); } catch (e) { /* swallow */ }
                    } catch (e) {
                        subscriber.error(e);
                    }
                },
                error: (error: any) => {
                    try {
                        context.msg.msgError('Error', '<h5>' + error + '</h5>', true);
                    } catch (e) { /* swallow */ }
                    try { spinner?.hide(); } catch (e) { /* swallow */ }
                    subscriber.error(error);
                }
            });
        });
    } catch (e) {
        try { spinner?.hide(); } catch (err) { /* swallow */ }
        return of(void 0);
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
