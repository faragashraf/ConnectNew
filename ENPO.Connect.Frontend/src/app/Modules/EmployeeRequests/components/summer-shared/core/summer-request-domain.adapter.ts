import { MessageDto } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.dto';
import { SummerRequestSummaryDto } from 'src/app/shared/services/BackendServices/SummerWorkflow/SummerWorkflow.dto';
import { buildSummerRequestCompanions, getFieldValueByKeys } from '../../summer-requests-workspace/summer-requests-workspace.utils';
import {
  SummerApplicant,
  SummerPayment,
  SummerPaymentStatusCode,
  SummerRequest,
  SummerRequestDetails,
  SummerRequestStatusCode,
  SummerTransfer
} from './summer-request-domain.models';
import { SUMMER_CANONICAL_FIELD_KEYS } from './summer-field-aliases';

function normalizeRequestStatusCode(raw: string): SummerRequestStatusCode {
  const token = String(raw ?? '').trim().toUpperCase();
  const allowed: SummerRequestStatusCode[] = [
    'NEW',
    'IN_PROGRESS',
    'REPLIED',
    'REJECTED',
    'TRANSFER_REVIEW_REQUIRED',
    'TRANSFER_REVIEW_RESOLVED',
    'UNKNOWN'
  ];
  return allowed.includes(token as SummerRequestStatusCode) ? token as SummerRequestStatusCode : 'UNKNOWN';
}

function normalizePaymentStatusCode(raw: string): SummerPaymentStatusCode {
  const token = String(raw ?? '').trim().toUpperCase();
  const allowed: SummerPaymentStatusCode[] = [
    'PENDING_PAYMENT',
    'PAID',
    'CANCELLED_AUTO',
    'CANCELLED_ADMIN',
    'CANCELLED_USER',
    'CANCELLED',
    'OVERDUE',
    'UNKNOWN'
  ];
  return allowed.includes(token as SummerPaymentStatusCode) ? token as SummerPaymentStatusCode : 'UNKNOWN';
}

function mapApplicantFromSummary(summary: SummerRequestSummaryDto): SummerApplicant {
  return {
    employeeId: String(summary?.employeeId ?? '').trim(),
    fullName: String(summary?.employeeName ?? '').trim(),
    nationalId: String(summary?.employeeNationalId ?? '').trim(),
    phone: String(summary?.employeePhone ?? '').trim(),
    extraPhone: String(summary?.employeeExtraPhone ?? '').trim()
  };
}

function mapPaymentFromFields(details: MessageDto | null, summary: SummerRequestSummaryDto): SummerPayment {
  const fields = details?.fields ?? [];
  const paymentStatusRaw = getFieldValueByKeys(fields, ['Summer_PaymentStatus']);
  return {
    dueAtUtc: String(summary?.paymentDueAtUtc ?? '').trim() || undefined,
    paidAtUtc: String(summary?.paidAtUtc ?? '').trim() || undefined,
    statusCode: normalizePaymentStatusCode(paymentStatusRaw)
  };
}

function mapTransferFromFields(details: MessageDto | null, summary: SummerRequestSummaryDto): SummerTransfer {
  const fields = details?.fields ?? [];
  const transferCount = Number(getFieldValueByKeys(fields, ['Summer_TransferCount']) || 0) || 0;
  const requiresReview = String(summary?.workflowStateCode ?? '').trim().toUpperCase() === 'TRANSFER_REVIEW_REQUIRED';
  const requiresRePayment = ['1', 'true', 'yes', 'نعم'].includes(
    String(getFieldValueByKeys(fields, ['Summer_TransferRequiresRePayment']) ?? '').trim().toLowerCase()
  );

  return {
    used: Boolean(summary?.transferUsed),
    count: transferCount,
    fromCategoryId: Number(getFieldValueByKeys(fields, ['Summer_TransferFromCategory'])) || undefined,
    fromWaveCode: String(getFieldValueByKeys(fields, ['Summer_TransferFromWave']) ?? '').trim() || undefined,
    toCategoryId: Number(getFieldValueByKeys(fields, ['Summer_TransferToCategory'])) || undefined,
    toWaveCode: String(getFieldValueByKeys(fields, ['Summer_TransferToWave']) ?? '').trim() || undefined,
    requiresReview,
    requiresRePayment
  };
}

export function mapSummaryToSummerRequest(summary: SummerRequestSummaryDto, seasonYear: number): SummerRequest {
  return {
    messageId: Number(summary?.messageId ?? 0) || 0,
    requestRef: String(summary?.requestRef ?? '').trim(),
    categoryId: Number(summary?.categoryId ?? 0) || 0,
    categoryName: String(summary?.categoryName ?? '').trim(),
    waveCode: String(summary?.waveCode ?? '').trim(),
    seasonYear,
    statusCode: normalizeRequestStatusCode(String(summary?.status ?? '')),
    statusLabel: String(summary?.statusLabel ?? '').trim(),
    workflowStateCode: String(summary?.workflowStateCode ?? '').trim(),
    workflowStateLabel: String(summary?.workflowStateLabel ?? '').trim(),
    applicant: mapApplicantFromSummary(summary),
    payment: {
      dueAtUtc: String(summary?.paymentDueAtUtc ?? '').trim() || undefined,
      paidAtUtc: String(summary?.paidAtUtc ?? '').trim() || undefined,
      statusCode: 'UNKNOWN'
    },
    transfer: {
      used: Boolean(summary?.transferUsed),
      count: 0,
      requiresReview: Boolean(summary?.needsTransferReview),
      requiresRePayment: false
    }
  };
}

export function mapDetailsToSummerRequest(
  summary: SummerRequestSummaryDto,
  details: MessageDto | null,
  seasonYear: number
): SummerRequestDetails {
  const fields = details?.fields ?? [];
  const base = mapSummaryToSummerRequest(summary, seasonYear);
  const companions = buildSummerRequestCompanions(fields).map(item => ({
    index: item.index,
    fullName: item.name,
    relation: item.relation,
    relationOther: String(getFieldValueByKeys(fields, [...SUMMER_CANONICAL_FIELD_KEYS.companionRelationOther]) ?? '').trim() || undefined,
    nationalId: item.nationalId,
    age: item.age ? Number(item.age) || null : null
  }));

  const attachments = (details?.attachments ?? []).map(item => ({
    id: Number((item as { id?: unknown; attchId?: unknown })?.id ?? (item as { id?: unknown; attchId?: unknown })?.attchId ?? 0) || 0,
    name: String((item as { attchNm?: unknown })?.attchNm ?? '').trim(),
    size: Number((item as { attchSize?: unknown })?.attchSize ?? 0) || 0
  })).filter(item => item.id > 0 || item.name.length > 0);

  const updates = (details?.replies ?? []).map(reply => ({
    id: Number(reply?.replyId ?? 0) || 0,
    author: String(reply?.authorName ?? reply?.authorId ?? '').trim(),
    message: String(reply?.message ?? '').trim(),
    created: String(reply?.createdDate ?? '').trim() || undefined
  }));

  return {
    ...base,
    waveLabel: String(getFieldValueByKeys(fields, [...SUMMER_CANONICAL_FIELD_KEYS.waveLabel]) ?? '').trim() || undefined,
    owner: mapApplicantFromSummary(summary),
    companions,
    notes: String(getFieldValueByKeys(fields, [...SUMMER_CANONICAL_FIELD_KEYS.notes]) ?? '').trim() || undefined,
    attachments,
    updates,
    payment: mapPaymentFromFields(details, summary),
    transfer: mapTransferFromFields(details, summary)
  };
}
