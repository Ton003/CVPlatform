import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
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

  readonly navItems = [
    {
      label: 'Dashboard',
      route: '/dashboard',
      icon:  'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    },
    {
      label: 'Upload CV',
      route: '/cv-upload',
      icon:  'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12',
    },
    {
      label:  'AI Search',
      route:  '/chatbot',
      icon:   'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
      badge:  'AI',
    },
    {
      label: 'Candidates',
      route: '/candidates',
      icon:  'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
    },
    {
      label: 'Job Offers',
      route: '/job-offers',
      icon:  'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    },
    {
      label: 'Competencies Library',
      route: '/competencies',
      icon:  'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    },
    {
      label: 'Job Titles',
      route: '/job-architecture',
      icon:  'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
    },
    {
      label: 'Employee DB',
      route: '/employees',
      icon:  'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
    },
  ];

  showSettings = false;
  apiKeyInput  = '';
  showApiKey   = false;

  constructor(
    private readonly auth:   AuthService,
    private readonly apiKey: ApiKeyService,
    private readonly toast:  ToastService,
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
    return u ? `${u.first_name} ${u.last_name}` : 'HR Manager';
  }

  get userRole(): string {
    return this.auth.getCurrentUser()?.role ?? 'hr';
  }

  get userInitials(): string {
    return this.userName.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  }

  get hasApiKey(): boolean { return this.apiKey.has(); }

  logout(): void { this.auth.logout(); }
}