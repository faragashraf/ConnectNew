import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject, from, of } from 'rxjs';
import { catchError, map, mergeMap, shareReplay } from 'rxjs/operators';
import { PowerBiController } from 'src/app/Modules/enpopower-bi/services/PowerBi.service';

interface ChartDataRequest {
  queryId: number;
  params: any;
  cacheKey: string;
  resultSubject: Subject<any[]>;
}

@Injectable({
  providedIn: 'root'
})
export class ChartDataService implements OnDestroy {
  private cache = new Map<string, Observable<any[]>>();
  private jobQueue$ = new Subject<ChartDataRequest>();
  private destroy$ = new Subject<void>();

  constructor(private powerBiController: PowerBiController) {
    // Process queue with concurrency limit of 3
    this.jobQueue$.pipe(
      mergeMap(job => {
        return this.executeRequest(job.queryId, job.params).pipe(
          map(data => ({ job, data: data ?? [], error: null })),
          catchError(err => of({ job, data: [], error: err }))
        );
      }, 3)
    ).subscribe(result => {
      if (result.error) {
        result.job.resultSubject.error(result.error);
      } else {
        // ensure we always emit an array
        result.job.resultSubject.next(result.data || []);
        result.job.resultSubject.complete();
      }
    });
  }

  // params may be string, object, null or undefined; service normalizes before backend call
  fetchChartData(queryId: number, params: any, cacheKey: string): Observable<any[]> {
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const resultSubject = new Subject<any[]>();
    const obs$ = resultSubject.asObservable().pipe(
      shareReplay(1)
    );

    this.cache.set(cacheKey, obs$);

    this.jobQueue$.next({
      queryId,
      params,
      cacheKey,
      resultSubject
    });

    return obs$;
  }

  clearCache(prefix?: string): void {
    if (prefix) {
      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  private executeRequest(queryId: number, params: any): Observable<any[]> {
    // Assuming PowerBiController.getGenericDataById is the method to use as per existing code
    // normalize params: controller expects string | undefined
    const normalizedParams: string | undefined = (params === null || params === undefined)
      ? undefined
      : (typeof params === 'string' ? params : JSON.stringify(params));

    return this.powerBiController.getGenericDataById(queryId, normalizedParams).pipe(
      map((res: any) => {
        if (res.isSuccess && res.data) {
          return res.data;
        } else {
          throw new Error(res.errors ? res.errors.join(', ') : 'Unknown error');
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
