import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full',
  },
  {
    path: 'auth',
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./features/auth/login/login.component').then(
            (m) => m.LoginComponent
          ),
      },
      {
        path: 'signup',
        loadComponent: () =>
          import('./features/auth/signup/signup.component').then(
            (m) => m.SignupComponent
          ),
      },
    ],
  },
  {
    path: 'dashboard',
    canActivate: [authGuard], // 🔒 Protected
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then(
        (m) => m.DashboardComponent
      ),
  },
  {
    path: '**',
    redirectTo: '/auth/login',
  },
];