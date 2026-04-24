export const SUMMER_ADMIN_ACTION = {
  FINAL_APPROVE: 'FINAL_APPROVE',
  MANUAL_CANCEL: 'MANUAL_CANCEL',
  REJECT_REQUEST: 'REJECT_REQUEST',
  COMMENT: 'COMMENT',
  INTERNAL_ADMIN_ACTION: 'INTERNAL_ADMIN_ACTION',
  MARK_UNPAID: 'MARK_UNPAID'
} as const;

export type SummerAdminActionCode = typeof SUMMER_ADMIN_ACTION[keyof typeof SUMMER_ADMIN_ACTION];

const SUMMER_ADMIN_ACTION_ALIAS_MAP: Record<string, SummerAdminActionCode> = {
  finalapprove: SUMMER_ADMIN_ACTION.FINAL_APPROVE,
  approve: SUMMER_ADMIN_ACTION.FINAL_APPROVE,
  اعتمادنهائي: SUMMER_ADMIN_ACTION.FINAL_APPROVE,
  اعتماد: SUMMER_ADMIN_ACTION.FINAL_APPROVE,
  final_approve: SUMMER_ADMIN_ACTION.FINAL_APPROVE,

  manualcancel: SUMMER_ADMIN_ACTION.MANUAL_CANCEL,
  manual_cancel: SUMMER_ADMIN_ACTION.MANUAL_CANCEL,
  cancel: SUMMER_ADMIN_ACTION.MANUAL_CANCEL,
  الغاءيدوي: SUMMER_ADMIN_ACTION.MANUAL_CANCEL,
  الغاء: SUMMER_ADMIN_ACTION.MANUAL_CANCEL,

  rejectrequest: SUMMER_ADMIN_ACTION.REJECT_REQUEST,
  reject_request: SUMMER_ADMIN_ACTION.REJECT_REQUEST,
  reject: SUMMER_ADMIN_ACTION.REJECT_REQUEST,
  rejection: SUMMER_ADMIN_ACTION.REJECT_REQUEST,
  رفض: SUMMER_ADMIN_ACTION.REJECT_REQUEST,

  comment: SUMMER_ADMIN_ACTION.COMMENT,
  reply: SUMMER_ADMIN_ACTION.COMMENT,
  note: SUMMER_ADMIN_ACTION.COMMENT,
  admin_note: SUMMER_ADMIN_ACTION.COMMENT,
  administrative_note: SUMMER_ADMIN_ACTION.COMMENT,
  تعليق: SUMMER_ADMIN_ACTION.COMMENT,
  رد: SUMMER_ADMIN_ACTION.COMMENT,
  ملاحظة: SUMMER_ADMIN_ACTION.COMMENT,
  ملاحظه: SUMMER_ADMIN_ACTION.COMMENT,
  ملاحظةادارية: SUMMER_ADMIN_ACTION.COMMENT,

  internaladminaction: SUMMER_ADMIN_ACTION.INTERNAL_ADMIN_ACTION,
  internal_admin_action: SUMMER_ADMIN_ACTION.INTERNAL_ADMIN_ACTION,
  internalaction: SUMMER_ADMIN_ACTION.INTERNAL_ADMIN_ACTION,
  internal_action: SUMMER_ADMIN_ACTION.INTERNAL_ADMIN_ACTION,
  اجراءاداريداخلي: SUMMER_ADMIN_ACTION.INTERNAL_ADMIN_ACTION,
  اجراءاداريداخلى: SUMMER_ADMIN_ACTION.INTERNAL_ADMIN_ACTION,
  اجراءداخلي: SUMMER_ADMIN_ACTION.INTERNAL_ADMIN_ACTION,

  markunpaid: SUMMER_ADMIN_ACTION.MARK_UNPAID,
  mark_unpaid: SUMMER_ADMIN_ACTION.MARK_UNPAID,
  setunpaid: SUMMER_ADMIN_ACTION.MARK_UNPAID,
  set_unpaid: SUMMER_ADMIN_ACTION.MARK_UNPAID,
  markasunpaid: SUMMER_ADMIN_ACTION.MARK_UNPAID,
  غيرمسدد: SUMMER_ADMIN_ACTION.MARK_UNPAID,
  تحويلاليغيرمسدد: SUMMER_ADMIN_ACTION.MARK_UNPAID,
  تحويلالىغيرمسدد: SUMMER_ADMIN_ACTION.MARK_UNPAID,
  تحويلإلىغيرمسدد: SUMMER_ADMIN_ACTION.MARK_UNPAID
};

function normalizeSearchToken(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/[\s\-]+/g, '')
    .replace(/[^a-z0-9_؀-ۿ]/g, '');
}

export function normalizeSummerAdminActionCode(actionCode: unknown): SummerAdminActionCode | '' {
  const normalized = normalizeSearchToken(actionCode);
  return SUMMER_ADMIN_ACTION_ALIAS_MAP[normalized] ?? '';
}
