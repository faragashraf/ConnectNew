import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { FileParameter } from '../dto-shared';
import {
  CommonResponse,
  EnvelopeDetailDto,
  EnvelopeListQueryDto,
  EnvelopeUpsertRequestDto,
  PagedEnvelopeListDto,
  PagedSubjectListDto,
  SubjectAttachmentDto,
  SubjectCategoryTreeNodeDto,
  SubjectDashboardDto,
  SubjectDashboardQueryDto,
  SubjectDetailDto,
  SubjectFormDefinitionDto,
  SubjectListQueryDto,
  SubjectStakeholderDto,
  SubjectStakeholderUpsertDto,
  SubjectStatusChangeRequestDto,
  SubjectStatusChangeResponseDto,
  SubjectTaskDto,
  SubjectTaskUpsertDto,
  SubjectAdminFieldDto,
  SubjectAdminFieldUpsertRequestDto,
  SubjectAdminGroupDto,
  SubjectAdminGroupUpsertRequestDto,
  SubjectCategoryFieldLinkAdminDto,
  SubjectCategoryFieldLinksUpsertRequestDto,
  SubjectTypeAdminCreateRequestDto,
  SubjectTypeAdminStatusRequestDto,
  SubjectTypeAdminTreeMoveRequestDto,
  SubjectTypeAdminDto,
  SubjectTypeAdminUpdateRequestDto,
  SubjectTypeAdminUpsertRequestDto,
  SubjectUpsertRequest
} from './DynamicSubjects.dto';

@Injectable({ providedIn: 'root' })
export class DynamicSubjectsController {
  private readonly baseUrl = `${environment.ConnectApiURL}/api/DynamicSubjects`;

  constructor(private readonly http: HttpClient) {}

  getCategoryTree(appId?: string): Observable<CommonResponse<SubjectCategoryTreeNodeDto[]>> {
    let params = new HttpParams();
    if (appId) {
      params = params.set('appId', appId);
    }

    return this.http.get<CommonResponse<SubjectCategoryTreeNodeDto[]>>(`${this.baseUrl}/CategoryTree`, { params });
  }

  getFormDefinition(categoryId: number, appId?: string): Observable<CommonResponse<SubjectFormDefinitionDto>> {
    let params = new HttpParams();
    if (appId) {
      params = params.set('appId', appId);
    }

    return this.http.get<CommonResponse<SubjectFormDefinitionDto>>(`${this.baseUrl}/FormDefinition/${categoryId}`, { params });
  }

  listSubjects(query: SubjectListQueryDto): Observable<CommonResponse<PagedSubjectListDto>> {
    let params = new HttpParams()
      .set('onlyMyItems', String(Boolean(query.onlyMyItems)))
      .set('pageNumber', String(query.pageNumber ?? 1))
      .set('pageSize', String(query.pageSize ?? 20));

    if (query.searchText) params = params.set('searchText', query.searchText);
    if (query.categoryId) params = params.set('categoryId', String(query.categoryId));
    if (query.status !== undefined && query.status !== null) params = params.set('status', String(query.status));
    if (query.assignedUnitId) params = params.set('assignedUnitId', String(query.assignedUnitId));
    if (query.createdFrom) params = params.set('createdFrom', query.createdFrom);
    if (query.createdTo) params = params.set('createdTo', query.createdTo);

    return this.http.get<CommonResponse<PagedSubjectListDto>>(`${this.baseUrl}/Subjects`, { params });
  }

  getSubject(messageId: number): Observable<CommonResponse<SubjectDetailDto>> {
    return this.http.get<CommonResponse<SubjectDetailDto>>(`${this.baseUrl}/Subjects/${messageId}`);
  }

  createSubject(request: SubjectUpsertRequest, files: FileParameter[]): Observable<CommonResponse<SubjectDetailDto>> {
    const formData = this.toSubjectFormData(request, files);
    return this.http.post<CommonResponse<SubjectDetailDto>>(`${this.baseUrl}/Subjects`, formData);
  }

  updateSubject(messageId: number, request: SubjectUpsertRequest, files: FileParameter[]): Observable<CommonResponse<SubjectDetailDto>> {
    const formData = this.toSubjectFormData(request, files);
    return this.http.put<CommonResponse<SubjectDetailDto>>(`${this.baseUrl}/Subjects/${messageId}`, formData);
  }

  changeStatus(messageId: number, request: SubjectStatusChangeRequestDto): Observable<CommonResponse<SubjectStatusChangeResponseDto>> {
    return this.http.post<CommonResponse<SubjectStatusChangeResponseDto>>(`${this.baseUrl}/Subjects/${messageId}/Status`, request);
  }

  addAttachments(messageId: number, files: FileParameter[]): Observable<CommonResponse<SubjectAttachmentDto[]>> {
    const formData = new FormData();
    (files ?? []).forEach(file => {
      formData.append('files', file.data, file.fileName || file.data.name || 'attachment');
    });

    return this.http.post<CommonResponse<SubjectAttachmentDto[]>>(`${this.baseUrl}/Subjects/${messageId}/Attachments`, formData);
  }

  removeAttachment(messageId: number, attachmentId: number): Observable<CommonResponse<boolean>> {
    return this.http.delete<CommonResponse<boolean>>(`${this.baseUrl}/Subjects/${messageId}/Attachments/${attachmentId}`);
  }

  upsertStakeholders(messageId: number, stakeholders: SubjectStakeholderUpsertDto[]): Observable<CommonResponse<SubjectStakeholderDto[]>> {
    return this.http.put<CommonResponse<SubjectStakeholderDto[]>>(`${this.baseUrl}/Subjects/${messageId}/Stakeholders`, stakeholders ?? []);
  }

  upsertTask(messageId: number, task: SubjectTaskUpsertDto): Observable<CommonResponse<SubjectTaskDto>> {
    return this.http.post<CommonResponse<SubjectTaskDto>>(`${this.baseUrl}/Subjects/${messageId}/Tasks`, task);
  }

  listEnvelopes(query: EnvelopeListQueryDto): Observable<CommonResponse<PagedEnvelopeListDto>> {
    let params = new HttpParams()
      .set('pageNumber', String(query.pageNumber ?? 1))
      .set('pageSize', String(query.pageSize ?? 20));

    if (query.searchText) params = params.set('searchText', query.searchText);
    if (query.incomingDateFrom) params = params.set('incomingDateFrom', query.incomingDateFrom);
    if (query.incomingDateTo) params = params.set('incomingDateTo', query.incomingDateTo);

    return this.http.get<CommonResponse<PagedEnvelopeListDto>>(`${this.baseUrl}/Envelopes`, { params });
  }

  getEnvelope(envelopeId: number): Observable<CommonResponse<EnvelopeDetailDto>> {
    return this.http.get<CommonResponse<EnvelopeDetailDto>>(`${this.baseUrl}/Envelopes/${envelopeId}`);
  }

  createEnvelope(request: EnvelopeUpsertRequestDto): Observable<CommonResponse<EnvelopeDetailDto>> {
    return this.http.post<CommonResponse<EnvelopeDetailDto>>(`${this.baseUrl}/Envelopes`, request);
  }

  updateEnvelope(envelopeId: number, request: EnvelopeUpsertRequestDto): Observable<CommonResponse<EnvelopeDetailDto>> {
    return this.http.put<CommonResponse<EnvelopeDetailDto>>(`${this.baseUrl}/Envelopes/${envelopeId}`, request);
  }

  linkSubjectToEnvelope(envelopeId: number, messageId: number): Observable<CommonResponse<boolean>> {
    return this.http.post<CommonResponse<boolean>>(`${this.baseUrl}/Envelopes/${envelopeId}/Subjects/${messageId}`, {});
  }

  unlinkSubjectFromEnvelope(envelopeId: number, messageId: number): Observable<CommonResponse<boolean>> {
    return this.http.delete<CommonResponse<boolean>>(`${this.baseUrl}/Envelopes/${envelopeId}/Subjects/${messageId}`);
  }

  getDashboard(query: SubjectDashboardQueryDto): Observable<CommonResponse<SubjectDashboardDto>> {
    let params = new HttpParams().set('onlyMyItems', String(Boolean(query.onlyMyItems)));
    if (query.categoryId) params = params.set('categoryId', String(query.categoryId));
    if (query.unitId) params = params.set('unitId', String(query.unitId));

    return this.http.get<CommonResponse<SubjectDashboardDto>>(`${this.baseUrl}/Dashboard`, { params });
  }

  getSubjectTypesAdminConfig(appId?: string): Observable<CommonResponse<SubjectTypeAdminDto[]>> {
    let params = new HttpParams();
    if (appId) {
      params = params.set('appId', appId);
    }

    return this.http.get<CommonResponse<SubjectTypeAdminDto[]>>(`${this.baseUrl}/Admin/SubjectTypes`, { params });
  }

  upsertSubjectTypeAdminConfig(categoryId: number, request: SubjectTypeAdminUpsertRequestDto): Observable<CommonResponse<SubjectTypeAdminDto>> {
    return this.http.put<CommonResponse<SubjectTypeAdminDto>>(`${this.baseUrl}/Admin/SubjectTypes/${categoryId}`, request);
  }

  getAdminCategoryTree(appId?: string): Observable<CommonResponse<SubjectTypeAdminDto[]>> {
    let params = new HttpParams();
    if (appId) {
      params = params.set('appId', appId);
    }

    return this.http.get<CommonResponse<SubjectTypeAdminDto[]>>(`${this.baseUrl}/Admin/CategoryTree`, { params });
  }

  createAdminCategory(request: SubjectTypeAdminCreateRequestDto): Observable<CommonResponse<SubjectTypeAdminDto>> {
    return this.http.post<CommonResponse<SubjectTypeAdminDto>>(`${this.baseUrl}/Admin/CategoryTypes`, request);
  }

  updateAdminCategory(categoryId: number, request: SubjectTypeAdminUpdateRequestDto): Observable<CommonResponse<SubjectTypeAdminDto>> {
    return this.http.put<CommonResponse<SubjectTypeAdminDto>>(`${this.baseUrl}/Admin/CategoryTypes/${categoryId}`, request);
  }

  deleteAdminCategory(categoryId: number): Observable<CommonResponse<boolean>> {
    return this.http.delete<CommonResponse<boolean>>(`${this.baseUrl}/Admin/CategoryTypes/${categoryId}`);
  }

  setAdminCategoryStatus(categoryId: number, request: SubjectTypeAdminStatusRequestDto): Observable<CommonResponse<SubjectTypeAdminDto>> {
    return this.http.patch<CommonResponse<SubjectTypeAdminDto>>(`${this.baseUrl}/Admin/CategoryTypes/${categoryId}/Status`, request);
  }

  moveAdminCategory(categoryId: number, request: SubjectTypeAdminTreeMoveRequestDto): Observable<CommonResponse<SubjectTypeAdminDto[]>> {
    return this.http.patch<CommonResponse<SubjectTypeAdminDto[]>>(`${this.baseUrl}/Admin/CategoryTypes/${categoryId}/Move`, request);
  }

  getAdminFields(appId?: string): Observable<CommonResponse<SubjectAdminFieldDto[]>> {
    let params = new HttpParams();
    if (appId) {
      params = params.set('appId', appId);
    }

    return this.http.get<CommonResponse<SubjectAdminFieldDto[]>>(`${this.baseUrl}/Admin/Fields`, { params });
  }

  createAdminField(request: SubjectAdminFieldUpsertRequestDto): Observable<CommonResponse<SubjectAdminFieldDto>> {
    return this.http.post<CommonResponse<SubjectAdminFieldDto>>(`${this.baseUrl}/Admin/Fields`, request);
  }

  updateAdminField(fieldKey: string, request: SubjectAdminFieldUpsertRequestDto): Observable<CommonResponse<SubjectAdminFieldDto>> {
    return this.http.put<CommonResponse<SubjectAdminFieldDto>>(`${this.baseUrl}/Admin/Fields/${encodeURIComponent(fieldKey)}`, request);
  }

  deleteAdminField(fieldKey: string): Observable<CommonResponse<boolean>> {
    return this.http.delete<CommonResponse<boolean>>(`${this.baseUrl}/Admin/Fields/${encodeURIComponent(fieldKey)}`);
  }

  getAdminGroups(): Observable<CommonResponse<SubjectAdminGroupDto[]>> {
    return this.http.get<CommonResponse<SubjectAdminGroupDto[]>>(`${this.baseUrl}/Admin/Groups`);
  }

  createAdminGroup(request: SubjectAdminGroupUpsertRequestDto): Observable<CommonResponse<SubjectAdminGroupDto>> {
    return this.http.post<CommonResponse<SubjectAdminGroupDto>>(`${this.baseUrl}/Admin/Groups`, request);
  }

  updateAdminGroup(groupId: number, request: SubjectAdminGroupUpsertRequestDto): Observable<CommonResponse<SubjectAdminGroupDto>> {
    return this.http.put<CommonResponse<SubjectAdminGroupDto>>(`${this.baseUrl}/Admin/Groups/${groupId}`, request);
  }

  deleteAdminGroup(groupId: number): Observable<CommonResponse<boolean>> {
    return this.http.delete<CommonResponse<boolean>>(`${this.baseUrl}/Admin/Groups/${groupId}`);
  }

  getAdminCategoryFieldLinks(categoryId: number): Observable<CommonResponse<SubjectCategoryFieldLinkAdminDto[]>> {
    return this.http.get<CommonResponse<SubjectCategoryFieldLinkAdminDto[]>>(`${this.baseUrl}/Admin/CategoryTypes/${categoryId}/FieldLinks`);
  }

  upsertAdminCategoryFieldLinks(categoryId: number, request: SubjectCategoryFieldLinksUpsertRequestDto): Observable<CommonResponse<SubjectCategoryFieldLinkAdminDto[]>> {
    return this.http.put<CommonResponse<SubjectCategoryFieldLinkAdminDto[]>>(`${this.baseUrl}/Admin/CategoryTypes/${categoryId}/FieldLinks`, request);
  }

  getAdminCategoryPreview(categoryId: number, appId?: string): Observable<CommonResponse<SubjectFormDefinitionDto>> {
    let params = new HttpParams();
    if (appId) {
      params = params.set('appId', appId);
    }

    return this.http.get<CommonResponse<SubjectFormDefinitionDto>>(`${this.baseUrl}/Admin/CategoryTypes/${categoryId}/Preview`, { params });
  }

  private toSubjectFormData(request: SubjectUpsertRequest, files: FileParameter[]): FormData {
    const formData = new FormData();
    formData.append('categoryId', String(request.categoryId));
    formData.append('subject', request.subject ?? '');
    formData.append('description', request.description ?? '');
    formData.append('saveAsDraft', String(Boolean(request.saveAsDraft)));
    formData.append('submit', String(Boolean(request.submit)));
    if (request.envelopeId && request.envelopeId > 0) {
      formData.append('envelopeId', String(request.envelopeId));
    }

    formData.append('dynamicFieldsJson', JSON.stringify(request.dynamicFields ?? []));
    formData.append('stakeholdersJson', JSON.stringify(request.stakeholders ?? []));
    formData.append('tasksJson', JSON.stringify(request.tasks ?? []));

    (files ?? []).forEach(file => {
      formData.append('files', file.data, file.fileName || file.data.name || 'attachment');
    });

    return formData;
  }
}
