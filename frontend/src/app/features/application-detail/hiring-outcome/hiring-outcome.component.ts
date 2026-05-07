import { Component, Input, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

export interface HiringOutcome {
  id: string;
  applicationId: string;
  outcome: 'hired' | 'rejected' | 'withdrew' | 'offer_declined';
  rejectionReason?: string;
  performanceRating?: number;
  performanceNotes?: string;
  recordedAt: string;
}

@Component({
  selector: 'app-hiring-outcome',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="card outcome-card" *ngIf="outcome || isTerminal">
      <div class="card-head">
        <span class="card-label">Final Hiring Outcome</span>
        <span class="outcome-badge" *ngIf="outcome" [attr.data-outcome]="outcome.outcome">
          {{ outcome.outcome.replace('_', ' ') | titlecase }}
        </span>
      </div>

      <!-- Form if no outcome recorded yet but in terminal stage -->
      <div class="outcome-form" *ngIf="!outcome && isTerminal">
        <p class="form-hint">Record the final decision for this application.</p>
        <div class="form-group">
          <label>Outcome</label>
          <select [(ngModel)]="form.outcome" class="field-select">
            <option value="hired">Hired</option>
            <option value="rejected">Rejected</option>
            <option value="withdrew">Candidate Withdrew</option>
            <option value="offer_declined">Offer Declined</option>
          </select>
        </div>
        <div class="form-group" *ngIf="form.outcome === 'rejected'">
          <label>Rejection Reason</label>
          <select [(ngModel)]="form.rejectionReason" class="field-select">
            <option value="Technical Skills">Lack of Technical Skills</option>
            <option value="Cultural Fit">Cultural Fit</option>
            <option value="Salary Expectation">Salary Expectation</option>
            <option value="Experience">Insufficient Experience</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <button class="btn-primary btn-sm" (click)="saveOutcome()" [disabled]="saving">
          {{ saving ? 'Saving...' : 'Record Outcome' }}
        </button>
      </div>

      <!-- Display recorded outcome -->
      <div class="outcome-display" *ngIf="outcome">
        <div class="display-row">
          <span class="lbl">Recorded On</span>
          <span class="val">{{ outcome.recordedAt | date:'MMM d, yyyy' }}</span>
        </div>
        <div class="display-row" *ngIf="outcome.rejectionReason">
          <span class="lbl">Reason</span>
          <span class="val">{{ outcome.rejectionReason }}</span>
        </div>

        <!-- Post-hire Performance Loop -->
        <div class="performance-loop" *ngIf="outcome.outcome === 'hired'">
          <div class="perf-divider"></div>
          <p class="perf-title">6-Month Quality of Hire</p>
          
          <div *ngIf="!outcome.performanceRating" class="perf-empty">
            <p>Waiting for post-hire performance review...</p>
            <button class="btn-outline btn-xs" (click)="showPerfForm = true" *ngIf="!showPerfForm">Rate Performance</button>
          </div>

          <div *ngIf="showPerfForm && !outcome.performanceRating" class="perf-form">
            <div class="star-row">
              <button *ngFor="let s of [1,2,3,4,5]" class="star-btn" 
                [class.lit]="s <= perfForm.rating" (click)="perfForm.rating = s">★</button>
            </div>
            <textarea [(ngModel)]="perfForm.notes" placeholder="How is the employee performing?"></textarea>
            <div class="perf-actions">
              <button class="btn-ghost btn-xs" (click)="showPerfForm = false">Cancel</button>
              <button class="btn-primary btn-xs" (click)="savePerformance()" [disabled]="savingPerf || !perfForm.rating">Save</button>
            </div>
          </div>

          <div *ngIf="outcome.performanceRating" class="perf-result">
            <div class="star-row">
              <span *ngFor="let s of [1,2,3,4,5]" class="star-read" [class.lit]="s <= outcome.performanceRating">★</span>
            </div>
            <p class="perf-notes" *ngIf="outcome.performanceNotes">{{ outcome.performanceNotes }}</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .outcome-card {
      margin-top: 1rem;
      border-left: 4px solid var(--border-subtle);
    }
    .outcome-badge {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 10px;
      text-transform: uppercase;
      &[data-outcome="hired"] { background: var(--success-bg); color: var(--success); }
      &[data-outcome="rejected"] { background: var(--danger-bg); color: var(--danger); }
      &[data-outcome="withdrew"], &[data-outcome="offer_declined"] { background: var(--bg-muted); color: var(--text-secondary); }
    }
    .outcome-form, .outcome-display { padding-top: 0.5rem; }
    .form-hint { font-size: 11px; color: var(--text-secondary); margin-bottom: 0.75rem; }
    .form-group { margin-bottom: 0.75rem; label { display: block; font-size: 11px; font-weight: 600; margin-bottom: 4px; } }
    .display-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px; 
      .lbl { color: var(--text-secondary); } .val { font-weight: 600; }
    }
    .performance-loop { margin-top: 1rem; }
    .perf-divider { height: 1px; background: var(--border-subtle); margin-bottom: 1rem; }
    .perf-title { font-size: 11px; font-weight: 700; color: var(--primary); text-transform: uppercase; margin-bottom: 0.5rem; }
    .perf-empty { font-size: 11px; color: var(--text-muted); display: flex; align-items: center; justify-content: space-between; }
    .star-row { display: flex; gap: 4px; margin-bottom: 0.5rem; }
    .star-btn, .star-read { font-size: 18px; color: var(--border-subtle); background: none; border: none; cursor: pointer; padding: 0; }
    .star-btn.lit, .star-read.lit { color: #facc15; }
    .perf-form textarea { width: 100%; border: 1px solid var(--border-subtle); border-radius: 4px; padding: 6px; font-size: 11px; min-height: 50px; margin-bottom: 0.5rem; }
    .perf-actions { display: flex; justify-content: flex-end; gap: 8px; }
    .perf-notes { font-size: 12px; color: var(--text-primary); font-style: italic; margin-top: 4px; }
    .btn-xs { padding: 2px 8px; font-size: 10px; }
  `]
})
export class HiringOutcomeComponent implements OnInit {
  @Input() applicationId = '';
  @Input() stage = '';

  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);

  outcome: HiringOutcome | null = null;
  loading = true;
  saving = false;
  showPerfForm = false;
  savingPerf = false;

  form = { outcome: 'hired', rejectionReason: 'Technical Skills' };
  perfForm = { rating: 0, notes: '' };

  get isTerminal(): boolean {
    return ['hired', 'rejected', 'offer_declined', 'withdrew'].includes(this.stage);
  }

  ngOnInit(): void {
    this.loadOutcome();
  }

  loadOutcome(): void {
    this.http.get<HiringOutcome>(`${environment.apiUrl}/applications/${this.applicationId}/outcome`)
      .subscribe({
        next: (o) => { this.outcome = o; this.loading = false; this.cdr.detectChanges(); },
        error: () => { this.loading = false; this.cdr.detectChanges(); }
      });
  }

  saveOutcome(): void {
    this.saving = true;
    this.http.post<HiringOutcome>(`${environment.apiUrl}/applications/${this.applicationId}/outcome`, this.form)
      .subscribe({
        next: (o) => { this.outcome = o; this.saving = false; this.cdr.detectChanges(); },
        error: () => { this.saving = false; this.cdr.detectChanges(); }
      });
  }

  savePerformance(): void {
    this.savingPerf = true;
    this.http.patch<HiringOutcome>(`${environment.apiUrl}/applications/${this.applicationId}/outcome/performance`, {
      performanceRating: this.perfForm.rating,
      performanceNotes: this.perfForm.notes
    }).subscribe({
      next: (o) => { this.outcome = o; this.savingPerf = false; this.showPerfForm = false; this.cdr.detectChanges(); },
      error: () => { this.savingPerf = false; this.cdr.detectChanges(); }
    });
  }
}
