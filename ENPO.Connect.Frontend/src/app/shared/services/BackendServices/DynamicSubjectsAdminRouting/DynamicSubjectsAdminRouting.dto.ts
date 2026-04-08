export type RoutingDirectionMode = 'None' | 'InboundOnly' | 'OutboundOnly' | 'Both';

export type RoutingStepType =
  | 'Start'
  | 'Review'
  | 'Approval'
  | 'Assignment'
  | 'Completion'
  | 'Return'
  | 'Rejection'
  | 'Escalation';

export type RoutingTargetMode =
  | 'UnitType'
  | 'SpecificUnit'
  | 'UnitLeader'
  | 'Position'
  | 'CommitteeMembers'
  | 'ParentUnitLeader'
  | 'ChildUnitByType';

export type RoutingSelectedNodeType = 'OrgUnit' | 'Position' | 'SpecificUser';
export type RequestAvailabilityMode = 'Public' | 'Restricted';

export type RoutingAudienceResolutionMode =
  | 'OrgUnitAllMembers'
  | 'OrgUnitLeaderOnly'
  | 'PositionOccupants'
  | 'SpecificUserOnly';

export type RoutingWorkDistributionMode =
  | 'SharedInbox'
  | 'AutoDistributeActive'
  | 'ManualAssignment';

export interface SubjectRoutingProfileDto {
  id: number;
  subjectTypeId: number;
  nameAr: string;
  descriptionAr?: string;
  isActive: boolean;
  directionMode: RoutingDirectionMode | string;
  startStepId?: number;
  versionNo: number;
  createdBy: string;
  createdDate: string;
  lastModifiedBy?: string;
  lastModifiedDate?: string;
}

export interface SubjectRoutingProfileUpsertRequestDto {
  subjectTypeId: number;
  nameAr: string;
  descriptionAr?: string;
  isActive: boolean;
  directionMode: RoutingDirectionMode | string;
  startStepId?: number;
  versionNo: number;
}

export interface SubjectRoutingStepDto {
  id: number;
  routingProfileId: number;
  stepCode: string;
  stepNameAr: string;
  stepType: RoutingStepType | string;
  stepOrder: number;
  isStart: boolean;
  isEnd: boolean;
  slaHours?: number;
  isActive: boolean;
  notesAr?: string;
}

export interface SubjectRoutingStepUpsertRequestDto {
  routingProfileId: number;
  stepCode: string;
  stepNameAr: string;
  stepType: RoutingStepType | string;
  stepOrder: number;
  isStart: boolean;
  isEnd: boolean;
  slaHours?: number;
  isActive: boolean;
  notesAr?: string;
}

export interface SubjectRoutingTargetDto {
  id: number;
  routingStepId: number;
  targetMode: RoutingTargetMode | string;
  oracleUnitTypeId?: number;
  oracleOrgUnitId?: number;
  positionId?: number;
  positionCode?: string;
  selectedNodeType?: RoutingSelectedNodeType | string;
  selectedNodeNumericId?: number;
  selectedNodeUserId?: string;
  audienceResolutionMode?: RoutingAudienceResolutionMode | string;
  workDistributionMode?: RoutingWorkDistributionMode | string;
  allowMultipleReceivers: boolean;
  sendToLeaderOnly: boolean;
  isActive: boolean;
  notesAr?: string;
}

export interface SubjectRoutingTargetUpsertRequestDto {
  routingStepId: number;
  targetMode: RoutingTargetMode | string;
  oracleUnitTypeId?: number;
  oracleOrgUnitId?: number;
  positionId?: number;
  positionCode?: string;
  selectedNodeType?: RoutingSelectedNodeType | string;
  selectedNodeNumericId?: number;
  selectedNodeUserId?: string;
  audienceResolutionMode?: RoutingAudienceResolutionMode | string;
  workDistributionMode?: RoutingWorkDistributionMode | string;
  allowMultipleReceivers: boolean;
  sendToLeaderOnly: boolean;
  isActive: boolean;
  notesAr?: string;
}

export interface SubjectRoutingTransitionDto {
  id: number;
  routingProfileId: number;
  fromStepId: number;
  toStepId: number;
  actionCode: string;
  actionNameAr: string;
  displayOrder: number;
  requiresComment: boolean;
  requiresMandatoryFieldsCompletion: boolean;
  isRejectPath: boolean;
  isReturnPath: boolean;
  isEscalationPath: boolean;
  conditionExpression?: string;
  isActive: boolean;
}

export interface SubjectRoutingTransitionUpsertRequestDto {
  routingProfileId: number;
  fromStepId: number;
  toStepId: number;
  actionCode: string;
  actionNameAr: string;
  displayOrder: number;
  requiresComment: boolean;
  requiresMandatoryFieldsCompletion: boolean;
  isRejectPath: boolean;
  isReturnPath: boolean;
  isEscalationPath: boolean;
  conditionExpression?: string;
  isActive: boolean;
}

export interface SubjectTypeRoutingBindingDto {
  id: number;
  subjectTypeId: number;
  routingProfileId: number;
  isDefault: boolean;
  appliesToInbound: boolean;
  appliesToOutbound: boolean;
  isActive: boolean;
}

export interface SubjectTypeRoutingBindingUpsertRequestDto {
  subjectTypeId: number;
  routingProfileId: number;
  isDefault: boolean;
  appliesToInbound: boolean;
  appliesToOutbound: boolean;
  isActive: boolean;
}

export interface SubjectRoutingProfileWorkspaceDto {
  profile?: SubjectRoutingProfileDto;
  binding?: SubjectTypeRoutingBindingDto;
  steps: SubjectRoutingStepDto[];
  targets: SubjectRoutingTargetDto[];
  transitions: SubjectRoutingTransitionDto[];
}

export interface SubjectRoutingPreviewNodeDto {
  stepId: number;
  stepCode: string;
  stepNameAr: string;
  stepType: string;
  stepOrder: number;
  isStart: boolean;
  isEnd: boolean;
  isRejectStep: boolean;
  isReturnStep: boolean;
  isEscalationStep: boolean;
  targetsSummaryAr: string;
}

export interface SubjectRoutingPreviewEdgeDto {
  transitionId: number;
  fromStepId: number;
  toStepId: number;
  actionCode: string;
  actionNameAr: string;
  displayOrder: number;
  isRejectPath: boolean;
  isReturnPath: boolean;
  isEscalationPath: boolean;
}

export interface SubjectRoutingPreviewDto {
  routingProfileId: number;
  profileNameAr: string;
  startStepId?: number;
  nodes: SubjectRoutingPreviewNodeDto[];
  edges: SubjectRoutingPreviewEdgeDto[];
  summaryAr: string;
}

export interface SubjectRoutingValidationMessageDto {
  code: string;
  severity: 'Error' | 'Warning' | string;
  isBlocking: boolean;
  messageAr: string;
  relatedEntityType?: string;
  relatedEntityId?: number;
}

export interface SubjectRoutingValidationResultDto {
  routingProfileId: number;
  isValid: boolean;
  errors: SubjectRoutingValidationMessageDto[];
  warnings: SubjectRoutingValidationMessageDto[];
}

export interface SubjectRoutingOrgUnitTypeLookupDto {
  unitTypeId: number;
  typeName: string;
  leaderTitle?: string;
  isActive: boolean;
}

export interface SubjectRoutingOrgUnitLookupDto {
  unitId: number;
  unitName: string;
  unitTypeId: number;
  unitTypeName: string;
  parentId?: number;
  isActive: boolean;
}

export interface SubjectRoutingOrgPositionLookupDto {
  positionId: number;
  userId: string;
  userDisplayNameAr?: string;
  userDisplayNameEn?: string;
  unitId: number;
  unitName: string;
  isManager: boolean;
  isActive: boolean;
  startDate?: string;
  endDate?: string;
}

export interface SubjectRoutingOrgUserLookupDto {
  userId: string;
  displayNameAr?: string;
  displayNameEn?: string;
  activePositionsCount: number;
}

export interface SubjectRoutingOrgTreeNodeDto {
  nodeType: RoutingSelectedNodeType | string;
  nodeNumericId?: number;
  nodeUserId?: string;
  labelAr: string;
  secondaryLabelAr?: string;
  parentNodeType?: RoutingSelectedNodeType | string;
  parentNodeNumericId?: number;
  parentNodeUserId?: string;
  isSelectable: boolean;
  hasChildren: boolean;
  isActive: boolean;
}

export interface SubjectTypeRequestAvailabilityDto {
  subjectTypeId: number;
  availabilityMode: RequestAvailabilityMode | string;
  selectedNodeType?: RoutingSelectedNodeType | string;
  selectedNodeNumericId?: number;
  selectedNodeUserId?: string;
  selectedNodeLabelAr?: string;
  selectedNodeSecondaryLabelAr?: string;
  selectedNodePathAr?: string;
  availabilitySummaryAr: string;
  lastModifiedBy?: string;
  lastModifiedAtUtc?: string;
}

export interface SubjectTypeRequestAvailabilityUpsertRequestDto {
  availabilityMode: RequestAvailabilityMode | string;
  selectedNodeType?: RoutingSelectedNodeType | string;
  selectedNodeNumericId?: number;
  selectedNodeUserId?: string;
}

export interface SubjectAvailabilityNodeValidationRequestDto {
  selectedNodeType?: RoutingSelectedNodeType | string;
  selectedNodeNumericId?: number;
  selectedNodeUserId?: string;
}

export interface SubjectAvailabilityNodeValidationResultDto {
  isValid: boolean;
  selectedNodeType?: RoutingSelectedNodeType | string;
  selectedNodeNumericId?: number;
  selectedNodeUserId?: string;
  selectedNodeLabelAr?: string;
  selectedNodeSecondaryLabelAr?: string;
  selectedNodePathAr?: string;
  availabilitySummaryAr: string;
}
