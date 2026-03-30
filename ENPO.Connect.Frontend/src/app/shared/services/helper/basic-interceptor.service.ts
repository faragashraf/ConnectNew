import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from "@angular/common/http";
import * as signalR from '@microsoft/signalr';

import { Injectable } from "@angular/core";
import { BehaviorSubject, catchError, EMPTY, filter, finalize, from, Observable, switchMap, take, throwError } from "rxjs";
import { SignalRService } from "../SignalRServices/SignalR.service";
import { AuthObjectsService } from "./auth-objects.service";
import { SpinnerService } from "./spinner.service";
import { MsgsService } from "./msgs.service";
import { Router } from '@angular/router';

@Injectable({
  providedIn: "root",
})
export class BasicInterceptorService implements HttpInterceptor {
  private readonly noStoreUrls = ['api/DomainAuthorization/Encrypt', 'api/DomainAuthorization/Decrypt'];
  private readonly skipAuthPatterns = [
    'authenticatebyuserid', 'changepassword', 'authorizewithpassword',
    'publications/getfilecontent', 'isemailexistinexchange', 'registeruser',
    'assets/component-configs.json', 'admin/applicationconfiguration', 'localhost:3001',
    'localhost:3002/nswag', 'admin/nswagconfiguration', 'publications/getdocumentslist_user',
    'publications/getmenuitems', 'publications/getcriteria'
  ];
  private isRefreshingToken = false;
  private readonly refreshedToken$ = new BehaviorSubject<string | null>(null);
  private isSessionDialogOpen = false;

  constructor(
    private chatService: SignalRService,
    private msgsService: MsgsService,
    private AuthObjects: AuthObjectsService,
    private spinner: SpinnerService,
    private router: Router
  ) { }
  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {

    const token = this.AuthObjects.getPendingToken() || localStorage.getItem('ConnectToken');
    const url = req.url || '';
    const isAssetsRequest = this.isAssetsUrl(url);
    const isDocsAsset = this.isDocsAssetUrl(url);

    // this.spinner.show();
    if (req.url.includes("Domain_Authorization") || req.url.includes('SSO')) {
      const handlledReq = this.domainHandlling(req, token as string | null);
      return next.handle(handlledReq).pipe(
        finalize(() => this._Finalize())
      );
    }
    else if (isAssetsRequest || isDocsAsset || this.matchesAny(url, this.skipAuthPatterns)) {
      return next.handle(req).pipe(finalize(() => this._Finalize())); // No auth needed
    } else if (req.url.includes("GetLogCaseAsync")) {
      let jsonReq: HttpRequest<any> = req.clone({
        setHeaders: {
          "Content-Type": "application/json",
          Authorization: `Basic ${btoa('SMS_Hangfire:@SMS_Hangfire123$')}`
        },
      });
      return next.handle(jsonReq).pipe(
        finalize(() => this._Finalize())
      );
    }
    else if (token != null) {
      let tokenReq = this.attachBearer(req, token);
      if (this.shouldApplyNoStore(tokenReq.url)) {
        tokenReq = this.applyNoStoreHeaders(tokenReq);
      }

      return next.handle(tokenReq).pipe(
        catchError((error: HttpErrorResponse) => {
          console.log('error.status', error.status, error, tokenReq.url);

          if (error.status === 401) {
            return this.handleUnauthorizedError(tokenReq, next, token);
          }

          return throwError(() => error);
        }),
        finalize(() => this._Finalize())
      );
    } else {
      console.log('Interceptor Error: missing token', token);
      this.msgsService.msgInfo(
        "برجاء تسجيل الدخول أولاً",
        "رسالة معلومات",
        'warn'
      );
      this.navigateToLoginAndSignOut();
      // Ensure interceptor finalization runs (hide spinner, etc.) then cancel the request
      this._Finalize();
      return EMPTY as Observable<HttpEvent<any>>;
    }
  }

  private navigateToLoginAndSignOut() {
    const currentUrl = this.router.url;
    // Prevent redirect loop
    if (!currentUrl.includes('/Auth/Login')) {
      this.router.navigate(['/Auth/Login'], {
        queryParams: { returnUrl: currentUrl === '/' ? '/Home' : currentUrl }
      });
    }
    this.AuthObjects.SignOut(true);
  }

  private attachBearer(req: HttpRequest<any>, token: string): HttpRequest<any> {
    return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }

  private handleUnauthorizedError(
    req: HttpRequest<any>,
    next: HttpHandler,
    currentToken: string
  ): Observable<HttpEvent<any>> {
    if (this.isRefreshingToken) {
      return this.refreshedToken$.pipe(
        filter((token): token is string => !!token),
        take(1),
        switchMap((token) => next.handle(this.attachBearer(req, token)))
      );
    }

    this.isRefreshingToken = true;
    this.refreshedToken$.next(null);

    return from(this.chatService.requestTokenRefresh(currentToken)).pipe(
      switchMap((newToken) => {
        localStorage.setItem('ConnectToken', newToken);
        this.refreshedToken$.next(newToken);
        return next.handle(this.attachBearer(req, newToken));
      }),
      catchError((refreshError) => {
        console.error('Token refresh failed after 401', refreshError);
        this.promptSessionExpiredAndSignOut();
        return EMPTY as Observable<HttpEvent<any>>;
      }),
      finalize(() => {
        this.isRefreshingToken = false;
      })
    );
  }

  private promptSessionExpiredAndSignOut() {
    if (this.isSessionDialogOpen) {
      return;
    }

    this.isSessionDialogOpen = true;
    setTimeout(() => {
      this.msgsService
        .msgConfirm('إنتهت صلاحية الجلسة', 'إعادة تسجيل الدخول')
        .then(() => {
          this.navigateToLoginAndSignOut();
        })
        .finally(() => {
          this.isSessionDialogOpen = false;
        });
    }, 50);
  }

  domainHandlling(req: HttpRequest<any>, token: string | null): HttpRequest<any> {
    const lower = (req.url || '').toLowerCase();
    if (lower.includes('authanticateme') || lower.includes('registerme') || lower.includes('authorizewithoutpassword') || lower.includes('authorizewithpassword')) {
      return req.clone({ withCredentials: true });
    }

    // default: attach bearer
    if (token) {
      return req.clone({ setHeaders: { Authorization: `Bearer ${token}` }, withCredentials: false });
    }
    return req.clone({ withCredentials: false });
  }

  private isDocsAssetUrl(url: string): boolean {
    const raw = (url || '').toLowerCase().replace(/\\/g, '/');
    if (raw.includes('/assets/docs/') || raw.includes('assets/docs/')) return true;
    try {
      const base = typeof window !== 'undefined' && window.location ? window.location.origin : 'http://localhost';
      const parsed = new URL(url, base);
      const path = parsed.pathname.toLowerCase().replace(/\\/g, '/');
      return path.includes('/assets/docs/');
    } catch (e) {
      return raw.includes('assets/docs/');
    }
  }

  private isAssetsUrl(url: string): boolean {
    const raw = (url || '').toLowerCase().replace(/\\/g, '/');
    if (raw.includes('/assets/')) return true;
    try {
      const base = typeof window !== 'undefined' && window.location ? window.location.origin : 'http://localhost';
      const parsed = new URL(url, base);
      const path = parsed.pathname.toLowerCase().replace(/\\/g, '/');
      return path.includes('/assets/');
    } catch (e) {
      return raw.includes('assets/');
    }
  }

  private matchesAny(url: string, patterns: string[]): boolean {
    const raw = (url || '').toLowerCase();
    return patterns.some(p => raw.includes(p));
  }

  private shouldApplyNoStore(url: string): boolean {
    const raw = (url || '').toLowerCase();
    return this.noStoreUrls.some(p => raw.includes(p));
  }

  private applyNoStoreHeaders(req: HttpRequest<any>): HttpRequest<any> {
    return req.clone({
      setHeaders: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
        Expires: '0'
      }
    });
  }
  _Finalize() {
    const token = localStorage.getItem('ConnectToken') ?? '';
    this.spinner.hide();
    if (token) {
      if (this.chatService.hubConnection?.state === signalR.HubConnectionState.Connected) {
        this.chatService.RefreshToken(token);
      }
    }
  }
}
