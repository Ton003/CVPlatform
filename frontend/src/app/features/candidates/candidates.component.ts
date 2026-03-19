import { Component, OnInit, OnDestroy, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import { CommonModule }          from '@angular/common';
import { FormsModule }           from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { HttpClient }            from '@angular/common/http';
import { Subject }               from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil, finalize } from 'rxjs/operators';
import { AuthService }             from '../../core/services/auth.service';
import { CandidatesStateService }  from '../../core/services/candidates-state.service';
import { environment }             from '../../../environments/environment';

interface CandidateCard {
  candidateId:  string;
  name:         string;
  email:        string | null;
  location:     string | null;
  currentTitle: string | null;
  yearsExp:     number | null;
  createdAt:    string | null;
}

interface CandidateListResponse {
  data:       CandidateCard[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}

@Component({
  selector:    'app-candidates',
  standalone:  true,
  imports:     [CommonModule, FormsModule, RouterLink, RouterLinkActive],
  templateUrl: './candidates.component.html',
  styleUrls:   ['./candidates.component.scss'],
})
export class CandidatesComponent implements OnInit, AfterViewInit, OnDestroy {

  candidates:  CandidateCard[] = [];
  total        = 0;
  totalPages   = 0;
  currentPage  = 1;
  readonly limit = 20;

  loading      = false;
  error        = '';
  searchQuery  = '';

  private readonly searchSubject = new Subject<string>();
  private readonly destroy$      = new Subject<void>();
  private restoringState         = false;

  readonly navItems = [
    { label: 'Dashboard',  route: '/dashboard',  icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { label: 'Upload CV',  route: '/cv-upload',  icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12' },
    { label: 'AI Search',  route: '/chatbot',    icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
    { label: 'Candidates', route: '/candidates', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  ];

  constructor(
    private readonly http:            HttpClient,
    private readonly auth:            AuthService,
    private readonly router:          Router,
    private readonly cdr:             ChangeDetectorRef,
    private readonly candidatesState: CandidatesStateService,
  ) {}

  ngOnInit(): void {
    // ✅ Restore state from service if returning from a profile page
    const hasState = this.candidatesState.searchQuery !== ''
                  || this.candidatesState.currentPage > 1;

    if (hasState) {
      this.restoringState = true;
      this.searchQuery    = this.candidatesState.searchQuery;
      this.currentPage    = this.candidatesState.currentPage;
    }

    // Debounced search — only fires on actual user input
    this.searchSubject.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
    ).subscribe(() => {
      this.currentPage = 1;
      this.fetchCandidates();
    });

    this.fetchCandidates();
  }

  ngAfterViewInit(): void {
    // ✅ Restore scroll position after data renders
    if (this.restoringState && this.candidatesState.scrollY > 0) {
      setTimeout(() => {
        window.scrollTo({ top: this.candidatesState.scrollY, behavior: 'instant' });
        this.restoringState = false;
      }, 100);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchInput(value: string): void {
    this.searchQuery = value;
    this.searchSubject.next(value);
  }

  fetchCandidates(): void {
    this.loading = true;
    this.error   = '';

    const params: Record<string, string> = {
      page:  String(this.currentPage),
      limit: String(this.limit),
    };
    if (this.searchQuery.trim()) {
      params['search'] = this.searchQuery.trim();
    }

    const queryString = new URLSearchParams(params).toString();

    this.http.get<CandidateListResponse>(
      `${environment.apiUrl}/candidates?${queryString}`
    ).pipe(
      finalize(() => { this.loading = false; this.cdr.detectChanges(); })
    ).subscribe({
      next: res => {
        this.candidates  = res.data;
        this.total       = res.total;
        this.totalPages  = res.totalPages;
        this.currentPage = res.page;
      },
      error: () => {
        this.error = 'Failed to load candidates. Please try again.';
      },
    });
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.currentPage = page;
    this.saveState();
    this.fetchCandidates();
  }

  openProfile(candidateId: string): void {
  this.saveState();
  this.router.navigate(['/candidates', candidateId], {
    queryParams: { from: 'candidates' } // ✅ tag the origin
  });
}

  clearSearch(): void {
    this.searchQuery = '';
    this.currentPage = 1;
    this.candidatesState.clear();
    this.fetchCandidates();
  }

  private saveState(): void {
    this.candidatesState.searchQuery = this.searchQuery;
    this.candidatesState.currentPage = this.currentPage;
    this.candidatesState.scrollY     = window.scrollY;
  }

  get pageNumbers(): number[] {
    const pages: number[] = [];
    const start = Math.max(1, this.currentPage - 2);
    const end   = Math.min(this.totalPages, start + 4);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }

  initials(name: string): string {
    return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  }

  formatDate(d: string | null): string {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }

  get userName(): string {
    const u = this.auth.getCurrentUser();
    return u ? `${u.first_name} ${u.last_name}` : 'HR Manager';
  }

  get userRole():     string { return this.auth.getCurrentUser()?.role ?? 'hr'; }
  get userInitials(): string {
    return this.userName.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase();
  }

  logout(): void { this.auth.logout(); }
}