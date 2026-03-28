import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { CdmendDto } from '../BackendServices/DynamicForm/DynamicForm.dto';
import { DynamicFormController } from '../BackendServices/DynamicForm/DynamicForm.service';

export interface DynamicMendJsonResult<T> {
  isSuccess: boolean;
  data: T | null;
  errors: string[];
}

@Injectable({ providedIn: 'root' })
export class DynamicMetadataService {
  constructor(private readonly dynamicFormController: DynamicFormController) { }

  getMendJson<T>(applicationId: string, mendField: string): Observable<DynamicMendJsonResult<T>> {
    const appId = String(applicationId ?? '').trim();
    const mendKey = String(mendField ?? '').trim();

    if (!appId || !mendKey) {
      return of({
        isSuccess: false,
        data: null,
        errors: ['بيانات الطلب غير مكتملة: يلزم تحديد ApplicationID واسم الحقل.']
      });
    }

    return this.dynamicFormController.getMandatoryMetaDate(appId).pipe(
      switchMap(response => {
        const fromScoped = this.resolveFromRows<T>(Array.isArray(response?.data) ? response.data : [], mendKey);
        if (fromScoped) {
          return of(fromScoped);
        }

        // Fallback عام: ابحث عن نفس الحقل في كل ApplicationIDs
        return this.dynamicFormController.getMandatoryMetaDate(undefined).pipe(
          map(allResponse => {
            const fromGlobal = this.resolveFromRows<T>(Array.isArray(allResponse?.data) ? allResponse.data : [], mendKey);
            if (fromGlobal) {
              return fromGlobal;
            }

            return {
              isSuccess: false,
              data: null,
              errors: [`لا يوجد تعريف للحقل ${mendKey} داخل التطبيق المحدد.`]
            } as DynamicMendJsonResult<T>;
          }),
          catchError(() => of({
            isSuccess: false,
            data: null,
            errors: [`لا يوجد تعريف للحقل ${mendKey} داخل التطبيق المحدد.`]
          } as DynamicMendJsonResult<T>))
        );
      }),
      catchError(() => of({
        isSuccess: false,
        data: null,
        errors: ['تعذر تحميل بيانات تعريف الحقول من الخادم.']
      } as DynamicMendJsonResult<T>))
    );
  }

  private resolveFromRows<T>(rows: CdmendDto[], mendField: string): DynamicMendJsonResult<T> | null {
    const match = rows.find(field => this.normalizeKey(field?.cdmendTxt) === this.normalizeKey(mendField));
    if (!match) {
      return null;
    }

    const parsed = this.parseLooseJson(match);
    if (parsed === null) {
      return {
        isSuccess: false,
        data: null,
        errors: [`تعذر قراءة CDMendTbl للحقل ${mendField}.`]
      } as DynamicMendJsonResult<T>;
    }

    return {
      isSuccess: true,
      data: parsed as T,
      errors: []
    } as DynamicMendJsonResult<T>;
  }

  private parseLooseJson(field: CdmendDto): unknown | null {
    const raw = String(field?.cdmendTbl ?? '').trim();
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch {
      try {
        const fixed = raw.replace(/\'/g, '"');
        return JSON.parse(fixed);
      } catch {
        return null;
      }
    }
  }

  private normalizeKey(value: unknown): string {
    return String(value ?? '').trim().toLowerCase();
  }
}
