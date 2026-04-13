export const SUMMER_ADMIN_ACTION = {
  FINAL_APPROVE: 'FINAL_APPROVE',
  MANUAL_CANCEL: 'MANUAL_CANCEL',
  COMMENT: 'COMMENT',
  INTERNAL_ADMIN_ACTION: 'INTERNAL_ADMIN_ACTION'
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
  reject: SUMMER_ADMIN_ACTION.MANUAL_CANCEL,
  rejection: SUMMER_ADMIN_ACTION.MANUAL_CANCEL,
  الغاءيدوي: SUMMER_ADMIN_ACTION.MANUAL_CANCEL,
  الغاء: SUMMER_ADMIN_ACTION.MANUAL_CANCEL,
  رفض: SUMMER_ADMIN_ACTION.MANUAL_CANCEL,

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
  اجراءداخلي: SUMMER_ADMIN_ACTION.INTERNAL_ADMIN_ACTION
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
