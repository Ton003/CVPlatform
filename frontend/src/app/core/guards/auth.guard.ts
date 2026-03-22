import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    return true;
  }

  // Not logged in → redirect to login page
  router.navigate(['/auth/login'], {
    queryParams: { returnUrl: state.url }, // Remember where they were going
  });
  return false;
};

// Role-based guard — usage: canActivate: [roleGuard('admin')]
export const roleGuard = (requiredRole: string | string[]): CanActivateFn => {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (authService.isLoggedIn() && authService.hasRole(requiredRole)) {
      return true;
    }

    router.navigate(['/unauthorized']);
    return false;
  };
};