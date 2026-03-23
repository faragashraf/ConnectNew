import { Component, Input } from '@angular/core';

type CompanionRow = {
  index?: number;
  name?: string;
  relation?: string;
  nationalId?: string;
  age?: string;
};

@Component({
  selector: 'app-summer-request-companions-table',
  templateUrl: './summer-request-companions-table.component.html',
  styleUrls: ['./summer-request-companions-table.component.scss']
})
export class SummerRequestCompanionsTableComponent {
  @Input() title = 'بيانات المرافقين';
  @Input() emptyMessage = 'لا توجد بيانات مرافقين.';
  @Input() companions: CompanionRow[] = [];

  resolveText(value: unknown): string {
    const text = String(value ?? '').trim();
    return text.length > 0 ? text : '-';
  }

  resolveIndex(value: unknown, fallback: number): number {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : fallback;
  }
}
