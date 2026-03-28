import { Component, Input } from '@angular/core';

type SummerSkeletonVariant = 'details' | 'table' | 'dashboard' | 'form' | 'capacity' | 'cards' | 'inline';

@Component({
  selector: 'app-summer-skeleton',
  templateUrl: './summer-skeleton.component.html',
  styleUrls: ['./summer-skeleton.component.scss']
})
export class SummerSkeletonComponent {
  @Input() variant: SummerSkeletonVariant = 'inline';
  @Input() rows = 4;
  @Input() columns = 4;
  @Input() cards = 6;
  @Input() showTitle = true;
  @Input() ariaLabel = 'جاري تحميل البيانات';

  private readonly rangeCache = new Map<number, number[]>();

  toRange(count: number): number[] {
    const normalized = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
    const cached = this.rangeCache.get(normalized);
    if (cached) {
      return cached;
    }

    const created = Array.from({ length: normalized }, (_, index) => index);
    this.rangeCache.set(normalized, created);
    return created;
  }

  trackByIndex(index: number): number {
    return index;
  }
}
