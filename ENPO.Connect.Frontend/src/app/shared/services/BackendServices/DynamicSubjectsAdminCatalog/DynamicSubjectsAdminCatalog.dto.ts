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
