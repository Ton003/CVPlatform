import { Component, Input, OnInit, Output, EventEmitter, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

export interface VerdictStrength {
  competenceId: string; sfiaCode: string; sfiaName: string;
  evaluatedLevel: number; requiredLevel: number; delta: number; reason: string;
}
export interface VerdictGap {
  competenceId: string; sfiaCode: string; sfiaName: string;
  evaluatedLevel: number | null; requiredLevel: number;
  delta: number; impact: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'; reason: string;
}
export interface RiskFlag { code: string; severity: 'HIGH' | 'MEDIUM' | 'LOW'; message: string; }
export interface ApplicationVerdict {
  id: string; applicationId: string;
  matchScore: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  recommendation: 'ADVANCE' | 'INTERVIEW' | 'HOLD' | 'REJECT' | 'INSUFFICIENT_DATA';
  strengths: VerdictStrength[];
  gaps: VerdictGap[];
  riskFlags: RiskFlag[];
  scoreBreakdown: {
    competency: number | null; interview: number | null;
    experience: number | null; final: number;
    weights: { competency: number; interview: number; experience: number };
  };
  ratedCompetencies: number;
  totalCompetencies: number;
  computedAt: string;
}

import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-ai-verdict-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ai-verdict-panel.component.html',
  styleUrls: ['./ai-verdict-panel.component.scss'],
})
export class AiVerdictPanelComponent implements OnInit {
  @Input() applicationId = '';
  @Output() verdictLoaded = new EventEmitter<ApplicationVerdict>();

  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);

  verdict: ApplicationVerdict | null = null;
  loading = true;
  refreshing = false;
  error = '';

  // Expand/collapse state
  strengthsOpen = true;
  gapsOpen = true;
  risksOpen = true;
  breakdownOpen = false;

  // Feedback
  feedbackSent = false;
  feedbackSending = false;
  showReasonInput = false;
  disagreementReason = '';

  ngOnInit(): void {
    this.loadVerdict();
  }

  loadVerdict(): void {
    this.loading = true;
    this.error = '';
    this.http.get<ApplicationVerdict>(`${environment.apiUrl}/applications/${this.applicationId}/verdict`)
      .subscribe({
        next: (v) => {
          this.verdict = v;
          this.loading = false;
          this.verdictLoaded.emit(v);
          this.cdr.detectChanges();
        },
        error: () => {
          this.error = 'Could not load verdict.';
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
  }

  refresh(): void {
    if (this.refreshing) return;
    this.refreshing = true;
    this.http.post<ApplicationVerdict>(`${environment.apiUrl}/applications/${this.applicationId}/verdict/refresh`, {})
      .subscribe({
        next: (v) => {
          this.verdict = v;
          this.refreshing = false;
          this.verdictLoaded.emit(v);
          this.cdr.detectChanges();
        },
        error: () => { this.refreshing = false; this.cdr.detectChanges(); }
      });
  }

  onFeedbackClick(agreed: boolean): void {
    if (agreed) {
      this.sendFeedback(true);
    } else {
      this.showReasonInput = true;
      this.cdr.detectChanges();
    }
  }

  sendFeedback(agreed: boolean): void {
    if (this.feedbackSending || this.feedbackSent) return;
    
    if (!agreed && this.showReasonInput && !this.disagreementReason.trim()) {
      // Could add a toast here
      return;
    }

    this.feedbackSending = true;
    this.http.post(`${environment.apiUrl}/applications/${this.applicationId}/verdict/feedback`, {
      agreed,
      overrideReason: !agreed ? this.disagreementReason : null,
      qualityRating: agreed ? 5 : 2
    }).subscribe({
      next: () => { 
        this.feedbackSent = true; 
        this.feedbackSending = false; 
        this.showReasonInput = false;
        this.cdr.detectChanges(); 
      },
      error: () => { this.feedbackSending = false; this.cdr.detectChanges(); }
    });
  }

  // ── Display helpers ──────────────────────────────────────────────

  get recommendationConfig(): { label: string; icon: string; cls: string; desc: string } {
    const map: Record<string, any> = {
      ADVANCE:          { label: 'Advance to Next Stage', icon: '✅', cls: 'rec--advance', desc: 'Strong candidate — move forward in pipeline.' },
      INTERVIEW:        { label: 'Schedule Interview',    icon: '💬', cls: 'rec--interview', desc: 'Promising profile — validate with a structured interview.' },
      HOLD:             { label: 'Place on Hold',         icon: '⏸️', cls: 'rec--hold',    desc: 'Borderline fit — gather more information before deciding.' },
      REJECT:           { label: 'Not Recommended',       icon: '❌', cls: 'rec--reject',  desc: 'Significant gaps detected for this role.' },
      INSUFFICIENT_DATA:{ label: 'More Data Needed',      icon: '🔍', cls: 'rec--unknown', desc: 'Complete the competency evaluation to unlock a verdict.' },
    };
    return map[this.verdict?.recommendation ?? 'INSUFFICIENT_DATA'];
  }

  get confidenceConfig(): { label: string; cls: string } {
    const map: Record<string, any> = {
      HIGH:   { label: 'High Confidence',   cls: 'conf--high'   },
      MEDIUM: { label: 'Medium Confidence', cls: 'conf--medium' },
      LOW:    { label: 'Low Confidence',    cls: 'conf--low'    },
    };
    return map[this.verdict?.confidence ?? 'LOW'];
  }

  get coveragePct(): number {
    if (!this.verdict || !this.verdict.totalCompetencies) return 0;
    return Math.round((this.verdict.ratedCompetencies / this.verdict.totalCompetencies) * 100);
  }

  impactConfig(impact: string): { cls: string; label: string } {
    const map: Record<string, any> = {
      CRITICAL: { cls: 'impact--critical', label: 'Critical' },
      HIGH:     { cls: 'impact--high',     label: 'High'     },
      MEDIUM:   { cls: 'impact--medium',   label: 'Medium'   },
      LOW:      { cls: 'impact--low',      label: 'Low'      },
    };
    return map[impact] ?? map['MEDIUM'];
  }

  riskSeverityIcon(severity: string): string {
    return severity === 'HIGH' ? '🚩' : severity === 'MEDIUM' ? '⚠️' : 'ℹ️';
  }

  formatWeight(w: number): string {
    return `${Math.round(w * 100)}%`;
  }

  scoreColor(score: number | null): string {
    if (score === null) return 'var(--text-muted)';
    if (score >= 78) return 'var(--success)';
    if (score >= 60) return '#8b5cf6';
    if (score >= 45) return 'var(--warning)';
    return 'var(--danger)';
  }

  gaugeOffset(score: number): number {
    const clamped = Math.min(100, Math.max(0, score));
    return 226 - (clamped / 100) * 226;
  }

  timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }
}
