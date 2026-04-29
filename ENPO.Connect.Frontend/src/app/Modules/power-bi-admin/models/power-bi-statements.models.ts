export interface ApiErrorDto {
  code?: string;
  message?: string;
}

export interface ApiCommonResponse<T> {
  isSuccess: boolean;
  errors?: ApiErrorDto[];
  data: T;
}

export interface PredefinedSqlStatementDto {
  statementId: number;
  applicationId?: string;
  schemaName?: string;
  sqlType?: string;
  sqlStatement?: string;
  parameters?: string;
  description?: string;
  createdAt?: string;
  database?: string;
}

export interface PredefinedSqlStatementUpsertRequestDto {
  statementId?: number | null;
  applicationId?: string | null;
  schemaName?: string | null;
  sqlType?: string | null;
  sqlStatement?: string | null;
  parameters?: string | null;
  description?: string | null;
  database?: string | null;
}

export interface PowerBiStatementLookupsDto {
  applicationIds: string[];
  schemaNames: string[];
  sqlTypes: string[];
  databases: string[];
}

export interface PowerBiStatementDeleteResultDto {
  deleted: boolean;
  statementId: number;
}
