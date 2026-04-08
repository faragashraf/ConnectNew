import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { CommonResponse } from '../DynamicSubjects/DynamicSubjects.dto';
import {
  AdminCatalogApplicationCreateRequestDto,
  AdminCatalogApplicationDeleteDiagnosticsDto,
  AdminCatalogApplicationDto,
  AdminCatalogApplicationUpdateRequestDto,
  AdminCatalogCategoryCreateRequestDto,
  AdminCatalogCategoryDeleteDiagnosticsDto,
  AdminCatalogDeleteResultDto,
  AdminCatalogCategoryDto,
  AdminCatalogCategoryTreeNodeDto,
  AdminCatalogCategoryUpdateRequestDto,
  AdminCatalogGroupCreateRequestDto,
  AdminCatalogGroupDto,
  AdminCatalogGroupTreeNodeDto,
  AdminCatalogGroupUpdateRequestDto
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

  diagnoseApplicationDelete(applicationId: string): Observable<CommonResponse<AdminCatalogApplicationDeleteDiagnosticsDto>> {
    return this.http.get<CommonResponse<AdminCatalogApplicationDeleteDiagnosticsDto>>(
      `${this.baseUrl}/Applications/${encodeURIComponent(applicationId)}/DeleteDiagnostics`
    );
  }

  deleteApplication(applicationId: string): Observable<CommonResponse<AdminCatalogDeleteResultDto>> {
    return this.http.delete<CommonResponse<AdminCatalogDeleteResultDto>>(
      `${this.baseUrl}/Applications/${encodeURIComponent(applicationId)}`
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

  diagnoseCategoryDelete(categoryId: number): Observable<CommonResponse<AdminCatalogCategoryDeleteDiagnosticsDto>> {
    return this.http.get<CommonResponse<AdminCatalogCategoryDeleteDiagnosticsDto>>(
      `${this.baseUrl}/Categories/${categoryId}/DeleteDiagnostics`
    );
  }

  deleteCategory(categoryId: number): Observable<CommonResponse<AdminCatalogDeleteResultDto>> {
    return this.http.delete<CommonResponse<AdminCatalogDeleteResultDto>>(`${this.baseUrl}/Categories/${categoryId}`);
  }

  getGroupsByCategory(categoryId: number): Observable<CommonResponse<AdminCatalogGroupTreeNodeDto[]>> {
    return this.http.get<CommonResponse<AdminCatalogGroupTreeNodeDto[]>>(`${this.baseUrl}/Categories/${categoryId}/Groups`);
  }

  createGroup(request: AdminCatalogGroupCreateRequestDto): Observable<CommonResponse<AdminCatalogGroupDto>> {
    return this.http.post<CommonResponse<AdminCatalogGroupDto>>(`${this.baseUrl}/Groups`, request);
  }

  updateGroup(groupId: number, request: AdminCatalogGroupUpdateRequestDto): Observable<CommonResponse<AdminCatalogGroupDto>> {
    return this.http.put<CommonResponse<AdminCatalogGroupDto>>(`${this.baseUrl}/Groups/${groupId}`, request);
  }

  deleteGroup(groupId: number): Observable<CommonResponse<AdminCatalogDeleteResultDto>> {
    return this.http.delete<CommonResponse<AdminCatalogDeleteResultDto>>(`${this.baseUrl}/Groups/${groupId}`);
  }
}
