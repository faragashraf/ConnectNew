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
  SummerDestinationId: 'كود المصيف',
  SummerDestinationName: 'اسم المصيف',
  SummerProxyMode: 'تسجيل بالنيابة',
  Description: 'ملاحظات',
  FamilyMember_Name: 'اسم المرافق',
  FamilyRelation: 'درجة القرابة',
  FamilyMember_NationalId: 'الرقم القومي للمرافق',
  FamilyMember_Age: 'السن (للأطفال)',
  Summer_PaymentDueAtUtc: 'مهلة السداد',
  Summer_PaymentStatus: 'حالة السداد',
  Summer_PaidAtUtc: 'تاريخ السداد',
  Summer_TransferCount: 'عدد مرات التحويل',
  Summer_TransferredAtUtc: 'تاريخ التحويل',
  Summer_TransferFromCategory: 'من مصيف',
  Summer_TransferFromWave: 'من فوج',
  Summer_TransferToCategory: 'إلى مصيف',
  Summer_TransferToWave: 'إلى فوج',
  Summer_TransferApprovedAtUtc: 'تاريخ اعتماد التحويل',
  Summer_CancelReason: 'سبب الاعتذار'
};

const ACTION_TYPE_LABELS: Record<string, string> = {
  CANCEL: 'اعتذار عن الحجز',
  PAY: 'تسجيل السداد',
  TRANSFER: 'تحويل الحجز',
  AUTO_CANCEL_PAYMENT_TIMEOUT: 'إلغاء آلي لانتهاء مهلة السداد',
  MANUAL_CANCEL: 'إلغاء يدوي من الإدارة',
  FINAL_APPROVE: 'اعتماد نهائي',
  COMMENT: 'تعليق إداري'
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'بانتظار السداد',
  PAID: 'تم السداد',
  CANCELLED_AUTO: 'ملغي آليًا لعدم السداد',
  CANCELLED_ADMIN: 'ملغي من الإدارة',
  CANCELLED_USER: 'ملغي بناءً على الاعتذار',
  CANCELLED: 'ملغي',
  OVERDUE: 'متأخر عن السداد'
};

const STAY_MODE_LABELS: Record<string, string> = {
  RESIDENCE_ONLY: 'إقامة فقط',
  RESIDENCE_WITH_TRANSPORT: 'إقامة وانتقالات'
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
    .replace(/[^a-z0-9\u0600-\u06FF]/g, '');
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
  return (String(value ?? '').match(/[\u0600-\u06FF]/g) ?? []).length;
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

  if (normalizedKey.includes('staymode')) {
    return translateValue(value, STAY_MODE_LABELS);
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
    hour12: false,
    timeZone: 'Africa/Cairo'
  }).formatToParts(parsed);

  const day = getDatePart(parts, 'day');
  const month = getDatePart(parts, 'month');
  const year = getDatePart(parts, 'year');
  const hour = getDatePart(parts, 'hour');

  if (!day || !month || !year || !hour) {
    return value;
  }

  return `${day}/${month}/${year} ${hour}:00`;
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
  if (normalized.includes('closed') || normalized.includes('done') || normalized.includes('مكتمل') || normalized.includes('تم') || normalized.includes('مسدد') || normalized.includes('مقبول')) {
    return 'status-good';
  }
  return 'status-neutral';
}

export function getStatusLabel(status: string | undefined): string {
  const normalized = (status ?? '').toLowerCase();
  if (isRejectedStatus(normalized)) {
    return 'مرفوض';
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
  return `${day}/${month}/${year} ${hour}:00`;
}

export function isCorruptedText(value: string): boolean {
  const text = String(value ?? '').trim();
  if (!text) {
    return false;
  }

  const questionMarks = (text.match(/[\?\u061F]/g) ?? []).length;
  if (questionMarks > 0 && questionMarks >= Math.ceil(text.length * 0.35)) {
    return true;
  }

  const nonQuestionText = text.replace(/[\?\u061F\s]/g, '');
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

export function extractCapacityPayloadFromSignal(texts: string[]): string | null {
  const markers = ['SUMMER_CAPACITY_UPDATED|', 'capacity|'];

  for (const text of texts) {
    const normalized = String(text ?? '').trim();
    if (!normalized) {
      continue;
    }

    const directParts = normalized.split('|');
    if (directParts.length >= 3) {
      const directHead = String(directParts[0] ?? '').trim().toLowerCase();
      if (directHead === 'summer_capacity_updated' || directHead === 'capacity') {
        return normalized;
      }
    }

    const lower = normalized.toLowerCase();
    for (const marker of markers) {
      const index = lower.indexOf(marker.toLowerCase());
      if (index < 0) {
        continue;
      }

      const payload = normalized.substring(index).trim();
      const payloadParts = payload.split('|');
      if (payloadParts.length >= 3) {
        return payload;
      }
    }
  }

  return null;
}
