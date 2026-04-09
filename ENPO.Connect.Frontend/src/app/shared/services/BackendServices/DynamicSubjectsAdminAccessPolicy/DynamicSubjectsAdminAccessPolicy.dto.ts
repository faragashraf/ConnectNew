import { SubjectFieldDefinitionDto, SubjectGroupDefinitionDto } from '../DynamicSubjects/DynamicSubjects.dto';

export type FieldAccessTargetLevel = 'Request' | 'Group' | 'Field' | string;
export type FieldAccessPermissionType = 'Hidden' | 'ReadOnly' | 'Editable' | 'RequiredInput' | string;
export type FieldAccessSubjectType = 'OrgUnit' | 'Position' | 'User' | 'RequestOwner' | 'CurrentCustodian' | string;
export type FieldAccessEffect = 'Allow' | 'Deny' | string;
export type FieldAccessLockMode = 'NoEdit' | 'NoInput' | 'FullLock' | string;

export interface FieldAccessPolicyDto {
  id?: number;
  name: string;
  isActive: boolean;
  defaultAccessMode: FieldAccessPermissionType;
}

export interface FieldAccessPolicyRuleDto {
  id?: number;
  targetLevel: FieldAccessTargetLevel;
  targetId: number;
  stageId?: number;
  actionId?: number;
  permissionType: FieldAccessPermissionType;
  subjectType: FieldAccessSubjectType;
  subjectId?: string;
  effect: FieldAccessEffect;
  priority: number;
  isActive: boolean;
  notes?: string;
}

export interface FieldAccessLockDto {
  id?: number;
  stageId?: number;
  actionId?: number;
  targetLevel: FieldAccessTargetLevel;
  targetId: number;
  lockMode: FieldAccessLockMode;
  allowedOverrideSubjectType?: FieldAccessSubjectType;
  allowedOverrideSubjectId?: string;
  isActive: boolean;
  notes?: string;
}

export interface FieldAccessLookupItemDto {
  id: number;
  code: string;
  label: string;
  groupId?: number;
}

export interface FieldAccessStageLookupDto {
  id: number;
  code: string;
  label: string;
  stepOrder: number;
}

export interface FieldAccessActionLookupDto {
  id: number;
  stageId: number;
  code: string;
  label: string;
  displayOrder: number;
}

export interface FieldAccessPolicyWorkspaceDto {
  requestTypeId: number;
  requestTypeName: string;
  policy: FieldAccessPolicyDto;
  rules: FieldAccessPolicyRuleDto[];
  locks: FieldAccessLockDto[];
  groups: FieldAccessLookupItemDto[];
  fields: FieldAccessLookupItemDto[];
  stages: FieldAccessStageLookupDto[];
  actions: FieldAccessActionLookupDto[];
  generatedAtUtc: string;
}

export interface FieldAccessPolicyWorkspaceUpsertRequestDto {
  policyName?: string;
  isPolicyActive: boolean;
  defaultAccessMode: FieldAccessPermissionType;
  rules: FieldAccessPolicyRuleDto[];
  locks: FieldAccessLockDto[];
}

export interface FieldAccessPreviewRequestDto {
  stageId?: number;
  actionId?: number;
  requestId?: number;
  subjectType?: FieldAccessSubjectType;
  subjectId?: string;
  requestOwnerUserId?: string;
  currentCustodianUnitId?: string;
}

export interface FieldAccessPreviewResponseDto {
  requestTypeId: number;
  stageId?: number;
  actionId?: number;
  subjectType?: string;
  subjectId?: string;
  groups: SubjectGroupDefinitionDto[];
  fields: SubjectFieldDefinitionDto[];
  hiddenGroupsCount: number;
  hiddenFieldsCount: number;
  readOnlyFieldsCount: number;
  requiredFieldsCount: number;
  lockedFieldsCount: number;
}
