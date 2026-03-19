import { Injectable } from '@angular/core';
import { PowerBiController, SchemaList, SelectRequestModel } from './PowerBi.service';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { Column, DatabaseTable, Schema } from '../models';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { ConditionalDate } from 'src/app/shared/Pipe/Conditional-date.pipe';



export interface ColumnConfig {
  field: string;          // Object property name (e.g. "DocumentId")
  header: string;         // Arabic label (e.g. "رقم الوثيقة")
  visible: boolean;       // Should this column appear in the table?
}

@Injectable({
  providedIn: 'root'
})
export class GenerateQueryService {

  constructor(private spinner: SpinnerService, private msg: MsgsService,private conditionalDate: ConditionalDate,
     private powerBiController: PowerBiController) { }

  selectRequestModel: SelectRequestModel = {} as SelectRequestModel
  selectedSchema: SchemaList = {} as SchemaList;
  generatedQuery: string = '';
  selectedEnvironment: string = 'production';

  SchemaList: SchemaList[] = []
  schemas: Schema[] = [];
  tables: DatabaseTable[] = [];
  columns: Column[] = [];
  selectedTable: DatabaseTable[] = [];
  selectedColumns: Column[] = [];


  tableGenericData: any[] = []; // Your generic data array
  tableGenericSelectedRow: any;
  _columns: string[] = []; // Dynamically extracted column names

  duration: any = 0


  populateSchemas(rawData: any[]): DatabaseTable[] {
    const tableMap = new Map<string, DatabaseTable>();

    rawData.forEach((row) => {
      // Destructure SCHEMA from the row along with other properties
      const {
        OWNER: SCHEMA,
        TABLE_NAME,
        OBJECT_TYPE,
        COLUMN_NAME,
        DATA_TYPE,
        DATA_LENGTH,
        NULLABLE,
        COLUMN_ID
      } = row;

      // Create composite key using schema + table name
      const tableKey = `${SCHEMA}.${TABLE_NAME}`;

      if (!tableMap.has(tableKey)) {
        tableMap.set(tableKey, {
          SCHEMA: SCHEMA,
          TABLE_NAME: TABLE_NAME,
          OBJECT_TYPE: OBJECT_TYPE,
          columns: []
        });
      }

      const table = tableMap.get(tableKey)!;
      table.columns.push({
        COLUMN_NAME,
        DATA_TYPE,
        DATA_LENGTH,
        NULLABLE,
        COLUMN_ID,
      });
    });

    return Array.from(tableMap.values());
  }
  generateSelectStatment() {
    // Validate selections
    if (this.selectedTable.length === 0 || this.selectedColumns.length === 0) {
      this.generatedQuery = 'Please select a schema, at least one table, and columns.';
      return;
    }

    // Build SELECT clause
    const columns = this.selectedColumns
      .map(c => `${this.generateAlias(c.TABLE_NAME as string)}.${c.COLUMN_NAME}`) // Qualified column names
      .join(', \n            ');

    // Build FROM and JOIN clauses
    // const schemaName = this.selectedSchema.schemA_NAME;
    let fromClause = `${this.selectedTable[0].SCHEMA}.${this.selectedTable[0].TABLE_NAME} ${this.generateAlias(this.selectedTable[0].TABLE_NAME as string)}`;

    // Add Joins
    for (const condition of this.joinConditions) {
      if (condition.leftTable && condition.leftColumn && condition.rightTable && condition.rightColumn) {
        const leftAlias = this.generateAlias(condition.leftTable.TABLE_NAME as string);
        const rightAlias = this.generateAlias(condition.rightTable.TABLE_NAME as string);
        const leftCol = `${leftAlias}.${condition.leftColumn.COLUMN_NAME}`;
        const rightCol = `${rightAlias}.${condition.rightColumn.COLUMN_NAME}`;

        let onCondition = '';

        // Check data types and apply TO_CHAR if needed
        const leftType = condition.leftColumn.DATA_TYPE?.toUpperCase();
        const rightType = condition.rightColumn.DATA_TYPE?.toUpperCase();

        if (leftType === 'NUMBER' && rightType === 'VARCHAR2') {
          onCondition = `TO_CHAR(${leftCol}) = ${rightCol}`;
        } else if (leftType === 'VARCHAR2' && rightType === 'NUMBER') {
          onCondition = `${leftCol} = TO_CHAR(${rightCol})`;
        } else {
          onCondition = `${leftCol} = ${rightCol}`;
        }

        fromClause +=
          `\n ${condition.joinType} JOIN ${condition.rightTable.SCHEMA}.${condition.rightTable.TABLE_NAME} ${rightAlias}` +
          `\n ON ${onCondition}`;
      }
    }
    let _where: string[] = [];
    this.Conditions.forEach(W => {
      if (W.value.length > 0) {
        if (W.cond == 'IN') {
          if (W.col.DATA_TYPE.includes('NUMBER')) {
            _where.push(`${this.generateAlias(W.col.TABLE_NAME as string)}.${W.col.COLUMN_NAME} ${W.cond} (${W.value.split(',').map(v => v.trim()).join(",")})`);
          } else {
            _where.push(`${this.generateAlias(W.col.TABLE_NAME as string)}.${W.col.COLUMN_NAME} ${W.cond} ('${W.value.split(',').map(v => v.trim()).join("','")}')`);
          }
        } else {
          if (W.col.DATA_TYPE.includes('NUMBER')) {
            _where.push(`${this.generateAlias(W.col.TABLE_NAME as string)}.${W.col.COLUMN_NAME} ${W.cond} ${W.value}`);
          } else {
            _where.push(`${this.generateAlias(W.col.TABLE_NAME as string)}.${W.col.COLUMN_NAME} ${W.cond} '${W.value}'`);
          }
        }
      }
    })
    // Final Query
    this.generatedQuery = `SELECT \n            ${columns}\nFROM ${fromClause} ${_where.length > 0 ? '\n WHERE' : ''}  ${_where.join('\n AND ')}`;
  }

  onTableSelected() {
    if (this.selectedTable.length == 0) {
      this.selectedColumns = [];
      this.columns = [];
      this.selectedColumns = [];
      this.joinConditions = [];
      this.Conditions = [];
    }
    if (this.selectedTable && this.selectedTable.length > 0) {
      // Combine all columns from the selected tables and include the table name
      this.columns = this.selectedTable.flatMap((table) =>
        table.columns.map((column) => ({
          ...column,
          TABLE_NAME: table.TABLE_NAME, // Add the table name to each column
        }))
      );
    } else {
      // Clear columns if no table is selected
      this.columns = [];
    }
  }

  // New Properties
  joinConditions: {
    leftTable?: DatabaseTable,
    leftColumn?: Column,
    rightTable?: DatabaseTable,
    rightColumn?: Column,
    joinType?: string;
  }[] = [];
  // Add/Remove Join Conditions
  addJoinCondition() {
    this.joinConditions.push({});
  }

  removeJoinCondition(index: number) {
    this.joinConditions.splice(index, 1);
  }

  // Get Columns for a Specific Table
  getColumnsForTable(tableName?: string): Column[] {
    if (!tableName) return [];
    const table = this.selectedTable.find(t => t.TABLE_NAME === tableName);
    return table ? table.columns : [];
  }

  Conditions: {
    col: Column,
    cond: string,
    value: string,
  }[] = [];
  addCondition() {
    this.Conditions.push({
      col: {
        COLUMN_NAME: '',
        DATA_TYPE: '',
        DATA_LENGTH: '',
        COLUMN_ID: '',
        NULLABLE: ''
      },
      cond: '',
      value: ''
    });
  }
  onColumnConditionSelected(event: any, condition: any): void {
    // Update the condition object with the selected column
    const selectedColumn = this.columns.find(col => col.COLUMN_NAME === event.value);
    if (selectedColumn) {
      condition.col = selectedColumn; // Update the condition with the full column object
    }
    this.generateSelectStatment()
  }

  onTableColumnsSelected() {
    this.generateSelectStatment()
  }
  removeCondition(index: number) {
    this.Conditions.splice(index, 1);
    this.generateSelectStatment()
  }

  generateAlias(columnName: string): string {
    return columnName
      ?.split('_')
      ?.filter(part => part.length > 0)
      ?.map(part => part[0]?.toUpperCase() || '')
      ?.join('') || '';
  }

  generateQuery() {
    this.tableGenericData = [];
    this._columns = []
    this.selectRequestModel.schema = this.selectedSchema?.schemA_NAME;
    if (this.selectRequestModel.schema == undefined || this.selectedSchema?.schemA_NAME?.length == 0) {
      this.msg.msgError('Attention', 'please Select Schema To Set Connection String', true)
      return;
    }
    this.selectRequestModel.str = this.generatedQuery
    this.selectRequestModel.selectedEnvironment = this.selectedEnvironment
    console.log('this.selectRequestModel', this.selectRequestModel)
    this.spinner.show('جاري تحميل البيانات ...');
    const startTime = Date.now();
    this.powerBiController.selectStatment(this.selectRequestModel)
      .subscribe({
        next: (resp) => {
          if (resp.isSuccess) {

            this.duration = (Date.now() - startTime) / 1000;
            this.tableGenericData = resp.data as any[]
            if (this.tableGenericData.length > 0) {
              this._columns = Object.keys(this.tableGenericData[0]);
            }
          }
          else {

            let errr = '';
            resp.errors?.forEach(e => errr += e.message + "<br>");
            this.msg.msgError(errr, "هناك خطا ما", true);
          }
        },
        error: (error) => {
          console.log(error.message);

          this.msg.msgError(error, "هناك خطا ما", true);
        },
        complete: () => {
          console.log(' Complete');
        }
      }
      );
  }

  removeColumn(col: string) {
    this._columns = this._columns.filter(c => c !== col)
    this.selectedColumns = this.selectedColumns.filter(c => c.COLUMN_NAME !== col);
    this.generateSelectStatment()
  }
  exportToExcel(data: any[], columns: string[]) {
    const exportData = data.map(row => {
      const rowData: any = {};
      columns.forEach(col => {
        rowData[col] = row[col];
      });
      return rowData;
    });

    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(exportData);
    const workbook: XLSX.WorkBook = { Sheets: { 'Data': worksheet }, SheetNames: ['Data'] };
    const excelBuffer: any = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const dataBlob: Blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(dataBlob, 'exported-data.xlsx');
  }

  removeEmptyColumns() {
    this._columns = this._columns.filter(column => {
      return this.tableGenericData.some(row => {
        const value = row[column];
        return value !== null && value !== undefined && value !== '';
      });
    });

    // Keep selectedColumns in sync
    this.selectedColumns = this.selectedColumns.filter(c =>
      this._columns.includes(c.COLUMN_NAME)
    );

    this.generateSelectStatment();
  }

  parseSqlQuery(sql?: any) {
    this.spinner.show('جاري تحميل البيانات ...')
    // Reset current selections
    // this.selectedSchema = {} as SchemaList;
    this.selectedTable = [];
    this.selectedColumns = [];
    this.joinConditions = [];
    this.Conditions = [];

    // Early exit if SQL is empty
    if (!this.generatedQuery || !this.generatedQuery.trim()) return;

    try {
      // Normalize SQL formatting
      const normalizedSql = this.generatedQuery.replace(/\s+/g, ' ').trim();

      // Extract SELECT clause
      const selectMatch = normalizedSql.match(/SELECT\s+(.*?)\s+FROM/i);
      if (!selectMatch) throw new Error('Invalid SELECT clause');
      const columnsPart = selectMatch[1].trim();

      // Extract FROM and JOIN clauses
      const fromJoinMatch = normalizedSql.match(/FROM\s+(.*?)(\s+WHERE\s+.*|$)/i);
      if (!fromJoinMatch) throw new Error('Invalid FROM clause');
      const fromJoinPart = fromJoinMatch[1].trim();

      // Extract WHERE clause if present
      const whereMatch = normalizedSql.match(/WHERE\s+(.*)$/i);
      const wherePart = whereMatch?.[1]?.trim();

      // Parse schema, tables, and aliases from FROM and JOIN clauses
      const aliasMap = new Map<string, { table: string, schema: string }>(); // Maps alias to table name and schema
      const tables: Array<{ name: string; alias: string; schema: string }> = [];

      // Split the FROM/JOIN part into components
      const clauses = fromJoinPart.split(
        /((?:INNER|LEFT|RIGHT|FULL)\s+JOIN\s+.*?ON\s+.*?)(?=\s+(?:INNER|LEFT|RIGHT|FULL)\s+JOIN|$)/gi
      ).filter(c => c.trim());

      // Process the main FROM clause
      const mainFromClause = clauses.shift()?.trim();
      if (!mainFromClause) throw new Error('No FROM clause  <br> All Tables must have Alias and schema names');
      const mainTableInfo = this.parseTableClause(mainFromClause);

      if (!mainTableInfo) throw new Error('Invalid main table <br> All Tables must have Alias and schema names');
      const { schemaName, tableName, alias } = mainTableInfo;

      // Find main table with schema
      const mainTable = this.tables.find(t =>
        // t.SCHEMA.toUpperCase() === schemaName.toUpperCase() &&
        t.TABLE_NAME.toUpperCase() === tableName.toUpperCase()
      );

      if (!mainTable) throw new Error(`Main table not found: ${schemaName}.${tableName}`);

      this.selectedTable.push(mainTable);
      aliasMap.set(alias, { table: tableName, schema: schemaName });
      tables.push({ name: tableName, alias, schema: schemaName });
      this.onTableSelected();

      // Process JOIN clauses
      clauses.forEach((clause: string) => {
        const joinMatch = clause.match(/(INNER|LEFT|RIGHT|FULL)?\s+JOIN\s+(.*)/i);
        if (!joinMatch) return;

        const joinType = (joinMatch[1] || 'INNER').trim();
        const joinClause = joinMatch[2].trim();
        const joinTableInfo = this.parseTableClause(joinClause.split(/\s+ON/i)[0]);
        if (!joinTableInfo) return;

        const { schemaName: joinSchema, tableName: joinTable, alias: joinAlias } = joinTableInfo;
        const joinTableObj = this.tables.find(t =>
          t.SCHEMA.toUpperCase() === joinSchema.toUpperCase() &&
          t.TABLE_NAME.toUpperCase() === joinTable.toUpperCase()
        );

        if (!joinTableObj) throw new Error(`Join table not found: ${joinSchema}.${joinTable}`);

        this.selectedTable.push(joinTableObj);
        aliasMap.set(joinAlias, { table: joinTable, schema: joinSchema });
        tables.push({ name: joinTable, alias: joinAlias, schema: joinSchema });
        this.onTableSelected();

        // Extract ON condition
        const onCondition = joinClause.split(/\s+ON\s+/i)[1]?.trim();
        if (!onCondition) return;

        const [left, right] = onCondition.split('=').map(s => s.trim());
        const [leftAlias, leftCol] = left.split('.');
        const [rightAlias, rightCol] = right.split('.');

        const leftTableInfo = aliasMap.get(leftAlias);
        const rightTableInfo = aliasMap.get(rightAlias);

        if (!leftTableInfo || !rightTableInfo) return;

        this.joinConditions.push({
          joinType: joinType as 'INNER' | 'LEFT' | 'RIGHT' | 'FULL',
          leftTable: this.selectedTable.find(t =>
            t.SCHEMA === leftTableInfo.schema &&
            t.TABLE_NAME === leftTableInfo.table
          ),
          leftColumn: this.columns.find(c =>
            c.TABLE_NAME === leftTableInfo.table.toUpperCase() &&
            c.COLUMN_NAME === leftCol.toUpperCase()
          ),
          rightTable: this.selectedTable.find(t =>
            t.SCHEMA === rightTableInfo.schema &&
            t.TABLE_NAME === rightTableInfo.table
          ),
          rightColumn: this.columns.find(c =>
            c.TABLE_NAME === rightTableInfo.table.toUpperCase() &&
            c.COLUMN_NAME === rightCol.toUpperCase()
          )
        });
      });

      // Parse SELECT columns
      const selectedColumns = columnsPart.split(',').map((c: string) => {
        const [aliasCol, column] = c.trim().split('.').map(s => s.trim());
        const tableInfo = aliasMap.get(aliasCol);
        if (!tableInfo) return null;

        return this.columns.find(col =>
          col.TABLE_NAME === tableInfo.table.toUpperCase() &&
          col.COLUMN_NAME === column.toUpperCase()
        );
      }).filter((c: any) => c);

      this.selectedColumns = selectedColumns as any[];

      // Parse WHERE conditions
      if (wherePart) {
        const conditions = wherePart.split(/\s+AND\s+/i).map((c: string) => c.trim());
        conditions.forEach((cond: string) => {
          const match = cond.match(/(.*?)\s+(=|!=|>|<|>=|<=|IN|LIKE)\s+(.*)/i);
          if (!match) return;

          const [_, colPart, operator, valuePart] = match;
          const [alias, column] = colPart.split('.');
          const tableInfo = aliasMap.get(alias);
          if (!tableInfo) return;

          const colObj = this.columns.find(c =>
            c.TABLE_NAME === tableInfo.table.toUpperCase() &&
            c.COLUMN_NAME === column.toUpperCase()
          );

          if (!colObj) return;

          let value = valuePart.replace(/['()]/g, '');
          if (operator === 'IN') {
            value = value.split(',').map(v => v.trim()).join(',');
          }

          this.Conditions.push({
            col: colObj,
            cond: operator,
            value: value
          });
        });
      }
      this.msg.msgSuccess('Segmentated Successfully');

    } catch (error) {

      this.msg.msgError('Becarfule', error as string, true);
      console.error('Parsing error:', error);
    }
  }

  private parseTableClause(clause: string): { schemaName: string; tableName: string; alias: string } | null {
    const match = clause.match(/(\w+)\.(\w+)\s+(\w+)/);
    if (!match) return null;
    return {
      schemaName: match[1],
      tableName: match[2],
      alias: match[3]
    };
  }

  editRow(index: number) {
    // Example: Open a dialog or set a flag for editing
    // You can replace this with your own edit logic
    const rowData = this.tableGenericData[index];
    // For demonstration, just log the row data
    console.log('Edit row:', index, rowData);
    // You can set a property like this.editingRow = { index, ...rowData };
    // Then show an edit form/dialog in your component
  }

  mapDataToTable<T>(data: T[], config: ColumnConfig[], onlyVisible?: boolean) {
    if (!data || data.length === 0) return [];
    // Step 1: filter visible columns
    const visibleCols = onlyVisible ? config.filter(c => c.visible) : config;
    const mapped = data.map((item, idx) => {
      const row: Record<string, any> = {};
      visibleCols.forEach(col => {
        if (col.field === 'serial') {
          row[col.header] = idx + 1;
        } else {
          if(col.header.toString().includes('تاريخ'))
            row[col.header] = this.conditionalDate.transform((item as any)[col.field],'short');
          else
          row[col.header] = (item as any)[col.field];
        }
      });
      return row;
    });
    return mapped;
  }
}
