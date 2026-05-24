import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';
import { ApiKeyService } from '../../core/services/api-key.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
})
export class SidebarComponent {

  private readonly ALL_NAV_ITEMS = [
    {
      label: 'Dashboard',
      route: '/dashboard',
      icon:  'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
      roles: ['admin', 'hr', 'manager'],
    },
    {
      label: 'Upload CV',
      route: '/cv-upload',
      icon:  'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12',
      roles: ['admin', 'hr'],
    },
    {
      label:  'AI Search',
      route:  '/chatbot',
      icon:   'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
      badge:  'AI',
      roles: ['admin', 'hr', 'manager'],
    },
    {
      label: 'Candidates',
      route: '/candidates',
      icon:  'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
      roles: ['admin', 'hr', 'manager'],
    },
    {
      label: 'Job Offers',
      route: '/job-offers',
      icon:  'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
      roles: ['admin', 'hr', 'manager'],
    },
    {
      label: 'Competencies Library',
      route: '/competencies',
      icon:  'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
      roles: ['admin', 'hr'],
    },
    {
      label: 'Job Titles',
      route: '/job-architecture',
      icon:  'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
      roles: ['admin', 'hr'],
    },
    {
      label: 'Employee DB',
      route: '/employees',
      icon:  'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
      roles: ['admin', 'hr', 'manager'],
    },
    {
      label: 'Org Chart',
      route: '/employees/org-chart',
      icon:  'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 012 2h2a2 2 0 012-2V7a2 2 0 01-2-2h-2a2 2 0 01-2 2',
      roles: ['admin', 'hr', 'manager'],
    },
  ];

  get navItems() {
    return this.ALL_NAV_ITEMS.filter(item => item.roles.includes(this.userRole));
  }

  showSettings = false;
  apiKeyInput  = '';
  showApiKey   = false;

  // ── Profile Settings ──────────────────────────────────────────
  showProfileModal = false;
  profileSaving = false;
  showProfilePassword = false;
  showProfileOldPassword = false;
  profileForm = {
    firstName: '',
    lastName: '',
    password: '',
    oldPassword: '',
  };

  constructor(
    private readonly auth:   AuthService,
    private readonly apiKey: ApiKeyService,
    private readonly toast:  ToastService,
    private readonly http:   HttpClient,
  ) {}

  openSettings(): void {
    this.apiKeyInput  = this.apiKey.get();
    this.showSettings = true;
  }

  saveSettings(): void {
    this.apiKey.set(this.apiKeyInput.trim());
    this.showSettings = false;
    this.toast.success('API key saved successfully.');
  }

  clearKey(): void {
    this.apiKeyInput = '';
    this.apiKey.clear();
    this.toast.info('API key cleared.');
  }

  get userName(): string {
    const u = this.auth.getCurrentUser();
    return u ? `${u.firstName} ${u.lastName}` : 'HR Manager';
  }

  get userRole(): string {
    return this.auth.getCurrentUser()?.role ?? 'hr';
  }

  get userInitials(): string {
    const name = this.userName;
    if (!name || name === 'HR Manager') return 'HR';
    return name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase();
  }

  get hasApiKey(): boolean { return this.apiKey.has(); }

  openProfileModal(): void {
    const user = this.auth.getCurrentUser();
    this.profileForm = {
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      password: '',
      oldPassword: '',
    };
    this.showProfilePassword = false;
    this.showProfileModal = true;
  }

  saveProfile(): void {
    if (!this.profileForm.firstName.trim() || !this.profileForm.lastName.trim()) {
      this.toast.error('First name and last name are required.');
      return;
    }

    this.profileSaving = true;
    const payload: any = {
      firstName: this.profileForm.firstName.trim(),
      lastName: this.profileForm.lastName.trim(),
      oldPassword: this.profileForm.oldPassword,
    };

    if (this.profileForm.password.trim()) {
      payload.password = this.profileForm.password.trim();
    }

    const apiUrl = environment.apiUrl;
    this.http.patch(`${apiUrl}/users/profile`, payload, { withCredentials: true })
      .subscribe({
        next: () => {
          this.auth.refreshUser().subscribe({
            next: () => {
              this.profileSaving = false;
              this.showProfileModal = false;
              this.toast.success('Profile updated successfully.');
            },
            error: () => {
              this.profileSaving = false;
              this.toast.error('Profile saved, but failed to refresh session.');
            }
          });
        },
        error: (err) => {
          this.profileSaving = false;
          const errMsg = err.error?.message || 'Failed to update profile.';
          this.toast.error(errMsg);
        }
      });
  }

  logout(): void { this.auth.logout(); }
}