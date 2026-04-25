import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../environments/environment';
import {
  User,
  AuthResponse,
  LoginPayload,
  SignupPayload,
} from '../../shared/models/user.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly API_URL = environment.apiUrl; // ✅ no more hardcode
  private readonly TOKEN_KEY = 'biat_access_token';
  private readonly USER_KEY = 'biat_user';
  private readonly isBrowser: boolean;

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (this.isBrowser) {
      this.currentUserSubject.next(this.getUserFromStorage());
    }
  }

  login(payload: LoginPayload): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.API_URL}/auth/login`, payload, { withCredentials: true })
      .pipe(tap((response) => this.handleAuthSuccess(response)));
  }

  signup(payload: SignupPayload): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.API_URL}/auth/signup`, payload, { withCredentials: true })
      .pipe(tap((response) => this.handleAuthSuccess(response)));
  }

  logout(): void {
    this.http.post(`${this.API_URL}/auth/logout`, {}, { withCredentials: true }).subscribe({
      next: () => this.executeLogout(),
      error: () => this.executeLogout()
    });
  }

  executeLogout(): void {
    this.clearStorage(); // ✅ centralized
    this.currentUserSubject.next(null);
    this.router.navigate(['/auth/login']);
  }

  isLoggedIn(): boolean {
    if (!this.isBrowser) return false;
    return !!this.getUserFromStorage();
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.getValue();
  }

  hasRole(role: string | string[]): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;
    if (Array.isArray(role)) return role.includes(user.role);
    return user.role === role;
  }

  // ✅ Call this on app init or after role changes
  refreshUser(): Observable<User> {
    return this.http.get<User>(`${this.API_URL}/auth/me`, { withCredentials: true }).pipe(
      tap((user) => {
        if (this.isBrowser) {
          localStorage.setItem(this.USER_KEY, JSON.stringify(user));
        }
        this.currentUserSubject.next(user);
      })
    );
  }

  private handleAuthSuccess(response: AuthResponse): void {
    if (this.isBrowser) {
      localStorage.setItem(this.USER_KEY, JSON.stringify(response.user));
    }
    this.currentUserSubject.next(response.user);
  }

  private getUserFromStorage(): User | null {
    try {
      const userStr = localStorage.getItem(this.USER_KEY);
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  }

  private clearStorage(): void {
    if (!this.isBrowser) return;
    localStorage.removeItem(this.USER_KEY);
  }
}