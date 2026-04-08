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
