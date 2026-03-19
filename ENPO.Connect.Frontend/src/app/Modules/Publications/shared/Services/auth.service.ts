import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly AUTH_TOKEN_KEY = 'auth_token';
  private readonly USER_INFO_KEY = 'user_info';
  private readonly TOKEN_EXPIRATION_KEY = 'token_expires_at';
  private userSubject: BehaviorSubject<any | null>;
  public user$: Observable<any | null>;

  constructor(private router: Router) {
    // Initialize with user data from local storage if available
    const storedUser = this.getStoredUser();
    this.userSubject = new BehaviorSubject<any | null>(storedUser);
    this.user$ = this.userSubject.asObservable();
  }

  /**
   * Login user and store authentication data
   * @param authData Should contain at least { token, userInfo }
   */
  login(authData: { token: string, userInfo: any, userRole?: Date }): void {
    if (!authData.token || !authData.userInfo) {
      throw new Error('Invalid auth data provided');
    }

    // Store all auth data in local storage
    localStorage.setItem(this.AUTH_TOKEN_KEY, authData.token);
    localStorage.setItem(this.USER_INFO_KEY, JSON.stringify(authData.userInfo));

    // // Store expiration if provided
    // if (authData.expiresAt) {
    //   localStorage.setItem(this.TOKEN_EXPIRATION_KEY, authData.expiresAt.toISOString());
    // }

    // Update the observable
    this.userSubject.next(authData.userInfo);
    this.router.navigate(['/admin/all-full-publication']);

  }

  /**
   * Logout user and clear all auth data
   */
  logout(): void {
    localStorage.removeItem(this.AUTH_TOKEN_KEY);
    localStorage.removeItem(this.USER_INFO_KEY);
    localStorage.removeItem(this.TOKEN_EXPIRATION_KEY);
    this.userSubject.next(null);
  }

  /**
   * Set authentication data (can be used for token refresh)
   */
  // setAuthData(authData: { token?: string, userInfo?: any, expiresAt?: Date }): void {
  //   if (authData.token) {
  //     localStorage.setItem(this.AUTH_TOKEN_KEY, authData.token);
  //   }

  //   if (authData.userInfo) {
  //     localStorage.setItem(this.USER_INFO_KEY, JSON.stringify(authData.userInfo));
  //     this.userSubject.next(authData.userInfo);
  //   }

  //   if (authData.expiresAt) {
  //     localStorage.setItem(this.TOKEN_EXPIRATION_KEY, authData.expiresAt.toISOString());
  //   }
  // }

  /**
   * Get current user info
   */
  getCurrentUser(): any | null {
    return this.userSubject.value;
  }

  /**
   * Get auth token
   */
  getToken(): string | null {
    return localStorage.getItem(this.AUTH_TOKEN_KEY);
  }

  /**
   * Check if user is authenticated
   * (Optional: Add token expiration check)
   */
  // isAuthenticated(): boolean {
  //   return !!this.getToken();
  // }

  /**
   * Check if token is expired
   */
  // isTokenExpired(): boolean {
  //   const expiration = localStorage.getItem(this.TOKEN_EXPIRATION_KEY);
  //   if (!expiration) return false; // Assume not expired if no expiration stored

  //   return new Date(expiration) < new Date();
  // }

  /**
   * Get stored user from local storage
   */
  private getStoredUser(): any | null {
    const userInfo = localStorage.getItem(this.USER_INFO_KEY);
    return userInfo ? JSON.parse(userInfo) : null;
  }

  /**
   * Get stored token expiration
   */
  // getTokenExpiration(): Date | null {
  //   const expiration = localStorage.getItem(this.TOKEN_EXPIRATION_KEY);
  //   return expiration ? new Date(expiration) : null;
  // }
}