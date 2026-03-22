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
  fit:           string | null;
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
  aiMessage   = '';
  total       = 0;

  loading     = false;
  error       = '';

  mode        = 'groq';

  private offerId = '';

  constructor(
    private readonly route:  ActivatedRoute,
    private readonly router: Router,
    private readonly http:   HttpClient,
    private readonly auth:   AuthService,
    private readonly apiKey: ApiKeyService,
    private readonly toast:  ToastService,
    private readonly cdr:    ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.offerId = this.route.snapshot.paramMap.get('id') ?? '';
    this.runMatch();
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
    if (this.mode === 'groq' && key) params.set('apiKey', key);

    this.http.get<MatchResponse>(
      `${environment.apiUrl}/job-offers/${this.offerId}/matches?${params}`
    ).pipe(
      finalize(() => { this.loading = false; this.cdr.detectChanges(); }),
    ).subscribe({
      next: res => {
        this.offer      = res.offer;
        this.candidates = res.candidates;
        this.aiMessage  = res.aiRecommendation ?? res.message;
        this.total      = res.total;
      },
      error: () => {
        this.error = 'Failed to fetch matches. Check your API key in sidebar settings and try again.';
        this.toast.error('AI Matching failed. Verify your Groq API key.');
      },
    });
  }

  goToProfile(candidateId: string): void {
    this.router.navigate(['/candidates', candidateId], { queryParams: { from: 'job-offers' } });
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