import { Component, OnDestroy, OnInit, Injector } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray, FormControl } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { ComponentConfig, defaultGlobalFilterFields } from 'src/app/shared/models/Component.Config.model';

import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { CONTROLLER_CLASSES } from 'src/app/shared/services/BackendServices';
import { ComponentConfigService } from '../../services/component-config.service';
import { CentralAdminContextService } from '../../services/central-admin-context.service';

@Component({
    selector: 'app-component-config-manager',
    templateUrl: './component-config-manager.component.html',
    styleUrls: ['./ccm-shared.scss']
})
export class ComponentConfigManagerComponent implements OnInit, OnDestroy {
    configs: ComponentConfig[] = [];
    routeKeyFilter = '';
    contextApplicationId = '';
    contextCategoryId: number | null = null;
    populateMethodOptions: { label: string; value: string; defaults?: any[] }[] = [
        { label: 'populateTreeGeneric', value: 'populateTreeGeneric', defaults: ['idKey', 'parentIdKey', 'labelKey', 'treeArrayName', 'selectableParent', 'expandFirstParent'] },
        { label: 'this.genericFormService.mapDataToTable', value: 'this.genericFormService.mapDataToTable', defaults: ['this.allPublications','this.documentConfig'] },
    ];
    // Publications controller endpoints discovered at runtime
    publicationsApiMethods: { label: string; value: string; params: { raw: string; name: string; isBody: boolean; isArray: boolean }[] }[] = [];
    // placeholders for args per request item index
    publicationsArgsPlaceholders: { [requestIndex: number]: string[] } = {};
    // DTO shapes loaded at runtime from generated JSON (src/assets/publications-dto-shapes.json)
    dtoShapes: { [typeName: string]: any } = {};
    availablePageSizes: number[] = [3, 5, 10, 25, 50, 100];
        availableGlobalFilterFields: string[] = defaultGlobalFilterFields || ['messageId', 'requestRef', 'categoryCd', 'inquiryType', 'status', 'createdDate'];
    // options shown as checkboxes for allowed attachment types
    availableAttachmentOptions: string[] = ['.pdf', '.doc', '.docx', '.jpg', '.png', '.xlsx'];
    selected?: ComponentConfig;
    showDrawer = false;
    form!: FormGroup;
    expandedRows = new Set<string>();
    activeTabIndex = 0;
    private readonly subscriptions = new Subscription();
        // dynamically discovered controller instances
        controllers: any[] = [];
        // publicationsController will hold the array of discovered controllers
        publicationsController: any[] = [];

    constructor(
        private svc: ComponentConfigService,
        private fb: FormBuilder,
        private msg: MsgsService,
        private injector: Injector,
        private http: HttpClient,
        private activatedRoute: ActivatedRoute,
        private centralAdminContext: CentralAdminContextService
    ) { }

    ngOnInit(): void {
        this.subscriptions.add(
            this.activatedRoute.queryParamMap.subscribe(params => {
                this.centralAdminContext.updateFromDeepLink({
                    routeKeyPrefix: params.get('routeKeyPrefix'),
                    applicationId: params.get('applicationId'),
                    categoryId: params.get('categoryId')
                });
            })
        );

        this.subscriptions.add(
            this.centralAdminContext.state$.subscribe(state => {
                this.routeKeyFilter = String(state.routeKeyPrefix ?? '').trim();
                this.contextApplicationId = String(state.selectedApplicationId ?? '').trim();
                this.contextCategoryId = state.selectedCategoryId ?? null;
                this.updateFilteredConfigsSummary();
            })
        );

        this.load();
        this.buildFormFromConfig();
        this.loadControllers();
        this.extractPublicationsEndpoints();
        // Attempt to import any generated TS DTO modules from BackendServices/DtoShapes.
        // Merge any modules found so the component can support shapes generated per-service.
        const tryImport = async () => {
            let merged: any = {};
            // Explicit imports to satisfy webpack static analysis and avoid critical dependency warnings
            try {
                const mod = await import('src/app/shared/services/BackendServices/DtoShapes/combined-dto-shapes');
                const shapes = (mod && (mod.DTO_SHAPES || mod.default || mod)) || {};
                for (const k of Object.keys(shapes || {})) { if (!merged.hasOwnProperty(k)) merged[k] = shapes[k]; }
            } catch (e) { /* ignore */ }

            // `dto-shapes` module removed; combined-dto-shapes is authoritative.

            try {
                const mod = await import('src/app/shared/services/BackendServices/DtoShapes/index');
                const shapes = (mod && (mod.DTO_SHAPES || mod.default || mod)) || {};
                for (const k of Object.keys(shapes || {})) { if (!merged.hasOwnProperty(k)) merged[k] = shapes[k]; }
            } catch (e) { /* ignore */ }

            if (Object.keys(merged).length > 0) {
                this.dtoShapes = merged;
                try { this.applyDtoShapesToExistingRequests(); } catch (e) { /* ignore */ }
                return;
            }

            // fallback: try per-service JSONs under assets/dto-shapes/<service>-dto-shapes.json
            try {
                // Build a set of controller name variants from all discovered controllers
                const variants = new Set<string>();
                try {
                    const ctrlNames = Array.isArray(this.publicationsController) ? this.publicationsController.map((c: any) => (c && c.constructor && c.constructor.name) ? c.constructor.name : '') : [];
                    for (const controllerName of ctrlNames) {
                        if (!controllerName) continue;
                        variants.add(controllerName);
                        variants.add(controllerName.replace(/Controller$/i, ''));
                        variants.add(controllerName.replace(/Api$/i, ''));
                    } 
                    // add lowercased and simple forms
                    for (const v of Array.from(variants)) { if (v) variants.add(v.toLowerCase()); }
                } catch (e) { /* ignore */ }

                const tryServiceJson = async () => {
                    for (const v of variants) {
                        const name = String(v).trim();
                        if (!name) continue;
                        const candidate = `assets/dto-shapes/${name.toLowerCase()}-dto-shapes.json`;
                        try {
                            const s = await this.http.get<any>(candidate).toPromise();
                            if (s) { this.dtoShapes = s; try { this.applyDtoShapesToExistingRequests(); } catch (e) { } return true; }
                        } catch (e) { /* ignore not-found */ }
                    }
                    return false;
                };

                tryServiceJson().then(found => {
                    if (found) return;
                    // as last resort load combined JSON (legacy name + new combined)
                    this.http.get<any>('assets/dto-shapes/combined-dto-shapes.json').subscribe(s => {
                        try { this.dtoShapes = s || {}; } catch (e) { this.dtoShapes = {}; }
                        try { this.applyDtoShapesToExistingRequests(); } catch (e) { /* ignore */ }
                    }, () => {
                        // legacy fallback for older generator
                        this.http.get<any>('assets/publications-dto-shapes.json').subscribe(s2 => { try { this.dtoShapes = s2 || {}; } catch (e) { this.dtoShapes = {}; } try { this.applyDtoShapesToExistingRequests(); } catch (e) { /* ignore */ } }, () => { this.dtoShapes = {}; });
                    });
                });
            } catch (e) { this.dtoShapes = {}; }
        };
        tryImport();
        this.loadAttachmentOptions();
    }

    ngOnDestroy(): void {
        this.subscriptions.unsubscribe();
    }

    private loadAttachmentOptions() {
        // const defaults = ['pdf', 'doc', 'docx', 'jpg', 'png', 'xlsx'];
        // this.availableAttachmentOptions = defaults;
        try {
            this.http.get<any>('assets/attachment-options.json').subscribe((res: any) => {
                try {
                    if (Array.isArray(res)) this.availableAttachmentOptions = res;
                    else if (res && Array.isArray(res.options)) this.availableAttachmentOptions = res.options;
                } catch (e) { /* ignore parse errors, keep defaults */ }
            }, () => { /* ignore load errors */ });
        } catch (e) { /* ignore */ }
    }

    // Load controller instances registered with Angular DI using the classes
    private loadControllers() {
        try {
            this.controllers = [];
            const classNames = (CONTROLLER_CLASSES || []).map((c: any) => (c && c.name) ? c.name : String(c));
            console.debug('BackendServices.CONTROLLER_CLASSES:', classNames);
            for (const cls of CONTROLLER_CLASSES || []) {
                try {
                    const inst = this.injector.get(cls as any);
                    if (inst) this.controllers.push(inst);
                } catch (e) {
                    console.debug('Injector.get failed for', (cls && (cls as any).name) || cls, e && ((e as any).message || e));
                }
            }

            console.debug('Resolved controller instances:', this.controllers.map((c: any) => c && c.constructor && c.constructor.name));

            // expose all discovered controllers so callers can aggregate endpoints
            this.publicationsController = Array.isArray(this.controllers) ? this.controllers : (this.controllers ? [this.controllers] : []);
        } catch (e) { /* ignore */ }
    }

    private extractPublicationsEndpoints() {
        try {
            const list: { label: string; value: string; params: { raw: string; name: string; isBody: boolean; isArray: boolean }[] }[] = [];
            // Aggregate methods from all discovered controllers
            for (const ctrl of (this.publicationsController || [])) {
                try {
                    const ctrlName = (ctrl && ctrl.constructor && ctrl.constructor.name) ? ctrl.constructor.name : 'controller';
                    const lcCtrlName = ctrlName && ctrlName.length ? (ctrlName.charAt(0).toLowerCase() + ctrlName.slice(1)) : ctrlName;
                    const proto = Object.getPrototypeOf(ctrl);
                    const names = Object.getOwnPropertyNames(proto || {}).filter(n => n !== 'constructor' && typeof (ctrl as any)[n] === 'function');
                    for (const name of names) {
                        // skip internal helpers generated by NSwag (process* etc.)
                        if (/^process|^blobToText|^throwException/.test(name)) continue;
                        try {
                            const fn: any = (ctrl as any)[name];
                            const src = fn && fn.toString ? fn.toString() : '';
                            const pstart = src.indexOf('(');
                            const pend = src.indexOf(')');
                            const params: { raw: string; name: string; isBody: boolean; isArray: boolean }[] = [];
                            if (pstart >= 0 && pend > pstart) {
                                const rawParams = src.substring(pstart + 1, pend).split(',').map((s: any) => s.trim()).filter(Boolean);
                                for (const rp of rawParams) {
                                    const raw = rp;
                                    const namePart = (raw.split(':')[0] || raw.split('=')[0] || raw).trim();
                                    const lname = namePart.toLowerCase();
                                    const isBody = lname === 'body' || lname.endsWith('body');
                                    const isArray = raw.indexOf('[]') >= 0 || /Array<.*>/.test(raw);
                                    params.push({ raw, name: namePart, isBody, isArray });
                                }
                            }
                            // label should indicate controller.method and param kinds
                            let label = `${lcCtrlName}.${name} (not Params)`;
                            try {
                                const kinds = new Set<string>();
                                for (const pp of params) {
                                    if (pp.isBody) kinds.add('body');
                                    else kinds.add('query String Parameters');
                                }
                                const parts = Array.from(kinds.values());
                                    if (parts.length) label = `${lcCtrlName}.${name} (${parts.join(', ')})`;
                            } catch (e) { /* ignore */ }

                            // value is namespaced so callers can identify controller+method
                            const value = `${lcCtrlName}.${name}`;
                            list.push({ label, value, params });
                        } catch (e) { /* ignore */ }
                    }
                } catch (e) { /* ignore per-controller */ }
            }
            this.publicationsApiMethods = list.sort((a, b) => a.label.localeCompare(b.label));
            // Ensure any form rows loaded before endpoints were available get initialized now
            try { setTimeout(() => this.initializePublicationArgsForRequests()); } catch (e) { /* ignore */ }
        } catch (e) { /* ignore */ }
    }

    onSelectPublicationEndpoint(requestIndex: number, methodName: string) {
        // Robust lookup: accept full "ctrl.method", short "method", case-insensitive, and suffix matches
        const methods = this.publicationsApiMethods || [];
        const findDesc = (mn: string | undefined) => {
            try {
                console.debug('CCM.findDesc: lookup', { requested: mn, available: methods.map(m => m && m.value) });
            } catch (e) { /* ignore logging errors */ }
            if (!mn) return undefined as any;
            // exact match
            let d = methods.find(m => m.value === mn);
            if (d) { try { console.debug('CCM.findDesc: exact match', d.value); } catch (e) {} return d; }
            const lower = String(mn).toLowerCase();
            // match by suffix after '.' (method-only)
            d = methods.find(m => typeof m.value === 'string' && m.value.split('.')?.[1] === mn);
            if (d) { try { console.debug('CCM.findDesc: suffix match', d.value); } catch (e) {} return d; }
            d = methods.find(m => typeof m.value === 'string' && m.value.split('.')?.[1]?.toLowerCase() === lower);
            if (d) { try { console.debug('CCM.findDesc: suffix lowercase match', d.value); } catch (e) {} return d; }
            // endsWith match (e.g. 'controller.method' vs 'method')
            d = methods.find(m => typeof m.value === 'string' && m.value.toLowerCase().endsWith('.' + lower));
            if (d) { try { console.debug('CCM.findDesc: endsWith match', d.value); } catch (e) {} return d; }
            // case-insensitive full match
            d = methods.find(m => typeof m.value === 'string' && m.value.toLowerCase() === lower);
            if (d) { try { console.debug('CCM.findDesc: case-insensitive full match', d.value); } catch (e) {} }
            return d;
        };
        const desc = findDesc(methodName as any);
        try { console.debug('CCM.onSelectPublicationEndpoint', { requestIndex, methodName, desc, params: desc && desc.params }); } catch (e) { }
        const params = desc ? desc.params : [];
        // prepare placeholders (strings) and initial arg values
        const placeholders: string[] = [];
        const values: any[] = [];
        // if there are no params, ensure args is an empty array (avoid leftover object)
        if (!params || params.length === 0) {
            this.publicationsArgsPlaceholders[requestIndex] = [];
            try {
                const ctrl = this.requestsarray.at(requestIndex).get('args') as FormControl;
                ctrl.setValue([]);
            } catch (e) { /* ignore */ }
            return;
        }
        for (let pIndex = 0; pIndex < params.length; pIndex++) {
            const p = params[pIndex];
            if (p.isBody) {
                placeholders.push(p.name + ' (body)');
                // try to extract the declared type from the raw signature and build a shape
                let typeName = null as string | null;
                try {
                    const methodMap = (this.dtoShapes && (this.dtoShapes as any).__methodParamMap) ? (this.dtoShapes as any).__methodParamMap : null;
                    // methodName may be namespaced as Controller.method; try both keys
                    const methodKeyCandidates = methodName && methodName.indexOf('.') >= 0 ? [methodName, methodName.split('.')[1]] : [methodName];
                        if (methodMap) {
                            for (const mk of methodKeyCandidates) {
                                if (mk && methodMap[mk] && methodMap[mk][pIndex] && methodMap[mk][pIndex].type) {
                                    typeName = this.normalizeTypeName(methodMap[mk][pIndex].type) || methodMap[mk][pIndex].type; break;
                                }
                            }
                        }
                } catch (e) { /* ignore */ }
                    if (!typeName) typeName = this.extractTypeNameFromRaw(p.raw);
                let shape: any = undefined;
                const normType = this.normalizeTypeName(typeName) || typeName;
                if (normType && this.dtoShapes && (this.dtoShapes as any)[normType]) {
                    shape = (this.dtoShapes as any)[normType];
                } else {
                    // Heuristic: if runtime signature lost the TypeScript type (raw === 'body'),
                    // try to guess a shape by matching the method name to DTO keys (e.g. addMenuItem -> MenuItemReq)
                    try {
                        const methodOnly = methodName && methodName.indexOf('.') >= 0 ? methodName.split('.')[1] : methodName;
                        const guessed = this.guessTypeNameForParam(methodOnly, p.name);
                        if (guessed && this.dtoShapes && this.dtoShapes[guessed]) {
                            typeName = guessed;
                            shape = this.dtoShapes[guessed];
                        }
                    } catch (e) { /* ignore guessing errors */ }
                }
                if (!shape) {
                    // fallback: dtoShapes may include entries keyed by method name or method-only name
                    try {
                        if (this.dtoShapes && (this.dtoShapes as any)[methodName]) shape = (this.dtoShapes as any)[methodName];
                        const methodOnly = methodName && methodName.indexOf('.') >= 0 ? methodName.split('.')[1] : methodName;
                        if (!shape && methodOnly && this.dtoShapes && (this.dtoShapes as any)[methodOnly]) shape = (this.dtoShapes as any)[methodOnly];
                    } catch (e) { /* ignore */ }
                }
                if (!shape) shape = p.isArray ? [] : {};
                // if array, provide an array with one shaped element
                const val = p.isArray ? [ this.cloneShape(shape) ] : this.cloneShape(shape);
                values.push(this.normalizeBodyForDisplay(val));
            } else {
                placeholders.push(p.name);
                // set initial value to the param name so value == placeholder as requested
                values.push(p.name);
            }
        }
        this.publicationsArgsPlaceholders[requestIndex] = placeholders;
        try { console.debug('CCM.onSelectPublicationEndpoint placeholders/values', { requestIndex, placeholders, values }); } catch (e) { }
            try {
                const ctrl = this.requestsarray.at(requestIndex).get('args') as FormControl;
                // preserve existing arg values where they are meaningful (avoid overwriting with placeholders)
                try {
                    const existingRaw = ctrl && ctrl.value;
                    // If the stored value is an explicit empty array, respect it and do not auto-populate placeholders.
                    if (Array.isArray(existingRaw) && existingRaw.length === 0) {
                        try { ctrl.setValue([]); } catch (e) { /* ignore */ }
                        try {
                            const wrapCtrl = this.requestsarray.at(requestIndex).get('wrapBodyAsArray') as FormControl;
                            if (wrapCtrl) {
                                let shouldWrap = false;
                                try { shouldWrap = Array.isArray(params) && params.some(p => p.isBody && p.isArray); } catch (e) { /* ignore */ }
                                wrapCtrl.setValue(shouldWrap);
                            }
                        } catch (e) { /* ignore */ }
                        return;
                    }
                    const existing = Array.isArray(existingRaw) ? [...existingRaw] : this.normalizeArgs(existingRaw);
                    const merged: any[] = [];
                for (let vi = 0; vi < values.length; vi++) {
                    const existingVal = existing && existing.length > vi ? existing[vi] : undefined;
                    const placeholderLike = (v: any, placeholder: string) => typeof v === 'string' && (v === '' || v === placeholder || v === (placeholder + ' (body)'));
                    if (existingVal !== undefined && existingVal !== null && !placeholderLike(existingVal, placeholders[vi] || '')) {
                        // if the param is a body but existing is a primitive string, try to map it into a useful body property
                        const paramPlaceholder = placeholders[vi] || '';
                        const isBody = (paramPlaceholder && paramPlaceholder.toLowerCase().indexOf('(body)') >= 0);
                        if (isBody && typeof existingVal === 'string') {
                            try {
                                const defaultVal = values[vi];
                                // defaultVal may be an array wrapper or object
                                let innerShape: any = undefined;
                                if (Array.isArray(defaultVal)) innerShape = defaultVal[0];
                                else innerShape = defaultVal;
                                // if innerShape is object, try to fill likely search field
                                if (innerShape && typeof innerShape === 'object') {
                                    const copy = this.cloneShape(innerShape);
                                    if (copy.search && copy.search.hasOwnProperty('searchField')) copy.search.searchField = existingVal;
                                    else if (copy.hasOwnProperty('searchField')) copy.searchField = existingVal;
                                    else if (copy.hasOwnProperty('areaName')) copy.areaName = existingVal;
                                    else if (copy.hasOwnProperty('name')) copy.name = existingVal;
                                    // set merged to normalized display form
                                    merged[vi] = Array.isArray(defaultVal) ? this.normalizeBodyForDisplay([copy]) : this.normalizeBodyForDisplay(copy);
                                    continue;
                                }
                            } catch (e) { /* ignore and fallthrough to keep existingVal */ }
                        }
                        merged[vi] = existingVal;
                    } else {
                        merged[vi] = values[vi];
                    }
                }
                // Do NOT preserve trailing existing args beyond the new method's params.
                // Ensure merged array length matches the expected params length.
                merged.length = values.length;
                ctrl.setValue(merged);
                // If the selected endpoint has a body param that's an array, or the merged value contains an array body, set wrapBodyAsArray flag
                try {
                    const wrapCtrl = this.requestsarray.at(requestIndex).get('wrapBodyAsArray') as FormControl;
                    let shouldWrap = false;
                    try { shouldWrap = Array.isArray(params) && params.some(p => p.isBody && p.isArray); } catch (e) { /* ignore */ }
                    if (!shouldWrap) {
                        for (let vi = 0; vi < merged.length; vi++) {
                            try {
                                const ph = placeholders[vi] || '';
                                const isBody = typeof ph === 'string' && ph.toLowerCase().indexOf('(body)') >= 0;
                                const v = merged[vi];
                                if (isBody && Array.isArray(v)) { shouldWrap = true; break; }
                            } catch (e) { /* ignore */ }
                        }
                    }
                    if (wrapCtrl) wrapCtrl.setValue(shouldWrap);
                } catch (e) { /* ignore */ }
                console.debug('CCM.onSelectPublicationEndpoint set args ctrl', { requestIndex, ctrlValue: ctrl.value });
                try { console.debug('CCM.onSelectPublicationEndpoint set args ctrl JSON', { requestIndex, ctrlJson: JSON.stringify(ctrl.value) }); } catch (e) { /* ignore stringify errors */ }
            } catch (e) {
                // fallback to replacing
                try { ctrl.setValue(values); } catch (e2) { /* ignore */ }
            }
        } catch (e) { /* ignore */ }
        // Extra safety: if dtoShapes are already loaded, ensure shapes applied immediately
        try { this.applyDtoShapesToExistingRequests(); } catch (e) { /* ignore */ }
    }

    private extractTypeNameFromRaw(raw: string | undefined): string | null {
        try {
            if (!raw || typeof raw !== 'string') return null;
            // examples: "body: ExpressionDto[] | undefined" or "body: PublicationTypeRequestDto | undefined"
            const colonIdx = raw.indexOf(':');
            const after = colonIdx >= 0 ? raw.substring(colonIdx + 1) : raw;
            // take first token before '|' or '=' or '['
            const cleaned = after.split('|')[0].split('=')[0].trim();
            const match = cleaned.match(/([A-Za-z0-9_]+)/);
            return match ? match[1] : null;
        } catch (e) { return null; }
    }

    // Normalize type names emitted by generators (strip array markers like [] or Array<...>)
    private normalizeTypeName(typeName: string | null | undefined): string | null {
        try {
            if (!typeName || typeof typeName !== 'string') return null;
            let t = typeName.trim();
            // strip trailing []
            t = t.replace(/\[\]$/g, '');
            // unwrap Array<...>
            const m = t.match(/^Array<(.+)>$/i);
            if (m && m[1]) t = m[1];
            // strip any non-alphanumeric suffix/prefix
            const mm = t.match(/([A-Za-z0-9_]+)/);
            return mm ? mm[1] : null;
        } catch (e) { return null; }
    }

    private cloneShape(shape: any): any {
        if (shape === null || shape === undefined) return shape;
        try { return JSON.parse(JSON.stringify(shape)); } catch (e) { return shape; }
    }

    // Normalize body objects for display in inputs: stringify nested objects so they render
    private normalizeBodyForDisplay(val: any): any {
        try {
            if (val == null) return val;
            // Preserve nested objects/arrays for long-term correctness.
            // Return a deep-cloned structure so callers can mutate safely without affecting originals.
            if (Array.isArray(val)) return JSON.parse(JSON.stringify(val));
            if (typeof val === 'object') return JSON.parse(JSON.stringify(val));
            return val;
        } catch (e) { return val; }
    }

    private normalizeArrValue(arr: any): any {
        try {
            if (arr === null || arr === undefined) return '';
            if (typeof arr === 'string') return arr;
            if (Array.isArray(arr)) return arr;
            return arr; // plain object or other type: preserve as-is
        } catch (e) { return arr; }
    }

    // helpers to get/set nested properties by dotted path
    private getNested(obj: any, path: string) {
        try {
            if (!obj || !path) return undefined;
            const parts = path.split('.');
            let cur = obj;
            for (const p of parts) {
                if (cur == null) return undefined;
                cur = cur[p];
            }
            return cur;
        } catch (e) { return undefined; }
    }

    private setNested(obj: any, path: string, value: any) {
        try {
            if (!obj || !path) return;
            const parts = path.split('.');
            let cur = obj;
            for (let i = 0; i < parts.length - 1; i++) {
                const p = parts[i];
                if (cur[p] == null || typeof cur[p] !== 'object') cur[p] = {};
                cur = cur[p];
            }
            cur[parts[parts.length - 1]] = value;
        } catch (e) { /* ignore */ }
    }

    // Try to guess a DTO type name for a given controller method + param when TS types are erased at runtime
    private guessTypeNameForParam(methodName: string, paramName: string): string | null {
        try {
            if (!this.dtoShapes) return null;
            const keys = Object.keys(this.dtoShapes || {});
            if (!methodName) return null;
            // remove common verb prefixes
            const stripped = methodName.replace(/^(get|add|update|save|delete|post|put|create)/i, '');
            const token = stripped.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
            if (!token) return null;

            // prefer keys that contain the token (e.g. MenuItem -> menuitem)
            for (const k of keys) {
                if (k.toLowerCase().includes(token)) return k;
            }

            // fallback: look for any key ending with 'req' that contains some token words
            for (const k of keys) {
                if (k.toLowerCase().endsWith('req') && k.toLowerCase().includes(token.slice(0, Math.max(3, Math.floor(token.length / 2))))) return k;
            }

            // last resort: use any '*Req' shaped key
            for (const k of keys) {
                if (k.toLowerCase().endsWith('req')) return k;
            }
            return null;
        } catch (e) { return null; }
    }

    // Apply loaded dtoShapes to any existing requests so body properties appear
    private applyDtoShapesToExistingRequests() {
        try {
            const ra = this.form.get('requestsarray') as FormArray;
            if (!ra || !this.publicationsApiMethods) return;
            ra.controls.forEach((g, requestIndex) => {
                try {
                    const method = g.get('method')?.value;
                    if (!method) return;
                    const desc = (this.publicationsApiMethods || []).find(m => m.value === method || (typeof m.value === 'string' && m.value.split('.')[1] === method));
                    if (!desc) return;
                    const argsCtrl = g.get('args') as FormControl;
                    const argsVal = argsCtrl ? argsCtrl.value : undefined;
                    const currentArgs = Array.isArray(argsVal) ? [...argsVal] : this.normalizeArgs(argsVal);
                    let changed = false;
                    for (let i = 0; i < desc.params.length; i++) {
                        const p = desc.params[i];
                        if (!p.isBody) continue;
                        // Prefer explicit method->param map if generator provided it
                        let typeName: string | null = null;
                        try {
                            const methodMap = (this.dtoShapes && (this.dtoShapes as any).__methodParamMap) ? (this.dtoShapes as any).__methodParamMap : null;
                            if (methodMap) {
                                const mk = method && typeof method === 'string' && method.indexOf('.') >= 0 ? method.split('.')[1] : method;
                                if (mk && methodMap[mk] && methodMap[mk][i] && methodMap[mk][i].type) {
                                    typeName = this.normalizeTypeName(methodMap[mk][i].type) || methodMap[mk][i].type;
                                }
                            }
                        } catch (e) { /* ignore */ }
                        if (!typeName) typeName = this.extractTypeNameFromRaw(p.raw);
                        const norm = this.normalizeTypeName(typeName) || typeName;
                        const hasShape = !!(norm && this.dtoShapes && (this.dtoShapes as any)[norm]);
                        let desired = hasShape ? this.cloneShape((this.dtoShapes as any)[norm as any]) : (p.isArray ? [] : {});
                        if (!hasShape && this.dtoShapes) {
                            const methodOnly = method && typeof method === 'string' && method.indexOf('.') >= 0 ? method.split('.')[1] : method;
                            if ((this.dtoShapes as any)[method]) desired = this.cloneShape((this.dtoShapes as any)[method]);
                            else if (methodOnly && (this.dtoShapes as any)[methodOnly]) desired = this.cloneShape((this.dtoShapes as any)[methodOnly]);
                        }

                        const cur = currentArgs[i];
                            if (p.isArray) {
                            // if current is not a useful array, replace with array containing shaped element
                            const needs = (!Array.isArray(cur)) || (Array.isArray(cur) && (cur.length === 0 || (typeof cur[0] === 'object' && Object.keys(cur[0] || {}).length === 0)));
                            if (needs) { currentArgs[i] = this.normalizeBodyForDisplay([ this.cloneShape(desired) ]); changed = true; }
                        } else {
                            const isEmptyObj = cur && typeof cur === 'object' && Object.keys(cur || {}).length === 0;
                            const isPlaceholderString = typeof cur === 'string' && (cur === '' || cur === p.name || cur === p.name + ' (body)');
                            if (cur == null || isEmptyObj || isPlaceholderString) { currentArgs[i] = this.normalizeBodyForDisplay(this.cloneShape(desired)); changed = true; }
                        }
                    }
                    if (changed) {
                        try {
                            console.debug('CCM.applyDtoShapesToExistingRequests about to set args', { requestIndex, method, before: argsVal, after: currentArgs });
                        } catch (e) { }
                        argsCtrl.setValue(currentArgs);
                        try { console.debug('CCM.applyDtoShapesToExistingRequests set args JSON', { requestIndex, method, argsJson: JSON.stringify(currentArgs) }); } catch (e) { }
                    }
                } catch (e) { /* ignore per-row errors */ }
            });
        } catch (e) { /* ignore */ }
    }

    private buildFormFromConfig(cfg?: ComponentConfig) {
        const c = cfg || ({} as ComponentConfig);

        this.form = this.fb.group({
            routeKey: [c.routeKey ?? '', Validators.required],
            componentTitle: [c.componentTitle ?? ''],
            formDisplayOption: [c.formDisplayOption ?? 'fullscreen'],
            genericFormName: [c.genericFormName ?? ''],
            selectedNodeKey: [c.selectedNodeKey ?? ''],
            menuId: [c.menuId ?? 0],
            unitId: [Array.isArray(c.unitId) ? c.unitId.join(',') : (c.unitId || '')],
            pageSizes: this.fb.control(Array.isArray(c.pageSizes) ? c.pageSizes : [5, 10, 25, 50, 100]),
            allowStatusChange: [c.allowStatusChange !== false],
            allowDefaultNextResponsibleSectorID: [c.allowDefaultNextResponsibleSectorID !== false],
            statusChangeOptions: this.fb.array((Array.isArray((c as any).statusChangeOptions) ? (c as any).statusChangeOptions : []).map((opt: any) => this.fb.group({
                label: [opt?.label ?? ''],
                value: [opt?.value ?? 0]
            }))),
            deadStatus: this.fb.control(Array.isArray(c.deadStatus) ? c.deadStatus : []),
            totalRecords: [c.totalRecords ?? 0],
            tableColumns: this.fb.array((Array.isArray(c.tableColumns) ? c.tableColumns : []).map(tc => this.fb.group({ key: [tc.key], value: [tc.value] }))),
            tableFields: this.fb.array((Array.isArray(c.tableFields) ? c.tableFields : []).map(tf => this.fb.group({ header: [tf.header], field: [tf.field], useRequester: [tf.useRequester || false], width: [tf.width || ''], sortable: [tf.sortable || false], visible: [tf.visible !== false], renderAsStatus: [tf.renderAsStatus || false] }))),
            tkCategoryCds: this.fb.array((Array.isArray(c.tkCategoryCds) ? c.tkCategoryCds : []).map(t => this.fb.group({ key: [t.key], value: [t.value] })) ),
                attachmentConfig: this.fb.group({
                showAttachmentSection: [ ((c as any).attachmentConfig && (c as any).attachmentConfig.showAttachmentSection === true) || ((c as any).showAttachmentSection === true) ],
                AllowedExtensions: this.fb.control(Array.isArray((c as any).attachmentConfig?.AllowedExtensions) ? (c as any).attachmentConfig.AllowedExtensions : (Array.isArray((c as any).AllowedExtensions) ? (c as any).AllowedExtensions : [])),
                maximumFileSize: [((c as any).attachmentConfig && (c as any).attachmentConfig.maximumFileSize !== undefined && (c as any).attachmentConfig.maximumFileSize !== null) ? (c as any).attachmentConfig.maximumFileSize : (((c as any).maximumFileSize !== undefined && (c as any).maximumFileSize !== null) ? (c as any).maximumFileSize : 2)],
                isMandatory: [((c as any).attachmentConfig && (c as any).attachmentConfig.isMandatory === true) || ((c as any).isMandatory === true)],
                maxFileCount: [((c as any).attachmentConfig && (c as any).attachmentConfig.maxFileCount !== undefined && (c as any).attachmentConfig.maxFileCount !== null) ? (c as any).attachmentConfig.maxFileCount : (((c as any).maxFileCount !== undefined && (c as any).maxFileCount !== null) ? (c as any).maxFileCount : 2)],
                allowAdd: [((c as any).attachmentConfig && (c as any).attachmentConfig.allowAdd === true) || ((c as any).allowAdd === true)],
                allowMultiple: [((c as any).attachmentConfig && (c as any).attachmentConfig.allowMultiple !== undefined && (c as any).attachmentConfig.allowMultiple !== null) ? (c as any).attachmentConfig.allowMultiple : ((c as any).allowMultiple !== undefined && (c as any).allowMultiple !== null ? (c as any).allowMultiple : true)]
            }),
            showFormSignature: [c.showFormSignature === true],
            showViewToggle: [c.showViewToggle !== false],
            submitButtonText: [c.submitButtonText ?? 'Submit'],
            submissionLabel: [c.submissionLabel ?? ''],
            listRequestModel: this.fb.group({
                pageNumber: [c.listRequestModel?.pageNumber ?? 1],
                pageSize: [c.listRequestModel?.pageSize ?? 5],
                status: [c.listRequestModel?.status ?? 0],
                categoryCd: [c.listRequestModel?.categoryCd ?? 0],
                type: [c.listRequestModel?.type ?? 0],
                requestedData: [c.listRequestModel?.requestedData ?? 0],
                search: this.fb.group({
                    searchKind: [c.listRequestModel?.search?.searchKind || 0],
                    searchField: [c.listRequestModel?.search?.searchField || ''],
                    searchText: [c.listRequestModel?.search?.searchText || ''],
                    searchType: [c.listRequestModel?.search?.searchType || '']
                })
            }),
            globalFilterFields: this.fb.control(Array.isArray(c.globalFilterFields) ? c.globalFilterFields : []),
            isNew: [c.isNew ?? false],
            fieldsConfiguration: this.fb.group({
                isDivDisabled: [c.fieldsConfiguration?.isDivDisabled ?? false],
                useDefaultRadioView: [c.fieldsConfiguration?.useDefaultRadioView ?? false],
                isNotRequired: [c.fieldsConfiguration?.isNotRequired ?? false],
                isCategoryTreeMode: [c.fieldsConfiguration?.isCategoryTreeMode ?? false],
                sticky: [c.fieldsConfiguration?.sticky ?? false]
            }),
            requestsarray: this.fb.array((Array.isArray(c.requestsarray) ? c.requestsarray : []).map((r, i) => {
                const arrInit = (r && (r.arrName ?? ''));
                return this.fb.group({ method: [r.method ?? ''], args: [this.normalizeArgs(r.args)], requestsSelectionFields: this.fb.array((Array.isArray(r.requestsSelectionFields) ? r.requestsSelectionFields : []).map((s: any) => this.fb.control(s))), arrName: [this.normalizeArrValue(arrInit)], wrapBodyAsArray: [r.wrapBodyAsArray === true], populateMethod: [r.populateMethod ], populateArgs: [Array.isArray(r.populateArgs) ? r.populateArgs : []] });
            }))
        });

        // ensure populateArgs structure and subscribe to changes for existing request items
        setTimeout(() => this.initializePublicationArgsForRequests());
    }

    load() {
        this.svc.getAll().subscribe((c) => {
            this.configs = Array.isArray(c) ? c : [];
            this.updateFilteredConfigsSummary();
        });
    }

    get filteredConfigs(): ComponentConfig[] {
        const filterValue = String(this.routeKeyFilter ?? '').trim().toLowerCase();
        const selectedApp = String(this.contextApplicationId ?? '').trim().toLowerCase();
        const selectedCategoryId = Number(this.contextCategoryId ?? 0);

        return (this.configs ?? []).filter(cfg => {
            const routeKey = String(cfg?.routeKey ?? '').trim().toLowerCase();
            if (filterValue && !routeKey.includes(filterValue)) {
                return false;
            }

            const configCategory = Number(cfg?.listRequestModel?.categoryCd ?? 0);
            if (selectedCategoryId > 0 && configCategory > 0 && configCategory !== selectedCategoryId) {
                return false;
            }

            const explicitApp = String(cfg?.dynamicFormSettings?.applicationId ?? '').trim().toLowerCase();
            if (selectedApp && explicitApp && explicitApp !== selectedApp) {
                return false;
            }

            return true;
        });
    }

    openNew() {
        this.selected = undefined;
        this.buildFormFromConfig();
        this.showDrawer = true;
        this.centralAdminContext.patchContext({ selectedConfigRouteKey: null });
    }

    edit(cfg: ComponentConfig) {
        this.selected = cfg;
        this.buildFormFromConfig(cfg);
        // show drawer after form built, then ensure any Publications endpoint selections are initialized
        this.showDrawer = true;
        setTimeout(() => this.initializePublicationArgsForRequests());
        this.centralAdminContext.patchContext({
            selectedConfigRouteKey: cfg?.routeKey ?? null
        });
    }

    private updateFilteredConfigsSummary(): void {
        const filtered = this.filteredConfigs;
        const currentSelected = String(this.centralAdminContext.snapshot.selectedConfigRouteKey ?? '').trim();
        const selectedInScope = currentSelected.length > 0
            && filtered.some(cfg => String(cfg?.routeKey ?? '').trim().toLowerCase() === currentSelected.toLowerCase());
        const fallbackRouteKey = filtered.length > 0
            ? (String(filtered[0]?.routeKey ?? '').trim() || null)
            : null;

        this.centralAdminContext.patchContext({
            filteredConfigsCount: filtered.length,
            selectedConfigRouteKey: selectedInScope ? currentSelected : fallbackRouteKey
        });
    }

    // Centralized initializer for requestsarray to normalize args, subscribe populateMethod changes,
    // set placeholders and fill missing body shapes safely.
    private initializePublicationArgsForRequests() {
        try {
            const ra = this.form.get('requestsarray') as FormArray;
            if (!ra) return;
            ra.controls.forEach((g, requestIndex) => {
                try {
                    // normalize args control
                    const argsCtrl = g.get('args');
                    if (argsCtrl) argsCtrl.setValue(this.normalizeArgs(argsCtrl.value));

                    // ensure populateArgs structure if needed
                    const pm = g.get('populateMethod');
                    if (pm && this.requiresPopulateArgs(pm.value)) this.initPopulateArgsForIndex(requestIndex);
                    if (pm) pm.valueChanges.subscribe((v: any) => { if (this.requiresPopulateArgs(v)) this.initPopulateArgsForIndex(requestIndex); });

                    // if there's a selected Publications method, set placeholders and fill missing args safely
                    const methodCtrl = g.get('method');
                    const method = methodCtrl?.value;
                    // ensure we respond to future programmatic changes to the dropdown as well
                    if (methodCtrl && methodCtrl.valueChanges) {
                        methodCtrl.valueChanges.subscribe((v: any) => { try { this.onSelectPublicationEndpoint(requestIndex, v); } catch (e) { /* ignore */ } });
                    }
                    // If a method is already set (from JSON or programmatically), ensure placeholders and body args are initialized
                    if (method) {
                        try { this.onSelectPublicationEndpoint(requestIndex, method); } catch (e) { /* ignore */ }
                    }
                    try { console.debug('CCM.initializePublicationArgsForRequests row', { requestIndex, method, argsCtrlValue: argsCtrl ? argsCtrl.value : undefined, placeholders: this.publicationsArgsPlaceholders[requestIndex] }); } catch (e) { }
                } catch (e) { /* ignore per-row */ }
            });
            try { this.applyDtoShapesToExistingRequests(); } catch (e) { /* ignore */ }
        } catch (e) { /* ignore */ }
    }

    save() {
        if (this.form.invalid) return;
        const value = this.form.value as any;
        const cfg = new ComponentConfig({
            routeKey: value.routeKey,
            componentTitle: value.componentTitle,
            formDisplayOption: value.formDisplayOption,
            genericFormName: value.genericFormName,
            menuId: Number(value.menuId ?? 0),
            unitId: value.unitId ? String(value.unitId).split(',').map((s: string) => Number(s.trim())).filter((n: number) => !isNaN(n)) : [],
            pageSizes: Array.isArray(value.pageSizes) ? value.pageSizes : [5, 10, 25, 50, 100],
            selectedNodeKey: value.selectedNodeKey ?? '',
            tableColumns: (Array.isArray(value.tableColumns) ? value.tableColumns : []).map((t: any) => ({ key: t.key, value: t.value })),
            tableFields: (Array.isArray(value.tableFields) ? value.tableFields : []).map((f: any) => ({ header: f.header, field: f.field, useRequester: !!f.useRequester, width: f.width || '', sortable: !!f.sortable, visible: f.visible !== false, renderAsStatus: !!f.renderAsStatus })),
            tkCategoryCds: (Array.isArray(value.tkCategoryCds) ? value.tkCategoryCds : []).map((t: any) => ({ key: Number(t.key), value: t.value })),
            attachmentConfig: {
                showAttachmentSection: !!(value.attachmentConfig && value.attachmentConfig.showAttachmentSection),
                AllowedExtensions: Array.isArray(value.attachmentConfig?.AllowedExtensions) ? value.attachmentConfig.AllowedExtensions : (Array.isArray(value.AllowedExtensions) ? value.AllowedExtensions : []),
                maximumFileSize: (value.attachmentConfig && value.attachmentConfig.maximumFileSize !== undefined && value.attachmentConfig.maximumFileSize !== null) ? Number(value.attachmentConfig.maximumFileSize) : ((value.maximumFileSize !== undefined && value.maximumFileSize !== null) ? Number(value.maximumFileSize) : 2),
                isMandatory: !!(value.attachmentConfig && value.attachmentConfig.isMandatory),
                maxFileCount: (value.attachmentConfig && value.attachmentConfig.maxFileCount !== undefined && value.attachmentConfig.maxFileCount !== null) ? Number(value.attachmentConfig.maxFileCount) : ((value.maxFileCount !== undefined && value.maxFileCount !== null) ? Number(value.maxFileCount) : 2),
                allowAdd: !!(value.attachmentConfig && value.attachmentConfig.allowAdd),
                allowMultiple: (value.attachmentConfig && value.attachmentConfig.allowMultiple !== undefined && value.attachmentConfig.allowMultiple !== null) ? !!value.attachmentConfig.allowMultiple : true
            },
            allowStatusChange: value.allowStatusChange !== false,
            allowDefaultNextResponsibleSectorID: value.allowDefaultNextResponsibleSectorID !== false,
            statusChangeOptions: (Array.isArray(value.statusChangeOptions) ? value.statusChangeOptions : [])
                .map((opt: any) => ({ label: String(opt?.label ?? '').trim(), value: Number(opt?.value) }))
                .filter((opt: any) => opt.label.length > 0 && !isNaN(opt.value)),
            deadStatus: Array.isArray(value.deadStatus) ? value.deadStatus.map((d: any) => Number(d)) : (value.deadStatus ? [Number(value.deadStatus)] : []),
            totalRecords: Number(value.totalRecords ?? 0) || 0,
            listRequestModel: {
                pageNumber: Number(value.listRequestModel?.pageNumber ?? 1),
                pageSize: Number(value.listRequestModel?.pageSize ?? 5),
                status: value.listRequestModel?.status ?? 0,
                categoryCd: value.listRequestModel?.categoryCd ?? 0,
                type: value.listRequestModel?.type ?? 0,
                requestedData: value.listRequestModel?.requestedData ?? 0,
                search: { ...value.listRequestModel.search }
            },
            globalFilterFields: Array.isArray(value.globalFilterFields) ? value.globalFilterFields : [],
            isNew: !!value.isNew,
            fieldsConfiguration: { ...value.fieldsConfiguration },
            
            showFormSignature: !!value.showFormSignature,
            showViewToggle: !!value.showViewToggle,
            submitButtonText: value.submitButtonText ?? '',
            submissionLabel: value.submissionLabel ?? '',
            requestsarray: (value.requestsarray || []).map((r: any) => {
                const method = r.method;
                const rawArgs = this.normalizeArgs(r.args);
                // Special-case: when calling publicationsController.getDocumentsList_user
                // ensure an empty object used as the 3rd arg is saved as an empty array instead.
                const args = Array.isArray(rawArgs) ? [...rawArgs] : this.normalizeArgs(rawArgs);
                try {
                    if (method === 'publicationsController.getDocumentsList_user' && args.length >= 3) {
                        const third = args[2];
                        if (third && typeof third === 'object' && !Array.isArray(third) && Object.keys(third).length === 0) {
                            args[2] = [];
                        }
                    }
                } catch (e) { /* ignore normalization errors and keep original args */ }

                const arrCtrlVal = this.normalizeArrValue(r && r.arrName);
                const arrField = (typeof arrCtrlVal === 'string') ? { arrName: arrCtrlVal } : (Array.isArray(arrCtrlVal) ? { arrValue: arrCtrlVal } : { arrName: arrCtrlVal });
                return {
                    method: method,
                    args: args,
                    requestsSelectionFields: Array.isArray(r.requestsSelectionFields) ? r.requestsSelectionFields : [],
                    ...arrField,
                    wrapBodyAsArray: !!r.wrapBodyAsArray,
                    populateMethod: r.populateMethod,
                    populateArgs: Array.isArray(r.populateArgs) ? r.populateArgs : []
                };
            })
        });


        if (this.selected) {
            const merged = new ComponentConfig({ ...this.selected, ...cfg });
            const hasChanges = (() => {
                try { return JSON.stringify(merged) !== JSON.stringify(this.selected); } catch (e) { return true; }
            })();

            if (!hasChanges) {
                this.msg.msgInfo('No changes detected.', 'No changes');
                return;
            }

            // Ask user to confirm applying changes and exporting — if they cancel, do nothing
            this.msg.msgConfirm('<h4>Apply changes and push to disk (writes src/assets/component-configs.json)?</h4>', 'Confirm').then(confirmed => {
                if (!confirmed) return; // do nothing when user cancels

                this.svc.update(merged).subscribe(() => {
                    this.finishSave();
                    this.svc.getAll().subscribe(items => {
                        const exportResult = this.svc.exportToServer(items as ComponentConfig[]);
                        if (exportResult && typeof exportResult.subscribe === 'function') {
                            exportResult.subscribe(() => this.msg.msgSuccess('Saved to disk.'), () => this.msg.msgError('Error', 'Failed to save to disk'));
                        }
                    });
                });
            });
        } else {
            // For new configs: ask confirm, if not confirmed do nothing
            this.msg.msgConfirm('<h4>Save new config and push to disk (writes src/assets/component-configs.json)?</h4>', 'Confirm').then(confirmed => {
                if (!confirmed) return; // do nothing

                this.svc.add(cfg).subscribe(() => {
                    this.finishSave();
                    this.svc.getAll().subscribe(items => {
                        this.svc.exportToServer(items as ComponentConfig[]).subscribe(() => this.msg.msgSuccess('Saved to disk.'), () => this.msg.msgError('Error', 'Failed to save to disk'));
                    });
                });
            });
        }
    }

    // FormArray helpers
    get requestsarray(): FormArray { return this.form.get('requestsarray') as FormArray; }
    addRequest() {
        const defaultMethod = this.getDefaultPopulateMethod();
        const initialPopulateArgs = this.getPopulateDefaults(defaultMethod) ?? [];
        const grp = this.fb.group({ method: [''], args: [[]], requestsSelectionFields: this.fb.array([]), arrName: [[]], wrapBodyAsArray: [false], populateMethod: [defaultMethod], populateArgs: [initialPopulateArgs] });
        this.requestsarray.push(grp);
        const idx = this.requestsarray.length - 1;
        const pm = grp.get('populateMethod');
        if (pm && this.requiresPopulateArgs(pm.value)) this.initPopulateArgsForIndex(idx);
        if (pm) pm.valueChanges.subscribe((v: any) => { if (this.requiresPopulateArgs(v)) this.initPopulateArgsForIndex(idx); });
    }
    removeRequest(i: number) { this.requestsarray.removeAt(i); }

    get tkCategoryCdsArr(): FormArray { return this.form.get('tkCategoryCds') as FormArray; }
    addTkCategory() { this.tkCategoryCdsArr.push(this.fb.group({ key: [0], value: [''] })); }
    removeTkCategory(i: number) { this.tkCategoryCdsArr.removeAt(i); }

    get tableColumnsArr(): FormArray { return this.form.get('tableColumns') as FormArray; }
    addTableColumn() { this.tableColumnsArr.push(this.fb.group({ key: [''], value: [''] })); }
    removeTableColumn(i: number) { this.tableColumnsArr.removeAt(i); }
    get tableFieldsArr(): FormArray { return this.form.get('tableFields') as FormArray; }
    addTableField() { this.tableFieldsArr.push(this.fb.group({ header: [''], field: [''], useRequester: [false], width: [''], sortable: [false], visible: [true], renderAsStatus: [false] })); }
    removeTableField(i: number) { this.tableFieldsArr.removeAt(i); }

    get statusChangeOptionsArr(): FormArray { return this.form.get('statusChangeOptions') as FormArray; }
    addStatusChangeOption() { this.statusChangeOptionsArr.push(this.fb.group({ label: [''], value: [0] })); }
    removeStatusChangeOption(i: number) { this.statusChangeOptionsArr.removeAt(i); }

    // Initialize populateArgs array for a given request index ensuring 6 positions
    initPopulateArgsForIndex(idx: number) {
        try {
            const control = this.requestsarray.at(idx).get('populateArgs') as FormControl;
            const current = Array.isArray(control?.value) ? [...control.value] : [];
            const pm = this.requestsarray.at(idx).get('populateMethod')?.value;
            const defaults = this.getPopulateDefaults(pm) ?? ['idKey', 'parentIdKey', 'labelKey', 'treeArrayName', false, false];
            const result = [] as any[];
            for (let i = 0; i < defaults.length; i++) {
                if (i < current.length && current[i] !== undefined && current[i] !== null) result[i] = current[i];
                else result[i] = defaults[i];
            }
            control.setValue(result);
        } catch (e) { /* ignore */ }
    }

    // Helpers for requestsSelectionFields within a request FormGroup
    getRequestsSelectionFieldsArray(requestIndex: number): FormArray {
        try {
            return this.requestsarray.at(requestIndex).get('requestsSelectionFields') as FormArray;
        } catch (e) {
            return this.fb.array([]);
        }
    }

    addRequestsSelectionField(requestIndex: number, value: any = '') {
        try {
            const arr = this.getRequestsSelectionFieldsArray(requestIndex);
            arr.push(this.fb.control(value));
        } catch (e) { /* ignore */ }
    }

    removeRequestsSelectionField(requestIndex: number, idx: number) {
        try {
            const arr = this.getRequestsSelectionFieldsArray(requestIndex);
            if (idx >= 0 && idx < arr.length) arr.removeAt(idx);
        } catch (e) { /* ignore */ }
    }

    getRequestsSelectionFieldsControls(requestIndex: number) { return (this.getRequestsSelectionFieldsArray(requestIndex)).controls; }

    // Returns the default populate method from options (first option) or empty string
    getDefaultPopulateMethod(): string {
        return (this.populateMethodOptions && this.populateMethodOptions.length) ? this.populateMethodOptions[0].value : '';
    }

    // Returns the defaults array for a populate method if provided in options
    getPopulateDefaults(method?: string | null): any[] | undefined {
        if (!method) return undefined;
        const opt = (this.populateMethodOptions || []).find(o => o.value === method);
        return opt && Array.isArray(opt.defaults) ? opt.defaults : undefined;
    }

    isDefaultString(def: any): boolean { return typeof def === 'string'; }
    isDefaultBoolean(def: any): boolean { return typeof def === 'boolean'; }

    formatDefaultLabel(def: any): string {
        if (typeof def !== 'string') return '';
        // split camelCase, underscores, dashes and numbers, then Title Case
        let s = def.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
        s = s.replace(/[_-]+/g, ' ');
        s = s.replace(/([A-Za-z])([0-9])/g, '$1 $2');
        return s.split(/\s+/).filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }

    // Whether a given populate method should have populateArgs initialized
    requiresPopulateArgs(method?: string | null): boolean {
        const defs = this.getPopulateDefaults(method);
        return Array.isArray(defs) && defs.length > 0;
    }

    getPopulateArgValue(requestIndex: number, pos: number) {
        const control = this.requestsarray.at(requestIndex).get('populateArgs') as FormControl;
        const v = control?.value;
        return Array.isArray(v) && v.length > pos ? v[pos] : (pos >= 4 ? false : '');
    }

    setPopulateArgValue(requestIndex: number, pos: number, value: any) {
        const control = this.requestsarray.at(requestIndex).get('populateArgs') as FormControl;
        const v = Array.isArray(control?.value) ? [...control!.value] : [];
        v[pos] = value;
        control.setValue(v);
    }
    getArgsDisplay(index: number): string {
        try {
            const ctrl = this.requestsarray.at(index).get('args') as FormControl;
            const v = ctrl?.value;
            if (v == null) return '';
            return typeof v === 'string' ? v : JSON.stringify(v);
        } catch (e) { return ''; }
    }

    // Helper to determine if an arg position corresponds to a body parameter (used by template)
    isBodyArg(requestIndex: number, argIndex: number): boolean {
        try {
            const ph = this.publicationsArgsPlaceholders[requestIndex];
            if (ph && ph.length > 0) {
                const v = ph[argIndex];
                return typeof v === 'string' && v.toLowerCase().indexOf('(body)') >= 0;
            }
            // fallback: try to infer from the published method descriptor for this row
            const method = this.requestsarray && this.requestsarray.at(requestIndex) ? this.requestsarray.at(requestIndex).get('method')?.value : undefined;
            const desc = this.getMethodDescriptor(method);
            if (!desc || !Array.isArray(desc.params)) return false;
            const p = desc.params[argIndex];
            return !!(p && p.isBody);
        } catch (e) { return false; }
    }

    // Return method descriptor from publicationsApiMethods using tolerant matching
    private getMethodDescriptor(methodName: string | null | undefined) {
        try {
            if (!methodName) return undefined;
            const methods = this.publicationsApiMethods || [];
            // exact
            let d = methods.find(m => m.value === methodName);
            if (d) return d;
            const lower = String(methodName).toLowerCase();
            d = methods.find(m => typeof m.value === 'string' && m.value.split('.')?.[1] === methodName);
            if (d) return d;
            d = methods.find(m => typeof m.value === 'string' && m.value.split('.')?.[1]?.toLowerCase() === lower);
            if (d) return d;
            d = methods.find(m => typeof m.value === 'string' && m.value.toLowerCase().endsWith('.' + lower));
            if (d) return d;
            d = methods.find(m => typeof m.value === 'string' && m.value.toLowerCase() === lower);
            return d;
        } catch (e) { return undefined; }
    }

    // Format an arg value for display in single-line inputs: stringify objects
    formatArgValue(val: any): string {
        try {
            if (val === null || val === undefined) return '';
            if (typeof val === 'object') return JSON.stringify(val);
            return String(val);
        } catch (e) { return '' + val; }
    }

    isObjectArg(requestIndex: number, argIndex: number): boolean {
        try {
            const arr = this.getArgsArray(requestIndex);
            const v = arr && arr.length > argIndex ? arr[argIndex] : undefined;
            if (v === null || v === undefined) return false;
            if (typeof v === 'object') {
                if (Array.isArray(v)) {
                    return v.length > 0 && v[0] !== null && typeof v[0] === 'object' && !Array.isArray(v[0]);
                }
                return true;
            }
            return false;
        } catch (e) { return false; }
    }

    objectKeys(obj: any): string[] {
        try {
            if (obj == null) return [];
            if (Array.isArray(obj)) {
                const first = obj[0];
                return first && typeof first === 'object' ? Object.keys(first) : [];
            }
            return typeof obj === 'object' ? Object.keys(obj) : [];
        } catch (e) { return []; }
    }

    getBodyValue(requestIndex: number, argIndex: number, prop: string): any {
        try {
            const arr = this.getArgsArray(requestIndex);
            const v = arr && arr.length > argIndex ? arr[argIndex] : undefined;
            if (v == null) return '';
            if (Array.isArray(v)) {
                const first = v[0];
                // support dotted props
                if (!first) return '';
                if (prop.indexOf('.') >= 0) {
                    // prefer a flat dotted-key if present, otherwise traverse nested object
                    if (first && Object.prototype.hasOwnProperty.call(first, prop)) return first[prop];
                    return this.getNested(first, prop) ?? '';
                }
                return first && first.hasOwnProperty(prop) ? first[prop] : '';
            }
            if (prop.indexOf('.') >= 0) {
                if (v && Object.prototype.hasOwnProperty.call(v, prop)) return v[prop];
                return this.getNested(v, prop) ?? '';
            }
            return v && v.hasOwnProperty(prop) ? v[prop] : '';
        } catch (e) { return ''; }
    }

    setBodyProp(requestIndex: number, argIndex: number, prop: string, value: any) {
        try {
            const ctrl = this.requestsarray.at(requestIndex).get('args') as FormControl;
            const arr = Array.isArray(ctrl.value) ? [...ctrl.value] : [];
            const current = arr[argIndex];
            if (Array.isArray(current)) {
                const first = current[0] && typeof current[0] === 'object' ? { ...current[0] } : {};
                if (prop.indexOf('.') >= 0) {
                    this.setNested(first, prop, value);
                    // if a flat dotted-key existed, remove it to avoid duplication
                    if (Object.prototype.hasOwnProperty.call(first, prop)) delete first[prop];
                } else {
                    first[prop] = value;
                }
                const copy = [...current];
                copy[0] = first;
                arr[argIndex] = copy;
            } else {
                const obj = (current && typeof current === 'object') ? { ...current } : {};
                if (prop.indexOf('.') >= 0) {
                    this.setNested(obj, prop, value);
                    if (Object.prototype.hasOwnProperty.call(obj, prop)) delete obj[prop];
                } else {
                    obj[prop] = value;
                }
                arr[argIndex] = obj;
            }
            ctrl.setValue(arr);
        } catch (e) { /* ignore */ }
    }

    addBodyProp(requestIndex: number, argIndex: number) {
        try {
            const key = window.prompt('Property name');
            if (!key) return;
            this.setBodyProp(requestIndex, argIndex, key, '');
        } catch (e) { /* ignore */ }
    }

    removeBodyProp(requestIndex: number, argIndex: number, prop: string) {
        try {
            const ctrl = this.requestsarray.at(requestIndex).get('args') as FormControl;
            const arr = Array.isArray(ctrl.value) ? [...ctrl.value] : [];
            const current = arr[argIndex];
            if (Array.isArray(current)) {
                const first = current[0] && typeof current[0] === 'object' ? { ...current[0] } : {};
                if (prop.indexOf('.') >= 0) {
                    // if flat dotted-key exists, remove it; otherwise delete nested property
                    if (Object.prototype.hasOwnProperty.call(first, prop)) delete first[prop];
                    else {
                        try {
                            const parts = prop.split('.');
                            let cur = first;
                            for (let i = 0; i < parts.length - 1; i++) { if (!cur) break; cur = cur[parts[i]]; }
                            if (cur && cur.hasOwnProperty(parts[parts.length - 1])) delete cur[parts[parts.length - 1]];
                        } catch (e) { /* ignore */ }
                    }
                } else if (first && first.hasOwnProperty(prop)) delete first[prop];
                const copy = [...current];
                copy[0] = first;
                arr[argIndex] = copy;
            } else {
                const obj = (current && typeof current === 'object') ? { ...current } : {};
                if (prop.indexOf('.') >= 0) {
                    if (Object.prototype.hasOwnProperty.call(obj, prop)) delete obj[prop];
                    else {
                        try {
                            const parts = prop.split('.');
                            let cur = obj;
                            for (let i = 0; i < parts.length - 1; i++) { if (!cur) break; cur = cur[parts[i]]; }
                            if (cur && cur.hasOwnProperty(parts[parts.length - 1])) delete cur[parts[parts.length - 1]];
                        } catch (e) { /* ignore */ }
                    }
                } else if (obj && obj.hasOwnProperty(prop)) delete obj[prop];
                arr[argIndex] = obj;
            }
            ctrl.setValue(arr);
        } catch (e) { /* ignore */ }
    }

    tryParseBodyJson(requestIndex: number, argIndex: number) {
        try {
            const arr = this.getArgsArray(requestIndex);
            const text = arr && arr.length > argIndex ? arr[argIndex] : undefined;
            if (typeof text !== 'string') return;
            const parsed = JSON.parse(text);
            const ctrl = this.requestsarray.at(requestIndex).get('args') as FormControl;
            const newArr = Array.isArray(ctrl.value) ? [...ctrl.value] : [];

            // If an array of objects was provided, prefer the first object's shape
            let toSet: any = parsed;
            if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0] !== null) {
                toSet = parsed[0];
            }

            // If it's an object, ensure its properties are primitive/string for editable inputs
            const normalized: any = {};
            if (toSet && typeof toSet === 'object' && !Array.isArray(toSet)) {
                for (const k of Object.keys(toSet)) {
                    const v = toSet[k];
                    if (v === null || v === undefined) normalized[k] = '';
                    else normalized[k] = v; // preserve nested objects/arrays
                }
            }

            // preserve array wrapper if the original control had an array at this position
            const orig = ctrl.value && Array.isArray(ctrl.value) && Array.isArray(ctrl.value[argIndex]);
            if (orig) {
                const copy = Array.isArray(ctrl.value[argIndex]) ? [...ctrl.value[argIndex]] : [];
                copy[0] = normalized;
                newArr[argIndex] = copy;
            } else if (Array.isArray(parsed)) {
                // if parsed was an array of primitives/objects but original was not array, pick first
                newArr[argIndex] = normalized;
            } else {
                newArr[argIndex] = normalized;
            }

            ctrl.setValue(newArr);
        } catch (e) { this.msg.msgError('JSON parse error', String(e)); }
    }

    onArgsInput(e: Event, index: number) {
        const val = (e.target as HTMLInputElement).value;
        const arr = this.normalizeArgs(val);
        const ctrl = this.getArgsControlAt(index);
        if (ctrl) ctrl.setValue(arr);
    }

    // Helpers to edit args as a list in the template
    // (delegates to descriptive helpers defined later)

    // Generic array helpers for request-level array-like controls (descriptive names)
    private getRequestArrayControl(requestIndex: number, controlName: string): any {
        try { return this.requestsarray.at(requestIndex).get(controlName); } catch (e) { return null; }
    }

    getRequestArrayValues(requestIndex: number, controlName: string): any[] {
        try {
            const ctrl = this.getRequestArrayControl(requestIndex, controlName);
            if (!ctrl) return [];
            if (ctrl instanceof FormArray) return ctrl.controls.map(c => c.value);
            const v = ctrl.value;
            return Array.isArray(v) ? v : this.normalizeArgs(v);
        } catch (e) { return []; }
    }

    setRequestArrayValue(requestIndex: number, controlName: string, pos: number, value: any) {
        try {
            const ctrl = this.getRequestArrayControl(requestIndex, controlName);
            if (!ctrl) return;
            if (ctrl instanceof FormArray) {
                if (pos < ctrl.length) {
                    ctrl.at(pos).setValue(value);
                } else {
                    ctrl.push(this.fb.control(value));
                }
                return;
            }
            const current = Array.isArray(ctrl.value) ? [...ctrl.value] : [];
            let parsed: any = value;
            if (value === 'true') parsed = true;
            else if (value === 'false') parsed = false;
            else if (typeof value === 'string') {
                const num = Number(value);
                if (!isNaN(num) && value.trim() !== '') parsed = num;
            }
            current[pos] = parsed;
            ctrl.setValue(current);
        } catch (e) { /* ignore */ }
    }

    addRequestArrayItem(requestIndex: number, controlName: string, value: any = '') {
        try {
            const ctrl = this.getRequestArrayControl(requestIndex, controlName);
            if (!ctrl) return;
            if (ctrl instanceof FormArray) { ctrl.push(this.fb.control(value)); return; }
            const current = Array.isArray(ctrl.value) ? [...ctrl.value] : [];
            current.push(value);
            ctrl.setValue(current);
        } catch (e) { /* ignore */ }
    }

    removeRequestArrayItem(requestIndex: number, controlName: string, pos: number) {
        try {
            const ctrl = this.getRequestArrayControl(requestIndex, controlName);
            if (!ctrl) return;
            if (ctrl instanceof FormArray) { if (pos >= 0 && pos < ctrl.length) ctrl.removeAt(pos); return; }
            const current = Array.isArray(ctrl.value) ? [...ctrl.value] : [];
            if (pos >= 0 && pos < current.length) { current.splice(pos, 1); ctrl.setValue(current); }
        } catch (e) { /* ignore */ }
    }

    // Backwards-compatible arg helpers delegating to descriptive generic helpers
    getArgsControlAt(index: number): FormControl { return this.requestsarray.at(index).get('args') as FormControl; }
    getArgsArray(index: number): any[] { return this.getRequestArrayValues(index, 'args'); }
    setArgValue(requestIndex: number, pos: number, value: any) { this.setRequestArrayValue(requestIndex, 'args', pos, value); }
    addArg(requestIndex: number) { this.addRequestArrayItem(requestIndex, 'args', ''); }
    removeArg(requestIndex: number, pos: number) { this.removeRequestArrayItem(requestIndex, 'args', pos); }

    // Normalize various forms of `args` into an array for saving/export
    private normalizeArgs(val: any): any[] {
        if (Array.isArray(val)) return val;
        if (val == null) return [];
        if (typeof val === 'string') {
            const s = val.trim();
            if (!s) return [];
            try {
                const parsed = JSON.parse(s);
                if (Array.isArray(parsed)) return parsed;
            } catch (e) { /* not JSON */ }
            return s.split(',').map(p => {
                const t = p.trim();
                const n = Number(t);
                return t === '' ? null : (!isNaN(n) ? n : t);
            }).filter(x => x !== null && x !== undefined);
        }
        return [val];
    }

    // Additional helpers/getters
    get pageSizesControl(): FormControl { return this.form.get('pageSizes') as FormControl; }
    get globalFilterFieldsControl(): FormControl { return this.form.get('globalFilterFields') as FormControl; }
    get listRequestModelGroup(): FormGroup { return this.form.get('listRequestModel') as FormGroup; }
    get deadStatusControl(): FormControl { return this.form.get('deadStatus') as FormControl; }

    isSelected(controlName: string, value: any): boolean {
        try {
            const v = (this.form.get(controlName) as FormControl)?.value;
            return Array.isArray(v) && v.indexOf(value) >= 0;
        } catch (e) { return false; }
    }

    onToggle(controlName: string, value: any, e: Event) {
        const checked = (e.target as HTMLInputElement).checked;
        const control = this.form.get(controlName) as FormControl;
        const current = Array.isArray(control?.value) ? [...control.value] : [];
        if (checked) {
            if (!current.includes(value)) current.push(value);
        } else {
            for (let i = current.length - 1; i >= 0; i--) {
                if (current[i] === value) current.splice(i, 1);
            }
        }
        if (controlName === 'pageSizes') current.sort((a: number, b: number) => Number(a) - Number(b));
        control.setValue(current);
    }

    // Template-friendly FormArray controls getters to satisfy the Angular template type checker
    get requestsarrayControls() { return (this.form.get('requestsarray') as FormArray).controls; }
    get tkCategoryCdsControls() { return (this.form.get('tkCategoryCds') as FormArray).controls; }

    onPageSizesChange(e: Event) {
        const v = (e.target as HTMLInputElement)?.value;
        if (!v) { this.pageSizesControl.setValue([]); return; }
        const arr = v.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n));
        this.pageSizesControl.setValue(arr);
    }

    onGlobalFilterFieldsChange(e: Event) {
        const v = (e.target as HTMLInputElement)?.value;
        if (!v) { this.globalFilterFieldsControl.setValue([]); return; }
        const arr = v.split(',').map(s => s.trim()).filter(s => s.length > 0);
        this.globalFilterFieldsControl.setValue(arr);
    }

    

    onDeadStatusChange(e: Event) {
        const v = (e.target as HTMLInputElement)?.value;
        if (!v) { this.deadStatusControl.setValue([]); return; }
        const arr = v.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n));
        this.deadStatusControl.setValue(arr);
    }

    toggleRow(key: string) { if (this.expandedRows.has(key)) this.expandedRows.delete(key); else this.expandedRows.add(key); }

    finishSave() {
        this.showDrawer = false;
        this.load();
    }

    remove(cfg: ComponentConfig) {
        this.msg.msgConfirm('<h4>Delete this config</h4>', 'Confirm').then(confirmed => {
            if (!confirmed) return;
            this.svc.delete(cfg.routeKey).subscribe(() => {
                this.load();
                this.msg.msgConfirm('<h4>Also push changes to disk (writes src/assets/component-configs.json)?</h4>', 'Confirm').then(confirmed => {
                    if (!confirmed) return;
                    this.svc.getAll().subscribe(items => {
                        this.svc.exportToServer(items as ComponentConfig[]).subscribe(() => this.msg.msgSuccess('Saved to disk.'), () => alert('Failed to save to disk'));
                    });
                });
            });
        });
    }
}
