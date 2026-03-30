import { isAdminActionAllowedForCurrentStatus, resolveBlockedActionForCurrentStatus } from './summer-admin-action-state-guard';

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

  it('blocks transfer approval when current state is rejected/cancelled', () => {
    expect(isAdminActionAllowedForCurrentStatus('APPROVE_TRANSFER', 'Rejected')).toBeFalse();
    expect(isAdminActionAllowedForCurrentStatus('APPROVE_TRANSFER', 'مرفوض')).toBeFalse();
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
    expect(isAdminActionAllowedForCurrentStatus('APPROVE_TRANSFER', 'تم')).toBeFalse();
    expect(isAdminActionAllowedForCurrentStatus('COMMENT', 'Printed')).toBeTrue();
    expect(resolveBlockedActionForCurrentStatus('تم')).toBe('FINAL_APPROVE');
  });
});
