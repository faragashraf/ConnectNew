import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { CommonResponse } from '../DynamicSubjects/DynamicSubjects.dto';
import {
  SubjectAvailabilityNodeValidationRequestDto,
  SubjectAvailabilityNodeValidationResultDto,
  SubjectRoutingOrgTreeNodeDto,
  SubjectRoutingOrgPositionLookupDto,
  SubjectRoutingOrgUnitLookupDto,
  SubjectRoutingOrgUnitTypeLookupDto,
  SubjectRoutingOrgUserLookupDto,
  SubjectRoutingPreviewDto,
  SubjectRoutingProfileDto,
  SubjectRoutingProfileUpsertRequestDto,
  SubjectRoutingProfileWorkspaceDto,
  SubjectRoutingStepDto,
  SubjectRoutingStepUpsertRequestDto,
  SubjectRoutingTargetDto,
  SubjectRoutingTargetUpsertRequestDto,
  SubjectRoutingTransitionDto,
  SubjectRoutingTransitionUpsertRequestDto,
  SubjectRoutingValidationResultDto,
  SubjectTypeRequestAvailabilityDto,
  SubjectTypeRequestAvailabilityUpsertRequestDto,
  SubjectTypeRoutingBindingDto,
  SubjectTypeRoutingBindingUpsertRequestDto
} from './DynamicSubjectsAdminRouting.dto';

@Injectable({ providedIn: 'root' })
export class DynamicSubjectsAdminRoutingController {
  private readonly baseUrl = `${environment.ConnectApiURL}/api/DynamicSubjectsAdminRouting`;

  constructor(private readonly http: HttpClient) {}

  getProfilesByRequestType(subjectTypeId: number): Observable<CommonResponse<SubjectRoutingProfileDto[]>> {
    const params = new HttpParams().set('subjectTypeId', String(subjectTypeId));
    return this.http.get<CommonResponse<SubjectRoutingProfileDto[]>>(`${this.baseUrl}/Profiles`, { params });
  }

  getProfileByRequestType(
    subjectTypeId: number,
    direction?: string
  ): Observable<CommonResponse<SubjectRoutingProfileWorkspaceDto>> {
    let params = new HttpParams();
    const normalizedDirection = String(direction ?? '').trim();
    if (normalizedDirection.length > 0) {
      params = params.set('direction', normalizedDirection);
    }

    return this.http.get<CommonResponse<SubjectRoutingProfileWorkspaceDto>>(
      `${this.baseUrl}/Profiles/ByRequestType/${subjectTypeId}`,
      { params }
    );
  }

  getProfileWorkspace(profileId: number): Observable<CommonResponse<SubjectRoutingProfileWorkspaceDto>> {
    return this.http.get<CommonResponse<SubjectRoutingProfileWorkspaceDto>>(
      `${this.baseUrl}/Profiles/${profileId}/Workspace`
    );
  }

  createProfile(request: SubjectRoutingProfileUpsertRequestDto): Observable<CommonResponse<SubjectRoutingProfileDto>> {
    return this.http.post<CommonResponse<SubjectRoutingProfileDto>>(`${this.baseUrl}/Profiles`, request);
  }

  updateProfile(
    profileId: number,
    request: SubjectRoutingProfileUpsertRequestDto
  ): Observable<CommonResponse<SubjectRoutingProfileDto>> {
    return this.http.put<CommonResponse<SubjectRoutingProfileDto>>(`${this.baseUrl}/Profiles/${profileId}`, request);
  }

  addStep(request: SubjectRoutingStepUpsertRequestDto): Observable<CommonResponse<SubjectRoutingStepDto>> {
    return this.http.post<CommonResponse<SubjectRoutingStepDto>>(`${this.baseUrl}/Steps`, request);
  }

  updateStep(stepId: number, request: SubjectRoutingStepUpsertRequestDto): Observable<CommonResponse<SubjectRoutingStepDto>> {
    return this.http.put<CommonResponse<SubjectRoutingStepDto>>(`${this.baseUrl}/Steps/${stepId}`, request);
  }

  deleteStep(stepId: number): Observable<CommonResponse<boolean>> {
    return this.http.delete<CommonResponse<boolean>>(`${this.baseUrl}/Steps/${stepId}`);
  }

  addTarget(request: SubjectRoutingTargetUpsertRequestDto): Observable<CommonResponse<SubjectRoutingTargetDto>> {
    return this.http.post<CommonResponse<SubjectRoutingTargetDto>>(`${this.baseUrl}/Targets`, request);
  }

  updateTarget(
    targetId: number,
    request: SubjectRoutingTargetUpsertRequestDto
  ): Observable<CommonResponse<SubjectRoutingTargetDto>> {
    return this.http.put<CommonResponse<SubjectRoutingTargetDto>>(`${this.baseUrl}/Targets/${targetId}`, request);
  }

  deleteTarget(targetId: number): Observable<CommonResponse<boolean>> {
    return this.http.delete<CommonResponse<boolean>>(`${this.baseUrl}/Targets/${targetId}`);
  }

  addTransition(
    request: SubjectRoutingTransitionUpsertRequestDto
  ): Observable<CommonResponse<SubjectRoutingTransitionDto>> {
    return this.http.post<CommonResponse<SubjectRoutingTransitionDto>>(`${this.baseUrl}/Transitions`, request);
  }

  updateTransition(
    transitionId: number,
    request: SubjectRoutingTransitionUpsertRequestDto
  ): Observable<CommonResponse<SubjectRoutingTransitionDto>> {
    return this.http.put<CommonResponse<SubjectRoutingTransitionDto>>(`${this.baseUrl}/Transitions/${transitionId}`, request);
  }

  deleteTransition(transitionId: number): Observable<CommonResponse<boolean>> {
    return this.http.delete<CommonResponse<boolean>>(`${this.baseUrl}/Transitions/${transitionId}`);
  }

  bindProfileToRequestType(
    request: SubjectTypeRoutingBindingUpsertRequestDto
  ): Observable<CommonResponse<SubjectTypeRoutingBindingDto>> {
    return this.http.post<CommonResponse<SubjectTypeRoutingBindingDto>>(`${this.baseUrl}/Bindings`, request);
  }

  getRoutingPreview(profileId: number): Observable<CommonResponse<SubjectRoutingPreviewDto>> {
    return this.http.get<CommonResponse<SubjectRoutingPreviewDto>>(`${this.baseUrl}/Profiles/${profileId}/Preview`);
  }

  validateRoutingProfile(profileId: number): Observable<CommonResponse<SubjectRoutingValidationResultDto>> {
    return this.http.get<CommonResponse<SubjectRoutingValidationResultDto>>(
      `${this.baseUrl}/Profiles/${profileId}/Validation`
    );
  }

  getRequestAvailability(subjectTypeId: number): Observable<CommonResponse<SubjectTypeRequestAvailabilityDto>> {
    return this.http.get<CommonResponse<SubjectTypeRequestAvailabilityDto>>(
      `${this.baseUrl}/Availability/${subjectTypeId}`
    );
  }

  upsertRequestAvailability(
    subjectTypeId: number,
    request: SubjectTypeRequestAvailabilityUpsertRequestDto
  ): Observable<CommonResponse<SubjectTypeRequestAvailabilityDto>> {
    return this.http.put<CommonResponse<SubjectTypeRequestAvailabilityDto>>(
      `${this.baseUrl}/Availability/${subjectTypeId}`,
      request
    );
  }

  validateRequestAvailabilityNode(
    subjectTypeId: number,
    request: SubjectAvailabilityNodeValidationRequestDto
  ): Observable<CommonResponse<SubjectAvailabilityNodeValidationResultDto>> {
    return this.http.post<CommonResponse<SubjectAvailabilityNodeValidationResultDto>>(
      `${this.baseUrl}/Availability/${subjectTypeId}/ValidateNode`,
      request
    );
  }

  getAvailabilityTreeNodes(subjectTypeId: number, options?: {
    parentNodeType?: string;
    parentNodeNumericId?: number;
    parentNodeUserId?: string;
    search?: string;
    activeOnly?: boolean;
    includeUsers?: boolean;
  }): Observable<CommonResponse<SubjectRoutingOrgTreeNodeDto[]>> {
    let params = new HttpParams();

    const normalizedParentType = String(options?.parentNodeType ?? '').trim();
    if (normalizedParentType.length > 0) {
      params = params.set('parentNodeType', normalizedParentType);
    }

    if (options?.parentNodeNumericId != null) {
      params = params.set('parentNodeNumericId', String(options.parentNodeNumericId));
    }

    const normalizedParentUserId = String(options?.parentNodeUserId ?? '').trim();
    if (normalizedParentUserId.length > 0) {
      params = params.set('parentNodeUserId', normalizedParentUserId);
    }

    const normalizedSearch = String(options?.search ?? '').trim();
    if (normalizedSearch.length > 0) {
      params = params.set('search', normalizedSearch);
    }

    params = params.set('activeOnly', String(options?.activeOnly !== false));
    params = params.set('includeUsers', String(options?.includeUsers !== false));

    return this.http.get<CommonResponse<SubjectRoutingOrgTreeNodeDto[]>>(
      `${this.baseUrl}/Availability/${subjectTypeId}/TreeNodes`,
      { params }
    );
  }

  getOracleUnitTypes(): Observable<CommonResponse<SubjectRoutingOrgUnitTypeLookupDto[]>> {
    return this.http.get<CommonResponse<SubjectRoutingOrgUnitTypeLookupDto[]>>(`${this.baseUrl}/Oracle/UnitTypes`);
  }

  getOracleUnits(
    options?: { unitTypeId?: number; parentId?: number; search?: string; activeOnly?: boolean }
  ): Observable<CommonResponse<SubjectRoutingOrgUnitLookupDto[]>> {
    let params = new HttpParams();
    if (options?.unitTypeId != null) {
      params = params.set('unitTypeId', String(options.unitTypeId));
    }

    if (options?.parentId != null) {
      params = params.set('parentId', String(options.parentId));
    }

    const normalizedSearch = String(options?.search ?? '').trim();
    if (normalizedSearch.length > 0) {
      params = params.set('search', normalizedSearch);
    }

    params = params.set('activeOnly', String(options?.activeOnly !== false));
    return this.http.get<CommonResponse<SubjectRoutingOrgUnitLookupDto[]>>(`${this.baseUrl}/Oracle/Units`, { params });
  }

  getOraclePositions(
    options?: { targetUserId?: string; unitId?: number; activeOnly?: boolean }
  ): Observable<CommonResponse<SubjectRoutingOrgPositionLookupDto[]>> {
    let params = new HttpParams();
    const normalizedUserId = String(options?.targetUserId ?? '').trim();
    if (normalizedUserId.length > 0) {
      params = params.set('targetUserId', normalizedUserId);
    }

    if (options?.unitId != null) {
      params = params.set('unitId', String(options.unitId));
    }

    params = params.set('activeOnly', String(options?.activeOnly !== false));
    return this.http.get<CommonResponse<SubjectRoutingOrgPositionLookupDto[]>>(`${this.baseUrl}/Oracle/Positions`, { params });
  }

  getOracleUsers(activeOnly = true): Observable<CommonResponse<SubjectRoutingOrgUserLookupDto[]>> {
    const params = new HttpParams().set('activeOnly', String(activeOnly));
    return this.http.get<CommonResponse<SubjectRoutingOrgUserLookupDto[]>>(`${this.baseUrl}/Oracle/Users`, { params });
  }

  getOracleTreeNodes(options?: {
    parentNodeType?: string;
    parentNodeNumericId?: number;
    parentNodeUserId?: string;
    search?: string;
    activeOnly?: boolean;
    includeUsers?: boolean;
  }): Observable<CommonResponse<SubjectRoutingOrgTreeNodeDto[]>> {
    let params = new HttpParams();

    const normalizedParentType = String(options?.parentNodeType ?? '').trim();
    if (normalizedParentType.length > 0) {
      params = params.set('parentNodeType', normalizedParentType);
    }

    if (options?.parentNodeNumericId != null) {
      params = params.set('parentNodeNumericId', String(options.parentNodeNumericId));
    }

    const normalizedParentUserId = String(options?.parentNodeUserId ?? '').trim();
    if (normalizedParentUserId.length > 0) {
      params = params.set('parentNodeUserId', normalizedParentUserId);
    }

    const normalizedSearch = String(options?.search ?? '').trim();
    if (normalizedSearch.length > 0) {
      params = params.set('search', normalizedSearch);
    }

    params = params.set('activeOnly', String(options?.activeOnly !== false));
    params = params.set('includeUsers', String(options?.includeUsers !== false));

    return this.http.get<CommonResponse<SubjectRoutingOrgTreeNodeDto[]>>(`${this.baseUrl}/Oracle/TreeNodes`, { params });
  }
}
