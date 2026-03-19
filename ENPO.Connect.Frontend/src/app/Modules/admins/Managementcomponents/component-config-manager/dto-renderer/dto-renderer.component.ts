import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
    selector: 'app-dto-renderer',
    templateUrl: './dto-renderer.component.html',
    styleUrls: ['../ccm-shared.scss']
})
export class DtoRendererComponent {
    @Input() value: any;
    @Output() valueChange = new EventEmitter<any>();

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

    isObject(v: any): boolean { return v && typeof v === 'object' && !Array.isArray(v); }

    // Called when a primitive property input changes
    onPropChange(key: string, raw: any) {
        try {
            const parsed = this.parseValue(raw);
            if (Array.isArray(this.value)) {
                this.value[0] = this.value[0] && typeof this.value[0] === 'object' ? this.value[0] : {};
                (this.value[0] as any)[key] = parsed;
                this.emitValue();
            } else {
                this.value = this.value || {};
                (this.value as any)[key] = parsed;
                this.valueChange.emit(this.value);
            }
        } catch (e) { /* ignore */ }
    }

    // Called when a nested object changes
    onNestedChange(key: string, newObj: any) {
        try {
            if (Array.isArray(this.value)) {
                this.value[0] = this.value[0] && typeof this.value[0] === 'object' ? this.value[0] : {};
                (this.value[0] as any)[key] = newObj;
                this.emitValue();
            } else {
                this.value = this.value || {};
                (this.value as any)[key] = newObj;
                this.valueChange.emit(this.value);
            }
        } catch (e) { /* ignore */ }
    }

    // Update when editing the first element of an array-of-objects
    onArrayFirstChanged(newFirst: any) {
        try {
            this.value = Array.isArray(this.value) ? this.value : [];
            (this.value as any)[0] = newFirst;
            this.emitValue();
        } catch (e) { /* ignore */ }
    }

    // Handle editing arrays of primitives from a comma-separated input
    onArrayInput(event: Event): void {
        try {
            const raw = (event.target as HTMLInputElement).value;
            if (raw === '') {
                this.value = [];
                this.valueChange.emit(this.value);
                return;
            }
            const items = raw
                .split(',')
                .map(s => s.trim())
                .filter(s => s !== '')
                .map(s => this.parseValue(s));
            this.value = items;
            this.emitValue();
        } catch (e) { /* ignore */ }
    }

    // Append a new element to the current array value (deep clone or sensible default)
    addArrayElement() {
        try {
            if (!Array.isArray(this.value)) {
                this.value = [];
            }
            const first = (this.value as any)[0];
            let newElem: any;
            if (first === undefined) {
                newElem = {};
            } else if (typeof first === 'object') {
                newElem = JSON.parse(JSON.stringify(first));
            } else if (typeof first === 'string') {
                newElem = '';
            } else if (typeof first === 'number') {
                newElem = 0;
            } else if (typeof first === 'boolean') {
                newElem = false;
            } else {
                newElem = null;
            }
            (this.value as any).push(newElem);
            this.emitValue();
        } catch (e) { /* ignore */ }
    }


    addProperty(originalKey?: string) {
        try {
            const baseDefault = 'k';
            const copy = Array.isArray(this.value) ? JSON.parse(JSON.stringify(this.value)) : { ...this.value };
            const ensureUniqueKey = (obj: any, base: string) => {
                let k = base;
                let i = 1;
                while (obj && Object.prototype.hasOwnProperty.call(obj, k)) {
                    k = base + i;
                    i++;
                }
                return k;
            };

            if (originalKey) {
                // Duplicate an existing property under a unique name
                if (Array.isArray(copy)) {
                    const first = copy[0] && typeof copy[0] === 'object' ? { ...copy[0] } : {};
                    if (!Object.prototype.hasOwnProperty.call(first, originalKey)) return;
                    const source = first[originalKey];
                    const uniqueKey = ensureUniqueKey(first, originalKey);
                    // deep clone source if object/array
                    // operate on this.value directly
                    this.value = Array.isArray(this.value) ? this.value : [first];
                    (this.value[0] as any)[uniqueKey] = typeof source === 'object' ? JSON.parse(JSON.stringify(source)) : source;
                    this.emitValue();
                } else {
                    if (!Object.prototype.hasOwnProperty.call(copy, originalKey)) return;
                    const source = (copy as any)[originalKey];
                    const uniqueKey = ensureUniqueKey(copy, originalKey);
                    this.value = this.value || {};
                    (this.value as any)[uniqueKey] = typeof source === 'object' ? JSON.parse(JSON.stringify(source)) : source;
                    this.emitValue();
                }
                return;
            }

            // No originalKey: if value is an array, append a deep-cloned element;
            // otherwise add a cloned object under a new unique key.
            const baseKey = baseDefault;
            if (Array.isArray(this.value)) {
                const first = (this.value as any)[0] && typeof (this.value as any)[0] === 'object' ? (this.value as any)[0] : {};
                const cloned = JSON.parse(JSON.stringify(first));
                (this.value as any).push(cloned);
                this.emitValue();
            } else {
                this.value = this.value || {};
                const uniqueKey = ensureUniqueKey(this.value, baseKey);
                const source = { ...(this.value as any) };
                (this.value as any)[uniqueKey] = JSON.parse(JSON.stringify(source));
                this.emitValue();
            }
        } catch (e) { /* ignore */ }
    }

    removeProperty(key: string) {
        try {
            if (Array.isArray(this.value)) {
                this.value[0] = this.value[0] && typeof this.value[0] === 'object' ? this.value[0] : {};
                if (Object.prototype.hasOwnProperty.call(this.value[0], key)) delete (this.value[0] as any)[key];
                this.emitValue();
            } else {
                this.value = this.value || {};
                if (Object.prototype.hasOwnProperty.call(this.value, key)) delete (this.value as any)[key];
                this.emitValue();
            }
        } catch (e) { /* ignore */ }
    }

    parseValue(raw: any) {
        if (raw === null || raw === undefined) return '';
        if (typeof raw !== 'string') return raw;
        const s = raw.trim();
        if (s === '') return '';
        if (s === 'true') return true;
        if (s === 'false') return false;
        const n = Number(s);
        if (!isNaN(n) && s === String(n)) return n;
        try {
            const p = JSON.parse(s);
            return p;
        } catch (e) { return s; }
    }

    // Ensure we emit a new reference so Angular change-detection updates the DOM
    private emitValue() {
        try {
            const out = JSON.parse(JSON.stringify(this.value));
            this.value = out;
            this.valueChange.emit(out);
        } catch (e) {
            this.valueChange.emit(this.value);
        }
    }
}
