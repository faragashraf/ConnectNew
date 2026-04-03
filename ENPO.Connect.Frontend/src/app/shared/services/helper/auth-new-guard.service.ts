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
    const requiredRoleId = route.data?.['roleId'];

    if (requiredFunc) {
      const hasPermission = this.hasFunctionPermission(requiredFunc, funcToken);

      if (!hasPermission) {
        this.router.navigate(['/Auth/AccessDenied']);
        return false;
      }
    }

    if (requiredRoleId) {
      const hasRole = this.hasRolePermission(requiredRoleId, token, funcToken);
      if (!hasRole) {
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

  private hasRolePermission(requiredRoleId: string, ...tokens: Array<string | null>): boolean {
    const normalizedRequiredRoleId = `${requiredRoleId ?? ''}`.trim();
    if (!normalizedRequiredRoleId) {
      return false;
    }

    for (const token of tokens) {
      if (!token) {
        continue;
      }

      try {
        const decoded = this.jwtHelper.decodeToken(token);
        if (!decoded) {
          continue;
        }

        const claimKeys = ['RoleId', 'roleId', 'role', 'roles', 'RoleIds', 'roleIds'];
        for (const key of claimKeys) {
          const candidates = this.expandClaimValues(decoded[key]);
          if (candidates.includes(normalizedRequiredRoleId)) {
            return true;
          }
        }
      } catch {
        // Ignore malformed token and continue with the next one.
      }
    }

    return false;
  }

  private expandClaimValues(value: any): string[] {
    if (value === null || value === undefined) {
      return [];
    }

    if (Array.isArray(value)) {
      return value
        .map(item => `${item ?? ''}`.trim())
        .filter(item => item.length > 0);
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return [`${value}`];
    }

    if (typeof value === 'object') {
      const roleId = value?.roleId ?? value?.RoleId;
      return roleId !== undefined && roleId !== null
        ? [`${roleId}`.trim()].filter(item => item.length > 0)
        : [];
    }

    const raw = `${value}`.trim();
    if (!raw) {
      return [];
    }

    if (raw.startsWith('[')) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed
            .map(item => `${item ?? ''}`.trim())
            .filter(item => item.length > 0);
        }
      } catch {
        // Fallback to delimiter parsing.
      }
    }

    return raw
      .split(/[;,|]/g)
      .map(item => item.trim())
      .filter(item => item.length > 0);
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
