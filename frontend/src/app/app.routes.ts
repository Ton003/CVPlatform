import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { ShellComponent } from './layouts/shell/shell.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full',
  },
  // ── Public auth routes (no shell / no sidebar) ──────────────────
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
  // ── Authenticated routes (all share the global Shell sidebar) ───
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        path: 'cv-upload',
        loadComponent: () =>
          import('./features/cv-upload/cv-upload.component').then(m => m.CvUploadComponent),
      },
      {
        path: 'chatbot',
        loadComponent: () =>
          import('./features/chatbot/chatbot.component').then(m => m.ChatbotComponent),
      },
      {
        path: 'candidates',
        loadComponent: () =>
          import('./features/candidates/candidates.component').then(m => m.CandidatesComponent),
      },
      {
        path: 'candidates/:id',
        loadComponent: () =>
          import('./features/candidate-profile/candidate-profile.component').then(m => m.CandidateProfileComponent),
      },
      {
        path: 'job-offers',
        loadComponent: () =>
          import('./features/job-offers/job-offers.component').then(m => m.JobOffersComponent),
      },
      {
        path: 'competencies',
        loadComponent: () =>
          import('./features/competencies/competencies.component').then(m => m.CompetenciesComponent),
      },
      {
        path: 'job-architecture',
        loadComponent: () =>
          import('./features/job-architecture/job-architecture').then(m => m.JobArchitecture),
      },
      {
        path: 'job-offers/:id/matches',
        loadComponent: () =>
          import('./features/job-offers/job-offer-matches.component').then(m => m.JobOfferMatchesComponent),
      },
      {
        path: 'job-offers/:id/compare',
        loadComponent: () =>
          import('./features/job-offers/job-offer-comparison.component').then(m => m.JobOfferComparisonComponent),
      },
      {
        path: 'job-offers/:id/pipeline',
        loadComponent: () =>
          import('./features/job-pipeline/job-pipeline.component').then(m => m.JobPipelineComponent),
      },
      {
        path: 'applications/:id',
        loadComponent: () =>
          import('./features/application-detail/application-detail.component').then(m => m.ApplicationDetailComponent),
      },
      {
        path: 'employees',
        loadComponent: () =>
          import('./features/employees/employee-list/employee-list.component').then(m => m.EmployeeListComponent),
      },

      {
        path: 'employees/:id',
        loadComponent: () =>
          import('./features/employees/employee-profile/employee-profile.component').then(m => m.EmployeeProfileComponent),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '/auth/login',
  },
];