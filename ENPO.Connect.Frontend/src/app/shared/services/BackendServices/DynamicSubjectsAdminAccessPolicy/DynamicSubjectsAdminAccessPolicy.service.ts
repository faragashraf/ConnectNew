import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { CommonResponse } from '../DynamicSubjects/DynamicSubjects.dto';
import {
  FieldAccessPolicyWorkspaceDto,
  FieldAccessPolicyWorkspaceUpsertRequestDto,
  FieldAccessPreviewRequestDto,
  FieldAccessPreviewResponseDto
} from './DynamicSubjectsAdminAccessPolicy.dto';

@Injectable({ providedIn: 'root' })
export class DynamicSubjectsAdminAccessPolicyController {
  private readonly baseUrl = `${environment.ConnectApiURL}/api/DynamicSubjectsAdminAccessPolicy`;

  constructor(private readonly http: HttpClient) {}

  getWorkspace(requestTypeId: number): Observable<CommonResponse<FieldAccessPolicyWorkspaceDto>> {
    return this.http.get<CommonResponse<FieldAccessPolicyWorkspaceDto>>(
      `${this.baseUrl}/Workspace/${requestTypeId}`
    );
  }

  upsertWorkspace(
    requestTypeId: number,
    request: FieldAccessPolicyWorkspaceUpsertRequestDto
  ): Observable<CommonResponse<FieldAccessPolicyWorkspaceDto>> {
    return this.http.put<CommonResponse<FieldAccessPolicyWorkspaceDto>>(
      `${this.baseUrl}/Workspace/${requestTypeId}`,
      request
    );
  }

  preview(
    requestTypeId: number,
    request: FieldAccessPreviewRequestDto
  ): Observable<CommonResponse<FieldAccessPreviewResponseDto>> {
    return this.http.post<CommonResponse<FieldAccessPreviewResponseDto>>(
      `${this.baseUrl}/Preview/${requestTypeId}`,
      request
    );
  }
}
