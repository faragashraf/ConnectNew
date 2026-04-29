export const SUMMER_ALLOWED_ATTACHMENT_EXTENSIONS = new Set([
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.bmp',
  '.webp'
]);

export const SUMMER_FIELD_LABEL_MAP: Record<string, string> = {
  RequestRef: 'رقم الطلب',
  Subject: 'عنوان الطلب',
  Summer_ActionType: 'نوع الإجراء',
  Summer_AdminLastAction: 'آخر إجراء إداري',
  Summer_AdminActionAtUtc: 'تاريخ الإجراء الإداري',
  Summer_CancelledAtUtc: 'تاريخ الإلغاء',
  Summer_CancelledAt: 'تاريخ الإلغاء',
  Emp_Name: 'اسم الموظف',
  Emp_Id: 'رقم الملف',
  NationalId: 'الرقم القومي',
  PhoneNumber: 'رقم الهاتف',
  ExtraPhoneNumber: 'هاتف إضافي',
  SummerCamp: 'الفوج',
  SummerCampLabel: 'بيان الفوج',
  SummerSeasonYear: 'موسم الحجز',
  FamilyCount: 'عدد الأفراد',
  Over_Count: 'أفراد إضافيون',
  SummerStayMode: 'نوع الحجز',
  SummerDestinationId: 'اسم المصيف',
  SummerDestinationName: 'اسم المصيف',
  SummerProxyMode: 'تسجيل بالنيابة',
  SummerMembershipType: 'نوع العضوية',
  SUM2026_MembershipType: 'نوع العضوية',
  Description: 'ملاحظات',
  FamilyMember_Name: 'اسم المرافق',
  FamilyRelation: 'درجة القرابة',
  FamilyMember_NationalId: 'الرقم القومي للمرافق',
  FamilyMember_Age: 'السن (للأطفال)',
  Summer_PaymentDueAtUtc: 'مهلة السداد',
  Summer_PaymentStatus: 'حالة السداد',
  Summer_PaidAtUtc: 'تاريخ السداد',
  Summer_PaymentMode: 'طريقة السداد',
  SUM2026_PaymentMode: 'طريقة السداد',
  PaymentMode: 'طريقة السداد',
  Summer_PaymentInstallmentCount: 'عدد الأقساط',
  SUM2026_PaymentInstallmentCount: 'عدد الأقساط',
  Summer_PaymentInstallmentsTotal: 'إجمالي الأقساط',
  SUM2026_PaymentInstallmentsTotal: 'إجمالي الأقساط',
  Summer_RequestCreatedAtUtc: 'تاريخ إنشاء الطلب (UTC)',
  Summer_TransferCount: 'عدد مرات التحويل',
  Summer_TransferredAtUtc: 'تاريخ التحويل',
  Summer_TransferFromCategory: 'من مصيف',
  Summer_TransferFromWave: 'من فوج',
  Summer_TransferToCategory: 'إلى مصيف',
  Summer_TransferToWave: 'إلى فوج',
  Summer_TransferApprovedAtUtc: 'تاريخ اعتماد التحويل',
  Summer_CancelReason: 'سبب الاعتذار',
  Summer_WorkflowState: 'حالة المتابعة',
  Summer_WorkflowStateLabel: 'وصف حالة المتابعة',
  Summer_WorkflowStateReason: 'سبب المتابعة',
  Summer_WorkflowStateAtUtc: 'تاريخ حالة المتابعة',
  Summer_TransferRequiresRePayment: 'إعادة السداد مطلوبة',
  Summer_TransferRePaymentReason: 'سبب إعادة السداد',
  Summer_PricingConfigId: 'مرجع سياسة التسعير',
  Summer_PricingPolicyId: 'مرجع سياسة التسعير',
  Summer_PricingMode: 'نمط التسعير',
  Summer_PricingMembershipType: 'نوع العضوية المحسوب',
  Summer_PricingTransportationMandatory: 'الانتقالات إلزامية',
  Summer_PricingSelectedStayMode: 'نوع الحجز المعتمد',
  Summer_PricingPersonsCount: 'عدد الأفراد المحسوب',
  Summer_PricingPeriodKey: 'فترة التسعير',
  Summer_PricingWaveDate: 'تاريخ الفوج للتسعير',
  Summer_PricingAccommodationPricePerPerson: 'سعر الإقامة للفرد',
  Summer_PricingTransportationPricePerPerson: 'سعر الانتقالات للفرد',
  Summer_PricingInsuranceAmount: 'قيمة التأمين',
  Summer_PricingProxyInsuranceAmount: 'قيمة تأمين الحجز بالنيابة',
  Summer_PricingAppliedInsuranceAmount: 'قيمة التأمين المطبقة',
  Summer_PricingAccommodationTotal: 'إجمالي الإقامة',
  Summer_PricingTransportationTotal: 'إجمالي الانتقالات',
  Summer_PricingGrandTotal: 'الإجمالي النهائي',
  Summer_PricingDisplayText: 'بيان التسعير',
  Summer_PricingSmsText: 'نص رسالة SMS',
  Summer_PricingWhatsAppText: 'نص رسالة WhatsApp'
};

const ACTION_TYPE_LABELS: Record<string, string> = {
  CANCEL: 'اعتذار عن الحجز',
  PAY: 'تسجيل السداد',
  TRANSFER: 'تحويل الحجز',
  AUTO_CANCEL_PAYMENT_TIMEOUT: 'إلغاء آلي لانتهاء مهلة السداد',
  MANUAL_CANCEL: 'إلغاء يدوي من الإدارة',
  FINAL_APPROVE: 'اعتماد نهائي',
  MARK_UNPAID: 'تحويل إلى غير مسدد',
  MARK_PAID_ADMIN: 'تحويل إلى مسدد (سداد إداري)',
  COMMENT: 'تعليق إداري'
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'بانتظار السداد',
  PAID: 'تم السداد',
  PAID_ADMIN: 'سداد إداري',
  CANCELLED_AUTO: 'ملغي آليًا لعدم السداد',
  CANCELLED_ADMIN: 'ملغي من الإدارة',
  CANCELLED_USER: 'ملغي بناءً على الاعتذار',
  CANCELLED: 'ملغي',
  OVERDUE: 'متأخر عن السداد'
};

const PAYMENT_MODE_LABELS: Record<string, string> = {
  CASH: 'كاش',
  INSTALLMENT: 'تقسيط'
};

const MEMBERSHIP_TYPE_LABELS: Record<string, string> = {
  WORKER_MEMBER: 'عضو عامل',
  NON_WORKER_MEMBER: 'عضو غير عامل'
};

const WORKFLOW_STATE_LABELS: Record<string, string> = {
  TRANSFER_REVIEW_REQUIRED: 'يتطلب مراجعة بعد التحويل',
  TRANSFER_REVIEW_RESOLVED: 'تمت مراجعة التحويل'
};

const STAY_MODE_LABELS: Record<string, string> = {
  RESIDENCE_ONLY: 'إقامة فقط',
  RESIDENCE_WITH_TRANSPORT: 'إقامة وانتقالات'
};

const PRICING_MODE_LABELS: Record<string, string> = {
  AccommodationOnlyAllowed: 'إقامة فقط',
  AccommodationAndTransportationOptional: 'إقامة وانتقالات (اختياري)',
  TransportationMandatoryIncluded: 'انتقالات إلزامية ومضمنة'
};

const DESTINATION_VALUE_LABELS: Record<string, string> = {
  MATROUH: 'مرسى مطروح',
  MERSA_MATROUH: 'مرسى مطروح',
  MERSA_MATROH: 'مرسى مطروح',
  RAS_EL_BAR: 'رأس البر',
  RASELBAR: 'رأس البر',
  PORT_FOUAD: 'بور فؤاد',
  PORTFOUAD: 'بور فؤاد'
};

const RELATION_VALUE_LABELS: Record<string, string> = {
  BROTHER: 'أخ',
  SISTER: 'أخت',
  HUSBAND: 'زوج',
  WIFE: 'زوجة',
  SPOUSE: 'زوج/زوجة',
  SON: 'ابن',
  DAUGHTER: 'ابنة',
  FATHER: 'أب',
  MOTHER: 'أم'
};

export function isAllowedAttachmentFile(file: File, allowedExtensions: Set<string> = SUMMER_ALLOWED_ATTACHMENT_EXTENSIONS): boolean {
  const fileName = String(file?.name ?? '').toLowerCase();
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex < 0) {
    return false;
  }

  const extension = fileName.substring(dotIndex);
  return allowedExtensions.has(extension);
}

export function normalizeFieldToken(value: string): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ]/g, '');
}

export function getFieldValueByKeys(
  fields: Array<{ fildKind?: unknown; fildTxt?: unknown }> | undefined,
  keys: string[]
): string {
  if (!fields || !fields.length) {
    return '';
  }

  const normalizedKeys = keys.map(key => normalizeFieldToken(key));
  const normalizedFields = fields.map(field => ({
    normalizedKey: normalizeFieldToken(String(field.fildKind ?? '')),
    value: String(field.fildTxt ?? '').trim()
  }));

  for (const key of normalizedKeys) {
    const matched = normalizedFields.find(field => field.normalizedKey === key && field.value.length > 0);
    if (matched) {
      return matched.value;
    }
  }

  for (const key of normalizedKeys) {
    const matched = normalizedFields.find(field =>
      field.value.length > 0 &&
      (field.normalizedKey.includes(key) || key.includes(field.normalizedKey))
    );
    if (matched) {
      return matched.value;
    }
  }

  return '';
}

export function coalesceText(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text.length > 0 && text !== '-') {
      return text;
    }
  }
  return '';
}

export function toDisplayOrDash(value: string): string {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : '-';
}

function normalizeLookupValue(value: string): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
}

function countArabicChars(value: string): number {
  return (String(value ?? '').match(/[؀-ۿ]/g) ?? []).length;
}

function countCorruptionChars(value: string): number {
  return (String(value ?? '').match(/[ØÙÃÐ�]/g) ?? []).length;
}

function tryDecodeMojibake(value: string): string {
  const text = String(value ?? '');
  if (!text || !/[ØÙÃÐ�]/.test(text)) {
    return text;
  }

  try {
    const bytes = Uint8Array.from(Array.from(text).map(ch => ch.charCodeAt(0) & 0xff));
    const decoded = new TextDecoder('utf-8').decode(bytes).trim();
    if (!decoded) {
      return text;
    }

    const originalScore = (countArabicChars(text) * 2) - (countCorruptionChars(text) * 3);
    const decodedScore = (countArabicChars(decoded) * 2) - (countCorruptionChars(decoded) * 3);
    return decodedScore > originalScore ? decoded : text;
  } catch {
    return text;
  }
}

function parseBooleanLike(value: string): boolean | null {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (['1', 'true', 'yes', 'y', 'نعم'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'n', 'لا'].includes(normalized)) {
    return false;
  }
  return null;
}

function translateValue(value: string, dictionary: Record<string, string>): string {
  const normalized = normalizeLookupValue(value);
  return dictionary[normalized] ?? value;
}

function parseNumberLike(value: string): number | null {
  const normalized = String(value ?? '').trim().replace(/,/g, '');
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

function formatMoneyWithCurrency(value: string): string {
  const parsed = parseNumberLike(value);
  if (parsed === null) {
    return value;
  }

  const rounded = Math.round(parsed * 100) / 100;
  const hasFraction = Math.abs(rounded - Math.trunc(rounded)) > 0.0001;
  const formatted = rounded.toLocaleString('en-US', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2
  });
  return `${formatted} جنيه`;
}

export function formatRequestFieldValue(fieldKey: string, rawValue: string): string {
  let value = String(rawValue ?? '').trim();
  if (!value) {
    return '-';
  }

  value = tryDecodeMojibake(value);
  const normalizedKey = normalizeFieldToken(fieldKey);

  if (normalizedKey.includes('atutc') || normalizedKey.includes('dueat') || normalizedKey.includes('createddate')) {
    const formattedDate = formatUtcDateToCairoHour(value);
    return formattedDate || value;
  }

  if (normalizedKey.includes('actiontype') || normalizedKey.includes('adminlastaction')) {
    return translateValue(value, ACTION_TYPE_LABELS);
  }

  if (normalizedKey.includes('cancelreason') && isCorruptedText(value)) {
    return 'تم إلغاء الطلب تلقائيًا لعدم السداد خلال مهلة يوم العمل.';
  }

  if (normalizedKey.includes('paymentstatus')) {
    return translateValue(value, PAYMENT_STATUS_LABELS);
  }

  if (normalizedKey.includes('paymentmode')) {
    return translateValue(value, PAYMENT_MODE_LABELS);
  }

  if (normalizedKey.includes('membershiptype')) {
    return translateValue(value, MEMBERSHIP_TYPE_LABELS);
  }

  if (normalizedKey.includes('paymentinstallmentstotal')
    || (normalizedKey.includes('paymentinstallment') && normalizedKey.includes('amount'))) {
    return formatMoneyWithCurrency(value);
  }

  if (normalizedKey.includes('paymentinstallment')
    && normalizedKey.includes('paid')
    && !normalizedKey.includes('paidat')) {
    const paid = parseBooleanLike(value);
    if (paid === null) {
      return value;
    }
    return paid ? 'مسدد' : 'غير مسدد';
  }

  if (normalizedKey.includes('workflowstate') && !normalizedKey.includes('reason') && !normalizedKey.includes('label')) {
    return translateValue(value, WORKFLOW_STATE_LABELS);
  }

  if (normalizedKey.includes('staymode')) {
    return translateValue(value, STAY_MODE_LABELS);
  }

  if (normalizedKey.includes('pricingmode')) {
    return translateValue(value, PRICING_MODE_LABELS);
  }

  if (normalizedKey.includes('destination')) {
    return translateValue(value, DESTINATION_VALUE_LABELS);
  }

  if (normalizedKey.includes('relation')) {
    return translateValue(value, RELATION_VALUE_LABELS);
  }

  if (normalizedKey.includes('proxymode')) {
    const proxy = parseBooleanLike(value);
    if (proxy === null) {
      return value;
    }
    return proxy ? 'بالنيابة عن موظف آخر' : 'صاحب الطلب نفسه';
  }

  if (normalizedKey.includes('transferrequiresrepayment')) {
    const flag = parseBooleanLike(value);
    if (flag === null) {
      return value;
    }
    return flag ? 'نعم' : 'لا';
  }

  if (normalizedKey.includes('pricingtransportationmandatory')) {
    const flag = parseBooleanLike(value);
    if (flag === null) {
      return value;
    }
    return flag ? 'نعم' : 'لا';
  }

  const genericBoolean = parseBooleanLike(value);
  if (genericBoolean !== null) {
    return genericBoolean ? 'نعم' : 'لا';
  }

  return value;
}

export function resolveFieldLabel(key: string, labelMap: Record<string, string> = SUMMER_FIELD_LABEL_MAP): string {
  const direct = labelMap[key];
  if (direct) {
    return direct;
  }

  const normalized = normalizeFieldToken(key);
  if (normalized.includes('national') || normalized.includes('nid') || normalized.includes('idnumber')) {
    return 'الرقم القومي';
  }
  if (normalized.includes('phone') || normalized.includes('mobile') || normalized.includes('tel')) {
    return 'رقم الهاتف';
  }
  if (normalized.includes('name')) {
    return 'الاسم';
  }
  if (normalized.includes('family') && normalized.includes('count')) {
    return 'عدد الأفراد';
  }
  if (normalized.includes('wave') || normalized.includes('summercamp')) {
    return 'الفوج';
  }
  if (normalized.includes('notes') || normalized.includes('description')) {
    return 'ملاحظات';
  }

  return key;
}

export type SummerRequestFieldGridRow = {
  key?: string;
  label: string;
  value: string;
  instanceGroupId: number;
  rowType?: 'group-header' | 'field';
  groupTitle?: string;
};

type SummerFieldSource = {
  fildKind?: unknown;
  fildTxt?: unknown;
  instanceGroupId?: unknown;
};

type SummerRequestSummaryLike = {
  requestRef?: unknown;
  categoryName?: unknown;
  categoryId?: unknown;
  waveCode?: unknown;
  seasonYear?: unknown;
  paymentDueAtUtc?: unknown;
  paidAtUtc?: unknown;
};

type FieldGroupKey = 'booking' | 'owner' | 'workflow' | 'other';

type CanonicalFieldMeta = {
  id: string;
  label: string;
  group: FieldGroupKey;
  order: number;
};

type CanonicalFieldRow = CanonicalFieldMeta & {
  instanceGroupId: number;
  value: string;
};

type BuildSummerRequestDetailFieldsInput = {
  fields: SummerFieldSource[] | undefined;
  summary?: SummerRequestSummaryLike | null;
  summaryStatusLabel?: string;
  summaryDateFormatter?: (value?: string) => string;
  resolveWaveLabel?: (categoryId: number, waveCode: string) => string;
  resolveDestinationNameById?: (categoryId: number) => string;
  labelMap?: Record<string, string>;
};

const FIELD_GROUP_LABELS: Record<FieldGroupKey, string> = {
  booking: 'بيانات الحجز',
  owner: 'بيانات صاحب الطلب',
  workflow: 'بيانات المتابعة',
  other: 'بيانات إضافية'
};

const PREFER_TEXT_CANONICAL_KEYS = new Set<string>([
  'destination_name',
  'transfer_from_destination',
  'transfer_to_destination'
]);

function parsePositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.floor(parsed);
}

function normalizeInstanceGroupId(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

function isNumericText(value: string): boolean {
  return /^\d+$/.test(String(value ?? '').trim());
}

function shouldReplaceCanonicalValue(current: string, candidate: string, canonicalKey: string): boolean {
  const currentNormalized = toDisplayOrDash(current);
  const candidateNormalized = toDisplayOrDash(candidate);
  if (candidateNormalized === '-') {
    return false;
  }
  if (currentNormalized === '-') {
    return true;
  }
  if (currentNormalized === candidateNormalized) {
    return false;
  }

  if (PREFER_TEXT_CANONICAL_KEYS.has(canonicalKey)) {
    if (isNumericText(currentNormalized) && !isNumericText(candidateNormalized)) {
      return true;
    }
  }

  if (canonicalKey === 'wave_label') {
    if (!currentNormalized.includes('/') && candidateNormalized.includes('/')) {
      return true;
    }
  }

  return candidateNormalized.length > currentNormalized.length;
}

function resolveDestinationText(
  rawValue: string,
  resolveDestinationNameById?: (categoryId: number) => string,
  fallbackName?: string
): string {
  const normalized = toDisplayOrDash(rawValue);
  if (normalized === '-') {
    return toDisplayOrDash(fallbackName ?? '');
  }
  if (!isNumericText(normalized)) {
    return normalized;
  }

  const categoryId = parsePositiveInt(normalized);
  if (!categoryId) {
    return toDisplayOrDash(fallbackName ?? normalized);
  }

  const resolved = String(resolveDestinationNameById?.(categoryId) ?? '').trim();
  if (resolved.length > 0) {
    return resolved;
  }

  return toDisplayOrDash(fallbackName ?? normalized);
}

function resolveFriendlyLabel(key: string, labelMap: Record<string, string>): string {
  const resolved = resolveFieldLabel(key, labelMap);
  if (resolved !== key) {
    return resolved;
  }

  const normalized = normalizeFieldToken(key);
  if (normalized.includes('destination')) {
    return 'المصيف';
  }
  if (normalized.includes('wave') || normalized.includes('camp')) {
    return 'الفوج';
  }
  if (normalized.includes('season') || normalized.includes('year')) {
    return 'موسم الحجز';
  }
  if (normalized.includes('relation')) {
    return 'درجة القرابة';
  }
  if (normalized.includes('membership') || normalized.includes('membertype')) {
    return 'نوع العضوية';
  }
  if (normalized.includes('transportationmandatory')) {
    return 'الانتقالات إلزامية';
  }
  if (normalized.includes('phone') || normalized.includes('mobile') || normalized.includes('tel')) {
    return 'رقم الهاتف';
  }
  if (normalized.includes('count')) {
    return 'العدد';
  }
  if (normalized.includes('status')) {
    return 'الحالة';
  }
  if (normalized.includes('date') || normalized.includes('time') || normalized.includes('atutc')) {
    return 'التاريخ';
  }
  return 'بيان إضافي';
}

function resolveCanonicalFieldMeta(
  fieldKey: string,
  labelMap: Record<string, string>
): CanonicalFieldMeta {
  const normalized = normalizeFieldToken(fieldKey);

  const installmentAmountMatch = normalized.match(/paymentinstallment(\d+)amount/);
  if (installmentAmountMatch) {
    const installmentNo = Math.max(1, Number(installmentAmountMatch[1] ?? '1'));
    const installmentLabel = installmentNo === 1 ? 'قيمة مقدم الحجز' : `قيمة القسط ${installmentNo - 1}`;
    return {
      id: `payment_installment_${installmentNo}_amount`,
      label: installmentLabel,
      group: 'workflow',
      order: 220 + (installmentNo * 3)
    };
  }

  const installmentPaidAtMatch = normalized.match(/paymentinstallment(\d+)paidat/);
  if (installmentPaidAtMatch) {
    const installmentNo = Math.max(1, Number(installmentPaidAtMatch[1] ?? '1'));
    const installmentPaidAtLabel = installmentNo === 1 ? 'تاريخ سداد مقدم الحجز' : `تاريخ سداد القسط ${installmentNo - 1}`;
    return {
      id: `payment_installment_${installmentNo}_paid_at`,
      label: installmentPaidAtLabel,
      group: 'workflow',
      order: 221 + (installmentNo * 3)
    };
  }

  const installmentPaidMatch = normalized.match(/paymentinstallment(\d+)paid/);
  if (installmentPaidMatch) {
    const installmentNo = Math.max(1, Number(installmentPaidMatch[1] ?? '1'));
    const installmentPaidLabel = installmentNo === 1 ? 'حالة سداد مقدم الحجز' : `حالة سداد القسط ${installmentNo - 1}`;
    return {
      id: `payment_installment_${installmentNo}_paid`,
      label: installmentPaidLabel,
      group: 'workflow',
      order: 222 + (installmentNo * 3)
    };
  }

  if (normalized.includes('requestref')) {
    return { id: 'request_ref', label: 'رقم الطلب', group: 'workflow', order: 10 };
  }
  if (normalized.includes('subject')) {
    return { id: 'request_subject', label: 'عنوان الطلب', group: 'workflow', order: 20 };
  }

  if (normalized.includes('transferfromcategory') || normalized.includes('transferfromdestination') || normalized.includes('fromdestination')) {
    return { id: 'transfer_from_destination', label: 'من مصيف', group: 'workflow', order: 110 };
  }
  if (normalized.includes('transfertocategory') || normalized.includes('transfertodestination') || normalized.includes('todestination')) {
    return { id: 'transfer_to_destination', label: 'إلى مصيف', group: 'workflow', order: 130 };
  }
  if (normalized.includes('transferfromwave')) {
    return { id: 'transfer_from_wave', label: 'من فوج', group: 'workflow', order: 120 };
  }
  if (normalized.includes('transfertowave')) {
    return { id: 'transfer_to_wave', label: 'إلى فوج', group: 'workflow', order: 140 };
  }

  if (normalized.includes('summerdestinationname') || normalized.includes('summerdestinationid') || normalized.includes('destinationname') || normalized.includes('destinationid')) {
    return { id: 'destination_name', label: 'اسم المصيف', group: 'booking', order: 10 };
  }
  if (normalized.includes('summercamplabel') || (normalized.includes('wave') && normalized.includes('label'))) {
    return { id: 'wave_label', label: 'بيان الفوج', group: 'booking', order: 30 };
  }
  if (normalized.includes('summercamp') || normalized === 'wave' || normalized === 'wavecode') {
    return { id: 'wave_code', label: 'الفوج', group: 'booking', order: 20 };
  }
  if (normalized.includes('seasonyear')) {
    return { id: 'season_year', label: 'موسم الحجز', group: 'booking', order: 40 };
  }
  if (normalized.includes('staymode')) {
    return { id: 'stay_mode', label: 'نوع الحجز', group: 'booking', order: 50 };
  }
  if (normalized.includes('pricingselectedstaymode')) {
    return { id: 'pricing_selected_stay_mode', label: 'نوع الحجز المعتمد', group: 'booking', order: 51 };
  }
  if (normalized.includes('pricingmode')) {
    return { id: 'pricing_mode', label: 'نمط التسعير', group: 'booking', order: 52 };
  }
  if (normalized.includes('pricingtransportationmandatory')) {
    return { id: 'pricing_transport_mandatory', label: 'الانتقالات إلزامية', group: 'booking', order: 53 };
  }
  if (normalized.includes('transportationmandatory')) {
    return { id: 'transport_mandatory', label: 'الانتقالات إلزامية', group: 'booking', order: 53 };
  }
  if (normalized.includes('pricingmembershiptype')) {
    return { id: 'pricing_membership_type', label: 'نوع العضوية المحسوب', group: 'booking', order: 62 };
  }
  if (normalized.includes('membershiptype')) {
    return { id: 'membership_type', label: 'نوع العضوية', group: 'owner', order: 55 };
  }
  if (normalized.includes('pricingpersonscount')) {
    return { id: 'pricing_persons_count', label: 'عدد الأفراد المحسوب', group: 'booking', order: 54 };
  }
  if (normalized.includes('pricingperiodkey')) {
    return { id: 'pricing_period_key', label: 'فترة التسعير', group: 'booking', order: 55 };
  }
  if (normalized.includes('pricingaccommodationpriceperperson')) {
    return { id: 'pricing_accommodation_unit', label: 'سعر الإقامة للفرد', group: 'booking', order: 56 };
  }
  if (normalized.includes('pricingtransportationpriceperperson')) {
    return { id: 'pricing_transportation_unit', label: 'سعر الانتقالات للفرد', group: 'booking', order: 57 };
  }
  if (normalized.includes('pricingproxyinsuranceamount')) {
    return { id: 'pricing_proxy_insurance', label: 'قيمة تأمين الحجز بالنيابة', group: 'booking', order: 57 };
  }
  if (normalized.includes('pricingappliedinsuranceamount')) {
    return { id: 'pricing_applied_insurance', label: 'قيمة التأمين المطبقة', group: 'booking', order: 58 };
  }
  if (normalized.includes('pricinginsuranceamount')) {
    return { id: 'pricing_insurance', label: 'قيمة التأمين', group: 'booking', order: 58 };
  }
  if (normalized.includes('pricingaccommodationtotal')) {
    return { id: 'pricing_accommodation_total', label: 'إجمالي الإقامة', group: 'booking', order: 59 };
  }
  if (normalized.includes('pricingtransportationtotal')) {
    return { id: 'pricing_transportation_total', label: 'إجمالي الانتقالات', group: 'booking', order: 60 };
  }
  if (normalized.includes('pricinggrandtotal')) {
    return { id: 'pricing_grand_total', label: 'الإجمالي النهائي', group: 'booking', order: 61 };
  }
  if (normalized.includes('pricingdisplaytext')) {
    return { id: 'pricing_display_text', label: 'بيان التسعير', group: 'workflow', order: 65 };
  }
  if (normalized.includes('pricingconfigid') || normalized.includes('pricingpolicyid')) {
    return { id: 'pricing_config_id', label: 'مرجع سياسة التسعير', group: 'workflow', order: 66 };
  }
  if (normalized.includes('familycount')) {
    return { id: 'family_count', label: 'عدد الأفراد', group: 'booking', order: 60 };
  }
  if (normalized.includes('overcount') || normalized.includes('extracount')) {
    return { id: 'extra_count', label: 'أفراد إضافيون', group: 'booking', order: 70 };
  }

  if (normalized.includes('proxymode')) {
    return { id: 'proxy_mode', label: 'تسجيل بالنيابة', group: 'owner', order: 60 };
  }
  if (normalized.includes('empid') || normalized.includes('ownerfilenumber') || normalized === 'filenumber' || normalized.includes('employeefilenumber')) {
    return { id: 'owner_file', label: 'رقم الملف', group: 'owner', order: 20 };
  }
  if ((normalized.includes('national') || normalized.includes('nid') || normalized.includes('idnumber'))
    && !normalized.includes('family')
    && !normalized.includes('companion')) {
    return { id: 'owner_national_id', label: 'الرقم القومي', group: 'owner', order: 30 };
  }
  if (normalized.includes('extraphone') || normalized.includes('secondaryphone') || normalized.includes('alternatephone')) {
    return { id: 'owner_extra_phone', label: 'هاتف إضافي', group: 'owner', order: 50 };
  }
  if ((normalized.includes('phone') || normalized.includes('mobile') || normalized.includes('tel'))
    && !normalized.includes('family')
    && !normalized.includes('companion')) {
    return { id: 'owner_phone', label: 'رقم الهاتف', group: 'owner', order: 40 };
  }
  if ((normalized.includes('empname') || normalized.includes('employeename') || normalized.includes('ownername') || normalized === 'name')
    && !normalized.includes('family')
    && !normalized.includes('companion')
    && !normalized.includes('destination')) {
    return { id: 'owner_name', label: 'اسم الموظف', group: 'owner', order: 10 };
  }

  if (normalized.includes('actiontype')) {
    return { id: 'action_type', label: 'نوع الإجراء', group: 'workflow', order: 30 };
  }
  if (normalized.includes('adminlastaction')) {
    return { id: 'admin_last_action', label: 'آخر إجراء إداري', group: 'workflow', order: 35 };
  }
  if (normalized.includes('adminactionatutc')) {
    return { id: 'admin_action_at', label: 'تاريخ الإجراء الإداري', group: 'workflow', order: 40 };
  }
  if (normalized.includes('paymentmode')) {
    return { id: 'payment_mode', label: 'طريقة السداد', group: 'workflow', order: 46 };
  }
  if (normalized.includes('paymentinstallmentcount')) {
    return { id: 'payment_installment_count', label: 'عدد الأقساط', group: 'workflow', order: 47 };
  }
  if (normalized.includes('paymentinstallmentstotal')) {
    return { id: 'payment_installments_total', label: 'إجمالي الأقساط', group: 'workflow', order: 48 };
  }
  if (normalized.includes('paymentstatus')) {
    return { id: 'payment_status', label: 'حالة السداد', group: 'workflow', order: 50 };
  }
  if (normalized.includes('paymentdue')) {
    return { id: 'payment_due', label: 'مهلة السداد', group: 'workflow', order: 60 };
  }
  if (normalized.includes('paidat')) {
    return { id: 'paid_at', label: 'تاريخ السداد', group: 'workflow', order: 70 };
  }
  if (normalized.includes('cancelreason')) {
    return { id: 'cancel_reason', label: 'سبب الاعتذار', group: 'workflow', order: 80 };
  }
  if (normalized.includes('cancelledat')) {
    return { id: 'cancelled_at', label: 'تاريخ الإلغاء', group: 'workflow', order: 90 };
  }
  if (normalized.includes('transfercount')) {
    return { id: 'transfer_count', label: 'عدد مرات التحويل', group: 'workflow', order: 100 };
  }
  if (normalized.includes('transferredat')) {
    return { id: 'transferred_at', label: 'تاريخ التحويل', group: 'workflow', order: 150 };
  }
  if (normalized.includes('transferapprovedat')) {
    return { id: 'transfer_approved_at', label: 'تاريخ اعتماد التحويل', group: 'workflow', order: 160 };
  }
  if (normalized.includes('description') || normalized.includes('notes')) {
    return { id: 'notes', label: 'ملاحظات', group: 'workflow', order: 170 };
  }

  return {
    id: `other:${normalized || fieldKey}`,
    label: resolveFriendlyLabel(fieldKey, labelMap),
    group: 'other',
    order: 900
  };
}

function groupOrder(groupKey: FieldGroupKey): number {
  if (groupKey === 'booking') {
    return 1;
  }
  if (groupKey === 'owner') {
    return 2;
  }
  if (groupKey === 'workflow') {
    return 3;
  }
  return 4;
}

function appendGroupHeaders(rows: CanonicalFieldRow[]): SummerRequestFieldGridRow[] {
  const sorted = [...rows].sort((a, b) =>
    groupOrder(a.group) - groupOrder(b.group)
    || a.instanceGroupId - b.instanceGroupId
    || a.order - b.order
    || a.label.localeCompare(b.label, 'ar')
  );

  const result: SummerRequestFieldGridRow[] = [];
  let previousGroup: FieldGroupKey | null = null;
  sorted.forEach(row => {
    if (row.group !== previousGroup) {
      result.push({
        label: FIELD_GROUP_LABELS[row.group],
        value: '',
        instanceGroupId: row.instanceGroupId,
        rowType: 'group-header',
        groupTitle: FIELD_GROUP_LABELS[row.group]
      });
      previousGroup = row.group;
    }

    result.push({
      key: row.id,
      label: row.label,
      value: toDisplayOrDash(row.value),
      instanceGroupId: row.instanceGroupId,
      rowType: 'field'
    });
  });

  return result;
}

function upsertCanonicalRow(
  rowsByKey: Map<string, CanonicalFieldRow>,
  next: CanonicalFieldRow
): void {
  const key = `${next.instanceGroupId}|${next.id}`;
  const existing = rowsByKey.get(key);
  if (!existing) {
    rowsByKey.set(key, next);
    return;
  }

  if (shouldReplaceCanonicalValue(existing.value, next.value, next.id)) {
    existing.value = next.value;
    existing.label = next.label;
  }
}

function shouldExcludeDetailField(fieldKey: string): boolean {
  const normalized = normalizeFieldToken(fieldKey);
  return normalized.includes('whatsapp');
}

function addSummaryRows(
  rowsByKey: Map<string, CanonicalFieldRow>,
  summary: SummerRequestSummaryLike,
  statusLabel: string,
  dateFormatter?: (value?: string) => string
): void {
  const formattedDueAt = toDisplayOrDash(String(dateFormatter?.(String(summary.paymentDueAtUtc ?? '').trim()) ?? '').trim());
  const formattedPaidAt = toDisplayOrDash(String(dateFormatter?.(String(summary.paidAtUtc ?? '').trim()) ?? '').trim());

  const rows: CanonicalFieldRow[] = [
    {
      id: 'request_ref',
      label: 'رقم الطلب',
      group: 'workflow',
      order: 10,
      instanceGroupId: 1,
      value: toDisplayOrDash(String(summary.requestRef ?? '').trim())
    },
    {
      id: 'destination_name',
      label: 'اسم المصيف',
      group: 'booking',
      order: 10,
      instanceGroupId: 1,
      value: toDisplayOrDash(String(summary.categoryName ?? '').trim())
    },
    {
      id: 'wave_code',
      label: 'الفوج',
      group: 'booking',
      order: 20,
      instanceGroupId: 1,
      value: toDisplayOrDash(String(summary.waveCode ?? '').trim())
    },
    {
      id: 'request_status',
      label: 'الحالة',
      group: 'workflow',
      order: 45,
      instanceGroupId: 1,
      value: toDisplayOrDash(statusLabel)
    },
    {
      id: 'payment_due',
      label: 'مهلة السداد',
      group: 'workflow',
      order: 60,
      instanceGroupId: 1,
      value: formattedDueAt
    },
    {
      id: 'paid_at',
      label: 'تاريخ السداد',
      group: 'workflow',
      order: 70,
      instanceGroupId: 1,
      value: formattedPaidAt
    }
  ];

  rows.forEach(row => {
    if (toDisplayOrDash(row.value) !== '-') {
      upsertCanonicalRow(rowsByKey, row);
    }
  });
}

function isCompanionNameToken(normalizedKey: string): boolean {
  return normalizedKey.includes('name')
    && (normalizedKey.includes('familymember') || normalizedKey.includes('companion'));
}

function isCompanionRelationToken(normalizedKey: string): boolean {
  if (normalizedKey.includes('relationother')) {
    return false;
  }
  return normalizedKey.includes('relation')
    && (normalizedKey.includes('family') || normalizedKey.includes('companion'));
}

function isCompanionRelationOtherToken(normalizedKey: string): boolean {
  return normalizedKey.includes('relationother')
    && (normalizedKey.includes('family') || normalizedKey.includes('companion'));
}

function isCompanionNationalIdToken(normalizedKey: string): boolean {
  return (normalizedKey.includes('national') || normalizedKey.includes('nid') || normalizedKey.includes('idnumber'))
    && (normalizedKey.includes('familymember') || normalizedKey.includes('companion'));
}

function isCompanionAgeToken(normalizedKey: string): boolean {
  return normalizedKey.includes('age')
    && (normalizedKey.includes('familymember') || normalizedKey.includes('companion'));
}

export function isCompanionFieldKey(fieldKey: string): boolean {
  const normalized = normalizeFieldToken(fieldKey);
  return isCompanionNameToken(normalized)
    || isCompanionRelationToken(normalized)
    || isCompanionRelationOtherToken(normalized)
    || isCompanionNationalIdToken(normalized)
    || isCompanionAgeToken(normalized);
}

function isOtherRelationDisplayValue(value: string): boolean {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا');

  return normalized === 'اخرى'
    || normalized === 'اخري'
    || normalized === 'other';
}

export function buildSummerRequestCompanions(
  fields: SummerFieldSource[] | undefined
): Array<{ index: number; name: string; relation: string; nationalId: string; age: string }> {
  const grouped = new Map<number, { groupId: number; name: string; relation: string; relationOther: string; nationalId: string; age: string }>();

  (fields ?? []).forEach((field, index) => {
    const fieldKey = String(field.fildKind ?? '').trim();
    if (!isCompanionFieldKey(fieldKey)) {
      return;
    }

    const normalizedFieldKey = normalizeFieldToken(fieldKey);
    const formattedValue = formatRequestFieldValue(fieldKey, String(field.fildTxt ?? '').trim());
    const fallbackGroupId = 10000 + index;
    const groupId = parsePositiveInt(field.instanceGroupId) ?? fallbackGroupId;

    if (!grouped.has(groupId)) {
      grouped.set(groupId, {
        groupId,
        name: '',
        relation: '',
        relationOther: '',
        nationalId: '',
        age: ''
      });
    }

    const row = grouped.get(groupId);
    if (!row) {
      return;
    }

    if (isCompanionNameToken(normalizedFieldKey)) {
      row.name = formattedValue;
      return;
    }
    if (isCompanionRelationToken(normalizedFieldKey)) {
      row.relation = formattedValue;
      return;
    }
    if (isCompanionRelationOtherToken(normalizedFieldKey)) {
      row.relationOther = formattedValue;
      return;
    }
    if (isCompanionNationalIdToken(normalizedFieldKey)) {
      row.nationalId = formattedValue;
      return;
    }
    if (isCompanionAgeToken(normalizedFieldKey)) {
      row.age = formattedValue;
    }
  });

  return [...grouped.values()]
    .sort((a, b) => a.groupId - b.groupId)
    .map((row, index) => ({
      relation: toDisplayOrDash(
        isOtherRelationDisplayValue(row.relation) && String(row.relationOther ?? '').trim().length > 0
          ? row.relationOther
          : row.relation
      ),
      index: index + 1,
      name: toDisplayOrDash(row.name),
      nationalId: toDisplayOrDash(row.nationalId),
      age: toDisplayOrDash(row.age)
    }))
    .filter(row => row.name !== '-' || row.relation !== '-' || row.nationalId !== '-' || row.age !== '-');
}

export function buildSummerRequestDetailFields(input: BuildSummerRequestDetailFieldsInput): SummerRequestFieldGridRow[] {
  const labelMap = input.labelMap ?? SUMMER_FIELD_LABEL_MAP;
  const rowsByKey = new Map<string, CanonicalFieldRow>();
  const summary = input.summary ?? null;
  const summaryDestinationName = String(summary?.categoryName ?? '').trim();
  const summaryCategoryId = parsePositiveInt(summary?.categoryId);
  const summaryWaveCode = String(summary?.waveCode ?? '').trim();

  (input.fields ?? []).forEach(field => {
    const fieldKey = String(field.fildKind ?? '').trim();
    const rawValue = String(field.fildTxt ?? '').trim();
    if (!fieldKey || !rawValue || isCompanionFieldKey(fieldKey) || shouldExcludeDetailField(fieldKey)) {
      return;
    }

    const meta = resolveCanonicalFieldMeta(fieldKey, labelMap);
    const instanceGroupId = normalizeInstanceGroupId(field.instanceGroupId);
    let value = formatRequestFieldValue(fieldKey, rawValue);

    if (meta.id === 'destination_name') {
      value = resolveDestinationText(value, input.resolveDestinationNameById, summaryDestinationName);
    }
    if (meta.id === 'transfer_from_destination' || meta.id === 'transfer_to_destination') {
      value = resolveDestinationText(value, input.resolveDestinationNameById);
    }

    upsertCanonicalRow(rowsByKey, {
      ...meta,
      value,
      instanceGroupId
    });
  });

  if (summaryCategoryId && summaryWaveCode) {
    const waveLabel = String(input.resolveWaveLabel?.(summaryCategoryId, summaryWaveCode) ?? '').trim();
    if (waveLabel.length > 0) {
      upsertCanonicalRow(rowsByKey, {
        id: 'wave_label',
        label: 'بيان الفوج',
        group: 'booking',
        order: 30,
        instanceGroupId: 1,
        value: waveLabel
      });
    }
  }

  if (summaryDestinationName.length > 0) {
    upsertCanonicalRow(rowsByKey, {
      id: 'destination_name',
      label: 'اسم المصيف',
      group: 'booking',
      order: 10,
      instanceGroupId: 1,
      value: summaryDestinationName
    });
  } else if (summaryCategoryId) {
    const destinationName = String(input.resolveDestinationNameById?.(summaryCategoryId) ?? '').trim();
    if (destinationName.length > 0) {
      upsertCanonicalRow(rowsByKey, {
        id: 'destination_name',
        label: 'اسم المصيف',
        group: 'booking',
        order: 10,
        instanceGroupId: 1,
        value: destinationName
      });
    }
  }

  if (rowsByKey.size === 0 && summary) {
    addSummaryRows(rowsByKey, summary, toDisplayOrDash(input.summaryStatusLabel ?? ''), input.summaryDateFormatter);
  }

  return appendGroupHeaders(Array.from(rowsByKey.values()))
    .filter(row => row.rowType === 'group-header' || toDisplayOrDash(row.value) !== '-');
}

export function resolveAttachmentId(item: { attchId?: unknown; id?: unknown } | undefined): number {
  const id = Number(item?.id);
  if (Number.isFinite(id) && id > 0) {
    return id;
  }

  const attchId = Number(item?.attchId);
  if (Number.isFinite(attchId) && attchId > 0) {
    return attchId;
  }

  return 0;
}

export function parseDateToEpoch(value: string | undefined): number {
  if (!value) {
    return 0;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function getDatePart(parts: Intl.DateTimeFormatPart[], type: string): string {
  return parts.find(item => item.type === type)?.value ?? '';
}

export function formatUtcDateToCairoHour(value?: string): string {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const parts = new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Africa/Cairo'
  }).formatToParts(parsed);

  const day = getDatePart(parts, 'day');
  const month = getDatePart(parts, 'month');
  const year = getDatePart(parts, 'year');
  const hour = getDatePart(parts, 'hour');
  const minute = getDatePart(parts, 'minute');

  if (!day || !month || !year || !hour || !minute) {
    return value;
  }

  return `${day}/${month}/${year} ${hour}:${minute}`;
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

export function isRejectedStatus(status: string | undefined): boolean {
  const normalized = (status ?? '').toLowerCase();
  return normalized.includes('rejected') || normalized.includes('مرفوض') || normalized.includes('اعتذار') || normalized.includes('ملغي');
}

export function getStatusClass(status: string | undefined): string {
  const normalized = (status || '').toLowerCase();
  if (isRejectedStatus(normalized)) {
    return 'status-bad';
  }
  if (normalized.includes('inprogress') || normalized.includes('processing') || normalized.includes('قيد') || normalized.includes('جاري')) {
    return 'status-mid';
  }
  if (normalized.includes('closed')
    || normalized.includes('done')
    || normalized.includes('مكتمل')
    || normalized.includes('تم')
    || normalized.includes('مسدد')
    || normalized.includes('مقبول')
    || normalized.includes('replied')
    || normalized.includes('اعتماد')) {
    return 'status-good';
  }
  return 'status-neutral';
}

export function getStatusLabel(status: string | undefined): string {
  const normalized = (status ?? '').toLowerCase();
  if (isRejectedStatus(normalized)) {
    return 'مرفوض';
  }
  if (normalized.includes('finalapprove') || normalized.includes('اعتماد') || normalized.includes('approved')) {
    return 'اعتماد نهائي';
  }
  if (normalized.includes('replied') || normalized.includes('reply')) {
    return 'تم الرد';
  }
  if (normalized.includes('inprogress') || normalized.includes('processing') || normalized.includes('قيد') || normalized.includes('جاري')) {
    return 'قيد التنفيذ';
  }
  if (normalized.includes('closed') || normalized.includes('done') || normalized.includes('مكتمل') || normalized.includes('تم') || normalized.includes('مسدد')) {
    return 'مكتمل';
  }
  if (normalized.includes('new') || normalized.includes('جديد')) {
    return 'جديد';
  }
  return status?.trim() || 'غير معروف';
}

export function parseWaveLabelDate(label: string): Date | null {
  const normalized = String(label ?? '').trim();
  if (!normalized) {
    return null;
  }

  const match = normalized.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) {
    return null;
  }

  const parsed = new Date(year, month - 1, day, 0, 0, 0, 0);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatLocalDateHour(value: Date): string {
  if (!value || Number.isNaN(value.getTime())) {
    return '-';
  }

  const day = String(value.getDate()).padStart(2, '0');
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const year = String(value.getFullYear());
  const hour = String(value.getHours()).padStart(2, '0');
  const minute = String(value.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hour}:${minute}`;
}

export function isCorruptedText(value: string): boolean {
  const text = String(value ?? '').trim();
  if (!text) {
    return false;
  }

  const questionMarks = (text.match(/[\?؟]/g) ?? []).length;
  if (questionMarks > 0 && questionMarks >= Math.ceil(text.length * 0.35)) {
    return true;
  }

  const nonQuestionText = text.replace(/[\?؟\s]/g, '');
  if (!nonQuestionText.length) {
    return true;
  }

  return text.includes('?') || text.includes('Ø') || text.includes('Ù') || text.includes('�') || text.includes('Ã') || text.includes('Ð');
}

export function resolveReplyAuthorName(authorName: string, authorId: string): string {
  const cleanedName = authorName.trim();
  if (cleanedName.length > 0 && !isCorruptedText(cleanedName)) {
    return cleanedName;
  }

  const cleanedId = authorId.trim();
  if (cleanedId.length > 0 && !isCorruptedText(cleanedId)) {
    return cleanedId;
  }

  return 'غير معروف';
}

export function controlErrorsToMessages(label: string, errors: Record<string, unknown>): string[] {
  const messages: string[] = [];
  const normalizedLabel = String(label ?? '').trim();

  if (errors['required']) {
    messages.push(`${label}: هذا الحقل مطلوب.`);
  }
  if (errors['maxlength']) {
    const max = Number((errors['maxlength'] as { requiredLength?: number })?.requiredLength ?? 0);
    messages.push(`${label}: الحد الأقصى ${max} حرف.`);
  }
  if (errors['minlength']) {
    const min = Number((errors['minlength'] as { requiredLength?: number })?.requiredLength ?? 0);
    messages.push(`${label}: الحد الأدنى ${min} حرف.`);
  }
  if (errors['min']) {
    const min = Number((errors['min'] as { min?: number })?.min ?? 0);
    messages.push(`${label}: يجب ألا تقل القيمة عن ${min}.`);
  }
  if (errors['max']) {
    const max = Number((errors['max'] as { max?: number })?.max ?? 0);
    messages.push(`${label}: يجب ألا تزيد القيمة عن ${max}.`);
  }
  if (errors['pattern']) {
    if (normalizedLabel.includes('الرقم القومي')) {
      messages.push(`${label}: يجب أن يكون 14 رقمًا.`);
    } else {
      messages.push(`${label}: تنسيق القيمة غير صحيح.`);
    }
  }

  return messages;
}
