import { normalizeSummerAdminActionCode, SUMMER_ADMIN_ACTION, SummerAdminActionCode } from './summer-action-codes';

export const SUMMER_ADMIN_ACTION_STATE_MESSAGES = {
  duplicateState: 'لا يمكن تنفيذ نفس الإجراء مرة أخرى لأن الطلب بالفعل في هذه الحالة.',
  invalidCurrentState: 'لا يمكن تنفيذ هذا الإجراء لأن حالة الطلب الحالية لا تسمح بذلك.'
} as const;

type CanonicalRequestState = 'NEW' | 'IN_PROGRESS' | 'REPLIED' | 'REJECTED' | 'COMPLETED' | 'UNKNOWN';

export interface SummerAdminActionStateDecision {
  actionCode: SummerAdminActionCode | '';
  isAllowed: boolean;
  changesState: boolean;
  targetState: CanonicalRequestState | null;
  isCommentLikeAction: boolean;
  errorMessage: string;
}

function normalizeSearchToken(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/[\s\-]+/g, '')
    .replace(/[^a-z0-9_؀-ۿ]/g, '');
}

function resolveCanonicalRequestState(status: unknown): CanonicalRequestState {
  const token = normalizeSearchToken(status);
  if (
    token === 'new'
    || token === 'جديد'
  ) {
    return 'NEW';
  }

  if (
    token === 'inprogress'
    || token === 'in_progress'
    || token === 'جاريالتنفيذ'
  ) {
    return 'IN_PROGRESS';
  }

  if (
    token === 'replied'
    || token === 'approved'
    || token === 'finalapprove'
    || token === 'تمالرد'
    || token === 'اعتمادنهائي'
    || token === 'معتمد'
  ) {
    return 'REPLIED';
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
    return 'REJECTED';
  }

  if (
    token === 'printed'
    || token === 'completed'
    || token === 'تم'
  ) {
    return 'COMPLETED';
  }

  return 'UNKNOWN';
}

function isActionAllowedByState(actionCode: SummerAdminActionCode, currentState: CanonicalRequestState): boolean {
  if (currentState === 'UNKNOWN') {
    return true;
  }

  if (currentState === 'COMPLETED') {
    return actionCode === SUMMER_ADMIN_ACTION.COMMENT
      || actionCode === SUMMER_ADMIN_ACTION.INTERNAL_ADMIN_ACTION;
  }

  return true;
}

function resolveDeterministicTargetState(actionCode: SummerAdminActionCode): CanonicalRequestState | null {
  if (actionCode === SUMMER_ADMIN_ACTION.FINAL_APPROVE) {
    return 'REPLIED';
  }
  if (actionCode === SUMMER_ADMIN_ACTION.MANUAL_CANCEL) {
    return 'REJECTED';
  }
  return null;
}

export function resolveAdminActionDecisionForCurrentStatus(
  actionCode: unknown,
  status: unknown
): SummerAdminActionStateDecision {
  const normalizedAction = normalizeSummerAdminActionCode(actionCode);
  if (!normalizedAction) {
    return {
      actionCode: '',
      isAllowed: true,
      changesState: false,
      targetState: null,
      isCommentLikeAction: false,
      errorMessage: ''
    };
  }

  if (
    normalizedAction === SUMMER_ADMIN_ACTION.COMMENT
    || normalizedAction === SUMMER_ADMIN_ACTION.INTERNAL_ADMIN_ACTION
  ) {
    return {
      actionCode: normalizedAction,
      isAllowed: true,
      changesState: false,
      targetState: null,
      isCommentLikeAction: true,
      errorMessage: ''
    };
  }

  const currentState = resolveCanonicalRequestState(status);
  if (!isActionAllowedByState(normalizedAction, currentState)) {
    return {
      actionCode: normalizedAction,
      isAllowed: false,
      changesState: false,
      targetState: null,
      isCommentLikeAction: false,
      errorMessage: SUMMER_ADMIN_ACTION_STATE_MESSAGES.invalidCurrentState
    };
  }

  const targetState = resolveDeterministicTargetState(normalizedAction);
  if (targetState && currentState === targetState) {
    return {
      actionCode: normalizedAction,
      isAllowed: false,
      changesState: false,
      targetState,
      isCommentLikeAction: false,
      errorMessage: SUMMER_ADMIN_ACTION_STATE_MESSAGES.duplicateState
    };
  }

  return {
    actionCode: normalizedAction,
    isAllowed: true,
    changesState: Boolean(targetState),
    targetState,
    isCommentLikeAction: false,
    errorMessage: ''
  };
}

export function resolveBlockedActionForCurrentStatus(status: unknown): SummerAdminActionCode | '' {
  const currentState = resolveCanonicalRequestState(status);
  if (currentState === 'REPLIED') {
    return SUMMER_ADMIN_ACTION.FINAL_APPROVE;
  }
  if (currentState === 'REJECTED') {
    return SUMMER_ADMIN_ACTION.MANUAL_CANCEL;
  }
  if (currentState === 'COMPLETED') {
    return SUMMER_ADMIN_ACTION.FINAL_APPROVE;
  }
  return '';
}

export function isAdminActionAllowedForCurrentStatus(actionCode: unknown, status: unknown): boolean {
  return resolveAdminActionDecisionForCurrentStatus(actionCode, status).isAllowed;
}
