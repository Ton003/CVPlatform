import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule }        from '@angular/common';
import { FormsModule }         from '@angular/forms';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { HttpClient }          from '@angular/common/http';
import { finalize }            from 'rxjs/operators';
import { AuthService }         from '../../core/services/auth.service';
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
  imports:     [CommonModule, FormsModule, RouterLink, RouterLinkActive],
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

  // Groq API key (persisted in sessionStorage — same pattern as chatbot)
  apiKey      = '';
  showKey     = false;
  mode        = 'groq';

  readonly navItems = [
    { label: 'Dashboard',  route: '/dashboard',  icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { label: 'Upload CV',  route: '/cv-upload',  icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12' },
    { label: 'AI Search',  route: '/chatbot',    icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
    { label: 'Candidates', route: '/candidates', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
    { label: 'Job Offers', route: '/job-offers', icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  ];

  private offerId = '';

  constructor(
    private readonly route:  ActivatedRoute,
    private readonly router: Router,
    private readonly http:   HttpClient,
    private readonly auth:   AuthService,
    private readonly cdr:    ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.offerId = this.route.snapshot.paramMap.get('id') ?? '';
    this.apiKey  = sessionStorage.getItem('groq_api_key') ?? '';
    this.runMatch();
  }

  runMatch(): void {
    if (!this.offerId) return;
    if (this.mode === 'groq' && !this.apiKey.trim()) {
      this.error = 'Please enter your Groq API key to use AI matching.';
      return;
    }

    this.loading    = true;
    this.error      = '';
    this.candidates = [];
    this.aiMessage  = '';

    if (this.apiKey) sessionStorage.setItem('groq_api_key', this.apiKey);

    const params = new URLSearchParams({ mode: this.mode });
    if (this.mode === 'groq' && this.apiKey) params.set('apiKey', this.apiKey);

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
        this.error = 'Failed to fetch matches. Check your API key and try again.';
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

  get userName():     string { const u = this.auth.getCurrentUser(); return u ? `${u.first_name} ${u.last_name}` : 'HR Manager'; }
  get userRole():     string { return this.auth.getCurrentUser()?.role ?? 'hr'; }
  get userInitials(): string { return this.userName.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase(); }
  logout(): void { this.auth.logout(); }
}