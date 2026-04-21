import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule }        from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient }          from '@angular/common/http';
import { finalize }            from 'rxjs/operators';
import { environment }         from '../../../environments/environment';
import { JobOffer }            from './job-offers.component';

interface ComparisonRow {
  applicationId: string;
  candidateId:   string;
  name:          string;
  stage:         string;
  totalScore:    number;
  isComplete:    boolean;
  breakdown: {
    technical:   { score: number; weight: number; available: boolean };
    interview:   { score: number; weight: number; available: boolean };
  };
  matchedSkills: string[];
  missingSkills: string[];
}

@Component({
  selector:    'app-job-offer-comparison',
  standalone:  true,
  imports:     [CommonModule, RouterLink],
  templateUrl: './job-offer-comparison.component.html',
  styleUrls:   ['./job-offer-comparison.component.scss'],
})
export class JobOfferComparisonComponent implements OnInit {

  offer: JobOffer | null = null;
  rows:  ComparisonRow[] = [];
  loading = false;
  error   = '';

  private offerId = '';

  constructor(
    private readonly route:  ActivatedRoute,
    private readonly router: Router,
    private readonly http:   HttpClient,
    private readonly cdr:    ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.offerId = this.route.snapshot.paramMap.get('id') ?? '';
    this.loadComparison();
  }

  loadComparison(): void {
    if (!this.offerId) return;
    this.loading = true;
    this.error   = '';

    this.http.get<any>(`${environment.apiUrl}/job-offers/${this.offerId}/comparison`).pipe(
      finalize(() => { this.loading = false; this.cdr.detectChanges(); })
    ).subscribe({
      next: res => {
        this.offer = res.offer;
        this.rows  = (res.applications || []).sort((a: ComparisonRow, b: ComparisonRow) => b.totalScore - a.totalScore);
        this.cdr.detectChanges();
      },
      error: () => { this.error = 'Failed to load comparison data.'; }
    });
  }

  backToJob(): void {
    this.router.navigate(['/job-offers']);
  }

  viewPipeline(): void {
    if (this.offerId) this.router.navigate(['/job-offers', this.offerId, 'pipeline']);
  }

  scoreColor(score: number): string {
    if (score >= 80) return '#22c55e';
    if (score >= 65) return '#6d55fa';
    if (score >= 50) return '#f59e0b';
    return '#f43f5e';
  }

  scoreBg(score: number): string {
    if (score >= 80) return 'rgba(34,197,94,.12)';
    if (score >= 65) return 'rgba(109,85,250,.12)';
    if (score >= 50) return 'rgba(245,158,11,.12)';
    return 'rgba(244,63,94,.1)';
  }

  scoreLabel(score: number): string {
    if (score >= 80) return 'Excellent';
    if (score >= 65) return 'Strong';
    if (score >= 50) return 'Moderate';
    return 'Developing';
  }

  rankEmoji(i: number): string {
    return ['🥇', '🥈', '🥉'][i] ?? '';
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  }

  getStageBg(stage: string): string {
    const map: Record<string, string> = {
      applied: 'rgba(109,85,250,.1)', screening: 'rgba(56,189,248,.1)',
      interview: 'rgba(59,130,246,.1)', assessment: 'rgba(245,158,11,.1)',
      offer: 'rgba(34,197,94,.1)', rejected: 'rgba(244,63,94,.08)',
    };
    return map[stage] ?? 'var(--bg-raised)';
  }

  getStageColor(stage: string): string {
    const map: Record<string, string> = {
      applied: 'var(--accent)', screening: '#38bdf8',
      interview: '#3b82f6', assessment: 'var(--warning)',
      offer: 'var(--success)', rejected: 'var(--danger)',
    };
    return map[stage] ?? 'var(--text-muted)';
  }

  gaugeOffset(score: number): number {
    const r = 36;
    const c = 2 * Math.PI * r;
    return c - (score / 100) * c;
  }
}