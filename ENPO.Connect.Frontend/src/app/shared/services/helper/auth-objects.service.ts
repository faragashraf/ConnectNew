import { Injectable } from '@angular/core';
import { JwtHelperService } from '@auth0/angular-jwt';
import { MegaMenuItem, MenuItem } from 'primeng/api';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { SwbPrivilege } from 'src/app/Modules/auth/services/Domain_Auth.service';
import { BroadcastService } from './broadcast.service';
import { MsgsService } from './msgs.service';
import { SoundService } from './sound.service';

export interface TreeNode<T = any> {
  label?: string;
  data?: T;
  icon?: string;
  expandedIcon?: any;
  collapsedIcon?: any;
  children?: TreeNode<T>[];
  leaf?: boolean;
  expanded?: boolean;
  type?: string;
  parent?: TreeNode<T>;
  partialSelected?: boolean;
  style?: string;
  styleClass?: string;
  draggable?: boolean;
  droppable?: boolean;
  selectable?: boolean;
  key?: string;
  route?: string
}

export interface UserOtpEnrollmentDto {
  id: number;
  userId: string;
  issuer: string;
  isActive: boolean;
  isEnabled: 'Y' | 'N';
  createdAtUtc: string;
  revokedAtUtc: string | null;
  lastUsedAtUtc: string | null;
}

export interface AuthObject {
  token: string;
  exchangeUserInfo: any;
  privilageCollection: SwbPrivilege[];
  userOtpEnrollmentDto?: UserOtpEnrollmentDto | null;
  vwOrgUnitsWithCounts?: any;
}
@Injectable({
  providedIn: 'root'
})
export class AuthObjectsService {
  authObject$ = new Subject<boolean>();
  isAuthenticated: boolean = false;

  offlineAuthenticatedt$ = new Subject<boolean>();
  isOfflineAuthenticated: boolean = false;

  DomainAuthenticated$ = new Subject<boolean>();
  isDomainAuthenticated: boolean = false;

  // Exposed state for 2FA Protection UI
  public twoFactorProtected$ = new BehaviorSubject<boolean>(false);

  // Ramadan Celebration State
  public isRamadanCelebrationEnabled$ = new BehaviorSubject<boolean>(this.getRamadanPreference());

  private getRamadanPreference(): boolean {
    // Default to true if not set
    return localStorage.getItem('ep_ramadan_enabled') !== '0';
  }

  public setRamadanPreference(enabled: boolean) {
    localStorage.setItem('ep_ramadan_enabled', enabled ? '1' : '0');
    this.isRamadanCelebrationEnabled$.next(enabled);
  }

  LoggedIn!: boolean;
  UserFullName: string = "";

  private pendingToken: string | null = null;

  setPendingToken(token: string) {
    this.pendingToken = token;
  }

  getPendingToken(): string | null {
    return this.pendingToken;
  }

  clearPendingToken() {
    this.pendingToken = null;
  }

  constructor(private jwtHelper: JwtHelperService, private router: Router, private sanitizer: DomSanitizer,
    private broadcastService: BroadcastService, private msgsService: MsgsService, private soundService: SoundService
  ) {
    this.updateTwoFactorStatus();
  }


  userProfileItems: MenuItem[] = [];
  items1: MegaMenuItem[] = [];
  // items1$ = new Subject<MegaMenuItem[]>();
  _static: MegaMenuItem[] = [{
    label: 'الرئيسية', routerLink: '/Home', icon: 'pi pi-fw pi-home', "routerLinkActiveOptions": { "exact": true },
  },
  {
    label: 'المنشورات',
    icon: 'pi pi-bars',
    routerLink: '/Publications/mainLayOut'
  },
  {
    label: 'طلب جديد',
    icon: 'pi pi-pencil',
    routerLink: '/Admin/SummerRequests',
  }
  ]
  currentUser: string = ''
  UserPic!: string
  pic: SafeUrl = '';
  // Fallback profile used when localStorage does not contain AuthObject
  public userProfile: any = {};

  // XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX     Reviewed   XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  returnCurrentUserName(): string {
    //given_name
    const token = localStorage.getItem('ConnectToken') as string;
    if (token != undefined) {
      const currentUserName: string = this.jwtHelper.decodeToken(token).given_name
      if (currentUserName != undefined)
        return currentUserName
      else {
        return '';
      }
    }
    return '';
  }
  returnCurrentUser(): string | '' {
    const token = localStorage.getItem('ConnectToken') as string;
    if (token != undefined) {
      const CurrentUser: string = this.jwtHelper.decodeToken(token).UserId
      if (CurrentUser != undefined)
        return CurrentUser
      else {
        return '';
      }
    }
    return '';
  }

  public setAuthObject(data: AuthObject | string): void {
    try {
      if (typeof data === 'string') {
        localStorage.setItem('AuthObject', data);
      } else {
        localStorage.setItem('AuthObject', JSON.stringify(data));
      }
      this.authObject$.next(true);

      // Update 2FA flag upon new auth object
      this.updateTwoFactorStatus();
    } catch (e) {
      console.error('Error saving AuthObject', e);
    }
  }

  public getAuthObject(): AuthObject | null {
    try {
      const stored = localStorage.getItem('AuthObject');
      if (stored) {
        return JSON.parse(stored) as AuthObject;
      }
    } catch (e) {
      // Return null if parsing fails
      return null;
    }
    return null;
  }

  public updateUserOtpEnrollment(dto: UserOtpEnrollmentDto | null): void {
    this.patchUserOtpEnrollmentDto(dto);
  }

  /**
   * Return a consolidated user profile built from localStorage AuthObject and ConnectToken claims.
   * This mirrors the logic previously living in NavBarComponent.get userProfile.
   */
  public getUserProfile(): any {
    try {
      const rootAuthObj = this.getAuthObject();
      let parsed: any = null;

      if (rootAuthObj) {
        parsed = rootAuthObj.exchangeUserInfo;
      }
      const token = localStorage.getItem('ConnectToken');
      if (token) {
        try {
          const parts = token.split('.');
          if (parts.length >= 2) {
            const payload = parts[1];
            const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
            const json = decodeURIComponent(Array.prototype.map.call(atob(base64), (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
            const claims = JSON.parse(json);

            const givenName = claims.given_name || claims.name || claims.preferred_username || null;
            const emailClaim = claims.email || claims.UserEmail || claims.upn || claims.preferred_username || null;
            const UserIdClaim = claims.UserId;
            const nationalIdClaim = claims.NationalId;

            // New fields requested
            const ApplicationId = claims.ApplicationId;
            const ArabicName = claims.ArabicName;
            const MobileNumber = claims.MobileNumber;
            const Job = claims.Job;
            const PhoneWhats = claims.PhoneWhats;
            const CurrPlace = claims.CurrPlace;
            const ValidatedEmail = claims.ValidatedEmail;
            const ValidatedMobile = claims.ValidatedMobile;
            const Department = claims.Department;

            if (parsed) {
              // prefer token values when present
              if (givenName) parsed.userDisplayName = givenName;
              if (emailClaim) parsed.userEmail = emailClaim;
              if (UserIdClaim) parsed.userId = UserIdClaim;
              if (nationalIdClaim) parsed.nationalId = nationalIdClaim;

              // Assign new fields to parsed object
              if (ApplicationId) parsed.ApplicationId = ApplicationId;
              if (ArabicName) { parsed.ArabicName = ArabicName; parsed.userDisplayName = ArabicName; } // Use ArabicName as display name if available
              if (MobileNumber) parsed.MobileNumber = MobileNumber;
              if (Job) parsed.Job = Job;
              if (PhoneWhats) parsed.PhoneWhats = PhoneWhats;
              if (CurrPlace) parsed.CurrPlace = CurrPlace;
              if (ValidatedEmail) parsed.ValidatedEmail = ValidatedEmail;
              if (ValidatedMobile) parsed.ValidatedMobile = ValidatedMobile;
              if (Department) parsed.Department = Department;

              // attach other token claims under a clear title
              parsed.emailData = claims;
              if (!parsed.userTitle || parsed.userTitle.trim().length === 0) {
                parsed.userTitle = 'بيانات صندوق البريد';
              }
              // Attach vwOrgUnitsWithCounts if available
              if (rootAuthObj?.vwOrgUnitsWithCounts) {
                parsed.vwOrgUnitsWithCounts = rootAuthObj.vwOrgUnitsWithCounts;
              }
              return parsed;
            } else {
              // build a minimal profile from token
              const prof: any = {
                userDisplayName: ArabicName || givenName || this.userProfile.userDisplayName,
                userEmail: emailClaim || this.userProfile.userEmail,
                userTitle: Job || 'بيانات صندوق البريد',
                userPicture: this.userProfile.userPicture,
                registrationStatus: false,
                userId: UserIdClaim || 'N/A',
                passwordExpirationDate: null,
                userGroups: [],
                emailData: claims,

                // New fields
                ApplicationId: ApplicationId,
                ArabicName: ArabicName,
                MobileNumber: MobileNumber,
                Job: Job,
                PhoneWhats: PhoneWhats,
                CurrPlace: CurrPlace,
                ValidatedEmail: ValidatedEmail,
                ValidatedMobile: ValidatedMobile,
                Department: Department
              };
              // Attach vwOrgUnitsWithCounts if available
              if (rootAuthObj?.vwOrgUnitsWithCounts) {
                prof.vwOrgUnitsWithCounts = rootAuthObj.vwOrgUnitsWithCounts;
              }
              return prof;
            }
          }
        } catch (e) {
          // token decode failed, fall back
        }
      }

      if (parsed) {
        if (rootAuthObj?.vwOrgUnitsWithCounts) {
          parsed.vwOrgUnitsWithCounts = rootAuthObj.vwOrgUnitsWithCounts;
        }
        return parsed;
      }
    } catch (e) {
      // ignore
    }
    return this.userProfile;
  }
  public patchUserOtpEnrollmentDto(dto: any | null): void {
    try {
      let root = this.getAuthObject() as any;
      if (!root) {
        root = {};
      }

      // Ensure exchangeUserInfo exists for compatibility with getUserProfile
      if (!root.exchangeUserInfo || typeof root.exchangeUserInfo !== 'object') {
        root.exchangeUserInfo = root.exchangeUserInfo || {};
      }

      // Patch both top-level and exchangeUserInfo
      root.userOtpEnrollmentDto = dto;
      root.exchangeUserInfo.userOtpEnrollmentDto = dto;

      localStorage.setItem('AuthObject', JSON.stringify(root));
      // notify listeners that AuthObject changed
      try { this.authObject$.next(true); } catch (e) { /* ignore */ }

      this.updateTwoFactorStatus();

    } catch (e) {
      // ignore failures to avoid blocking UI
    }
  }

  public setUserOtpEnrollment(dto: UserOtpEnrollmentDto): void {
    this.patchUserOtpEnrollmentDto(dto);
  }

  public clearUserOtpEnrollment(): void {
    this.patchUserOtpEnrollmentDto(null);
  }

  public updateAuthObject(patch: Partial<AuthObject>): void {
    try {
      const current = this.getAuthObject() || {} as AuthObject;
      const updated = { ...current, ...patch };
      this.setAuthObject(updated);
    } catch (e) { console.error('Error updating AuthObject', e); }
  }

  /**
   * Internal helper to recalculate 2FA protection status based on current enrollment
   */
  private updateTwoFactorStatus(): void {
    try {
      const e = this.getUserOtpEnrollmentDtoFromStorage();
      const isEnabled = !!e && e.isActive === true && e.isEnabled === 'Y' && !e.revokedAtUtc;

      if (this.twoFactorProtected$.value !== isEnabled) {
        this.twoFactorProtected$.next(isEnabled);
      }
    } catch (e) {
      if (this.twoFactorProtected$.value !== false) {
        this.twoFactorProtected$.next(false);
      }
    }
  }

  /**
   * Helper getter to read stored userOtpEnrollmentDto from AuthObject in localStorage.
   */
  public getUserOtpEnrollmentDtoFromStorage(): any | null {
    try {
      const root = this.getAuthObject();
      if (!root) return null;
      return root?.exchangeUserInfo?.userOtpEnrollmentDto ?? root?.userOtpEnrollmentDto ?? null;
    } catch (e) {
      return null;
    }
  }
  showUserProfile: boolean = false;
  populateNaBarItems() {
    this.userProfileItems = [
      {
        label: '',
        items: [
          { label: 'الملف الشخصي', icon: 'pi pi-user', iconStyle: { color: '#2563eb' }, command: () => { this.Profie(); } },
          { label: 'طلبات المصايف', icon: 'pi pi-list', iconStyle: { color: '#0ea5a4' }, command: () => { this.router.navigate(['/EmployeeRequests/SummerRequests']); } },
          {
            label: 'تحديث النظام', icon: 'pi pi-refresh', iconStyle: { color: '#f59e0b' }, command: () => {
              this.soundService.performClearCacheAndReload();
            }
          },
          { label: 'تسجيل الخروج', icon: 'pi pi-power-off', iconStyle: { color: '#ef4444' }, command: () => { this.broadcastService.post({ type: 'USER_SIGNOUT', payload: {} }); this.SignOut(); } }
        ]
      },
    ];


    this.items1 = this._static;
    this.UserPic = this.isAuthenticated ? localStorage.getItem('Picture') as string : ''
    if (this.UserPic && this.UserPic.length > 0)
      this.pic = this.sanitizer.bypassSecurityTrustUrl('data:image/jpeg;base64,' + this.UserPic)
    else
      this.pic = ''
    this.currentUser = localStorage.getItem('firstName') as string


    const myObject = this.getAuthObject() as any;

    if (myObject && myObject.privilageCollection) {
      let userSidebar = this.convertPrivilegesToMegaMenu(myObject.privilageCollection);
      this.items1 = [...this._static, ...userSidebar];
    } else {
      this.items1 = this._static;
    }
  }
  Profie() {
    this.showUserProfile = true
  }
  convertPrivilegesToMegaMenu(privileges: SwbPrivilege[]): MegaMenuItem[] {
    // 1. Filter Parents, Menus, and Items
    const parents = privileges.filter(p => p.sbType === 'PARENT');
    const menus = privileges.filter(p => p.sbType === 'MENU');
    const items = privileges.filter(p => p.sbType !== 'PRIV' && p.sbRoute != null);

    // 2. Group Menus by Parent and Items by Menu
    const menusByParentId = new Map<number, SwbPrivilege[]>();
    const itemsByMenuId = new Map<number, SwbPrivilege[]>();

    // Group menus under their parent
    menus.forEach(menu => {
      const parentId = menu.sbSubId;
      if (parentId !== undefined) {
        if (!menusByParentId.has(parentId)) {
          menusByParentId.set(parentId, []);
        }
        menusByParentId.get(parentId)!.push(menu);
      }
    });

    // Group items under their menu
    items.forEach(item => {
      const menuId = item.sbSubId;
      if (menuId !== undefined) {
        if (!itemsByMenuId.has(menuId)) {
          itemsByMenuId.set(menuId, []);
        }
        itemsByMenuId.get(menuId)!.push(item);
      }
    });

    // 3. Build MegaMenu with IDs
    return parents.map(parent => {
      const parentMenus = menusByParentId.get(parent.sbId) || [];
      const menuColumns = this.distributeMenusAcrossColumns(parentMenus, 4, 3);

      const mapMenuToColumn = (menuGroup: SwbPrivilege[]) => {
        return menuGroup.map(menu => {
          // menu-level icon + style (consistent for menus)
          const menuIconMeta = this.GetIconMeta(menu.sbRoute || menu.sbId);
          return {
            label: menu.itemName || 'Unnamed Menu',
            id: `menu-${menu.sbId}`,
            icon: menuIconMeta.icon,
            iconStyle: menuIconMeta.iconStyle,
            items: (itemsByMenuId.get(menu.sbId) || []).map(item => {
              const iconMeta = this.GetIconMeta(item.sbRoute || item.sbId);
              return {
                label: item.itemName || 'Unnamed Item',
                routerLink: item.sbRoute,
                icon: iconMeta.icon,
                iconStyle: iconMeta.iconStyle,
                id: `item-${item.sbId}`,
                routerLinkActiveOptions: { exact: true }
              };
            })
          };
        });
      };

      // parent-level icon (consistent for parents)
      const parentIconMeta = this.GetIconMeta(parent.sbRoute || parent.sbId);
      return {
        label: parent.itemName || 'Unnamed Parent',
        id: `parent-${parent.sbId}`,
        icon: parentIconMeta.icon,
        iconStyle: parentIconMeta.iconStyle,
        items: menuColumns
          .map(columnMenus => mapMenuToColumn(columnMenus))
          .filter(column => column.length > 0),
        routerLinkActiveOptions: { exact: true }
      };
    });
  }

  private distributeMenusAcrossColumns(
    parentMenus: SwbPrivilege[],
    maxColumns: number,
    maxRowsPerColumn: number
  ): SwbPrivilege[][] {
    if (!parentMenus.length) {
      return [];
    }

    const normalizedMaxColumns = Math.max(1, maxColumns);
    const normalizedMaxRows = Math.max(1, maxRowsPerColumn);
    const columns: SwbPrivilege[][] = [[]];
    let columnIndex = 0;

    for (const menu of parentMenus) {
      if (columns[columnIndex].length >= normalizedMaxRows && columnIndex < normalizedMaxColumns - 1) {
        columns.push([]);
        columnIndex += 1;
      }

      columns[columnIndex].push(menu);
    }

    return columns.filter(column => column.length > 0);
  }

  /**
   * Unified icon + style lookup by sbRoute or sbId (fallback to defaults).
   * Returns object: { icon: string, iconStyle: { color: string } }
   */
  GetIconMeta(key: string | number): { icon: string; iconStyle: any } {
    const mapByRoute: { [key: string]: { icon: string; color: string } } = {
      // items
      'AdminCer/AreaRequests': { icon: 'pi pi-fw pi-map', color: '#0ea5a4' },
      'AdminCer/MyInbox': { icon: 'pi pi-fw pi-inbox', color: '#2563eb' },
      'Admin/RegistrationRequests': { icon: 'pi pi-fw pi-user-plus', color: '#10b981' },
      'LandTransport/PrintTrafficLetter': { icon: 'pi pi-fw pi-print', color: '#64748b' },
      'LandTransport/RePrintTrafficLetter': { icon: 'pi pi-fw pi-refresh', color: '#64748b' },
      'LandTransport/LetraReplyUpload': { icon: 'pi pi-fw pi-file-excel', color: '#16a34a' },
      'Admin/GetRoleHierarchy': { icon: 'pi pi-fw pi-sitemap', color: '#7c3aed' },
      'Admin/GetSideBarHierarchy': { icon: 'pi pi-fw pi-bars', color: '#eb1f1f' },
      'ENPOPowerBi/Build': { icon: 'pi pi-fw pi-wrench', color: '#f59e0b' },
      'ENPOPowerBi/MySelectStatements': { icon: 'pi pi-fw pi-database', color: '#0ea5e9' },
      'AdminCer/MyOutbox': { icon: 'pi pi-fw pi-send', color: '#0ea5e9' },
      'Publications/FullPublication': { icon: 'pi pi-fw pi-copy', color: '#6b7280' },
      'Admin/ResetPassword': { icon: 'pi pi-fw pi-key', color: '#f97316' },
      'Admin/DynamicFiledsManager': { icon: 'pi pi-fw pi-sliders-h', color: '#8b5cf6' },
      'Admin/DynamicSubjectTypes': { icon: 'pi pi-fw pi-sitemap', color: '#1d4ed8' },
      'Admin/DynamicSubjectManagement': { icon: 'pi pi-fw pi-sitemap', color: '#1d4ed8' },
      'Admin/ServerMonitorManager': { icon: 'pi pi-fw pi-desktop', color: '#64748b' },
      'TopManagement/AddSubject': { icon: 'pi pi-fw pi-plus-circle', color: '#16a34a' },
      'Admin/ApplicationConfiguration': { icon: 'pi pi-fw pi-cog', color: '#2563eb' },
      'TopManagement/ShowSubjects': { icon: 'pi pi-fw pi-list', color: '#0f71fa' },
      'AdminCer/Global': { icon: 'pi pi-fw pi-globe', color: '#059669' },
      'AdminCer/Chart': { icon: 'pi pi-fw pi-chart-bar', color: '#06b6d4' },
      'Admin/NswagConfiguration': { icon: 'pi pi-fw pi-server', color: '#0f172a' },
      'Admin/ChartConfiguration': { icon: 'pi pi-fw pi-chart-line', color: '#4338ca' },
      'Auth/EncryptDecrypt': { icon: 'pi pi-fw pi-lock', color: '#e11d48' },
      'Docs': { icon: 'pi pi-fw pi-book', color: '#0ea5a4' },
      'TopManagement/Chart': { icon: 'pi pi-fw pi-chart-bar', color: '#06b6d4' },
      'EmployeeRequests/Summer2026Management': { icon: 'pi pi-fw pi-plus-circle', color: '#16a34a' },
      'EmployeeRequests/Chart': { icon: 'pi pi-fw pi-chart-bar', color: '#06b6d4' },
      'Admin/SummerRequests': { icon: 'pi pi-fw pi-plus-circle', color: '#16a34a' }
    };

    const entry = mapByRoute[key as string];
    if (entry) return { icon: entry.icon, iconStyle: { color: entry.color } };

    // Parent/menu defaults (consistent icons)
    const parentDefaults = { icon: 'pi pi-fw pi-folder', iconStyle: { color: '#475569' } };
    const menuDefaults = { icon: 'pi pi-fw pi-list', iconStyle: { color: '#6b7280' } };

    // If no exact mapping, attempt to categorize by id ranges or return menu default
    const id = typeof key === 'string' && !isNaN(Number(key)) ? parseInt(key, 10) : (typeof key === 'number' ? key : null);
    if (id !== null && id >= 1 && id < 1000) {
      // heuristics: treat lower ids as parents/menus
      return parentDefaults;
    }

    return menuDefaults;
  }

  // Old string-based GetIcon/GetIconStyle removed - use `GetIconMeta(sbId)` instead.
  SignOut(skipNavigate: boolean = false) {
    this.authObject$.next(false);
    this.offlineAuthenticatedt$.next(false);
    this.DomainAuthenticated$.next(false);
    this.twoFactorProtected$.next(false);
    const fullUrl = (typeof window !== 'undefined' && window.location && window.location.href) ? window.location.href : this.router.url;
    const currentPath = this.resolveCurrentAppPath();
    const isLoginScreen = this.isLoginPath(currentPath) || fullUrl.toLowerCase().includes('/auth/login');

    if (!skipNavigate && !fullUrl.includes('mainLayOut') && !isLoginScreen) {
      this.router.navigate(['/Auth/Login'], {
        queryParams: { returnUrl: currentPath }
      });
    }
    localStorage.removeItem('ConnectToken');
    localStorage.removeItem('ConnectFunctions');
    localStorage.removeItem('firstName');
    localStorage.removeItem('Picture');
    localStorage.removeItem('Remember');
    localStorage.removeItem('UserId');
    localStorage.removeItem('AuthObject');
    this.currentUser = '';
    this.items1 = this._static;
  }

  private resolveCurrentAppPath(): string {
    const routerPath = String(this.router.url ?? '').trim();
    if (routerPath && routerPath !== '/') {
      return routerPath;
    }

    if (typeof window !== 'undefined' && window.location) {
      const hash = String(window.location.hash ?? '').trim();
      if (hash.startsWith('#/')) {
        return hash.substring(1);
      }
      if (hash.startsWith('#')) {
        return `/${hash.substring(1)}`;
      }
    }

    return '/Home';
  }

  private isLoginPath(path: string): boolean {
    const normalized = String(path ?? '').toLowerCase();
    return normalized.startsWith('/auth/login');
  }

  returnAllFunc(): any[] {
    const allFunc: string[] = this.jwtHelper.decodeToken(localStorage.getItem('ConnectToken') as string).functions
    if (allFunc != undefined)
      return allFunc
    else {
      return [];
    }
  }
  checkAuthFun(fnc: string): boolean {
    const normalizedFunction = `${fnc ?? ''}`.trim();
    if (!normalizedFunction) {
      return false;
    }

    let hasFunctionClaim = false;
    const funcToken = localStorage.getItem('ConnectFunctions');
    if (funcToken) {
      try {
        const decoded: any = this.jwtHelper.decodeToken(funcToken);
        const fncs = decoded?.functions;
        if (Array.isArray(fncs)) {
          hasFunctionClaim = fncs.includes(normalizedFunction);
        } else if (fncs !== null && fncs !== undefined) {
          hasFunctionClaim = `${fncs}` === normalizedFunction;
        }
      } catch {
        hasFunctionClaim = false;
      }
    }

    if (hasFunctionClaim) {
      return true;
    }

    if (normalizedFunction === 'SummerAdminFunc') {
      return this.checkAuthRole('2020') || this.checkAuthRole('2021');
    }

    if (normalizedFunction === 'SummerGeneralManagerFunc') {
      return this.checkAuthRole('2021');
    }

    return false;
  }
  checkAuthRole(roleId: string): boolean {
    const normalizedRequiredRoleId = `${roleId ?? ''}`.trim();
    if (!normalizedRequiredRoleId) {
      return false;
    }

    const tokens = [
      localStorage.getItem('ConnectToken'),
      localStorage.getItem('ConnectFunctions')
    ];

    for (const token of tokens) {
      if (!token) {
        continue;
      }

      try {
        const decoded: any = this.jwtHelper.decodeToken(token);
        if (!decoded) {
          continue;
        }

        const claimKeys = ['RoleId', 'roleId', 'role', 'roles', 'RoleIds', 'roleIds'];
        for (const key of claimKeys) {
          const values = this.expandClaimValues(decoded[key]);
          if (values.includes(normalizedRequiredRoleId)) {
            return true;
          }
        }
      } catch {
        // Ignore malformed token and continue checking the next one.
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
      const extracted = value?.roleId ?? value?.RoleId;
      return extracted !== undefined && extracted !== null
        ? [`${extracted}`.trim()].filter(item => item.length > 0)
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
        // Fall back to delimiter parsing.
      }
    }

    return raw
      .split(/[;,|]/g)
      .map(item => item.trim())
      .filter(item => item.length > 0);
  }
  transformDistinct(value: any[], property: string): any[] {
    if (!value || !property) {
      return value;
    }

    const distinctValues = [];
    const uniqueMap = new Map();

    for (const item of value) {
      const propertyValue = item[property];

      if (!uniqueMap.has(propertyValue)) {
        uniqueMap.set(propertyValue, true);
        distinctValues.push(item);
      }
    }

    return distinctValues;
  }
  returnGroupName(groupValue: string): string {
    let Groups: any[] = [
      { value: 'SWB', Name: 'مستخدمى تطبيق SWB' },
      { value: 'HeldNotification', Name: 'فريق الإخطارات' },
    ]
    return Groups.find(f => f.value == groupValue).Name;

  }
}
