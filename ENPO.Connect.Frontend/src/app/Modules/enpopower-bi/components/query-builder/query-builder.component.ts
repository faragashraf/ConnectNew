import { Component, ViewChild } from '@angular/core';
import { PowerBiController, SchemaList } from '../../services/PowerBi.service';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';
import { Table } from 'primeng/table';
import { MenuItem } from 'primeng/api';
import { GenerateQueryService } from '../../services/generate-query.service';

@Component({
  selector: 'app-query-builder',
  templateUrl: './query-builder.component.html',
  styleUrls: ['./query-builder.component.scss']
})
export class QueryBuilderComponent {
  constructor(private spinner: SpinnerService, private msg: MsgsService, private powerBiController: PowerBiController, public generateQueryService: GenerateQueryService) { }

  @ViewChild('dt1') dt1!: Table; // Using non-null assertion to tell TypeScript that it will always be initialized
  @ViewChild('dt2') dt2!: Table; // Using non-null assertion to tell TypeScript that it will always be initialized
  @ViewChild('dt3') dt3!: Table; // Using non-null assertion to tell TypeScript that it will always be initialized
  onFilterInput_dt1(event: Event): void {
    const inputElement = event.target as HTMLInputElement; // Explicitly assert as HTMLInputElement
    const inputValue = inputElement.value;
    this.dt1?.filterGlobal(inputValue, 'contains');
  }
  onFilterInput_dt2(event: Event): void {
    const inputElement = event.target as HTMLInputElement; // Explicitly assert as HTMLInputElement
    const inputValue = inputElement.value;
    this.dt2?.filterGlobal(inputValue, 'contains');
  }
  onFilterInput_dt3(event: Event): void {
    const inputElement = event.target as HTMLInputElement; // Explicitly assert as HTMLInputElement
    const inputValue = inputElement.value;
    this.dt3?.filterGlobal(inputValue, 'contains');
  }
  uniqueSchemas: SchemaList[] = [];
  async ngOnInit() {
    await this.getSchema();
  }
  // Handler for environment change
  onEnvironmentChange(environment: string): void {
    console.log('Selected Environment:', environment);
  }
  getSchema() {
    this.spinner.show('جاري تحميل البيانات ...');
    this.powerBiController.schemaList()
      .subscribe({
        next: (resp) => {
          if (resp.isSuccess) {
            this.generateQueryService.SchemaList = resp.data as any[]
            this.getMetaData();
            console.log('this.generateQueryService.SchemaList', this.generateQueryService.SchemaList)
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
  async getMetaData() {
    this.generateQueryService.selectRequestModel.selectedEnvironment = this.generateQueryService.selectedEnvironment;

    const schemaList: string[] = this.generateQueryService.SchemaList
      .map(item => item.schemA_NAME)
      .filter((name): name is string => name !== undefined);

    this.spinner.show('جاري تحميل البيانات ...');

    for (const _schema of schemaList) {
      this.generateQueryService.selectRequestModel.schema = _schema;
      this.generateQueryService.selectRequestModel.str = `
        SELECT c.owner, c.table_name, o.object_type, c.column_name, c.data_type, c.data_length, c.nullable, c.column_id
        FROM all_tab_columns c
        JOIN all_objects o ON c.owner = o.owner AND c.table_name = o.object_name
        WHERE c.owner IN ('${_schema}') AND o.object_type IN ('TABLE','VIEW')
        ORDER BY c.owner, c.table_name, c.column_id`;

      try {
        const resp = await new Promise<any>((resolve, reject) => {
          this.powerBiController.selectStatment(this.generateQueryService.selectRequestModel)
            .subscribe({
              next: resolve,
              error: reject
            });
        });

        if (resp.isSuccess) {
          this.generateQueryService.tables = [
            ...this.generateQueryService.tables,
            ...this.generateQueryService.populateSchemas(resp.data as any[])
          ];
          console.log('this.generateQueryService.tables', this.generateQueryService.tables);
        } else {
          let errr = '';
          resp.errors?.forEach((e: any) => errr += e.message + "<br>");
          this.msg.msgError(errr, "هناك خطأ ما", true);
        }
      } catch (error: any) {
        console.error(error.message);
        this.msg.msgError(error, "هناك خطأ ما", true);
      } finally {
        
      }
    }
  }

  onSchemaSelected() {
    // this.generateQueryService.selectedColumns = [];
    // this.generateQueryService.columns = [];
    // this.generateQueryService.tables = [];
    // this.generateQueryService.selectedTable = [];
    // this.generateQueryService.joinConditions = [];
    // this.generateQueryService.Conditions = [];
    // this.getMetaData();
  }
  onUnSchemaSelected() {
    this.generateQueryService.selectedSchema = {} as SchemaList;
    this.generateQueryService.selectedColumns = [];
    this.generateQueryService.columns = [];
    this.generateQueryService.tables = [];
    this.generateQueryService.selectedTable = [];
    this.generateQueryService.joinConditions = [];
    this.generateQueryService.Conditions = [];
  }
  toggleAllColumns(selectAll: boolean) {
    if (selectAll) {
      this.generateQueryService.selectedColumns = [...this.generateQueryService.columns];
    } else {
      this.generateQueryService.selectedColumns = [];
    }
    this.generateQueryService.generateSelectStatment()
  }

  public activeIndex: number = 0;
  steps: MenuItem[] = [
    {
      label: 'Select Schema & Tables & Columns',
      command: (event: any) => this.activeIndex = 0,
    },
    {
      label: 'Joins & Filters',
      command: (event: any) => this.activeIndex = 1
    },
    {
      label: 'Generated SQL',
      command: (event: any) => this.activeIndex = 2
    }
  ];

  next() {
    if (this.activeIndex == 1 && this.generateQueryService.Conditions.length == 0) {
      this.msg.msgConfirm(`سيتم عرض جميع البيانات <br> <span style="color:red"> لم يتم اختيار اي شرط</span>`, 'استمرار')
        .then(result => {
          if (result == true) {
            this.activeIndex++;
          }
        })
    }
    else if (this.activeIndex < this.steps.length - 1) {
      this.activeIndex++;
      // this.generateQueryService.generateSelectStatment();
    }
  }

  prev() {
    if (this.activeIndex > 0) {
      this.activeIndex--;
      // this.generateQueryService.generateSelectStatment();
    }
  }

  onSelectleftColumn(event: any) {
    console.log(event)
  }
  getFilteredColumns(tableName: string) {
    return this.generateQueryService.columns.filter(f => f.TABLE_NAME === tableName)
  }
}
