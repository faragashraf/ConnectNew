import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { SummerRequestsAdminConsoleComponent } from './summer-requests-admin-console.component';

describe('SummerRequestsAdminConsoleComponent - ConnectSupperAdminFunc', () => {
  function createComponent(hasSummerPricingPermission: boolean): {
    component: SummerRequestsAdminConsoleComponent;
    getPricingCatalogSpy: jasmine.Spy;
    savePricingCatalogSpy: jasmine.Spy;
    executeAdminActionSpy: jasmine.Spy;
    checkAuthFunSpy: jasmine.Spy;
    checkAuthRoleSpy: jasmine.Spy;
    msgErrorSpy: jasmine.Spy;
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
    const executeAdminActionSpy = jasmine.createSpy('executeAdminAction').and.returnValue(of({
      isSuccess: true,
      data: null,
      errors: []
    }));
    const checkAuthFunSpy = jasmine.createSpy('checkAuthFun').and.returnValue(hasSummerPricingPermission);
    const checkAuthRoleSpy = jasmine.createSpy('checkAuthRole').and.returnValue(hasSummerPricingPermission);
    const msgErrorSpy = jasmine.createSpy('msgError');

    const component = new SummerRequestsAdminConsoleComponent(
      new FormBuilder(),
      {
        getPricingCatalog: getPricingCatalogSpy,
        savePricingCatalog: savePricingCatalogSpy,
        executeAdminAction: executeAdminActionSpy
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
        msgError: msgErrorSpy
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
      executeAdminActionSpy,
      checkAuthFunSpy,
      checkAuthRoleSpy,
      msgErrorSpy
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

  it('shows backend ExecuteAdminAction error message instead of generic text on http errors', () => {
    const backendMessage = 'لا توجد سعة متاحة حالياً للوحدة/المصيف لهذا الطلب.';
    const { component, executeAdminActionSpy, msgErrorSpy } = createComponent(true);
    executeAdminActionSpy.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 429,
      error: {
        isSuccess: false,
        errors: [{ code: '429', message: backendMessage }]
      }
    })));

    component.selectedRequestId = 3435;
    component.submitAdminAction();

    expect(executeAdminActionSpy).toHaveBeenCalled();
    expect(msgErrorSpy).toHaveBeenCalledWith('خطأ', `<h5>${backendMessage}</h5>`, true);
  });
});
