import { FormBuilder } from '@angular/forms';
import { of } from 'rxjs';
import { SummerDynamicBookingBuilderComponent } from './summer-dynamic-booking-builder.component';

describe('SummerDynamicBookingBuilderComponent - Frozen Units Permission', () => {
  function createComponent(hasSummerAdminPermission: boolean): {
    component: SummerDynamicBookingBuilderComponent;
    checkAuthFunSpy: jasmine.Spy;
  } {
    const checkAuthFunSpy = jasmine.createSpy('checkAuthFun').and.returnValue(hasSummerAdminPermission);

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
          proxyMode: []
        }
      } as any
    );

    return { component, checkAuthFunSpy };
  }

  it('enables frozen-units mode when SummerAdminFunc is granted', () => {
    const { component, checkAuthFunSpy } = createComponent(true);

    (component as any).refreshProxyModeAccess();

    expect(checkAuthFunSpy).toHaveBeenCalledWith('SummerAdminFunc');
    expect(component.canUseProxyRegistration).toBeTrue();
    expect(component.canUseFrozenUnitsInCurrentFlow).toBeTrue();
  });

  it('disables frozen-units mode and resets include flag when SummerAdminFunc is missing', () => {
    const { component } = createComponent(false);
    component.includeFrozenUnitsInBooking = true;

    (component as any).refreshProxyModeAccess();

    expect(component.canUseProxyRegistration).toBeFalse();
    expect(component.canUseFrozenUnitsInCurrentFlow).toBeFalse();
    expect(component.includeFrozenUnitsInBooking).toBeFalse();
  });
});
