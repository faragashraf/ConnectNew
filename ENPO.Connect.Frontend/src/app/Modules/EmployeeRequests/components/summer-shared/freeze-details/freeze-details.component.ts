import { Component, Input } from '@angular/core';
import { SummerDestinationConfig } from '../../summer-requests-workspace/summer-requests-workspace.config';
import { SummerUnitFreezeDetailsDto } from 'src/app/shared/services/BackendServices/SummerWorkflow/SummerWorkflow.dto';

@Component({
  selector: 'app-freeze-details',
  templateUrl: './freeze-details.component.html',
  styleUrls: ['./freeze-details.component.scss']
})
export class FreezeDetailsComponent {
  @Input() details: SummerUnitFreezeDetailsDto | null = null;
  @Input() destinations: SummerDestinationConfig[] = [];

  getDestinationName(categoryId: number): string {
    const destination = this.destinations.find(item => item.categoryId === Number(categoryId));
    return destination?.name ?? `مصيف ${categoryId}`;
  }

  statusLabel(status: string): string {
    const normalized = String(status ?? '').trim().toUpperCase();
    if (normalized === 'FROZEN_AVAILABLE') {
      return 'مجمدة';
    }
    if (normalized === 'BOOKED') {
      return 'مستخدمة';
    }
    if (normalized === 'RELEASED') {
      return 'مفكوكة';
    }
    return normalized.length > 0 ? normalized : '-';
  }

  statusClass(status: string): string {
    const normalized = String(status ?? '').trim().toUpperCase();
    if (normalized === 'FROZEN_AVAILABLE') {
      return 'frozen';
    }
    if (normalized === 'BOOKED') {
      return 'booked';
    }
    if (normalized === 'RELEASED') {
      return 'released';
    }
    return 'unknown';
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
}
