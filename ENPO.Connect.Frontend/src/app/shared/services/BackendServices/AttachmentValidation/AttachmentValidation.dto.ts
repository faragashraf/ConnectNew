import { ErrorDto } from '../dto-shared';

export interface AttachmentValidationCommonResponse<T> {
  readonly isSuccess: boolean;
  errors: ErrorDto[] | undefined;
  data: T;
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  readonly totalPages: number;
}

export type AttachmentValidationMode = 'UploadOnly' | 'UploadAndValidate';

export interface AttachmentValidationDocumentTypeDto {
  id: number;
  documentTypeCode: string;
  documentTypeNameAr: string;
  descriptionAr?: string | null;
  validationMode: AttachmentValidationMode;
  isValidationRequired: boolean;
  isActive: boolean;
  createdBy: string;
  createdDate: string;
  lastModifiedBy?: string | null;
  lastModifiedDate?: string | null;
}

export interface AttachmentValidationRuleDto {
  id: number;
  ruleCode: string;
  ruleNameAr: string;
  descriptionAr?: string | null;
  parameterSchemaJson?: string | null;
  isSystemRule: boolean;
  isActive: boolean;
  createdBy: string;
  createdDate: string;
  lastModifiedBy?: string | null;
  lastModifiedDate?: string | null;
}

export interface AttachmentValidationDocumentTypeRuleDto {
  id: number;
  documentTypeId: number;
  ruleId: number;
  ruleOrder: number;
  isActive: boolean;
  isRequired: boolean;
  stopOnFailure: boolean;
  failureMessageAr?: string | null;
  parametersJson?: string | null;
  documentTypeCode?: string | null;
  documentTypeNameAr?: string | null;
  ruleCode?: string | null;
  ruleNameAr?: string | null;
  createdBy: string;
  createdDate: string;
  lastModifiedBy?: string | null;
  lastModifiedDate?: string | null;
}

export interface AttachmentValidationWorkspaceDto {
  documentTypes: AttachmentValidationDocumentTypeDto[];
  rules: AttachmentValidationRuleDto[];
  documentTypeRules: AttachmentValidationDocumentTypeRuleDto[];
}

export interface AttachmentValidationDocumentTypeUpsertRequest {
  id: number;
  documentTypeCode: string;
  documentTypeNameAr: string;
  descriptionAr?: string | null;
  validationMode: AttachmentValidationMode;
  isValidationRequired: boolean;
  isActive: boolean;
}

export interface AttachmentValidationRuleUpsertRequest {
  id: number;
  ruleCode: string;
  ruleNameAr: string;
  descriptionAr?: string | null;
  parameterSchemaJson?: string | null;
  isSystemRule: boolean;
  isActive: boolean;
}

export interface AttachmentValidationDocumentTypeRuleUpsertRequest {
  id: number;
  documentTypeId: number;
  ruleId: number;
  ruleOrder: number;
  isActive: boolean;
  isRequired: boolean;
  stopOnFailure: boolean;
  failureMessageAr?: string | null;
  parametersJson?: string | null;
}

export interface AttachmentValidationResolvedRuleDto {
  bindingId: number;
  ruleId: number;
  ruleCode: string;
  ruleNameAr: string;
  ruleOrder: number;
  isRequired: boolean;
  stopOnFailure: boolean;
  failureMessageAr?: string | null;
  parametersJson?: string | null;
}

export interface AttachmentValidationSettingsDto {
  documentTypeId: number;
  documentTypeCode: string;
  documentTypeNameAr: string;
  validationMode: AttachmentValidationMode;
  isValidationRequired: boolean;
  rules: AttachmentValidationResolvedRuleDto[];
}

export interface AttachmentValidationRuleResultDto {
  bindingId: number;
  ruleId: number;
  ruleCode: string;
  ruleNameAr: string;
  isRequired: boolean;
  passed: boolean;
  messageAr: string;
}

export interface AttachmentValidationExecutionResultDto {
  documentTypeId: number;
  documentTypeCode: string;
  documentTypeNameAr: string;
  validationMode: AttachmentValidationMode;
  isValidationRequired: boolean;
  filesCount: number;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  ruleResults: AttachmentValidationRuleResultDto[];
}
