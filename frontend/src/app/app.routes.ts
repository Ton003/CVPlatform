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
          import('./features/auth/login/login.component').then(m => m.LoginComponent),
      },
      {
        path: 'signup',
        loadComponent: () =>
          import('./features/auth/signup/signup.component').then(m => m.SignupComponent),
      },
    ],
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
  },
  {
    path: 'cv-upload',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/cv-upload/cv-upload.component').then(m => m.CvUploadComponent),
  },
  {
    path: 'chatbot',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/chatbot/chatbot.component').then(m => m.ChatbotComponent),
  },
  // ✅ list before :id, both before **
  {
    path: 'candidates',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/candidates/candidates.component').then(m => m.CandidatesComponent),
  },
  {
    path: 'candidates/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/candidate-profile/candidate-profile.component').then(m => m.CandidateProfileComponent),
  },
  {
    path: '**',
    redirectTo: '/auth/login',
  },
];