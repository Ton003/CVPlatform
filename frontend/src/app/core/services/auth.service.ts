import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { User, AuthResponse, LoginPayload, SignupPayload } from '../../shared/models/user.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly API_URL = 'http://localhost:3000/api';
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
    // Only access localStorage in the browser, not during SSR
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (this.isBrowser) {
      this.currentUserSubject.next(this.getUserFromStorage());
    }
  }

  login(payload: LoginPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/auth/login`, payload).pipe(
      tap((response) => this.handleAuthSuccess(response))
    );
  }

  signup(payload: SignupPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/auth/signup`, payload).pipe(
      tap((response) => this.handleAuthSuccess(response))
    );
  }

  logout(): void {
    if (this.isBrowser) {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
    }
    this.currentUserSubject.next(null);
    this.router.navigate(['/auth/login']);
  }

  getToken(): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem(this.TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    if (!this.isBrowser) return false;
    const token = this.getToken();
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
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

  private handleAuthSuccess(response: AuthResponse): void {
    if (this.isBrowser) {
      localStorage.setItem(this.TOKEN_KEY, response.access_token);
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
}