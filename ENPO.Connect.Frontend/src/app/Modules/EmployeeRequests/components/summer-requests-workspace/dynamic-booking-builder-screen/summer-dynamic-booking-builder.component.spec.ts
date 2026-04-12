import { FormBuilder } from '@angular/forms';
import { of } from 'rxjs';
import { SummerDynamicBookingBuilderComponent } from './summer-dynamic-booking-builder.component';

describe('SummerDynamicBookingBuilderComponent - Frozen Units Permission', () => {
  function createComponent(options?: {
    hasSummerAdminPermission?: boolean;
    hasSummerGeneralManagerPermission?: boolean;
  }): {
    component: SummerDynamicBookingBuilderComponent;
    checkAuthFunSpy: jasmine.Spy;
  } {
    const hasSummerAdminPermission = options?.hasSummerAdminPermission ?? false;
    const hasSummerGeneralManagerPermission = options?.hasSummerGeneralManagerPermission ?? false;
    const checkAuthFunSpy = jasmine.createSpy('checkAuthFun').and.callFake((func: string) => {
      if (func === 'SummerGeneralManagerFunc') {
        return hasSummerGeneralManagerPermission;
      }

      if (func === 'SummerAdminFunc') {
        return hasSummerAdminPermission;
      }

      return false;
    });

    const component = new SummerDynamicBookingBuilderComponent(
      new FormBuilder(),
      {
        dynamicGroups: [],
        cdmendDto: [],
        cdCategoryMandDto: [],
        validationMessages: [],
        getFormArray: () => null
      } as any,
      {} as any,
      {} as any,
      {
        getAll: () => of([])
      } as any,
      {
        checkAuthFun: checkAuthFunSpy,
        authObject$: of(null),
        returnCurrentUser: () => 'summer-user',
        getUserProfile: () => ({})
      } as any,
      {} as any,
      {} as any,
      {
        capacityUpdates$: of()
      } as any,
      {
        createFormConfig: () => ({}),
        aliases: {
          proxyMode: ['SUM2026_ProxyMode', 'SummerProxyMode'],
          membershipType: ['SUM2026_MembershipType', 'SummerMembershipType']
        }
      } as any
    );

    return { component, checkAuthFunSpy };
  }

  it('enables membership and frozen-units mode when SummerGeneralManagerFunc is granted', () => {
    const { component, checkAuthFunSpy } = createComponent({
      hasSummerAdminPermission: false,
      hasSummerGeneralManagerPermission: true
    });

    (component as any).refreshProxyModeAccess();

    expect(checkAuthFunSpy).toHaveBeenCalledWith('SummerAdminFunc');
    expect(checkAuthFunSpy).toHaveBeenCalledWith('SummerGeneralManagerFunc');
    expect(component.canUseProxyRegistration).toBeFalse();
    expect(component.canSelectMembershipType).toBeTrue();
    expect(component.canUseFrozenUnitsInCurrentFlow).toBeTrue();
  });

  it('disables frozen-units mode and resets include flag when SummerGeneralManagerFunc is missing', () => {
    const { component } = createComponent({
      hasSummerAdminPermission: true,
      hasSummerGeneralManagerPermission: false
    });
    component.includeFrozenUnitsInBooking = true;

    (component as any).refreshProxyModeAccess();

    expect(component.canUseProxyRegistration).toBeTrue();
    expect(component.canSelectMembershipType).toBeFalse();
    expect(component.canUseFrozenUnitsInCurrentFlow).toBeFalse();
    expect(component.includeFrozenUnitsInBooking).toBeFalse();
  });

  it('forces worker membership for non-general-manager submission', () => {
    const { component } = createComponent({
      hasSummerAdminPermission: true,
      hasSummerGeneralManagerPermission: false
    });
    (component as any).refreshProxyModeAccess();
    component.membershipTypeValue = 'NON_WORKER_MEMBER';

    const resolved = (component as any).resolveMembershipTypeForSubmission();

    expect(resolved).toBe('WORKER_MEMBER');
  });

  it('allows non-worker membership for general-manager submission', () => {
    const { component } = createComponent({
      hasSummerAdminPermission: false,
      hasSummerGeneralManagerPermission: true
    });
    (component as any).refreshProxyModeAccess();
    component.membershipTypeValue = 'NON_WORKER_MEMBER';

    const resolved = (component as any).resolveMembershipTypeForSubmission();

    expect(resolved).toBe('NON_WORKER_MEMBER');
  });

  it('hides membership field and proxy field for non-admin metadata rendering', () => {
    const { component } = createComponent({
      hasSummerAdminPermission: false,
      hasSummerGeneralManagerPermission: false
    });
    (component as any).refreshProxyModeAccess();

    const filtered = (component as any).filterRestrictedFields([
      { mendField: 'SUM2026_MembershipType' },
      { mendField: 'SUM2026_ProxyMode' },
      { mendField: 'Description' }
    ]);

    const keys = filtered.map((item: { mendField?: string }) => String(item?.mendField ?? ''));
    expect(keys).not.toContain('SUM2026_MembershipType');
    expect(keys).not.toContain('SUM2026_ProxyMode');
    expect(keys).toContain('Description');
  });

  it('keeps proxy field for admin metadata rendering while membership stays custom-controlled', () => {
    const { component } = createComponent({
      hasSummerAdminPermission: true,
      hasSummerGeneralManagerPermission: false
    });
    (component as any).refreshProxyModeAccess();

    const filtered = (component as any).filterRestrictedFields([
      { mendField: 'SUM2026_MembershipType' },
      { mendField: 'SUM2026_ProxyMode' },
      { mendField: 'Description' }
    ]);

    const keys = filtered.map((item: { mendField?: string }) => String(item?.mendField ?? ''));
    expect(keys).not.toContain('SUM2026_MembershipType');
    expect(keys).toContain('SUM2026_ProxyMode');
    expect(keys).toContain('Description');
  });
});
