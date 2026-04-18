import { FormBuilder } from '@angular/forms';
import { of } from 'rxjs';
import { SummerRequestsAdminConsoleComponent } from './summer-requests-admin-console.component';

describe('SummerRequestsAdminConsoleComponent - ConnectSupperAdminFunc', () => {
  function createComponent(hasSummerPricingPermission: boolean): {
    component: SummerRequestsAdminConsoleComponent;
    getPricingCatalogSpy: jasmine.Spy;
    savePricingCatalogSpy: jasmine.Spy;
    checkAuthFunSpy: jasmine.Spy;
    checkAuthRoleSpy: jasmine.Spy;
  } {
    const getPricingCatalogSpy = jasmine.createSpy('getPricingCatalog').and.returnValue(of({
      isSuccess: true,
      data: { seasonYear: 2026, records: [] },
      errors: []
    }));
    const savePricingCatalogSpy = jasmine.createSpy('savePricingCatalog').and.returnValue(of({
      isSuccess: true,
      data: { seasonYear: 2026, records: [] },
      errors: []
    }));
    const checkAuthFunSpy = jasmine.createSpy('checkAuthFun').and.returnValue(hasSummerPricingPermission);
    const checkAuthRoleSpy = jasmine.createSpy('checkAuthRole').and.returnValue(hasSummerPricingPermission);

    const component = new SummerRequestsAdminConsoleComponent(
      new FormBuilder(),
      {
        getPricingCatalog: getPricingCatalogSpy,
        savePricingCatalog: savePricingCatalogSpy
      } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {
        checkAuthFun: checkAuthFunSpy,
        checkAuthRole: checkAuthRoleSpy,
        authObject$: of(null)
      } as any,
      {
        msgSuccess: jasmine.createSpy('msgSuccess'),
        msgError: jasmine.createSpy('msgError')
      } as any,
      {
        show: jasmine.createSpy('show'),
        hide: jasmine.createSpy('hide')
      } as any,
      {} as any,
      {} as any
    );

    return {
      component,
      getPricingCatalogSpy,
      savePricingCatalogSpy,
      checkAuthFunSpy,
      checkAuthRoleSpy
    };
  }

  it('blocks pricing load and save actions when ConnectSupperAdminFunc is missing', () => {
    const { component, getPricingCatalogSpy, savePricingCatalogSpy, checkAuthFunSpy, checkAuthRoleSpy } = createComponent(false);
    component.pricingRecords = [{} as any];

    (component as any).refreshSummerPricingAccess();
    component.loadPricingCatalog();
    component.savePricingCatalog();

    expect(checkAuthFunSpy).toHaveBeenCalledWith('ConnectSupperAdminFunc');
    expect(checkAuthRoleSpy).toHaveBeenCalledWith('2003');
    expect(component.canManageSummerPricing).toBeFalse();
    expect(getPricingCatalogSpy).not.toHaveBeenCalled();
    expect(savePricingCatalogSpy).not.toHaveBeenCalled();
    expect(component.pricingRecords.length).toBe(0);
  });

  it('allows pricing load and save actions when ConnectSupperAdminFunc is granted', () => {
    const { component, getPricingCatalogSpy, savePricingCatalogSpy } = createComponent(true);
    component.pricingRecords = [];

    (component as any).refreshSummerPricingAccess();
    component.loadPricingCatalog();
    component.savePricingCatalog();

    expect(component.canManageSummerPricing).toBeTrue();
    expect(getPricingCatalogSpy).toHaveBeenCalled();
    expect(savePricingCatalogSpy).toHaveBeenCalled();
  });
});
