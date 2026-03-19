// Update interfaces in column.ts
export interface Column {
  COLUMN_NAME: string;
  DATA_TYPE: string;
  DATA_LENGTH: string;
  COLUMN_ID: string;
  NULLABLE: string;
  TABLE_NAME?: string;
}

export interface DatabaseTable {
  SCHEMA: string,
  TABLE_NAME: string;
  OBJECT_TYPE: string;
  columns: Column[];
}

export interface Schema {
  SCHEMA_NAME: string;
  tables: DatabaseTable[];
}


export interface SelectedTable {
  table: DatabaseTable;
  alias: string;
}

export interface JoinCondition {
  leftTable: string;
  leftColumn: string;
  rightTable: string;
  rightColumn: string;
  joinType: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
}