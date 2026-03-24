import { Component, Input } from '@angular/core';

type GenericFieldRow = {
  label?: string;
  key?: string;
  value?: string;
  rowType?: 'group-header' | 'field';
  groupTitle?: string;
};

@Component({
  selector: 'app-summer-request-fields-grid',
  templateUrl: './summer-request-fields-grid.component.html',
  styleUrls: ['./summer-request-fields-grid.component.scss']
})
export class SummerRequestFieldsGridComponent {
  @Input() title = 'تفاصيل الطلب';
  @Input() emptyMessage = 'لا توجد تفاصيل إضافية معروضة.';
  @Input() rows: GenericFieldRow[] = [];

  isGroupHeader(row: GenericFieldRow): boolean {
    return row?.rowType === 'group-header';
  }

  resolveGroupTitle(row: GenericFieldRow): string {
    const title = String(row?.groupTitle ?? row?.label ?? '').trim();
    return title.length > 0 ? title : 'بيانات';
  }

  resolveLabel(row: GenericFieldRow): string {
    const label = String(row?.label ?? row?.key ?? '').trim();
    return label.length > 0 ? label : '-';
  }

  resolveValue(row: GenericFieldRow): string {
    const value = String(row?.value ?? '').trim();
    return value.length > 0 ? value : '-';
  }
}
