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
  AdminCatalogCategoryDisplaySettingsDto,
  AdminCatalogCategoryDisplaySettingsUpsertRequestDto,
  AdminCatalogCategoryCreateRequestDto,
  AdminCatalogCategoryDeleteDiagnosticsDto,
  AdminCatalogDeleteResultDto,
  AdminCatalogCategoryDto,
  AdminCatalogCategoryTreeNodeDto,
  AdminControlCenterRequestPreviewDto,
  AdminCatalogCategoryUpdateRequestDto,
  AdminCatalogFieldCreateRequestDto,
  AdminCatalogFieldDeleteDiagnosticsDto,
  AdminCatalogFieldDto,
  AdminCatalogFieldListItemDto,
  AdminCatalogFieldLookupsDto,
  AdminCatalogFieldStatusFilter,
  AdminCatalogFieldUpdateRequestDto,
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

  getCategoryDisplaySettings(categoryId: number): Observable<CommonResponse<AdminCatalogCategoryDisplaySettingsDto>> {
    return this.http.get<CommonResponse<AdminCatalogCategoryDisplaySettingsDto>>(
      `${this.baseUrl}/Categories/${categoryId}/DisplaySettings`
    );
  }

  upsertCategoryDisplaySettings(
    categoryId: number,
    request: AdminCatalogCategoryDisplaySettingsUpsertRequestDto
  ): Observable<CommonResponse<AdminCatalogCategoryDisplaySettingsDto>> {
    return this.http.put<CommonResponse<AdminCatalogCategoryDisplaySettingsDto>>(
      `${this.baseUrl}/Categories/${categoryId}/DisplaySettings`,
      request
    );
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

  getFieldLookups(): Observable<CommonResponse<AdminCatalogFieldLookupsDto>> {
    return this.http.get<CommonResponse<AdminCatalogFieldLookupsDto>>(`${this.baseUrl}/FieldLibrary/Lookups`);
  }

  getFieldLibrary(
    appId?: string,
    search?: string,
    status?: AdminCatalogFieldStatusFilter
  ): Observable<CommonResponse<AdminCatalogFieldListItemDto[]>> {
    let params = new HttpParams();
    const normalizedAppId = String(appId ?? '').trim();
    const normalizedSearch = String(search ?? '').trim();
    const normalizedStatus = String(status ?? '').trim();

    if (normalizedAppId.length > 0) {
      params = params.set('appId', normalizedAppId);
    }

    if (normalizedSearch.length > 0) {
      params = params.set('search', normalizedSearch);
    }

    if (normalizedStatus.length > 0) {
      params = params.set('status', normalizedStatus);
    }

    return this.http.get<CommonResponse<AdminCatalogFieldListItemDto[]>>(`${this.baseUrl}/FieldLibrary`, { params });
  }

  getField(applicationId: string, fieldKey: string): Observable<CommonResponse<AdminCatalogFieldDto>> {
    return this.http.get<CommonResponse<AdminCatalogFieldDto>>(
      `${this.baseUrl}/FieldLibrary/${encodeURIComponent(applicationId)}/${encodeURIComponent(fieldKey)}`
    );
  }

  createField(request: AdminCatalogFieldCreateRequestDto): Observable<CommonResponse<AdminCatalogFieldDto>> {
    return this.http.post<CommonResponse<AdminCatalogFieldDto>>(`${this.baseUrl}/FieldLibrary`, request);
  }

  updateField(
    applicationId: string,
    fieldKey: string,
    request: AdminCatalogFieldUpdateRequestDto
  ): Observable<CommonResponse<AdminCatalogFieldDto>> {
    return this.http.put<CommonResponse<AdminCatalogFieldDto>>(
      `${this.baseUrl}/FieldLibrary/${encodeURIComponent(applicationId)}/${encodeURIComponent(fieldKey)}`,
      request
    );
  }

  diagnoseFieldDelete(
    applicationId: string,
    fieldKey: string
  ): Observable<CommonResponse<AdminCatalogFieldDeleteDiagnosticsDto>> {
    return this.http.get<CommonResponse<AdminCatalogFieldDeleteDiagnosticsDto>>(
      `${this.baseUrl}/FieldLibrary/${encodeURIComponent(applicationId)}/${encodeURIComponent(fieldKey)}/DeleteDiagnostics`
    );
  }

  deleteField(applicationId: string, fieldKey: string): Observable<CommonResponse<AdminCatalogDeleteResultDto>> {
    return this.http.delete<CommonResponse<AdminCatalogDeleteResultDto>>(
      `${this.baseUrl}/FieldLibrary/${encodeURIComponent(applicationId)}/${encodeURIComponent(fieldKey)}`
    );
  }

  getRequestPreview(requestTypeId: number): Observable<CommonResponse<AdminControlCenterRequestPreviewDto>> {
    return this.http.get<CommonResponse<AdminControlCenterRequestPreviewDto>>(
      `${environment.ConnectApiURL}/api/admin/control-center/request-preview/${requestTypeId}`
    );
  }
}
