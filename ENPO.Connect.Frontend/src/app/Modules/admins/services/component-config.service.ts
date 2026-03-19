import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { ComponentConfig, defaultAdminCerAreaConfigs, defaultModel, defaultGlobalFilterFields } from 'src/app/shared/models/Component.Config.model';

@Injectable({ providedIn: 'root' })
export class ComponentConfigService {
  private readonly saveServerUrl = 'http://localhost:3001/save-configs';
  // In-memory cache of configs loaded from assets or last saved state.
  private cachedConfigs: ComponentConfig[] = [];

  constructor(private http: HttpClient) { }

  /**
   * Export items to the dev save server (writes asset JSON).
   * Caller should confirm before invoking.
   */
  exportToServer(items: ComponentConfig[]): Observable<void> {
    if (typeof window === 'undefined' || !window.location || window.location.hostname !== 'localhost') {
      return of(undefined);
    }
    const sanitized = this.sanitizeForExport(items || []);
    return this.http.post<void>(this.saveServerUrl, { configs: sanitized });
  }
  private sanitizeForExport(items: ComponentConfig[]): ComponentConfig[] {
    try {
      return (items || []).map(cfg => {
        const copy: any = JSON.parse(JSON.stringify(cfg));
        if (Array.isArray(copy.requestsarray)) {
          copy.requestsarray = copy.requestsarray.map((r: any) => {
            try {
              if (r && typeof r.method === 'string' && r.method === 'publicationsController.getDocumentsList_user') {
                const a = Array.isArray(r.args) ? r.args : (r.args === undefined || r.args === null ? [] : [r.args]);
                if (a.length >= 3) {
                  const third = a[2];
                  if (third && typeof third === 'object' && !Array.isArray(third)) {
                    if (Object.keys(third).length === 0) {
                      a[2] = [];
                    } else {
                      a[2] = [third];
                    }
                  }
                }
                r.args = a;
              }
            } catch (e) { /* ignore per-request errors */ }
            return r;
          });
        }
        return copy as ComponentConfig;
      });
    } catch (e) {
      return items;
    }
  }

  getAll(): Observable<ComponentConfig[]> {
    // If cache is primed return it immediately.
    if (this.cachedConfigs && this.cachedConfigs.length > 0) {
      // Return a deep copy so components modify their own instance, not the shared cache
      const deepCopied = JSON.parse(JSON.stringify(this.cachedConfigs));
      return of(deepCopied.map((c: any) => this.ensureDefaults(new ComponentConfig(c))));
    }

    // Otherwise attempt to load from the bundled asset now and return that.
    return this.http.get<ComponentConfig[]>('assets/component-configs.json').pipe(
      map(arr => {
        const normalized = (arr && Array.isArray(arr) && arr.length > 0)
          ? (arr as any[]).map(a => this.ensureDefaults(new ComponentConfig(a as any)))
          : (defaultAdminCerAreaConfigs || []).map(c => this.ensureDefaults(new ComponentConfig(c as any)));
        this.cachedConfigs = normalized.slice();
        // Return a deep copy
        const deepCopied = JSON.parse(JSON.stringify(normalized));
        return deepCopied;
      }),
      catchError(() => of((defaultAdminCerAreaConfigs || []).map(c => this.ensureDefaults(new ComponentConfig(c as any)))))
    );
  }

  add(cfg: ComponentConfig): Observable<void> {
    const toSave = this.ensureDefaults(cfg);
    this.cachedConfigs = this.cachedConfigs || [];
    this.cachedConfigs.push(toSave);
    return of(undefined);
  }

  update(cfg: ComponentConfig): Observable<void> {
    const toSave = this.ensureDefaults(cfg);
    this.cachedConfigs = this.cachedConfigs || [];
    const idx = this.cachedConfigs.findIndex(i => i.routeKey === toSave.routeKey);
    if (idx >= 0) this.cachedConfigs[idx] = toSave;
    else this.cachedConfigs.push(toSave);
    return of(undefined);
  }

  private ensureDefaults(cfg?: ComponentConfig): ComponentConfig {
    const result = new ComponentConfig(cfg as any);
    if (!result.listRequestModel) result.listRequestModel = JSON.parse(JSON.stringify(defaultModel));
    // Preserve explicit empty arrays for `globalFilterFields` and `pageSizes`.
    // If the property is missing or not an array, normalize to an empty array.
    if (!Array.isArray(result.globalFilterFields)) result.globalFilterFields = [];
    if (result.isNew === undefined || result.isNew === null) result.isNew = false;
    if (!result.userConfiguration) result.userConfiguration = { currentUser: '', currentUserName: '', userGroup: '' };
    if (!result.fieldsConfiguration) result.fieldsConfiguration = { isDivDisabled: false, dateFormat: 'yy/mm/dd', showTime: false, timeOnly: false, maxDate: new Date(), useDefaultRadioView: false, isNotRequired: false };
    if (!Array.isArray(result.requestsarray)) result.requestsarray = [];
    if (result.allowStatusChange === undefined || result.allowStatusChange === null) result.allowStatusChange = true;
    if (result.allowDefaultNextResponsibleSectorID === undefined || result.allowDefaultNextResponsibleSectorID === null) result.allowDefaultNextResponsibleSectorID = true;
    if (!Array.isArray((result as any).statusChangeOptions)) (result as any).statusChangeOptions = [];
    if (!Array.isArray(result.deadStatus)) result.deadStatus = [];
    if (result.totalRecords === undefined || result.totalRecords === null) result.totalRecords = 0;
    if (!Array.isArray(result.pageSizes)) result.pageSizes = [];
    if (!Array.isArray(result.tableColumns)) result.tableColumns = [];
    if (!Array.isArray((result as any).tableFields)) (result as any).tableFields = [];
    if (!Array.isArray(result.tkCategoryCds) || result.tkCategoryCds.length === 0) result.tkCategoryCds = [{ key: 102, value: 'بريدية' }, { key: 103, value: 'حكومية' }, { key: 104, value: 'مالية' }, { key: 124, value: 'التظلمات' }];
    if (result.showFormSignature === undefined || result.showFormSignature === null) result.showFormSignature = false;
    if (result.submitButtonText === undefined || result.submitButtonText === null) result.submitButtonText = 'Submit';
    // Ensure unitId is array (migration safety)
    if (result.unitId !== undefined && result.unitId !== null && !Array.isArray(result.unitId)) {
      result.unitId = [result.unitId as any];
    } else if (!Array.isArray(result.unitId)) {
        result.unitId = [];
    }
    return result;
  }

  delete(routeKey: string): Observable<void> {
    this.cachedConfigs = (this.cachedConfigs || []).filter(i => i.routeKey !== routeKey);
    return of(undefined);
  }
}
