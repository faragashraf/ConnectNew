import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, UrlTree } from '@angular/router';
import { AdminControlCenterFacade } from '../facades/admin-control-center.facade';

@Injectable()
export class AdminControlCenterStepGuard implements CanActivate {
  constructor(
    private readonly facade: AdminControlCenterFacade,
    private readonly router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot): boolean | UrlTree {
    const paramStepKey = route.paramMap.get('stepKey');
    const requestedStepKey = paramStepKey ?? route.routeConfig?.path ?? null;
    this.facade.initialize(requestedStepKey);

    const transition = this.facade.evaluateStepTransition(requestedStepKey);
    if (transition.allowed) {
      this.facade.setActiveStepByKey(transition.resolvedStepKey);
      return true;
    }

    return this.router.createUrlTree(['/Admin/ControlCenter', transition.resolvedStepKey]);
  }
}
