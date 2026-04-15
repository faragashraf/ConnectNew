import { Component, Input } from '@angular/core';

type GenericFieldRow = {
  label?: string;
  key?: string;
  value?: string;
  rowType?: 'group-header' | 'field';
  groupTitle?: string;
};

type PaymentModeKind = 'cash' | 'installment' | 'unknown';

type PaymentPlanTableRow = {
  installmentNo: number;
  title: string;
  amount: string;
  paidState: string;
  paidAt: string;
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

  get displayRows(): GenericFieldRow[] {
    const rows = this.rows ?? [];
    const filteredRows = rows.filter(row => this.isGroupHeader(row) || !this.isInstallmentDetailKey(this.resolveKey(row)));
    if (filteredRows.length === 0) {
      return [];
    }

    const compacted: GenericFieldRow[] = [];
    let pendingHeader: GenericFieldRow | null = null;
    let groupFields: GenericFieldRow[] = [];

    const flushPendingGroup = () => {
      if (pendingHeader && groupFields.length > 0) {
        compacted.push(pendingHeader, ...groupFields);
      }
      pendingHeader = null;
      groupFields = [];
    };

    filteredRows.forEach(row => {
      if (this.isGroupHeader(row)) {
        flushPendingGroup();
        pendingHeader = row;
        return;
      }

      if (pendingHeader) {
        groupFields.push(row);
        return;
      }

      compacted.push(row);
    });

    flushPendingGroup();
    return compacted;
  }

  get paymentMethodLabel(): string {
    return this.buildPaymentPlanTable().modeLabel;
  }

  get paymentPlanRows(): PaymentPlanTableRow[] {
    return this.buildPaymentPlanTable().rows;
  }

  get hasPaymentPlanTable(): boolean {
    return this.paymentPlanRows.length > 0;
  }

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

  private buildPaymentPlanTable(): { modeLabel: string; modeKind: PaymentModeKind; rows: PaymentPlanTableRow[] } {
    const fieldRows = (this.rows ?? []).filter(row => !this.isGroupHeader(row));
    if (fieldRows.length === 0) {
      return { modeLabel: '-', modeKind: 'unknown', rows: [] };
    }

    const paymentModeValue = this.getFieldValueByKey(fieldRows, 'payment_mode');
    const modeKind = this.resolvePaymentModeKind(paymentModeValue, fieldRows);
    const modeLabel = this.resolveModeLabel(modeKind, paymentModeValue);

    const installmentCount = this.parsePositiveInt(this.getFieldValueByKey(fieldRows, 'payment_installment_count'));
    const installmentMap = new Map<number, { amount: string; paidState: string; paidAt: string }>();

    fieldRows.forEach(row => {
      const key = this.resolveKey(row);
      if (!key) {
        return;
      }

      const amountMatch = key.match(/^payment_installment_(\d+)_amount$/);
      if (amountMatch) {
        const installmentNo = Math.max(1, Number(amountMatch[1] ?? '1'));
        const current = installmentMap.get(installmentNo) ?? { amount: '-', paidState: '-', paidAt: '-' };
        current.amount = this.resolveValue(row);
        installmentMap.set(installmentNo, current);
        return;
      }

      const paidMatch = key.match(/^payment_installment_(\d+)_paid$/);
      if (paidMatch) {
        const installmentNo = Math.max(1, Number(paidMatch[1] ?? '1'));
        const current = installmentMap.get(installmentNo) ?? { amount: '-', paidState: '-', paidAt: '-' };
        current.paidState = this.resolvePaidState(this.resolveValue(row));
        installmentMap.set(installmentNo, current);
        return;
      }

      const paidAtMatch = key.match(/^payment_installment_(\d+)_paid_at$/);
      if (paidAtMatch) {
        const installmentNo = Math.max(1, Number(paidAtMatch[1] ?? '1'));
        const current = installmentMap.get(installmentNo) ?? { amount: '-', paidState: '-', paidAt: '-' };
        current.paidAt = this.resolveValue(row);
        installmentMap.set(installmentNo, current);
      }
    });

    if (modeKind === 'cash') {
      const paidAt = this.getFieldValueByKey(fieldRows, 'paid_at');
      const paymentStatus = this.getFieldValueByKey(fieldRows, 'payment_status');
      const amount = this.pickDisplayValue([
        this.getFieldValueByKey(fieldRows, 'pricing_grand_total'),
        this.getFieldValueByKey(fieldRows, 'payment_installments_total')
      ]);
      const paidState = this.resolveCashPaidState(paymentStatus, paidAt);

      return {
        modeLabel,
        modeKind,
        rows: [{
          installmentNo: 1,
          title: 'دفعة كاش',
          amount: this.ensureCurrency(amount),
          paidState,
          paidAt: this.toDisplayOrDash(paidAt)
        }]
      };
    }

    const maxInstallmentNo = installmentCount && installmentCount > 0
      ? installmentCount
      : Math.max(0, ...Array.from(installmentMap.keys()));
    if (maxInstallmentNo <= 0) {
      return { modeLabel, modeKind, rows: [] };
    }

    const rows: PaymentPlanTableRow[] = [];
    for (let installmentNo = 1; installmentNo <= maxInstallmentNo; installmentNo += 1) {
      const item = installmentMap.get(installmentNo) ?? { amount: '-', paidState: '-', paidAt: '-' };
      const paidAt = this.toDisplayOrDash(item.paidAt);
      const paidState = item.paidState !== '-'
        ? item.paidState
        : (paidAt !== '-' ? 'مسدد' : 'غير مسدد');

      rows.push({
        installmentNo,
        title: this.resolveInstallmentTitle(installmentNo),
        amount: this.ensureCurrency(item.amount),
        paidState,
        paidAt
      });
    }

    return { modeLabel, modeKind, rows };
  }

  private resolveModeLabel(modeKind: PaymentModeKind, value: string): string {
    if (modeKind === 'cash') {
      return 'كاش';
    }
    if (modeKind === 'installment') {
      return 'تقسيط';
    }

    const text = String(value ?? '').trim();
    return text.length > 0 ? text : '-';
  }

  private resolveInstallmentTitle(installmentNo: number): string {
    const normalizedNo = Math.max(1, Math.floor(Number(installmentNo) || 1));
    return normalizedNo === 1 ? 'مقدم الحجز' : `القسط ${normalizedNo - 1}`;
  }

  private resolvePaymentModeKind(modeValue: string, fieldRows: GenericFieldRow[]): PaymentModeKind {
    const normalized = this.normalizeText(modeValue);
    if (normalized.includes('cash') || normalized.includes('كاش')) {
      return 'cash';
    }
    if (normalized.includes('installment') || normalized.includes('تقسيط')) {
      return 'installment';
    }

    const hasInstallments = fieldRows.some(row => /^payment_installment_\d+_amount$/.test(this.resolveKey(row)));
    if (hasInstallments) {
      return 'installment';
    }

    return 'unknown';
  }

  private resolvePaidState(value: string): string {
    const normalized = this.normalizeText(value);
    if (!normalized || normalized === '-') {
      return '-';
    }

    if (normalized === 'false'
      || normalized === '0'
      || normalized.includes('غيرمسدد')
      || normalized.includes('بانتظار')
      || normalized.includes('unpaid')
      || normalized.includes('pending')
      || normalized.includes('متاخر')) {
      return 'غير مسدد';
    }

    if (normalized === 'true'
      || normalized === '1'
      || normalized === 'paid'
      || normalized.includes('تمالسداد')
      || normalized.includes('مسدد')) {
      return 'مسدد';
    }

    return value;
  }

  private resolveCashPaidState(paymentStatus: string, paidAt: string): string {
    if (this.toDisplayOrDash(paidAt) !== '-') {
      return 'مسدد';
    }

    const normalized = this.normalizeText(paymentStatus);
    if (!normalized || normalized === '-') {
      return 'غير مسدد';
    }

    if (normalized.includes('تمالسداد') || normalized === 'paid' || normalized.includes('مسدد')) {
      return 'مسدد';
    }

    return 'غير مسدد';
  }

  private getFieldValueByKey(rows: GenericFieldRow[], key: string): string {
    const targetKey = String(key ?? '').trim().toLowerCase();
    if (!targetKey) {
      return '-';
    }

    const row = rows.find(item => this.resolveKey(item) === targetKey);
    if (!row) {
      return '-';
    }

    return this.resolveValue(row);
  }

  private resolveKey(row: GenericFieldRow): string {
    return String(row?.key ?? '').trim().toLowerCase();
  }

  private parsePositiveInt(value: string): number | null {
    const normalized = this.replaceArabicDigits(String(value ?? '').trim());
    const matched = normalized.match(/\d+/);
    if (!matched) {
      return null;
    }

    const parsed = Number(matched[0]);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }

    return Math.floor(parsed);
  }

  private isInstallmentDetailKey(key: string): boolean {
    return /^payment_installment_\d+_(amount|paid|paid_at)$/.test(key);
  }

  private pickDisplayValue(values: string[]): string {
    for (const value of values) {
      const normalized = this.toDisplayOrDash(value);
      if (normalized !== '-') {
        return normalized;
      }
    }

    return '-';
  }

  private toDisplayOrDash(value: string): string {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : '-';
  }

  private ensureCurrency(value: string): string {
    const display = this.toDisplayOrDash(value);
    if (display === '-') {
      return display;
    }

    if (display.includes('جنيه')) {
      return display;
    }

    const normalized = this.replaceArabicDigits(display).replace(/,/g, '').trim();
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
      return display;
    }

    const rounded = Math.round(parsed * 100) / 100;
    const hasFraction = Math.abs(rounded - Math.trunc(rounded)) > 0.0001;
    const formatted = rounded.toLocaleString('en-US', {
      minimumFractionDigits: hasFraction ? 2 : 0,
      maximumFractionDigits: 2
    });
    return `${formatted} جنيه`;
  }

  private normalizeText(value: string): string {
    return this.replaceArabicDigits(String(value ?? ''))
      .trim()
      .toLowerCase()
      .replace(/[\s_\-]/g, '');
  }

  private replaceArabicDigits(value: string): string {
    return String(value ?? '')
      .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
      .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));
  }
}
