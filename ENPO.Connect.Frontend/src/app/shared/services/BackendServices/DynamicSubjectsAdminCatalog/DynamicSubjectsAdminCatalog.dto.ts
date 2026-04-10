export interface AdminCatalogApplicationDto {
  applicationId: string;
  applicationName: string;
  isActive: boolean;
}

export interface AdminCatalogApplicationCreateRequestDto {
  applicationId: string;
  applicationName: string;
  isActive: boolean;
}

export interface AdminCatalogApplicationUpdateRequestDto {
  applicationName: string;
  isActive: boolean;
}

export interface AdminCatalogCategoryDto {
  categoryId: number;
  parentCategoryId: number;
  categoryName: string;
  applicationId?: string;
  isActive: boolean;
}

export interface AdminCatalogCategoryTreeNodeDto {
  categoryId: number;
  parentCategoryId: number;
  categoryName: string;
  applicationId?: string;
  isActive: boolean;
  children: AdminCatalogCategoryTreeNodeDto[];
}

export interface AdminCatalogCategoryCreateRequestDto {
  applicationId: string;
  categoryName: string;
  parentCategoryId: number;
  isActive: boolean;
}

export interface AdminCatalogCategoryUpdateRequestDto {
  categoryName: string;
  parentCategoryId: number;
  isActive: boolean;
}

export interface AdminCatalogApplicationDeleteDiagnosticsDto {
  applicationId: string;
  linkedCategoriesCount: number;
  linkedFieldsCount: number;
  linkedGroupsCount: number;
  canHardDelete: boolean;
  willUseSoftDelete: boolean;
  isBlocked: boolean;
  decisionReason?: string;
}

export interface AdminCatalogCategoryDeleteDiagnosticsDto {
  categoryId: number;
  childrenCount: number;
  linkedFieldsCount: number;
  linkedMessagesCount: number;
  linkedGroupsCount: number;
  canHardDelete: boolean;
  willUseSoftDelete: boolean;
  isBlocked: boolean;
  decisionReason?: string;
}

export interface AdminCatalogDeleteResultDto {
  deleted: boolean;
  mode: string;
  message?: string;
}

export interface AdminCatalogGroupDto {
  groupId: number;
  categoryId: number;
  applicationId: string;
  groupName: string;
  groupDescription?: string;
  parentGroupId?: number;
  displayOrder: number;
  isActive: boolean;
}

export interface AdminCatalogGroupTreeNodeDto {
  groupId: number;
  categoryId: number;
  applicationId: string;
  groupName: string;
  groupDescription?: string;
  parentGroupId?: number;
  displayOrder: number;
  isActive: boolean;
  children: AdminCatalogGroupTreeNodeDto[];
}

export interface AdminCatalogGroupCreateRequestDto {
  categoryId: number;
  applicationId: string;
  groupName: string;
  groupDescription?: string;
  parentGroupId?: number;
  displayOrder: number;
  isActive: boolean;
}

export interface AdminCatalogGroupUpdateRequestDto {
  groupName: string;
  groupDescription?: string;
  parentGroupId?: number;
  displayOrder: number;
  isActive: boolean;
}

export interface AdminCatalogFieldListItemDto {
  applicationId: string;
  fieldKey: string;
  cdmendSql: number;
  fieldLabel: string;
  fieldType: string;
  dataType?: string;
  required: boolean;
  isActive: boolean;
  linkedCategoriesCount: number;
  linkedSettingsCount: number;
  linkedHistoryCount: number;
  isUsed: boolean;
}

export interface AdminCatalogFieldDto {
  applicationId: string;
  fieldKey: string;
  cdmendSql: number;
  fieldType: string;
  fieldLabel: string;
  placeholder?: string;
  defaultValue?: string;
  cdmendTbl?: string;
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
  linkedCategoriesCount: number;
  linkedSettingsCount: number;
  linkedHistoryCount: number;
  isUsed: boolean;
}

export interface AdminCatalogFieldCreateRequestDto {
  applicationId: string;
  fieldKey: string;
  cdmendSql?: number;
  fieldType: string;
  fieldLabel?: string;
  placeholder?: string;
  defaultValue?: string;
  cdmendTbl?: string;
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
}

export interface AdminCatalogFieldUpdateRequestDto {
  cdmendSql?: number;
  fieldType: string;
  fieldLabel?: string;
  placeholder?: string;
  defaultValue?: string;
  cdmendTbl?: string;
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
}

export interface AdminCatalogFieldDeleteDiagnosticsDto {
  applicationId: string;
  fieldKey: string;
  cdmendSql: number;
  linkedCategoriesCount: number;
  linkedActiveCategoriesCount: number;
  linkedSettingsCount: number;
  linkedHistoryByKeyCount: number;
  linkedHistoryBySqlCount: number;
  canHardDelete: boolean;
  willUseSoftDelete: boolean;
  isBlocked: boolean;
  decisionReason?: string;
}

export interface AdminCatalogFieldStatusOptionDto {
  key: string;
  label: string;
}

export interface AdminCatalogFieldLookupsDto {
  fieldTypes: string[];
  dataTypes: string[];
  statusOptions: AdminCatalogFieldStatusOptionDto[];
}

export type AdminCatalogFieldStatusFilter = 'all' | 'active' | 'inactive';

export interface AdminControlCenterRequestPreviewFieldDto {
  fieldId: number;
  fieldName: string;
  isVisible: boolean;
  isRequired: boolean;
  reasons: string[];
}

export interface AdminControlCenterRequestPreviewDto {
  requestTypeId: number;
  requestTypeName: string;
  isAvailable: boolean;
  availabilityReasons: string[];
  fields: AdminControlCenterRequestPreviewFieldDto[];
  warnings: string[];
}
