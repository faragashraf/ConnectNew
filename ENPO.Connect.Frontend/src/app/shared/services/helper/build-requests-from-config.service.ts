import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map as rxMap } from 'rxjs/operators';
import * as ConfigModel from '../../models/Component.Config.model';

@Injectable({ providedIn: 'root' })
export class BuildRequestsFromConfigService {
  constructor() { }

  buildRequestsFromConfig(arr: any[] | undefined, context: any): Observable<any>[] {
    const out: Observable<any>[] = [];
    if (!Array.isArray(arr)) return out;
    // Normalize any arrName -> arrValue references up-front so downstream
    // resolution logic can rely on item.arrValue being available when possible.
    try {
      (arr || []).forEach(item => normalizeArrOnContext(item, context));
    } catch (e) { /* swallow */ }
    arr.forEach(item => {
      try {
        if (item == null) {
          out.push(of(null));
          return;
        }

        // If already an Observable
        if (typeof (item as any).subscribe === 'function') {
          out.push(item as Observable<any>);
          return;
        }

        // If item is a function, call it (bind to context) and wrap result
        if (typeof item === 'function') {
          const res = item.call(context);
          if (res && typeof res.subscribe === 'function') {
            out.push(res as Observable<any>);
          } else {
            out.push(of(res));
          }
          return;
        }

        // If item is an object descriptor with method + args
        if (typeof item === 'object' && item.method) {
          let args = Array.isArray(item.args) ? item.args : [];
          // Resolve any args that reference the local context via a `this` prefix
          try {
            // Deep-resolve any string tokens that reference the local context (e.g. 'this.config.genericFormName')
            args = this.resolveDeep(args, context);
          } catch (e) { /* swallow */ }
          const obs = this.invokeMethodString(String(item.method), args, context, item);
          if (obs) {
            const wrapped = obs.pipe(rxMap((resp: any) => {
                try {
                let resolvedArr: any = undefined;
                // Prefer runtime arrValue if already present
                if (Array.isArray(item.arrValue)) {
                  resolvedArr = item.arrValue;
                } else if (typeof item.arrName === 'string' && String(item.arrName).trim().length > 0) {
                  const p = String(item.arrName).trim();
                  const path = p.startsWith('this.') ? p.substring(5) : p;
                  const parts = path.split('.');
                  let cur: any = context;
                  for (const part of parts) {
                    if (cur == null || !(part in cur)) { cur = undefined; break; }
                    cur = cur[part];
                  }
                  if (cur !== undefined) resolvedArr = cur;
                } else if (typeof item.arrName === 'function') {
                  try { resolvedArr = item.arrName.call(context); } catch { resolvedArr = undefined; }
                }

                if (!Array.isArray(resolvedArr)) {
                  // prefer normalized response shape when available
                  if (resp && resp.isSuccess && resp.data !== undefined) resolvedArr = resp.data;
                  else if (resp !== undefined) resolvedArr = resp;
                  else resolvedArr = [];
                }
                // store runtime reference
                item.arrValue = resolvedArr;
              } catch (e) {
                // swallow resolution errors and leave item.arrValue as-is
              }
              return resp;
            }));
            out.push(wrapped);
          } else {
            out.push(of(null));
          }
          return;
        }

        // If item defines a pre-provided array (`arrValue`/`arrName`/legacy arr), resolve it from context (string path) or call it (function)
        if (typeof item === 'object' && (item.arrValue !== undefined || item.arrName !== undefined)) {
          try {
            let resolvedArr: any = undefined;
            if (Array.isArray(item.arrValue)) resolvedArr = item.arrValue;
            else if (typeof item.arrName === 'string') {
              const v = this.resolvePathOnContext(item.arrName as string, context);
              if (v !== undefined) resolvedArr = v;
            } else if (typeof item.arrName === 'function') {
              try { resolvedArr = item.arrName.call(context); } catch { resolvedArr = undefined; }
            }
            if (!Array.isArray(resolvedArr)) resolvedArr = [];
            item.arrValue = resolvedArr;
            
            out.push(of({ isSuccess: true, data: resolvedArr }));
          } catch (e) {
            out.push(of({ isSuccess: false, data: null }));
          }
          return;
        }

        // If item is an object descriptor that only defines a populateMethod (no remote method),
        // create a resolved observable that will carry the data to the populate invoker.
        if (typeof item === 'object' && !item.method && item.populateMethod) {
          const providedArgs = Array.isArray(item.populateArgs) ? item.populateArgs : [];
          const resolvedArgs = providedArgs.map((a:any) => (typeof a === 'string' ? this.resolvePathOnContext(a, context) : a));
          const data = resolvedArgs.length === 1 ? resolvedArgs[0] : resolvedArgs;
          out.push(of({ isSuccess: true, data }));
          return;
        }

        // If item is a string, try to parse method and args
        if (typeof item === 'string') {
          const trimmed = item.trim();
          const match = trimmed.match(/^(.+?)\s*\((.*)\)\s*$/);
          let methodStr = trimmed;
          let argsArr: any[] = [];
          if (match) {
            methodStr = match[1];
            argsArr = this.parseArgs(match[2], context);
          }
          const obs = this.invokeMethodString(methodStr, argsArr, context, undefined);
          out.push(obs ?? of(null));
          return;
        }

        // Fallback: null observable
        out.push(of(null));
      } catch (e) {
        out.push(of(null));
      }
    });

    return out;
  }

  private parseArgs(argsStr: string, context: any): any[] {
    const out: any[] = [];
    if (!argsStr || !argsStr.length) return out;
    let cur = '';
    let inSingle = false;
    let inDouble = false;
    for (let i = 0; i < argsStr.length; i++) {
      const ch = argsStr[i];
      if (ch === "'" && !inDouble) { inSingle = !inSingle; cur += ch; continue; }
      if (ch === '"' && !inSingle) { inDouble = !inDouble; cur += ch; continue; }
      if (ch === ',' && !inSingle && !inDouble) {
        out.push(this.parseArgToken(cur.trim(), context));
        cur = '';
      } else {
        cur += ch;
      }
    }
    if (cur.trim().length) out.push(this.parseArgToken(cur.trim(), context));
    return out;
  }

  private parseArgToken(token: string, context: any): any {
    if (token === '') return null;
    if ((token.startsWith("'") && token.endsWith("'")) || (token.startsWith('"') && token.endsWith('"'))) {
      return token.substring(1, token.length - 1);
    }
    if (token === 'true') return true;
    if (token === 'false') return false;
    if (!isNaN(Number(token))) return Number(token);
    const resolved = this.resolvePathOnContext(token, context);
    if (resolved !== undefined) return resolved;
    return token;
  }

  private resolvePathOnContext(pathStr: string, context: any): any {
    let p = pathStr.trim();
    if (p.startsWith('this.')) p = p.substring(5);
    const parts = p.split('.');
    let cur: any = context;
    for (const part of parts) {
      if (cur == null) return undefined;
      if (!(part in cur)) return undefined;
      cur = cur[part];
    }
    return cur;
  }

  private resolveDeep(value: any, context: any): any {
    if (value === null || value === undefined) return value;
    // Resolve strings that reference context
    if (typeof value === 'string' && value.trim().startsWith('this')) {
      const resolved = this.resolvePathOnContext(value, context);
      return resolved !== undefined ? resolved : value;
    }
    // Recurse into arrays
    if (Array.isArray(value)) {
      return value.map(v => this.resolveDeep(v, context));
    }
    // Recurse into plain objects
    if (typeof value === 'object') {
      const out: any = {};
      Object.keys(value).forEach(k => {
        out[k] = this.resolveDeep(value[k], context);
      });
      return out;
    }
    return value;
  }

  private invokeMethodString(methodPath: string, args: any[], context: any, item?: any): Observable<any> | null {
    if (!methodPath || !methodPath.length) return null;
    let path = methodPath.trim();
    if (path.startsWith('this.')) path = path.substring(5);
    const parts = path.split('.');
    let owner: any = context;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (owner == null) return null;
      if (!(p in owner)) return null;
      owner = owner[p];
    }
    const methodName = parts[parts.length - 1];
    if (!owner) return null;
    const fn = owner[methodName];
    if (typeof fn !== 'function') return null;
    try {
      // Heuristic: if caller passed a single object where the remote method commonly
      // expects an array (e.g. publications "GetDocumentsList_*" methods), wrap
      // that object into an array to make config authoring tolerant.
      try {
        const normalizedMethodPath = methodPath.toString().toLowerCase();
        if (Array.isArray(args) && args.length > 0) {
          let lastArg = args[args.length - 1];
          // Give precedence to explicit flag on config item
          const explicitWrap = item && Object.prototype.hasOwnProperty.call(item, 'wrapBodyAsArray') ? !!item.wrapBodyAsArray : undefined;

          if (lastArg && typeof lastArg === 'object' && !Array.isArray(lastArg)) {
            const shouldNormalize = explicitWrap !== undefined ? explicitWrap : (normalizedMethodPath.includes('getdocumentslist') || normalizedMethodPath.includes('getdocuments'));
            if (shouldNormalize) {
              // avoid mutating original array passed by caller
              args = args.slice();

              // Case A: already ExpressionDto-like
              if ('PropertyName' in lastArg) {
                args[args.length - 1] = [lastArg];
              } else {
                // Case B: key/value map -> convert each key into ExpressionDto
                const exprs: any[] = [];
                Object.keys(lastArg).forEach(k => {
                  const v = (lastArg as any)[k];
                  const expr: any = { PropertyName: k };
                  if (v === null || v === undefined) {
                  } else if (typeof v === 'number') {
                    expr.PropertyIntValue = v;
                  } else if (typeof v === 'boolean') {
                    // map booleans to integer flags (1/0)
                    expr.PropertyIntValue = v ? 1 : 0;
                  } else if (v instanceof Date) {
                    expr.PropertyDateValue = v;
                  } else if (typeof v === 'string') {
                    // detect ISO-like date strings and convert to Date
                    const isoDateRegex = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?$/;
                    if (isoDateRegex.test(v)) {
                      const d = new Date(v);
                      if (!isNaN(d.getTime())) {
                        expr.PropertyDateValue = d;
                      } else {
                        expr.PropertyStringValue = v;
                      }
                    } else {
                      expr.PropertyStringValue = v;
                    }
                  } else {
                    expr.PropertyStringValue = String(v);
                  }
                  exprs.push(expr);
                });
                args[args.length - 1] = exprs;
              }
            }
          }
        }
      } catch (e) {
        // swallow normalization errors and proceed with original args
      }

      const res = fn.apply(owner, args);
      if (res && typeof res.subscribe === 'function') return res as Observable<any>;
      return of(res);
    } catch (e) {
      return of(null);
    }
  }

  getPopulateInvoker(item: any, context: any): ((respData: any, defaultArgs?: any[]) => void) | null {
    if (!item || !item.populateMethod) return null;
    const methodNameRaw: string = String(item.populateMethod);
    const providedArgs: any[] | undefined = Array.isArray(item.populateArgs) ? item.populateArgs : undefined;

    const resolveArg = (arg: any) => {
      if (typeof arg === 'string') {
        const resolved = this.resolvePathOnContext(arg, context);
        if (resolved !== undefined) return resolved;
        if (arg.startsWith('this.')) {
          const path = arg.substring(5);
          const parts = path.split('.');
          let parent: any = context;
          for (let i = 0; i < parts.length - 1; i++) {
            const p = parts[i];
            if (!(p in parent) || parent[p] === undefined) parent[p] = {};
            parent = parent[p];
          }
          const last = parts[parts.length - 1];
          if (!(last in parent) || parent[last] === undefined) parent[last] = [];
          return parent[last];
        }
      }
      return arg;
    };

    return (respData: any, defaultArgs?: any[]) => {
      const argsSource = providedArgs && providedArgs.length > 0 ? providedArgs : (defaultArgs || []);
      const resolved = argsSource.map(a => resolveArg(a));
      const finalArgs = [respData, ...resolved];

      try {
        // Normalize method path (allow 'this.foo' or 'foo.bar')
        let methodPath = methodNameRaw.trim();
        if (methodPath.startsWith('this.')) methodPath = methodPath.substring(5);
        const parts = methodPath.split('.').filter(p => p);

        // Try to resolve as a method on the provided context (supports dotted paths)
        if (parts.length > 0 && context) {
          let owner: any = context;
          for (let i = 0; i < parts.length - 1; i++) {
            if (owner == null) { owner = null; break; }
            owner = owner[parts[i]];
          }
          const last = parts[parts.length - 1];
          if (owner && typeof owner[last] === 'function') {
            try { owner[last].apply(owner, finalArgs); return; } catch (e) { console.warn(`Invoker: calling ${methodPath} on context failed`, e); }
          }
        }

        // Try to call an exported helper from Component.Config.model by name (fallback)
        const exportedName = methodNameRaw.replace(/^this\./, '');
        const exportedFn = (ConfigModel as any)[exportedName];
        if (typeof exportedFn === 'function') {
          try {
            // Special-case: when calling populateTreeGeneric, ensure the tree array
            // argument is an actual array reference on the context. Configs sometimes
            // pass a bare string (e.g. 'unitTree') which would otherwise be forwarded
            // to the helper and cause `length` assignment errors.
            if (exportedName === 'populateTreeGeneric' && finalArgs && finalArgs.length > 4) {
              const treeArg = finalArgs[4];
              if (typeof treeArg === 'string') {
                let path = treeArg;
                if (path.startsWith('this.')) path = path.substring(5);
                // Resolve on context, create array if missing
                const parts = path.split('.');
                let parent: any = context;
                for (let i = 0; i < parts.length - 1; i++) {
                  const p = parts[i];
                  if (parent[p] === undefined || parent[p] === null) parent[p] = {};
                  parent = parent[p];
                }
                const last = parts[parts.length - 1];
                if (!Array.isArray(parent[last])) parent[last] = [];
                finalArgs[4] = parent[last];
              }
            }

            exportedFn(...finalArgs);
          } catch (e) { console.warn(`Invoker: calling exported ${methodNameRaw} failed`, e); }
          return;
        }

        // Try global/window as last resort
        const fn = (window as any)[methodNameRaw.replace(/^this\./, '')];
        if (typeof fn === 'function') { try { fn(...finalArgs); } catch (e) { console.warn(`Invoker: calling ${methodNameRaw} on window failed`, e); } return; }
      } catch (e) {
        // swallow errors from invoker
      }
    };
  }
}


function normalizeArrOnContext(item: any, context: any): void {
  try {
    if (!item) return;
    // Determine source name (arrName only — legacy `arr` removed)
    const nameSource = typeof item.arrName === 'string' ? item.arrName : undefined;
    if (!nameSource) return;
    const p = String(nameSource).trim();
    const path = p.startsWith('this.') ? p.substring(5) : p;
    const parts = path.split('.');
    let parent: any = context;
    for (let i = 0; i < parts.length - 1; i++) {
      const k = parts[i];
      if (parent[k] === undefined || parent[k] === null) parent[k] = {};
      parent = parent[k];
    }
    const last = parts[parts.length - 1];
    if (!Array.isArray(parent[last])) parent[last] = [];
    // set runtime reference
    item.arrValue = parent[last];
  } catch (e) { /* swallow */ }
}
