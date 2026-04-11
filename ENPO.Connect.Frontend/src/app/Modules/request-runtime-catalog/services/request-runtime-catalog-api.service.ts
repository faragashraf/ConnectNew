import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  RequestRuntimeCatalogDto,
  RuntimeApiResponse
} from '../models/request-runtime-catalog.models';

@Injectable()
export class RequestRuntimeCatalogApiService {
  private readonly baseUrl = `${environment.ConnectApiURL}/api/RequestRuntimeCatalog`;

  constructor(private readonly http: HttpClient) {}

  getRegistrationTree(appId?: string | null): Observable<RuntimeApiResponse<RequestRuntimeCatalogDto>> {
    let params = new HttpParams();
    const normalizedAppId = String(appId ?? '').trim();
    if (normalizedAppId.length > 0) {
      params = params.set('appId', normalizedAppId);
    }

    return this.http.get<RuntimeApiResponse<RequestRuntimeCatalogDto>>(`${this.baseUrl}/RegistrationTree`, { params });
  }
}
