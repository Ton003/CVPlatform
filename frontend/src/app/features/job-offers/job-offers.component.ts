import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule }        from '@angular/common';
import { FormsModule }         from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { HttpClient }          from '@angular/common/http';
import { finalize }            from 'rxjs/operators';
import { AuthService }         from '../../core/services/auth.service';
import { environment }         from '../../../environments/environment';

export interface JobOffer {
  id:             string;
  title:          string;
  description:    string;
  location:       string | null;
  requiredSkills: string[];
  minYears:       number | null;
  status:         string;
  createdAt:      string;
}

@Component({
  selector:    'app-job-offers',
  standalone:  true,
  imports:     [CommonModule, FormsModule, RouterLink, RouterLinkActive],
  templateUrl: './job-offers.component.html',
  styleUrls:   ['./job-offers.component.scss'],
})
export class JobOffersComponent implements OnInit {

  offers:       JobOffer[] = [];
  loading       = false;
  error         = '';
  successMessage = '';

  // Create form
  showForm      = false;
  saving        = false;
  form = {
    title:          '',
    description:    '',
    location:       '',
    requiredSkills: '',  // comma-separated input → split on save
    minYears:       null as number | null,
    status:         'open',
  };

  readonly navItems = [
    { label: 'Dashboard',   route: '/dashboard',   icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { label: 'Upload CV',   route: '/cv-upload',   icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12' },
    { label: 'AI Search',   route: '/chatbot',     icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
    { label: 'Candidates',  route: '/candidates',  icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
    { label: 'Job Offers',  route: '/job-offers',  icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  ];

  constructor(
    private readonly http:   HttpClient,
    private readonly auth:   AuthService,
    private readonly router: Router,
    private readonly cdr:    ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadOffers();
  }

  loadOffers(): void {
    this.loading = true;
    this.error   = '';

    this.http.get<JobOffer[]>(`${environment.apiUrl}/job-offers`).pipe(
      finalize(() => { this.loading = false; this.cdr.detectChanges(); }),
    ).subscribe({
      next:  rows  => { this.offers = rows; },
      error: ()    => { this.error = 'Failed to load job offers. Please try again.'; },
    });
  }

  openForm(): void {
    this.showForm = true;
    this.form = { title: '', description: '', location: '', requiredSkills: '', minYears: null, status: 'open' };
    this.cdr.detectChanges();
  }

  cancelForm(): void {
    this.showForm = false;
    this.cdr.detectChanges();
  }

  submitForm(): void {
    if (!this.form.title.trim() || !this.form.description.trim()) return;

    this.saving = true;

    const payload = {
      title:          this.form.title.trim(),
      description:    this.form.description.trim(),
      location:       this.form.location.trim() || null,
      requiredSkills: this.form.requiredSkills
        .split(',')
        .map(s => s.trim())
        .filter(Boolean),
      minYears: this.form.minYears ? Number(this.form.minYears) : null,
      status:   this.form.status,
    };

    this.http.post<JobOffer>(`${environment.apiUrl}/job-offers`, payload).pipe(
      finalize(() => { this.saving = false; this.cdr.detectChanges(); }),
    ).subscribe({
      next: offer => {
        this.offers = [offer, ...this.offers];
        this.showForm = false;
        this.successMessage = 'Job offer created successfully.';
        setTimeout(() => { this.successMessage = ''; this.cdr.detectChanges(); }, 4000);
      },
      error: () => {
        this.error = 'Failed to create job offer. Please try again.';
      },
    });
  }

  deleteOffer(id: string, event: MouseEvent): void {
    event.stopPropagation();
    if (!confirm('Delete this job offer?')) return;

    this.http.delete(`${environment.apiUrl}/job-offers/${id}`).pipe(
      finalize(() => this.cdr.detectChanges()),
    ).subscribe({
      next: () => {
        this.offers = this.offers.filter(o => o.id !== id);
        this.successMessage = 'Job offer deleted.';
        setTimeout(() => { this.successMessage = ''; this.cdr.detectChanges(); }, 4000);
      },
      error: () => { this.error = 'Failed to delete job offer.'; },
    });
  }

  viewMatches(id: string): void {
    this.router.navigate(['/job-offers', id, 'matches']);
  }

  formatDate(d: string): string {
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  get userName():     string { const u = this.auth.getCurrentUser(); return u ? `${u.first_name} ${u.last_name}` : 'HR Manager'; }
  get userRole():     string { return this.auth.getCurrentUser()?.role ?? 'hr'; }
  get userInitials(): string { return this.userName.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase(); }
  logout(): void { this.auth.logout(); }
}