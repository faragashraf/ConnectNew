import { Component, EventEmitter, Input, Output, ViewChild, OnChanges, SimpleChanges } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { Table } from 'primeng/table';
import { GenerateQueryService } from 'src/app/Modules/enpopower-bi/services/generate-query.service';
import { ComponentConfig } from 'src/app/shared/models/Component.Config.model';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';

@Component({
  selector: 'generic-table',
  templateUrl: './Generic-Table.component.html',
  styleUrls: ['./Generic-Table.component.scss']
})
export class GenericTableComponent implements OnChanges {
  @Input() showRemoveColumn: boolean = false;
  @Input() tableGenericData: any[] = [];
  @Input() _columns: string[] = [];
  @Input() showExportButton: boolean = false;
  @Input() showDeleteButton: boolean = false;
  @Input() showEditButton: boolean = false;
  @Input() showViewButton: boolean = false;
  @Input() showColumnFilter: boolean = false;
  @Input() showFieldSort: boolean = false;
  @Input() showTableDetails: boolean = false;
  @Input() showGlobalSearch: boolean = false;
  @Input() istitlecase: boolean = false;
  @Input() isLazyLoading: boolean = false;
  @Input() dataKey: string = '';
  @Input() tableId: string = '';
  @Input() contextMenuItems: MenuItem[] = [];
  @Input() showTableContextMenu: boolean = false;
  @Input() config: ComponentConfig = {} as ComponentConfig;

  constructor(public generateQueryService: GenerateQueryService, private msg: MsgsService) { }

  @Input() rowsPerPage: number = 0; // Items per page
  @Input() totalRecords: number = 0; // Total number of records
  @Input() rowsPerPageOptions: number[] = [7, 10, 20]; // Dropdown options

  @Output() rowDelete = new EventEmitter<any>();
  @Output() rowEdit = new EventEmitter<any>();
  @Output() rowView = new EventEmitter<any>();
  @Output() rowSelect = new EventEmitter<any>();
  @Output() pageChange = new EventEmitter<{ event: any }>();
  @Output() contextMenuItemSelected = new EventEmitter<any>();

  deleteRow(item: any) {
    this.msg.msgConfirm(`سيتم الحذف  نهائياً`, 'حذف')
      .then(result => {
        if (result == true) {
          this.rowDelete.emit(item);
        }
      });
  }

  onRowSelect(event: any): void {
    this.rowSelect.emit(event);
  }

  EditRow(data: any, index?: number) {
    this.msg.msgConfirm(`سيتم التعديل`, 'تعديل')
      .then(result => {
        if (result == true) {
          this.rowEdit.emit({ data: data, index: index });
        }
      });
  }
  viewRow(data: any, index?: number) {
    this.rowView.emit({ data: data, index: index });
  }

  onPageChange(event: any) {
    this.pageChange.emit(event);
  }

  onContextMenuItemClick(e: any): void {
    console.log('GenericSidebar: contextMenu item clicked', e);
    this.contextMenuItemSelected.emit(e);
  }

  @ViewChild('dt1') dt1!: Table; // Using non-null assertion to tell TypeScript that it will always be initialized

  // Reset table to first page whenever the bound data changes
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tableGenericData']) {
      // Ensure we don't throw if dt1 is not yet available
      if (this.dt1) {
        // PrimeNG Table uses `first` to indicate the index of the first row on current page
        // this.dt1.first = 0;
      }
    }
  }

  onFilterInput(event: Event): void {
    const inputElement = event.target as HTMLInputElement; // Explicitly assert as HTMLInputElement
    const inputValue = inputElement.value;
    this.dt1?.filterGlobal(inputValue, 'contains');
  }

  onRowsPerPageChange(event: any): void {
    const newRows = event && event.value ? event.value : this.rowsPerPage;
    this.rowsPerPage = newRows;
    if (this.dt1) {
      this.dt1.rows = newRows;
      this.dt1.first = 0;
    }
    // Emit page change so parent can react (first index and rows)
    this.onPageChange({ first: 0, rows: newRows, page: 0 });
  }

  getSeverity(status: string): string {
    switch (status) {
      case 'جديد': // New
        return 'primary';
      case 'جاري التنفيذ': // In progress
        return 'warning';
      case 'تم الرد': // Replied
        return 'info';
      case 'مرفوض': // Rejected
        return 'danger';
      case 'تم': // Printed
        return 'success';
      case 'الكل': // All
        return 'secondary';
      case 'تعمل': // Printed
        return 'success';
      case 'لا تعمل': // Rejected
        return 'danger';
      default:
        return 'secondary';
    }
  }
}
