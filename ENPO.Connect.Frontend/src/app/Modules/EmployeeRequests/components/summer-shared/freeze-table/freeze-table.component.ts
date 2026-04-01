import { Component, EventEmitter, Input, Output } from '@angular/core';
import { SummerDestinationConfig } from '../../summer-requests-workspace/summer-requests-workspace.config';
import { SummerUnitFreezeDto } from 'src/app/shared/services/BackendServices/SummerWorkflow/SummerWorkflow.dto';

@Component({
  selector: 'app-freeze-table',
  templateUrl: './freeze-table.component.html',
  styleUrls: ['./freeze-table.component.scss']
})
export class FreezeTableComponent {
  @Input() destinations: SummerDestinationConfig[] = [];
  @Input() rows: SummerUnitFreezeDto[] = [];
  @Input() loading = false;
  @Input() showActions = true;

  @Output() viewDetails = new EventEmitter<number>();
  @Output() releaseFreeze = new EventEmitter<number>();
  @Output() reFreeze = new EventEmitter<SummerUnitFreezeDto>();

  getDestinationName(categoryId: number): string {
    const destination = this.destinations.find(item => item.categoryId === Number(categoryId));
    return destination?.name ?? `مصيف ${categoryId}`;
  }

  formatDate(value?: string): string {
    const text = String(value ?? '').trim();
    if (!text) {
      return '-';
    }

    const date = new Date(text);
    if (Number.isNaN(date.getTime())) {
      return text;
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hour}:${minute}`;
  }

  statusLabel(row: SummerUnitFreezeDto): string {
    return row.isActive ? 'نشط' : 'مفكوك';
  }
}
