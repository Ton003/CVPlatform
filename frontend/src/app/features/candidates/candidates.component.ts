import { Component, OnInit, OnDestroy, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import { CommonModule }          from '@angular/common';
import { FormsModule }           from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { HttpClient }            from '@angular/common/http';
import { Subject }               from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil, finalize } from 'rxjs/operators';
import { AuthService }             from '../../core/services/auth.service';
import { CandidatesStateService }  from '../../core/services/candidates-state.service';
import { SidebarComponent }        from '../../shared/sidebar/sidebar.component';
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
  imports:     [CommonModule, FormsModule, SidebarComponent],
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

  // View mode toggle
  viewMode: 'grid' | 'list' = 'grid';

  private readonly searchSubject = new Subject<string>();
  private readonly destroy$      = new Subject<void>();
  private restoringState         = false;

  constructor(
    private readonly http:            HttpClient,
    private readonly auth:            AuthService,
    private readonly router:          Router,
    private readonly cdr:             ChangeDetectorRef,
    private readonly candidatesState: CandidatesStateService,
  ) {}

  ngOnInit(): void {
    const hasState = this.candidatesState.searchQuery !== ''
                  || this.candidatesState.currentPage > 1;

    if (hasState) {
      this.restoringState = true;
      this.searchQuery    = this.candidatesState.searchQuery;
      this.currentPage    = this.candidatesState.currentPage;
    }

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
    if (this.searchQuery.trim()) params['search'] = this.searchQuery.trim();

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
      error: () => { this.error = 'Failed to load candidates. Please try again.'; },
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
    this.router.navigate(['/candidates', candidateId], { queryParams: { from: 'candidates' } });
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
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}