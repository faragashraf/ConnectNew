export interface ErrorDto {
  code?: string;
  message?: string;
}

export interface CommonResponse<T> {
  isSuccess: boolean;
  errors: ErrorDto[];
  data?: T;
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
}

export interface SubjectCategoryTreeNodeDto {
  categoryId: number;
  parentCategoryId: number;
  categoryName: string;
  isActive: boolean;
  applicationId?: string;
  hasDynamicFields: boolean;
  canCreate: boolean;
  isRuntimeAvailable: boolean;
  runtimeAvailabilityReasons: string[];
  runtimeWarnings: string[];
  displayOrder: number;
  children: SubjectCategoryTreeNodeDto[];
}

export interface SubjectGroupDefinitionDto {
  groupId: number;
  groupName: string;
  groupDescription?: string;
  isExtendable: boolean;
  groupWithInRow?: number;
  canView?: boolean;
  canEdit?: boolean;
  canFill?: boolean;
  isHidden?: boolean;
  isReadOnly?: boolean;
  isRequired?: boolean;
  isLocked?: boolean;
  lockReason?: string;
}

export interface SubjectFieldDefinitionDto {
  mendSql: number;
  categoryId: number;
  mendGroup: number;
  fieldKey: string;
  fieldType: string;
  fieldLabel?: string;
  placeholder?: string;
  defaultValue?: string;
  optionsPayload?: string;
  dataType?: string;
  required: boolean;
  requiredTrue: boolean;
  email: boolean;
  pattern: boolean;
  minValue?: string;
  maxValue?: string;
  mask?: string;
  isDisabledInit: boolean;
  isSearchable: boolean;
  width: number;
  height: number;
  applicationId?: string;
  displayOrder: number;
  isVisible: boolean;
  displaySettingsJson?: string;
  group?: SubjectGroupDefinitionDto;
  canView?: boolean;
  canEdit?: boolean;
  canFill?: boolean;
  isHidden?: boolean;
  isReadOnly?: boolean;
  isRequired?: boolean;
  isLocked?: boolean;
  lockReason?: string;
}

export interface SubjectFormDefinitionDto {
  categoryId: number;
  categoryName: string;
  parentCategoryId: number;
  applicationId?: string;
  groups: SubjectGroupDefinitionDto[];
  fields: SubjectFieldDefinitionDto[];
  requestPolicy?: RequestPolicyDefinitionDto;
}

export interface SubjectAdminPreviewIssueDto {
  code: string;
  severity: string;
  message: string;
  fieldKey?: string;
  groupId?: number;
}

export interface SubjectAdminPreviewReadinessDto {
  isReady: boolean;
  linkedFieldsCount: number;
  activeLinkedFieldsCount: number;
  visibleLinkedFieldsCount: number;
  renderableFieldsCount: number;
  missingDefinitionCount: number;
  missingBindingsCount: number;
  invalidDisplaySettingsCount: number;
  issues: SubjectAdminPreviewIssueDto[];
}

export interface SubjectAdminDirectionalReadinessDto {
  direction: string;
  isPublished: boolean;
  lastChangedAtUtc?: string;
  lastChangedBy?: string;
  readiness: SubjectAdminPreviewReadinessDto;
}

export interface SubjectAdminPreviewWorkspaceDto {
  categoryId: number;
  categoryName: string;
  parentCategoryId: number;
  applicationId?: string;
  subjectType?: SubjectTypeAdminDto;
  formDefinition?: SubjectFormDefinitionDto;
  fieldLinks: SubjectCategoryFieldLinkAdminDto[];
  readiness: SubjectAdminPreviewReadinessDto;
  activeDirection?: string;
  directionalReadiness: SubjectAdminDirectionalReadinessDto[];
  allDirectionsReady: boolean;
  generatedAtUtc: string;
}

export interface SubjectFieldValueDto {
  fildSql?: number;
  fieldKey: string;
  value?: string;
  instanceGroupId?: number;
}

export interface SubjectStakeholderUpsertDto {
  stockholderId: number;
  partyType: string;
  requiredResponse: boolean;
  status?: number;
  dueDate?: string;
  notes?: string;
}

export interface SubjectStakeholderDto extends SubjectStakeholderUpsertDto {
  messageStockholderId: number;
}

export interface SubjectTaskUpsertDto {
  actionTitle: string;
  actionDescription?: string;
  assignedToUserId?: string;
  assignedUnitId?: string;
  dueDateUtc?: string;
  status: number;
}

export interface SubjectTaskDto extends SubjectTaskUpsertDto {
  taskId: number;
  completedAtUtc?: string;
  createdAtUtc: string;
}

export interface SubjectAttachmentDto {
  attachmentId: number;
  fileName: string;
  fileExtension?: string;
  fileSize?: number;
  uploadedAtUtc?: string;
}

export interface SubjectTimelineEventDto {
  timelineEventId: number;
  eventType: string;
  eventTitle: string;
  eventPayloadJson?: string;
  statusFrom?: number;
  statusTo?: number;
  createdBy: string;
  createdAtUtc: string;
}

export interface EnvelopeSummaryDto {
  envelopeId: number;
  envelopeRef: string;
  incomingDate: string;
  sourceEntity?: string;
  deliveryDelegate?: string;
  linkedSubjectsCount: number;
}

export interface EnvelopeLinkedSubjectDto {
  messageId: number;
  requestRef?: string;
  subject?: string;
  status: number;
  categoryId: number;
}

export interface EnvelopeDetailDto {
  envelopeId: number;
  envelopeRef: string;
  incomingDate: string;
  sourceEntity?: string;
  deliveryDelegate?: string;
  notes?: string;
  createdBy: string;
  createdAtUtc: string;
  linkedSubjects: EnvelopeLinkedSubjectDto[];
}

export interface SubjectUpsertRequest {
  categoryId: number;
  documentDirection?: string;
  stageId?: number;
  actionId?: number;
  subject?: string;
  description?: string;
  saveAsDraft: boolean;
  submit: boolean;
  envelopeId?: number;
  targetUnitId?: string;
  dynamicFields: SubjectFieldValueDto[];
  stakeholders: SubjectStakeholderUpsertDto[];
  tasks: SubjectTaskUpsertDto[];
}

export interface SubjectStatusChangeRequestDto {
  newStatus: number;
  notes?: string;
}

export interface SubjectStatusChangeResponseDto {
  messageId: number;
  oldStatus: number;
  newStatus: number;
  changedAtUtc: string;
  changedBy: string;
}

export interface SubjectListQueryDto {
  searchText?: string;
  categoryId?: number;
  status?: number;
  assignedUnitId?: number;
  createdFrom?: string;
  createdTo?: string;
  onlyMyItems: boolean;
  pageNumber: number;
  pageSize: number;
}

export interface SubjectListItemDto {
  messageId: number;
  documentDirection?: string;
  requestRef?: string;
  subject?: string;
  description?: string;
  categoryId: number;
  status: number;
  statusLabel: string;
  createdBy?: string;
  assignedUnitId?: string;
  createdDate: string;
  lastModifiedDate?: string;
  attachmentsCount: number;
  stakeholdersCount: number;
  tasksCount: number;
  envelopesCount: number;
}

export interface PagedSubjectListDto {
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  items: SubjectListItemDto[];
}

export interface SubjectDetailDto {
  messageId: number;
  categoryId: number;
  documentDirection?: string;
  subject?: string;
  description?: string;
  requestRef?: string;
  status: number;
  statusLabel: string;
  createdBy?: string;
  assignedUnitId?: string;
  currentResponsibleUnitId?: string;
  createdDate: string;
  lastModifiedDate?: string;
  dynamicFields: SubjectFieldValueDto[];
  attachments: SubjectAttachmentDto[];
  stakeholders: SubjectStakeholderDto[];
  tasks: SubjectTaskDto[];
  timeline: SubjectTimelineEventDto[];
  linkedEnvelopes: EnvelopeSummaryDto[];
}

export interface EnvelopeUpsertRequestDto {
  envelopeRef: string;
  incomingDate: string;
  sourceEntity?: string;
  deliveryDelegate?: string;
  notes?: string;
  linkedSubjectIds: number[];
}

export interface EnvelopeListQueryDto {
  searchText?: string;
  incomingDateFrom?: string;
  incomingDateTo?: string;
  pageNumber: number;
  pageSize: number;
}

export interface PagedEnvelopeListDto {
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  items: EnvelopeSummaryDto[];
}

export interface SubjectDashboardCardDto {
  key: string;
  label: string;
  count: number;
}

export interface SubjectDashboardDto {
  totalSubjects: number;
  draftCount: number;
  submittedCount: number;
  underReviewCount: number;
  pendingCompletionCount: number;
  inProgressCount: number;
  completedCount: number;
  rejectedCount: number;
  archivedCount: number;
  totalEnvelopes: number;
  openTasksCount: number;
  statusCards: SubjectDashboardCardDto[];
  recentSubjects: SubjectListItemDto[];
  recentUpdates: SubjectTimelineEventDto[];
}

export interface SubjectDashboardQueryDto {
  categoryId?: number;
  unitId?: number;
  onlyMyItems: boolean;
}

export interface DynamicSubjectRealtimeEventDto {
  kind: string;
  eventId: string;
  eventType: string;
  entityType: string;
  entityId: number;
  messageId?: number;
  envelopeId?: number;
  categoryId?: number;
  status?: number;
  statusLabel?: string;
  referenceNumber?: string;
  summary?: string;
  timestampUtc: string;
  actorUserId?: string;
  data: Record<string, string | undefined>;
}

export interface RequestPolicyConditionDto {
  variable: string;
  operator?: string;
  value?: string;
  values?: string[];
}

export interface RequestPolicyFieldPatchDto {
  fieldKey: string;
  label?: string;
  visible?: boolean;
  required?: boolean;
  readonly?: boolean;
  placeholder?: string;
  helpText?: string;
}

export interface RequestPolicyPresentationRuleDto {
  ruleId?: string;
  isEnabled?: boolean;
  priority?: number;
  conditions: RequestPolicyConditionDto[];
  fieldPatches: RequestPolicyFieldPatchDto[];
}

export interface RequestPolicyPrincipalScopeDto {
  unitIds: string[];
  roleIds?: string[];
  groupIds?: string[];
}

export interface RequestAccessPolicyDto {
  createMode?: 'single' | 'multi' | string;
  createScope: RequestPolicyPrincipalScopeDto;
  readScope: RequestPolicyPrincipalScopeDto;
  workScope: RequestPolicyPrincipalScopeDto;
  inheritLegacyAccess?: boolean;
}

export interface RequestWorkflowPolicyDto {
  mode?: 'static' | 'manual' | 'hybrid' | string;
  directionMode?: 'fixed' | 'selectable' | string;
  fixedDirection?: string;
  staticTargetUnitIds: string[];
  allowManualSelection?: boolean;
  manualTargetFieldKey?: string;
  manualSelectionRequired?: boolean;
  defaultTargetUnitId?: string;
}

export interface RequestPolicyDefinitionDto {
  version?: number;
  presentationRules: RequestPolicyPresentationRuleDto[];
  accessPolicy: RequestAccessPolicyDto;
  workflowPolicy: RequestWorkflowPolicyDto;
}

export interface SubjectTypeAdminDto {
  categoryId: number;
  parentCategoryId: number;
  categoryName: string;
  applicationId?: string;
  catMend?: string;
  catWorkFlow: number;
  catSms: boolean;
  catMailNotification: boolean;
  to?: string;
  cc?: string;
  isActive: boolean;
  hasDynamicFields: boolean;
  canCreate: boolean;
  displayOrder: number;
  settingsJson?: string;
  referencePolicyId?: number;
  referencePolicyEnabled: boolean;
  referencePrefix?: string;
  referenceSeparator?: string;
  sourceFieldKeys?: string;
  includeYear: boolean;
  useSequence: boolean;
  sequenceName?: string;
  sequencePaddingLength?: number;
  sequenceResetScope?: 'none' | 'yearly' | 'monthly' | string;
  lastModifiedBy?: string;
  lastModifiedAtUtc?: string;
  requestPolicy?: RequestPolicyDefinitionDto;
}

export interface SubjectTypeAdminUpsertRequestDto {
  isActive: boolean;
  referencePolicyEnabled: boolean;
  referencePrefix?: string;
  referenceSeparator?: string;
  sourceFieldKeys?: string;
  includeYear: boolean;
  useSequence: boolean;
  sequenceName?: string;
  sequencePaddingLength?: number;
  sequenceResetScope?: 'none' | 'yearly' | 'monthly' | string;
  requestPolicy?: RequestPolicyDefinitionDto;
}

export interface SubjectTypeAdminTreeMoveRequestDto {
  newParentCategoryId: number;
  newIndex: number;
}

export interface SubjectTypeAdminStatusRequestDto {
  isActive: boolean;
}

export interface SubjectTypeAdminDirectionStatusRequestDto {
  isActive: boolean;
}

export interface SubjectTypeAdminCreateRequestDto {
  parentCategoryId: number;
  categoryName: string;
  applicationId?: string;
  catMend?: string;
  catWorkFlow: number;
  catSms: boolean;
  catMailNotification: boolean;
  to?: string;
  cc?: string;
  isActive: boolean;
}

export interface SubjectTypeAdminUpdateRequestDto {
  categoryName: string;
  applicationId?: string;
  catMend?: string;
  catWorkFlow: number;
  catSms: boolean;
  catMailNotification: boolean;
  to?: string;
  cc?: string;
  isActive: boolean;
}

export interface SubjectAdminFieldDto {
  cdmendSql: number;
  fieldKey: string;
  fieldType: string;
  fieldLabel?: string;
  placeholder?: string;
  defaultValue?: string;
  optionsPayload?: string;
  dataType?: string;
  required: boolean;
  requiredTrue: boolean;
  email: boolean;
  pattern: boolean;
  minValue?: string;
  maxValue?: string;
  mask?: string;
  isActive: boolean;
  width: number;
  height: number;
  isDisabledInit: boolean;
  isSearchable: boolean;
  applicationId?: string;
  linkedCategoriesCount: number;
}

export interface SubjectAdminFieldUpsertRequestDto {
  cdmendSql?: number;
  fieldKey: string;
  fieldType: string;
  fieldLabel?: string;
  placeholder?: string;
  defaultValue?: string;
  optionsPayload?: string;
  dataType?: string;
  required: boolean;
  requiredTrue: boolean;
  email: boolean;
  pattern: boolean;
  minValue?: string;
  maxValue?: string;
  mask?: string;
  isActive: boolean;
  width: number;
  height: number;
  isDisabledInit: boolean;
  isSearchable: boolean;
  applicationId?: string;
}

export interface SubjectAdminGroupDto {
  groupId: number;
  groupName?: string;
  groupDescription?: string;
  isExtendable: boolean;
  groupWithInRow?: number;
  linkedFieldsCount: number;
}

export interface SubjectAdminGroupUpsertRequestDto {
  groupName?: string;
  groupDescription?: string;
  isExtendable: boolean;
  groupWithInRow?: number;
}

export interface SubjectCategoryFieldLinkAdminDto {
  mendSql: number;
  categoryId: number;
  fieldKey: string;
  fieldLabel?: string;
  fieldType?: string;
  groupId: number;
  groupName?: string;
  isActive: boolean;
  displayOrder: number;
  isVisible: boolean;
  displaySettingsJson?: string;
  applicationId?: string;
}

export interface SubjectCategoryFieldLinkUpsertItemDto {
  mendSql?: number;
  fieldKey: string;
  groupId: number;
  isActive: boolean;
  displayOrder: number;
  isVisible: boolean;
  displaySettingsJson?: string;
}

export interface SubjectCategoryFieldLinksUpsertRequestDto {
  links: SubjectCategoryFieldLinkUpsertItemDto[];
}

export interface SubjectNotificationRuleDto {
  id: number;
  subjectTypeId: number;
  eventType: 'CREATE' | 'UPDATE' | 'FORWARD' | string;
  recipientType: 'USER' | 'ROLE' | 'UNIT' | 'GROUP' | string;
  recipientValue: string;
  template: string;
  isActive: boolean;
}

export interface SubjectNotificationRuleUpsertDto {
  id?: number;
  eventType: 'CREATE' | 'UPDATE' | 'FORWARD' | string;
  recipientType: 'USER' | 'ROLE' | 'UNIT' | 'GROUP' | string;
  recipientValue: string;
  template: string;
  isActive: boolean;
}

export interface SubjectNotificationRulesUpsertRequestDto {
  rules: SubjectNotificationRuleUpsertDto[];
}

export const DYNAMIC_SUBJECT_EVENT_KIND = 'DYNAMIC_SUBJECT_EVENT';
