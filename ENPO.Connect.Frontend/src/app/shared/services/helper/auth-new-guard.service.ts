import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { JwtHelperService } from '@auth0/angular-jwt';
import { MsgsService } from './msgs.service';
import { AuthObjectsService } from './auth-objects.service';

@Injectable({
  providedIn: 'root'
})
export class AuthNewGuardService {

  constructor(
    private router: Router,
    private jwtHelper: JwtHelperService,
    private msgsService: MsgsService,
    private authService: AuthObjectsService
  ) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {

    const token = localStorage.getItem('ConnectToken');
    const funcToken = localStorage.getItem('ConnectFunctions');
    const currentUrl = state.url;

    // 🔹 Prevent redirect loop
    if (currentUrl.includes('/Auth/Login')) {
      return true;
    }

    // 🔹 1. Check Authentication
    if (!token || !funcToken) {
      this.msgsService.msgInfo(
        "برجاء تسجيل الدخول أولاً",
        "رسالة معلومات",
        'warn'
      );
      this.redirectToLogin(currentUrl);
      return false;
    }

    // 🔹 2. Authorization (Generic func check)
    const requiredFunc = route.data?.['func'];

    if (requiredFunc) {
      const hasPermission = this.hasFunctionPermission(requiredFunc, funcToken);

      if (!hasPermission) {
        this.router.navigate(['/Auth/AccessDenied']);
        return false;
      }
    }

    return true;
  }

  // ===============================
  // 🔐 Permission Check
  // ===============================
  private hasFunctionPermission(requiredFunc: string, funcToken: string): boolean {

    try {
      const decoded = this.jwtHelper.decodeToken(funcToken);
      const functions = decoded?.functions;

      if (!functions) return false;

      if (Array.isArray(functions)) {
        return functions.includes(requiredFunc);
      }

      return functions === requiredFunc;

    } catch {
      return false;
    }
  }

  // ===============================
  // 🔁 Redirect Helper
  // ===============================
  private redirectToLogin(returnUrl: string): void {
    this.router.navigate(['/Auth/Login'], {
      queryParams: { returnUrl }
    });
  }
}
