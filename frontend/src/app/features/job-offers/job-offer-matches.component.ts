import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule }        from '@angular/common';
import { FormsModule }         from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient }          from '@angular/common/http';
import { finalize }            from 'rxjs/operators';
import { AuthService }         from '../../core/services/auth.service';
import { ApiKeyService }       from '../../core/services/api-key.service';
import { ToastService }        from '../../core/services/toast.service';
import { environment }         from '../../../environments/environment';
import { JobOffer }            from './job-offers.component';

interface CandidateMatch {
  candidateId:   string;
  name:          string;
  email:         string | null;
  location:      string | null;
  currentTitle:  string | null;
  yearsExp:      number | null;
  skills:        string[];
  summary:       string | null;
  matchScore:    number;
  matchedSkills: string[];
  strength:      string | null;
  gap:           string | null;
  relevantSkills: string[];
}

interface MatchResponse {
  offer:            JobOffer;
  message:          string;
  total:            number;
  candidates:       CandidateMatch[];
  aiRecommendation: string | null;
  mode:             string;
}

import { InternalMobilityService, UnifiedScoreResult } from '../employees/services/internal-mobility.service';

interface InternalCandidateMatch extends UnifiedScoreResult {
  uuid: string;
  firstName: string;
  lastName: string;
  currentRank?: string;
}

@Component({
  selector:    'app-job-offer-matches',
  standalone:  true,
  imports:     [CommonModule, FormsModule, RouterLink],
  templateUrl: './job-offer-matches.component.html',
  styleUrls:   ['./job-offer-matches.component.scss'],
})
export class JobOfferMatchesComponent implements OnInit {

  offer:      JobOffer | null = null;
  candidates: CandidateMatch[] = [];
  internalCandidates: InternalCandidateMatch[] = [];
  aiMessage   = '';
  total       = 0;
  successionCandidates: any[] = []; 
  loadingSuccessors = false; 
  hasSearched = false;

  loading     = false;
  loadingInternal = false;
  error       = '';

  mode        = 'groq';
  activeTab   = 'external'; // 'external' or 'internal'

  private offerId = '';

  constructor(
    private readonly route:  ActivatedRoute,
    private readonly router: Router,
    private readonly http:   HttpClient,
    private readonly auth:   AuthService,
    private readonly apiKey: ApiKeyService,
    private readonly toast:  ToastService,
    private readonly cdr:    ChangeDetectorRef,
    private readonly internalMobility: InternalMobilityService
  ) {}

  ngOnInit(): void {
    this.offerId = this.route.snapshot.paramMap.get('id') ?? '';
    this.runMatch();
  }

  setTab(tab: 'external' | 'internal'): void {
    this.activeTab = tab;
    if (tab === 'internal' && this.internalCandidates.length === 0) {
      this.loadInternalMatches();
    }
  }

  loadInternalMatches(): void {
    if (!this.offerId) return;
    this.loadingInternal = true;
    this.internalMobility.getOfferMatches(this.offerId).pipe(
      finalize(() => { this.loadingInternal = false; this.cdr.detectChanges(); })
    ).subscribe({
      next: res => { this.internalCandidates = res; },
      error: () => this.toast.error('Failed to load internal candidates.')
    });
  }

  runMatch(): void {
    if (!this.offerId) return;
    if (this.mode === 'groq' && !this.apiKey.has()) {
      this.error = 'No Groq API key found. Please add your key in the sidebar settings (key icon).';
      return;
    }

    this.loading    = true;
    this.error      = '';
    this.candidates = [];
    this.aiMessage  = '';

    const key    = this.apiKey.get();
    const params = new URLSearchParams({ mode: this.mode });
    let headers: any = {};
    if (this.mode === 'groq' && key) {
        headers['x-api-key'] = key;
    }

    this.http.get<MatchResponse>(
      `${environment.apiUrl}/job-offers/${this.offerId}/matches?${params}`,
      { headers }
    ).pipe(
      finalize(() => { this.loading = false; this.cdr.detectChanges(); }),
    ).subscribe({
      next: res => {
        this.offer      = res.offer;
        this.candidates = res.candidates;
        this.aiMessage  = res.aiRecommendation ?? res.message;
        this.total      = res.total;
        this.hasSearched = true;
        this.loadSuccessors(); // Trigger succession check
        if (this.activeTab === 'internal') this.loadInternalMatches();
      },
      error: () => {
        this.error = 'Failed to fetch matches. Check your API key in sidebar settings and try again.';
        this.toast.error('AI Matching failed. Verify your Groq API key.');
      },
    });
  }

  loadSuccessors(): void {
    if (!this.offer?.jobRoleId) return;
    this.loadingSuccessors = true;
    this.http.get<any[]>(`${environment.apiUrl}/job-architecture/job-roles/${this.offer.jobRoleId}/succession-candidates`)
      .pipe(finalize(() => { this.loadingSuccessors = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: (res) => {
          this.successionCandidates = res || [];
        },
        error: () => {
          this.toast.error('Failed to load succession candidates.');
        }
      });
  }

  goToProfile(candidateId: string): void {
    this.router.navigate(['/candidates', candidateId], { queryParams: { from: 'job-offers' } });
  }

  goToEmployee(id: string): void {
    this.router.navigate(['/employees', id]);
  }

  scoreColor(score: number): string {
    if (score >= 75) return '#4ade80';
    if (score >= 55) return 'var(--accent-soft)';
    if (score >= 35) return '#fbbf24';
    return '#fb7185';
  }

  scoreBg(score: number): string {
    if (score >= 75) return 'rgba(34,197,94,.12)';
    if (score >= 55) return 'var(--accent-dim)';
    if (score >= 35) return 'rgba(245,158,11,.12)';
    return 'var(--danger-dim)';
  }

  initials(name: string): string {
    return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  }

  get userName():  string { const u = this.auth.getCurrentUser(); return u ? `${u.first_name} ${u.last_name}` : 'HR Manager'; }
  get userRole():  string { return this.auth.getCurrentUser()?.role ?? 'hr'; }
}