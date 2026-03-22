import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule }        from '@angular/common';
import { FormsModule }         from '@angular/forms';
import { Router }              from '@angular/router';
import { HttpClient }          from '@angular/common/http';
import { finalize }            from 'rxjs/operators';
import { AuthService }         from '../../core/services/auth.service';
import { ToastService }        from '../../core/services/toast.service';
import { environment }         from '../../../environments/environment';
import { ConfirmModalComponent } from '../../shared/confirm-modal/confirm-modal.component';

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
  imports:     [CommonModule, FormsModule, ConfirmModalComponent],
  templateUrl: './job-offers.component.html',
  styleUrls:   ['./job-offers.component.scss'],
})
export class JobOffersComponent implements OnInit {

  offers:  JobOffer[] = [];
  loading  = false;
  error    = '';

  showForm = false;
  saving   = false;

  // View mode
  viewMode: 'grid' | 'list' = 'grid';

  // Delete confirmation
  deleteModal = false;
  pendingDeleteId = '';

  form = {
    title:          '',
    description:    '',
    location:       '',
    requiredSkills: '',
    minYears:       null as number | null,
    status:         'open',
  };

  constructor(
    private readonly http:   HttpClient,
    private readonly auth:   AuthService,
    private readonly router: Router,
    private readonly toast:  ToastService,
    private readonly cdr:    ChangeDetectorRef,
  ) {}

  ngOnInit(): void { this.loadOffers(); }

  loadOffers(): void {
    this.loading = true;
    this.error   = '';
    this.http.get<JobOffer[]>(`${environment.apiUrl}/job-offers`).pipe(
      finalize(() => { this.loading = false; this.cdr.detectChanges(); }),
    ).subscribe({
      next:  rows => { this.offers = rows; },
      error: ()   => { this.error  = 'Failed to load job offers.'; },
    });
  }

  openForm(): void {
    this.showForm = true;
    this.form = { title: '', description: '', location: '', requiredSkills: '', minYears: null, status: 'open' };
    this.cdr.detectChanges();
  }

  cancelForm(): void { this.showForm = false; this.cdr.detectChanges(); }

  submitForm(): void {
    if (!this.form.title.trim() || !this.form.description.trim()) return;
    this.saving = true;
    const payload = {
      title:          this.form.title.trim(),
      description:    this.form.description.trim(),
      location:       this.form.location.trim() || null,
      requiredSkills: this.form.requiredSkills.split(',').map(s => s.trim()).filter(Boolean),
      minYears:       this.form.minYears ? Number(this.form.minYears) : null,
      status:         this.form.status,
    };
    this.http.post<JobOffer>(`${environment.apiUrl}/job-offers`, payload).pipe(
      finalize(() => { this.saving = false; this.cdr.detectChanges(); }),
    ).subscribe({
      next: offer => {
        this.offers   = [offer, ...this.offers];
        this.showForm = false;
        this.toast.success('Job offer created successfully.');
      },
      error: () => { this.toast.error('Failed to create job offer. Please try again.'); },
    });
  }

  requestDelete(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.pendingDeleteId = id;
    this.deleteModal     = true;
  }

  confirmDelete(): void {
    const id = this.pendingDeleteId;
    this.deleteModal = false;
    this.http.delete(`${environment.apiUrl}/job-offers/${id}`).pipe(
      finalize(() => this.cdr.detectChanges()),
    ).subscribe({
      next: () => {
        this.offers = this.offers.filter(o => o.id !== id);
        this.toast.success('Job offer deleted.');
      },
      error: () => { this.toast.error('Failed to delete job offer.'); },
    });
  }

  cancelDelete(): void { this.deleteModal = false; }

  viewMatches(id: string): void { this.router.navigate(['/job-offers', id, 'matches']); }

  formatDate(d: string): string {
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  get userName():     string { const u = this.auth.getCurrentUser(); return u ? `${u.first_name} ${u.last_name}` : 'HR Manager'; }
  get userRole():     string { return this.auth.getCurrentUser()?.role ?? 'hr'; }
  get userInitials(): string { return this.userName.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase(); }
}