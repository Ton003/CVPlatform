import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Read XSRF-TOKEN from document.cookie
  const match = document.cookie.match(/(?:^|;)\s*XSRF-TOKEN=([^;]*)/);
  const xsrfToken = match ? match[1] : null;

  let headers = req.headers;
  if (xsrfToken && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    headers = headers.set('X-XSRF-TOKEN', xsrfToken);
  }

  // Clone request to ensure cookies are sent
  const authReq = req.clone({
    withCredentials: true,
    headers,
  });

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // If 401 Unauthorized, token is expired or invalid → logout
      if (error.status === 401) {
        authService.executeLogout();
      }
      return throwError(() => error);
    })
  );
};