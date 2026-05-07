import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { EmployeeService } from '../../../core/services/employee.service';
import { ConfirmModalComponent } from '../../../shared/confirm-modal/confirm-modal.component';

@Component({
  selector: 'app-assessment-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmModalComponent],
  template: `
    <div class="assessment-overlay" (click)="onClose()">
      <div class="assessment-panel card" (click)="$event.stopPropagation()">
 
        <header class="panel-header">
          <div class="panel-title-group">
            <h2>{{ type === 'employee' ? 'Performance Assessment' : 'Candidate Evaluation' }}</h2>
            <p class="panel-subtitle">Rate each competency from 1 (novice) to 5 (expert)</p>
          </div>
          <button class="modal-close" (click)="onClose()" aria-label="Close panel">&times;</button>
        </header>
 
        <ng-container *ngIf="assessment; else loadingTpl">
          <div class="panel-body">
 
            <!-- Meta -->
            <div class="assessment-meta">
              <div class="meta-field">
                <label>Review Cycle</label>
                <input type="text" class="field-input" [(ngModel)]="assessment.cycleLabel" placeholder="e.g. Q2 2026 Review">
              </div>
              <div class="meta-field">
                <label>Overall Notes</label>
                <textarea class="field-textarea" [(ngModel)]="assessment.notes" rows="2" placeholder="Add general observations..."></textarea>
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
                  <span class="meta-chip">Target: {{ getTargetLevel(item.competenceId) }}</span>
                </div>
 
                <div class="rating-row">
                  <div class="stars">
                    <button
                      *ngFor="let star of [1,2,3,4,5]"
                      type="button"
                      (click)="item.level = star"
                      [class.active]="item.level !== null && item.level >= star"
                      [attr.aria-label]="'Rate ' + star + ' out of 5'"
                      [title]="getLevelDescription(star)"
                    >★</button>
                  </div>
                  <div class="rating-meta">
                    <span class="current-label" *ngIf="item.level !== null">Level {{ item.level }}: {{ getLevelLabel(item.level) }}</span>
                    <span class="current-label unrated" *ngIf="item.level === null">Not rated</span>
                    <p class="level-hint" *ngIf="item.level !== null">{{ getLevelDescription(item.level) }}</p>
                  </div>
                  <button
                    *ngIf="item.level !== null"
                    type="button"
                    class="clear-btn"
                    (click)="item.level = null"
                  >Clear</button>
                </div>
 
                <input
                  type="text"
                  class="field-input"
                  [(ngModel)]="item.notes"
                  placeholder="Add specific feedback..."
                >
              </div>
            </div>
          </div>
 
          <footer class="panel-footer">
            <button class="btn-action btn-action--outline" type="button" (click)="saveDraft()" [disabled]="saving">
              {{ saving ? 'Saving...' : 'Save Draft' }}
            </button>
            <button *ngIf="assessment.id" class="btn-action btn-action--danger" type="button" (click)="deleteDraft()" [disabled]="saving">
              Delete Draft
            </button>
            <button class="btn-action btn-action--primary" type="button" (click)="submit()" [disabled]="saving || !isComplete()">
              <span *ngIf="saving" class="spinner-sm"></span>
              Submit Assessment
            </button>
          </footer>
        </ng-container>
 
        <ng-template #loadingTpl>
          <div class="state-center">
            <div class="loader-ring"></div>
            <span>Preparing assessment form...</span>
          </div>
        </ng-template>
 
      </div>
    </div>

    <!-- ── Confirmation Modal ── -->
    <app-confirm-modal
      [open]="confirmModal.isOpen"
      [title]="confirmModal.title"
      [message]="confirmModal.message"
      [confirmText]="confirmModal.confirmText"
      [isDanger]="confirmModal.isDanger"
      (confirmed)="onConfirmModal()"
      (cancelled)="onCancelModal()"
    ></app-confirm-modal>
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
      border-radius: 0 !important;
      border-left: 1px solid var(--border-default) !important;
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
      border-bottom: 1px solid var(--border-subtle);
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
      color: var(--text-primary);
    }
 
    .panel-subtitle {
      margin: 0;
      font-size: 0.82rem;
      color: var(--text-muted);
    }
 
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
      font-size: 0.7rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 0.4rem;
    }
 
    .completion-bar { }
 
    .bar-label-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.4rem;
    }
 
    .bar-label {
      font-size: 0.7rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
    }
 
    .bar-pct {
      font-size: 0.82rem;
      font-weight: 800;
      color: var(--text-primary);
    }
 
    .bar-outer {
      height: 6px;
      background: var(--bg-raised);
      border-radius: 3px;
      overflow: hidden;
    }
 
    .bar-inner {
      height: 100%;
      background: var(--success);
      border-radius: 3px;
      transition: width 0.3s ease;
    }
 
    .competency-list { display: flex; flex-direction: column; gap: 1rem; }
 
    .comp-item {
      padding: 1.15rem;
      background: var(--bg-raised);
      border-radius: var(--radius-lg);
      border: 1px solid var(--border-subtle);
      transition: border-color 0.15s;
    }
 
    .comp-item--rated {
      border-color: var(--success-dim);
      background: var(--bg-surface);
    }
 
    .comp-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }
 
    .comp-name {
      font-weight: 700;
      font-size: 0.9rem;
      color: var(--text-primary);
      flex: 1;
    }
 
    .rating-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1rem;
      flex-wrap: wrap;
    }
 
    .stars { display: flex; gap: 2px; }
 
    .stars button {
      background: none;
      border: none;
      font-size: 1.35rem;
      color: var(--border-default);
      cursor: pointer;
      transition: color 0.1s, transform 0.1s;
      padding: 0;
      line-height: 1;
    }
 
    .stars button:hover { transform: scale(1.2); }
    .stars button.active { color: #f59e0b; }
 
    .current-label {
      font-size: .82rem;
      color: var(--text-muted);
      font-weight: 600;
    }
 
    .current-label.unrated { font-style: italic; opacity: .7; }
 
    .clear-btn {
      background: none;
      border: none;
      font-size: 0.75rem;
      color: var(--danger);
      cursor: pointer;
      text-decoration: underline;
      padding: 0;
      margin-left: auto;
      font-weight: 600;
    }
 
    .panel-footer {
      padding: 1.25rem 1.5rem;
      border-top: 1px solid var(--border-subtle);
      display: flex;
      gap: 0.75rem;
      flex-shrink: 0;
    }
 
    .btn-action--danger {
      background: var(--danger);
      color: white;
      border: 1px solid var(--danger);
    }
    .btn-action--danger:hover {
      background: var(--danger-hover, #dc2626);
    }
    .btn-action--danger:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .rating-meta {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .level-hint {
      margin: 0;
      font-size: 0.75rem;
      color: var(--text-muted);
      font-style: italic;
      line-height: 1.4;
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

  // Modern Confirmation Modal
  confirmModal = {
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    isDanger: true,
    action: null as (() => void) | null
  };

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
    const obs: Observable<any> = this.type === 'employee'
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
    const obs: Observable<any> = this.type === 'employee'
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

    const patchObs: Observable<any> = this.type === 'employee'
      ? this.employeeService.updateAssessmentItems(this.assessment.id, items)
      : this.http.patch(`${environment.apiUrl}/applications/assessments/${this.assessment.id}/items`, items);

    patchObs.subscribe({
      next: () => {
        const submitObs: Observable<any> = this.type === 'employee'
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

  deleteDraft() {
    if (!this.assessment?.id) return;
    this.confirmModal = {
      isOpen: true,
      title: 'Delete Draft',
      message: 'Are you sure you want to delete this assessment draft? All current ratings will be lost.',
      confirmText: 'Delete Draft',
      isDanger: true,
      action: () => {
        this.saving = true;
        this.cdr.markForCheck();

        const obs: Observable<any> = this.type === 'employee'
          ? this.employeeService.deleteAssessment(this.assessment.id)
          : this.http.delete(`${environment.apiUrl}/applications/assessments/${this.assessment.id}`);

        obs.subscribe({
          next: () => {
            this.saving = false;
            this.assessment = null;
            this.close.emit();
            this.cdr.markForCheck();
          },
          error: () => {
            this.saving = false;
            this.cdr.markForCheck();
          }
        });
      }
    };
    this.cdr.markForCheck();
  }

  onConfirmModal(): void {
    if (this.confirmModal.action) {
      this.confirmModal.action();
    }
    this.confirmModal.isOpen = false;
    this.cdr.detectChanges();
  }

  onCancelModal(): void {
    this.confirmModal.isOpen = false;
    this.confirmModal.action = null;
    this.cdr.detectChanges();
  }

  getLevelLabel(level: number): string {
    const labels: Record<number, string> = {
      1: 'Follow',
      2: 'Assist',
      3: 'Apply',
      4: 'Enable',
      5: 'Ensure, Advise'
    };
    return labels[level] || '';
  }

  getLevelDescription(level: number): string {
    const desc: Record<number, string> = {
      1: 'Works under close supervision. Uses little discretion. Is expected to seek guidance in unexpected situations.',
      2: 'Works under routine supervision. Uses minor discretion in resolving problems or enquiries. Works without frequent reference to others.',
      3: 'Works under general supervision. Uses discretion in identifying and resolving complex problems and assignments. Usually receives specific instructions.',
      4: 'Works under general direction within a clear framework of accountability. Exercises substantial personal responsibility and autonomy. Plans own work.',
      5: 'Works under broad direction. Is fully accountable for own work and/or project/managerial responsibilities. Receives assignments in the form of objectives.'
    };
    return desc[level] || '';
  }

  onClose() {
    this.close.emit();
  }
}