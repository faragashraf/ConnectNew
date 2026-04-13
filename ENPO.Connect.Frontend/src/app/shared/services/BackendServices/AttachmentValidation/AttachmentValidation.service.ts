import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  AttachmentValidationCommonResponse,
  AttachmentValidationDocumentTypeDto,
  AttachmentValidationDocumentTypeRuleDto,
  AttachmentValidationDocumentTypeRuleUpsertRequest,
  AttachmentValidationDocumentTypeUpsertRequest,
  AttachmentValidationExecutionResultDto,
  AttachmentValidationRuleDto,
  AttachmentValidationRuleUpsertRequest,
  AttachmentValidationSettingsDto,
  AttachmentValidationWorkspaceDto
} from './AttachmentValidation.dto';

@Injectable({ providedIn: 'root' })
export class AttachmentValidationController {
  private readonly baseUrl = `${environment.ConnectApiURL}/api/AttachmentValidation`;

  constructor(private readonly http: HttpClient) {}

  getAdminWorkspace(): Observable<AttachmentValidationCommonResponse<AttachmentValidationWorkspaceDto>> {
    return this.http.get<AttachmentValidationCommonResponse<AttachmentValidationWorkspaceDto>>(
      `${this.baseUrl}/Admin/Workspace`
    );
  }

  upsertDocumentType(
    body: AttachmentValidationDocumentTypeUpsertRequest
  ): Observable<AttachmentValidationCommonResponse<AttachmentValidationDocumentTypeDto>> {
    return this.http.post<AttachmentValidationCommonResponse<AttachmentValidationDocumentTypeDto>>(
      `${this.baseUrl}/Admin/DocumentTypes/Upsert`,
      body
    );
  }

  upsertRule(
    body: AttachmentValidationRuleUpsertRequest
  ): Observable<AttachmentValidationCommonResponse<AttachmentValidationRuleDto>> {
    return this.http.post<AttachmentValidationCommonResponse<AttachmentValidationRuleDto>>(
      `${this.baseUrl}/Admin/Rules/Upsert`,
      body
    );
  }

  upsertDocumentTypeRule(
    body: AttachmentValidationDocumentTypeRuleUpsertRequest
  ): Observable<AttachmentValidationCommonResponse<AttachmentValidationDocumentTypeRuleDto>> {
    return this.http.post<AttachmentValidationCommonResponse<AttachmentValidationDocumentTypeRuleDto>>(
      `${this.baseUrl}/Admin/DocumentTypeRules/Upsert`,
      body
    );
  }

  deactivateDocumentType(id: number): Observable<AttachmentValidationCommonResponse<boolean>> {
    return this.http.post<AttachmentValidationCommonResponse<boolean>>(
      `${this.baseUrl}/Admin/DocumentTypes/${id}/Deactivate`,
      {}
    );
  }

  deactivateRule(id: number): Observable<AttachmentValidationCommonResponse<boolean>> {
    return this.http.post<AttachmentValidationCommonResponse<boolean>>(
      `${this.baseUrl}/Admin/Rules/${id}/Deactivate`,
      {}
    );
  }

  deactivateDocumentTypeRule(id: number): Observable<AttachmentValidationCommonResponse<boolean>> {
    return this.http.post<AttachmentValidationCommonResponse<boolean>>(
      `${this.baseUrl}/Admin/DocumentTypeRules/${id}/Deactivate`,
      {}
    );
  }

  getSettings(documentTypeCode: string): Observable<AttachmentValidationCommonResponse<AttachmentValidationSettingsDto>> {
    return this.http.get<AttachmentValidationCommonResponse<AttachmentValidationSettingsDto>>(
      `${this.baseUrl}/Settings/${encodeURIComponent(documentTypeCode)}`,
    );
  }

  validate(
    documentTypeCode: string,
    files: File[]
  ): Observable<AttachmentValidationCommonResponse<AttachmentValidationExecutionResultDto>> {
    const formData = new FormData();
    formData.append('DocumentTypeCode', documentTypeCode);

    (files ?? []).forEach(file => {
      formData.append('files', file, file.name);
    });

    return this.http.post<AttachmentValidationCommonResponse<AttachmentValidationExecutionResultDto>>(
      `${this.baseUrl}/Validate`,
      formData
    );
  }
}
