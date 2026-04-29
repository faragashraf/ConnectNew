export type SummerRequestStatusCode =
  | 'NEW'
  | 'IN_PROGRESS'
  | 'REPLIED'
  | 'REJECTED'
  | 'PENDING_REVIEW_REQUIRED'
  | 'PENDING_REVIEW_RESOLVED'
  | 'TRANSFER_REVIEW_REQUIRED'
  | 'TRANSFER_REVIEW_RESOLVED'
  | 'UNKNOWN';

export type SummerPaymentStatusCode =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'PAID_ADMIN'
  | 'PARTIAL_PAID'
  | 'CANCELLED_AUTO'
  | 'CANCELLED_ADMIN'
  | 'CANCELLED_USER'
  | 'CANCELLED'
  | 'OVERDUE'
  | 'UNKNOWN';

export type SummerAdminActionCode =
  | 'FINAL_APPROVE'
  | 'REJECT_REQUEST'
  | 'MANUAL_CANCEL'
  | 'COMMENT'
  | 'INTERNAL_ADMIN_ACTION'
  | 'MARK_UNPAID'
  | 'MARK_PAID_ADMIN'
  | 'APPROVE_TRANSFER';

export interface SummerApplicant {
  employeeId: string;
  fullName: string;
  nationalId: string;
  phone: string;
  extraPhone: string;
}

export interface SummerCompanion {
  index: number;
  fullName: string;
  relation: string;
  relationOther?: string;
  nationalId: string;
  age?: number | null;
}

export interface SummerPayment {
  dueAtUtc?: string;
  paidAtUtc?: string;
  statusCode: SummerPaymentStatusCode;
}

export interface SummerTransfer {
  used: boolean;
  count: number;
  fromCategoryId?: number | null;
  fromWaveCode?: string;
  toCategoryId?: number | null;
  toWaveCode?: string;
  requiresReview: boolean;
  requiresRePayment: boolean;
}

export interface SummerRequest {
  messageId: number;
  requestRef: string;
  categoryId: number;
  categoryName: string;
  waveCode: string;
  waveLabel?: string;
  seasonYear: number;
  statusCode: SummerRequestStatusCode;
  statusLabel: string;
  workflowStateCode?: string;
  workflowStateLabel?: string;
  applicant: SummerApplicant;
  payment: SummerPayment;
  transfer: SummerTransfer;
}

export interface SummerRequestDetails extends SummerRequest {
  owner: SummerApplicant;
  companions: SummerCompanion[];
  notes?: string;
  attachments: Array<{ id: number; name: string; size?: number }>;
  updates: Array<{ id: number; author: string; message: string; created?: string }>;
}
