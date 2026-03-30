import { normalizeSummerAdminActionCode, SUMMER_ADMIN_ACTION, SummerAdminActionCode } from './summer-action-codes';

function normalizeSearchToken(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/[\s\-]+/g, '')
    .replace(/[^a-z0-9_؀-ۿ]/g, '');
}

export function resolveBlockedActionForCurrentStatus(status: unknown): SummerAdminActionCode | '' {
  const token = normalizeSearchToken(status);

  if (
    token === 'replied'
    || token === 'approved'
    || token === 'finalapprove'
    || token === 'تمالرد'
    || token === 'اعتمادنهائي'
    || token === 'معتمد'
  ) {
    return SUMMER_ADMIN_ACTION.FINAL_APPROVE;
  }

  if (
    token === 'rejected'
    || token === 'cancelled'
    || token === 'manualcancel'
    || token === 'manual_cancel'
    || token === 'مرفوض'
    || token === 'ملغي'
    || token === 'الغاءيدوي'
  ) {
    return SUMMER_ADMIN_ACTION.MANUAL_CANCEL;
  }

  return '';
}

export function isAdminActionAllowedForCurrentStatus(actionCode: unknown, status: unknown): boolean {
  const normalizedAction = normalizeSummerAdminActionCode(actionCode);
  if (!normalizedAction) {
    return true;
  }

  if (normalizedAction === SUMMER_ADMIN_ACTION.COMMENT) {
    return true;
  }

  const blockedAction = resolveBlockedActionForCurrentStatus(status);
  return blockedAction !== normalizedAction;
}
