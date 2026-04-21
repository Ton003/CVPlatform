import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { EmployeeService } from '../../../core/services/employee.service';

@Component({
  selector: 'app-assessment-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="assessment-overlay" (click)="onClose()">
      <div class="assessment-panel" (click)="$event.stopPropagation()">

        <header class="panel-header">
          <div class="panel-title-group">
            <h2>{{ type === 'employee' ? 'Performance Assessment' : 'Candidate Evaluation' }}</h2>
            <p class="panel-subtitle">Rate each competency from 1 (novice) to 5 (expert)</p>
          </div>
          <button class="close-btn" (click)="onClose()" aria-label="Close panel">&times;</button>
        </header>

        <ng-container *ngIf="assessment; else loadingTpl">
          <div class="panel-body">

            <!-- Meta -->
            <div class="assessment-meta">
              <div class="meta-field">
                <label>Review Cycle</label>
                <input type="text" [(ngModel)]="assessment.cycleLabel" placeholder="e.g. Q2 2026 Review">
              </div>
              <div class="meta-field">
                <label>Overall Notes</label>
                <textarea [(ngModel)]="assessment.notes" rows="2" placeholder="Add general observations..."></textarea>
              </div>
            </div>

            <!-- Progress Bar -->
            <div class="completion-bar">
              <div class="bar-label-row">
                <span class="bar-label">Completion</span>
                <span class="bar-pct">{{ getCompletionRate() }}%</span>
              </div>
              <div class="bar-outer">
                <div class="bar-inner" [style.width.%]="getCompletionRate()"></div>
              </div>
            </div>

            <!-- Competency Items -->
            <div class="competency-list">
              <div class="comp-item" *ngFor="let item of assessment.items"
                   [class.comp-item--rated]="item.level !== null">
                <div class="comp-info">
                  <span class="comp-name">{{ item.competence?.name }}</span>
                  <span class="target-badge">Target: {{ getTargetLevel(item.competenceId) }}</span>
                </div>

                <div class="rating-row">
                  <div class="stars">
                    <button
                      *ngFor="let star of [1,2,3,4,5]"
                      type="button"
                      (click)="item.level = star"
                      [class.active]="item.level !== null && item.level >= star"
                      [attr.aria-label]="'Rate ' + star + ' out of 5'"
                    >★</button>
                  </div>
                  <span class="current-label" *ngIf="item.level !== null">Level {{ item.level }}</span>
                  <span class="current-label unrated" *ngIf="item.level === null">Not rated</span>
                  <button
                    *ngIf="item.level !== null"
                    type="button"
                    class="clear-btn"
                    (click)="item.level = null"
                  >Clear</button>
                </div>

                <input
                  type="text"
                  class="item-notes"
                  [(ngModel)]="item.notes"
                  placeholder="Add specific feedback..."
                >
              </div>
            </div>
          </div>

          <footer class="panel-footer">
            <button class="btn btn-outline" type="button" (click)="saveDraft()" [disabled]="saving">
              {{ saving ? 'Saving...' : 'Save Draft' }}
            </button>
            <button class="btn btn-primary" type="button" (click)="submit()" [disabled]="saving || !isComplete()">
              <span *ngIf="saving" class="spinner-inline"></span>
              Submit Assessment
            </button>
          </footer>
        </ng-container>

        <ng-template #loadingTpl>
          <div class="loading-state">
            <div class="spinner"></div>
            <span>Preparing assessment form...</span>
          </div>
        </ng-template>

      </div>
    </div>
  `,
  styles: [`
    .assessment-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
      z-index: 1000;
      display: flex;
      justify-content: flex-end;
    }

    .assessment-panel {
      width: 520px;
      max-width: 100vw;
      height: 100%;
      background: var(--color-background-primary, #fff);
      border-left: 0.5px solid var(--color-border-tertiary, #e2e8f0);
      display: flex;
      flex-direction: column;
      animation: slideIn 0.25s ease;
    }

    @keyframes slideIn {
      from { transform: translateX(100%); }
      to   { transform: translateX(0); }
    }

    .panel-header {
      padding: 1.5rem;
      border-bottom: 0.5px solid var(--color-border-tertiary, #e2e8f0);
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
      flex-shrink: 0;
    }

    .panel-title-group h2 {
      margin: 0 0 0.25rem;
      font-size: 1.1rem;
      font-weight: 700;
      color: var(--color-text-primary, #1e293b);
    }

    .panel-subtitle {
      margin: 0;
      font-size: 0.82rem;
      color: var(--color-text-secondary, #64748b);
    }

    .close-btn {
      width: 30px;
      height: 30px;
      background: var(--color-background-secondary, #f1f5f9);
      border: none;
      border-radius: 50%;
      font-size: 1.25rem;
      line-height: 1;
      cursor: pointer;
      color: var(--color-text-secondary, #64748b);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.12s;
    }

    .close-btn:hover { background: var(--color-border-tertiary, #e2e8f0); }

    .panel-body {
      flex: 1;
      overflow-y: auto;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .assessment-meta { display: flex; flex-direction: column; gap: 1rem; }

    .meta-field label {
      display: block;
      font-size: 0.78rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-text-secondary, #64748b);
      margin-bottom: 0.4rem;
    }

    .meta-field input,
    .meta-field textarea {
      width: 100%;
      padding: 0.55rem 0.75rem;
      border: 0.5px solid var(--color-border-secondary, #cbd5e1);
      border-radius: 0.5rem;
      font-family: inherit;
      font-size: 0.9rem;
      background: var(--color-background-primary, #fff);
      color: var(--color-text-primary, #1e293b);
      resize: vertical;
      box-sizing: border-box;
      transition: border-color 0.15s;
    }

    .meta-field input:focus,
    .meta-field textarea:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .completion-bar { }

    .bar-label-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.4rem;
    }

    .bar-label {
      font-size: 0.78rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-text-secondary, #64748b);
    }

    .bar-pct {
      font-size: 0.82rem;
      font-weight: 700;
      color: var(--color-text-primary, #1e293b);
    }

    .bar-outer {
      height: 6px;
      background: var(--color-border-tertiary, #e2e8f0);
      border-radius: 3px;
      overflow: hidden;
    }

    .bar-inner {
      height: 100%;
      background: #10b981;
      border-radius: 3px;
      transition: width 0.3s ease;
    }

    .competency-list { display: flex; flex-direction: column; gap: 1rem; }

    .comp-item {
      padding: 1rem 1.1rem;
      background: var(--color-background-secondary, #f8fafc);
      border-radius: 0.75rem;
      border: 0.5px solid var(--color-border-tertiary, #e2e8f0);
      transition: border-color 0.15s;
    }

    .comp-item--rated {
      border-color: #a7f3d0;
      background: #f0fdf4;
    }

    .comp-info {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 0.75rem;
      margin-bottom: 0.75rem;
    }

    .comp-name {
      font-weight: 600;
      font-size: 0.9rem;
      color: var(--color-text-primary, #1e293b);
      flex: 1;
    }

    .target-badge {
      font-size: 0.72rem;
      background: #dbeafe;
      color: #1d4ed8;
      padding: 0.2rem 0.5rem;
      border-radius: 99px;
      white-space: nowrap;
      font-weight: 600;
      flex-shrink: 0;
    }

    .rating-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.75rem;
      flex-wrap: wrap;
    }

    .stars { display: flex; gap: 2px; }

    .stars button {
      background: none;
      border: none;
      font-size: 1.35rem;
      color: var(--color-border-secondary, #cbd5e1);
      cursor: pointer;
      transition: color 0.1s, transform 0.1s;
      padding: 0;
      line-height: 1;
    }

    .stars button:hover { transform: scale(1.15); }
    .stars button.active { color: #f59e0b; }

    .current-label {
      font-size: 0.82rem;
      color: var(--color-text-secondary, #64748b);
      font-weight: 500;
    }

    .current-label.unrated { font-style: italic; }

    .clear-btn {
      background: none;
      border: none;
      font-size: 0.75rem;
      color: #ef4444;
      cursor: pointer;
      text-decoration: underline;
      padding: 0;
      margin-left: auto;
    }

    .item-notes {
      width: 100%;
      padding: 0.5rem 0.625rem;
      border: 0.5px solid var(--color-border-tertiary, #e2e8f0);
      border-radius: 0.375rem;
      font-size: 0.85rem;
      background: var(--color-background-primary, #fff);
      color: var(--color-text-primary, #1e293b);
      box-sizing: border-box;
      font-family: inherit;
      transition: border-color 0.15s;
    }

    .item-notes:focus {
      outline: none;
      border-color: #3b82f6;
    }

    .panel-footer {
      padding: 1.25rem 1.5rem;
      border-top: 0.5px solid var(--color-border-tertiary, #e2e8f0);
      display: flex;
      gap: 0.75rem;
      flex-shrink: 0;
    }

    .btn {
      flex: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      padding: 0.7rem 1rem;
      border-radius: 0.625rem;
      font-weight: 600;
      font-size: 0.9rem;
      cursor: pointer;
      transition: all 0.15s;
    }

    .btn-outline {
      background: var(--color-background-primary, #fff);
      border: 0.5px solid var(--color-border-secondary, #cbd5e1);
      color: var(--color-text-secondary, #64748b);
    }

    .btn-outline:hover { background: var(--color-background-secondary, #f8fafc); }
    .btn-outline:disabled { opacity: 0.4; cursor: not-allowed; }

    .btn-primary {
      background: #2563eb;
      border: none;
      color: #fff;
    }

    .btn-primary:hover { background: #1d4ed8; }
    .btn-primary:disabled { background: #94a3b8; cursor: not-allowed; }

    .loading-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      color: var(--color-text-secondary, #64748b);
      font-size: 0.9rem;
    }

    .spinner {
      width: 28px;
      height: 28px;
      border: 3px solid var(--color-border-tertiary, #e2e8f0);
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .spinner-inline {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255, 255, 255, 0.35);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
  `]
})
export class AssessmentPanelComponent implements OnInit {
  @Input() targetId!: string;
  @Input() type: 'employee' | 'application' = 'employee';
  @Input() requirements: any[] = [];
  @Output() close = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<void>();

  assessment: any = null;
  saving = false;

  constructor(
    private readonly employeeService: EmployeeService,
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.initAssessment();
  }

  // FIX: baseUrl was returning null for 'employee' type — was then used in the
  // application branch without guard. Now only used where type === 'application'.
  private get applicationBaseUrl(): string {
    return `${environment.apiUrl}/applications`;
  }

  initAssessment() {
    if (this.type === 'employee') {
      this.employeeService.getAssessmentHistory(this.targetId).subscribe({
        next: (history) => {
          const draft = history.find((a: any) => a.status === 'DRAFT');
          if (draft) {
            this.loadAssessment(draft.id);
          } else {
            this.createDraft();
          }
        },
        error: () => {
          // Could not load history — start a fresh draft
          this.createDraft();
        }
      });
    } else {
      // FIX: for applications we GET existing assessments first rather than blindly POSTing
      this.http.get<any[]>(`${this.applicationBaseUrl}/${this.targetId}/assessments`).subscribe({
        next: (list) => {
          const draft = list?.find((a: any) => a.status === 'DRAFT');
          if (draft) {
            this.loadAssessment(draft.id);
          } else {
            this.http.post<any>(`${this.applicationBaseUrl}/${this.targetId}/assessments`, {}).subscribe(res => {
              this.loadAssessment(res.id);
            });
          }
        },
        error: () => {
          // No existing drafts — create new
          this.http.post<any>(`${this.applicationBaseUrl}/${this.targetId}/assessments`, {}).subscribe(res => {
            this.loadAssessment(res.id);
          });
        }
      });
    }
  }

  createDraft() {
    this.employeeService.createAssessmentDraft(this.targetId, {}).subscribe({
      next: (res) => this.loadAssessment(res.id),
      error: () => {
        // Fallback: create minimal local assessment so the panel is still usable
        this.assessment = { items: [] };
        this.syncRequirements();
        this.cdr.markForCheck();
      }
    });
  }

  loadAssessment(id: string) {
    const obs = this.type === 'employee'
      ? this.employeeService.getAssessment(id)
      : this.http.get<any>(`${environment.apiUrl}/applications/assessments/${id}`);

    obs.subscribe({
      next: (res) => {
        this.assessment = res;
        this.syncRequirements();
        this.cdr.markForCheck();
      }
    });
  }

  syncRequirements() {
    if (!this.assessment || !this.requirements?.length) return;
    const existingIds = new Set((this.assessment.items ?? []).map((i: any) => i.competenceId));
    for (const req of this.requirements) {
      if (!existingIds.has(req.competenceId)) {
        if (!this.assessment.items) this.assessment.items = [];
        this.assessment.items.push({
          competenceId: req.competenceId,
          competence: req.competence || { name: req.name ?? 'Unknown' },
          level: null,
          notes: ''
        });
      }
    }
  }

  getTargetLevel(compId: string): number {
    return this.requirements.find(r => r.competenceId === compId)?.requiredLevel ?? 0;
  }

  getCompletionRate(): number {
    if (!this.assessment?.items?.length) return 0;
    const assessed = this.assessment.items.filter((i: any) => i.level !== null).length;
    return Math.round((assessed / this.assessment.items.length) * 100);
  }

  isComplete(): boolean {
    return this.getCompletionRate() === 100;
  }

  private buildItemsPayload() {
    return (this.assessment.items ?? []).map((i: any) => ({
      competenceId: i.competenceId,
      level: i.level,
      notes: i.notes
    }));
  }

  saveDraft() {
    if (!this.assessment) return;
    this.saving = true;
    this.cdr.markForCheck();

    const items = this.buildItemsPayload();
    const obs = this.type === 'employee'
      ? this.employeeService.updateAssessmentItems(this.assessment.id, items)
      : this.http.patch(`${environment.apiUrl}/applications/assessments/${this.assessment.id}/items`, items);

    obs.subscribe({
      next: () => { this.saving = false; this.cdr.markForCheck(); },
      error: () => { this.saving = false; this.cdr.markForCheck(); }
    });
  }

  submit() {
    if (!this.assessment) return;
    this.saving = true;
    this.cdr.markForCheck();

    const items = this.buildItemsPayload();

    const patchObs = this.type === 'employee'
      ? this.employeeService.updateAssessmentItems(this.assessment.id, items)
      : this.http.patch(`${environment.apiUrl}/applications/assessments/${this.assessment.id}/items`, items);

    patchObs.subscribe({
      next: () => {
        const submitObs = this.type === 'employee'
          ? this.employeeService.submitAssessment(this.assessment.id)
          : this.http.post(`${environment.apiUrl}/applications/assessments/${this.assessment.id}/submit`, {});

        submitObs.subscribe({
          next: () => {
            this.saving = false;
            this.submitted.emit();
            this.close.emit();
          },
          error: () => { this.saving = false; this.cdr.markForCheck(); }
        });
      },
      error: () => { this.saving = false; this.cdr.markForCheck(); }
    });
  }

  onClose() {
    this.close.emit();
  }
}