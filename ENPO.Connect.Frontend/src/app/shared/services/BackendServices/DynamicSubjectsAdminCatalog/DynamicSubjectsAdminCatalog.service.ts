import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { CommonResponse } from '../DynamicSubjects/DynamicSubjects.dto';
import {
  AdminCatalogApplicationCreateRequestDto,
  AdminCatalogApplicationDto,
  AdminCatalogApplicationUpdateRequestDto,
  AdminCatalogCategoryCreateRequestDto,
  AdminCatalogCategoryDto,
  AdminCatalogCategoryTreeNodeDto,
  AdminCatalogCategoryUpdateRequestDto
} from './DynamicSubjectsAdminCatalog.dto';

@Injectable({ providedIn: 'root' })
export class DynamicSubjectsAdminCatalogController {
  private readonly baseUrl = `${environment.ConnectApiURL}/api/DynamicSubjectsAdminCatalog`;

  constructor(private readonly http: HttpClient) {}

  getApplications(): Observable<CommonResponse<AdminCatalogApplicationDto[]>> {
    return this.http.get<CommonResponse<AdminCatalogApplicationDto[]>>(`${this.baseUrl}/Applications`);
  }

  createApplication(request: AdminCatalogApplicationCreateRequestDto): Observable<CommonResponse<AdminCatalogApplicationDto>> {
    return this.http.post<CommonResponse<AdminCatalogApplicationDto>>(`${this.baseUrl}/Applications`, request);
  }

  updateApplication(
    applicationId: string,
    request: AdminCatalogApplicationUpdateRequestDto
  ): Observable<CommonResponse<AdminCatalogApplicationDto>> {
    return this.http.put<CommonResponse<AdminCatalogApplicationDto>>(
      `${this.baseUrl}/Applications/${encodeURIComponent(applicationId)}`,
      request
    );
  }

  getCategoryTree(appId?: string): Observable<CommonResponse<AdminCatalogCategoryTreeNodeDto[]>> {
    let params = new HttpParams();
    if ((appId ?? '').trim().length > 0) {
      params = params.set('appId', String(appId).trim());
    }

    return this.http.get<CommonResponse<AdminCatalogCategoryTreeNodeDto[]>>(`${this.baseUrl}/CategoryTree`, { params });
  }

  createCategory(request: AdminCatalogCategoryCreateRequestDto): Observable<CommonResponse<AdminCatalogCategoryDto>> {
    return this.http.post<CommonResponse<AdminCatalogCategoryDto>>(`${this.baseUrl}/Categories`, request);
  }

  updateCategory(
    categoryId: number,
    request: AdminCatalogCategoryUpdateRequestDto
  ): Observable<CommonResponse<AdminCatalogCategoryDto>> {
    return this.http.put<CommonResponse<AdminCatalogCategoryDto>>(`${this.baseUrl}/Categories/${categoryId}`, request);
  }
}
