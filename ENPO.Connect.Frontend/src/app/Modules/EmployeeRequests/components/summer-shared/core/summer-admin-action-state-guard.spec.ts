import {
  isAdminActionAllowedForCurrentStatus,
  resolveAdminActionDecisionForCurrentStatus,
  resolveBlockedActionForCurrentStatus
} from './summer-admin-action-state-guard';

describe('summer-admin-action-state-guard', () => {
  it('blocks manual cancel when status is already rejected/cancelled', () => {
    expect(isAdminActionAllowedForCurrentStatus('MANUAL_CANCEL', 'Rejected')).toBeFalse();
    expect(isAdminActionAllowedForCurrentStatus('MANUAL_CANCEL', 'مرفوض')).toBeFalse();
    expect(resolveBlockedActionForCurrentStatus('Cancelled')).toBe('MANUAL_CANCEL');
  });

  it('blocks final approve when status is already approved/replied', () => {
    expect(isAdminActionAllowedForCurrentStatus('FINAL_APPROVE', 'Replied')).toBeFalse();
    expect(isAdminActionAllowedForCurrentStatus('FINAL_APPROVE', 'اعتماد نهائي')).toBeFalse();
    expect(resolveBlockedActionForCurrentStatus('approved')).toBe('FINAL_APPROVE');
  });

  it('always allows comment/reply/note style actions regardless of current state', () => {
    expect(isAdminActionAllowedForCurrentStatus('COMMENT', 'Rejected')).toBeTrue();
    expect(isAdminActionAllowedForCurrentStatus('reply', 'Rejected')).toBeTrue();
    expect(isAdminActionAllowedForCurrentStatus('note', 'Replied')).toBeTrue();
  });

  it('always allows internal admin action regardless of current state', () => {
    expect(isAdminActionAllowedForCurrentStatus('INTERNAL_ADMIN_ACTION', 'Rejected')).toBeTrue();
    expect(isAdminActionAllowedForCurrentStatus('INTERNAL_ADMIN_ACTION', 'مرفوض')).toBeTrue();
  });

  it('allows mark-unpaid only for open request states', () => {
    expect(isAdminActionAllowedForCurrentStatus('MARK_UNPAID', 'New')).toBeTrue();
    expect(isAdminActionAllowedForCurrentStatus('MARK_UNPAID', 'InProgress')).toBeTrue();
    expect(isAdminActionAllowedForCurrentStatus('MARK_UNPAID', 'Replied')).toBeTrue();
    expect(isAdminActionAllowedForCurrentStatus('MARK_UNPAID', 'Rejected')).toBeFalse();
    expect(isAdminActionAllowedForCurrentStatus('MARK_UNPAID', 'Printed')).toBeFalse();
  });

  it('treats mark-unpaid as allowed non-state-changing action in open states', () => {
    const decision = resolveAdminActionDecisionForCurrentStatus('MARK_UNPAID', 'InProgress');
    expect(decision.isAllowed).toBeTrue();
    expect(decision.changesState).toBeFalse();
    expect(decision.targetState).toBeNull();
  });

  it('matches the state-flow rule: pending -> approved -> rejected -> approved, then approving again is blocked', () => {
    expect(isAdminActionAllowedForCurrentStatus('FINAL_APPROVE', 'New')).toBeTrue();
    expect(isAdminActionAllowedForCurrentStatus('MANUAL_CANCEL', 'Replied')).toBeTrue();
    expect(isAdminActionAllowedForCurrentStatus('FINAL_APPROVE', 'Rejected')).toBeTrue();
    expect(isAdminActionAllowedForCurrentStatus('FINAL_APPROVE', 'Replied')).toBeFalse();
  });

  it('treats completed/printed states as terminal for state-changing admin actions', () => {
    expect(isAdminActionAllowedForCurrentStatus('FINAL_APPROVE', 'Printed')).toBeFalse();
    expect(isAdminActionAllowedForCurrentStatus('MANUAL_CANCEL', 'Completed')).toBeFalse();
    expect(isAdminActionAllowedForCurrentStatus('COMMENT', 'Printed')).toBeTrue();
    expect(isAdminActionAllowedForCurrentStatus('INTERNAL_ADMIN_ACTION', 'Printed')).toBeTrue();
    expect(resolveBlockedActionForCurrentStatus('تم')).toBe('FINAL_APPROVE');
  });
});
