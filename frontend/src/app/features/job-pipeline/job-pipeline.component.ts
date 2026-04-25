import {
  Component,
  OnInit,
  ChangeDetectorRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { finalize } from 'rxjs/operators';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ToastService } from '../../core/services/toast.service';
import { EmployeeService, PromotionResult } from '../../core/services/employee.service';

export type PipelineStage =
  | 'applied'
  | 'screening'
  | 'interview'
  | 'assessment'
  | 'offer'
  | 'rejected';

/** Canonical forward order used for backward-move detection. */
const STAGE_ORDER: PipelineStage[] = [
  'applied', 'screening', 'interview', 'assessment', 'offer', 'rejected',
];

function isBackwardMove(from: PipelineStage, to: PipelineStage): boolean {
  const fromIdx = STAGE_ORDER.indexOf(from);
  const toIdx   = STAGE_ORDER.indexOf(to);
  // Both must be in the ordered list and target must be strictly earlier
  return fromIdx !== -1 && toIdx !== -1 && toIdx < fromIdx;
}

export interface ApplicationCard {
  applicationId: string;
  candidateId: string;
  candidateName: string;
  currentTitle: string;
  yearsOfExperience: number | null;
  skills: string[];
  compositeScore: number | null;
  scoreLabel: string | null;
  daysInStage: number;
  stage: PipelineStage;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface JobDetail {
  id: string;
  title: string;
  status: string;
  location?: string;
  department?: string;
}

export interface StageColumn {
  id: PipelineStage;
  label: string;
  color: string;
  accent: string;
  icon: string;
  cards: ApplicationCard[];
  dragOver: boolean;
}

import { CvUploadComponent } from '../cv-upload/cv-upload.component';

@Component({
  selector: 'app-job-pipeline',
  standalone: true,
  imports: [CommonModule, FormsModule, CvUploadComponent],
  templateUrl: './job-pipeline.component.html',
  styleUrls: ['./job-pipeline.component.scss'],
})
export class JobPipelineComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private toast = inject(ToastService);
  private employeeService = inject(EmployeeService);

  jobId = '';
  job: JobDetail | null = null;
  loading = true;
  error = '';

  draggingCard: ApplicationCard | null = null;
  draggingFromStage: PipelineStage | null = null;
  updatingCardId: string | null = null;

  showAddCandidateModal = false;
  searchQuery = '';
  searchResults: any[] = [];
  isSearching = false;
  activeModalTab: 'search' | 'upload' = 'search';

  selectedApplicationId: string | null = null;
  selectedApplicationDetails: any = null;
  selectedNotes: any[] = [];
  selectedInterviews: any[] = [];
  sidePanelLoading = false;

  // Promotion Lifecycle
  showPromoteModal = false;
  promoting = false;
  managers: any[] = [];
  lastPromotionSource: 'manual' | 'ai_estimate' | null = null;
  promotePayload = {
    employeeId: '',
    hireDate: new Date().toISOString().split('T')[0],
    managerId: ''
  };

  columns: StageColumn[] = [
    { id: 'applied', label: 'Applied', color: '#6d55fa', accent: 'var(--accent)', icon: '📥', cards: [], dragOver: false },
    { id: 'screening', label: 'Screening', color: '#9b4dfa', accent: 'var(--purple)', icon: '🔍', cards: [], dragOver: false },
    { id: 'interview', label: 'Interview', color: '#3b82f6', accent: '#3b82f6', icon: '🎙️', cards: [], dragOver: false },
    { id: 'assessment', label: 'Assessment', color: '#f59e0b', accent: 'var(--warning)', icon: '📊', cards: [], dragOver: false },
    { id: 'offer', label: 'Offer', color: '#22c55e', accent: 'var(--success)', icon: '🎉', cards: [], dragOver: false },
    { id: 'rejected', label: 'Rejected', color: '#f43f5e', accent: 'var(--danger)', icon: '✕', cards: [], dragOver: false },
  ];

  get totalCandidates(): number {
    return this.columns.reduce((sum, col) => sum + col.cards.length, 0);
  }

  ngOnInit(): void {
    this.jobId = this.route.snapshot.paramMap.get('id') || '';
    this.loadJob();
    this.loadApplications();
  }

  loadJob(): void {
    this.http
      .get<JobDetail>(`${environment.apiUrl}/job-offers/${this.jobId}`)
      .subscribe({
        next: (job) => {
          this.job = job;
          this.cdr.detectChanges();
        },
        error: () => {
          // Non-fatal — pipeline still works without job detail
        },
      });
  }

  loadApplications(): void {
    this.loading = true;
    this.http
      .get<any>(`${environment.apiUrl}/applications?jobId=${this.jobId}`)
      .pipe(finalize(() => { this.loading = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: (res) => {
          const apps = Array.isArray(res) ? res : (res.data ?? []);
          this.columns.forEach((col) => (col.cards = []));
          apps.forEach((app: any) => {
            const card = this.mapToCard(app);
            const col = this.columns.find((c) => c.id === card.stage);
            if (col) col.cards.push(card);
          });
          this.cdr.detectChanges();
        },
        error: () => {
          this.error = 'Failed to load pipeline. Please try again.';
          this.cdr.detectChanges();
        },
      });
  }

  loadApplicationDetails(appId: string): void {
    this.sidePanelLoading = true;
    this.selectedNotes = [];
    this.selectedInterviews = [];

    forkJoin({
      details: this.http.get<any>(`${environment.apiUrl}/applications/${appId}`).pipe(catchError(() => of(null))),
      notes: this.http.get<any[]>(`${environment.apiUrl}/applications/${appId}/notes`).pipe(catchError(() => of([]))),
      interviews: this.http.get<any[]>(`${environment.apiUrl}/applications/${appId}/interviews`).pipe(catchError(() => of([]))),
    })
      .pipe(finalize(() => { this.sidePanelLoading = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: ({ details, notes, interviews }) => {
          if (!details) {
            this.toast.error('Failed to load application details.');
            this.closeSidePanel();
            return;
          }
          const updated = new Date(details.updatedAt);
          const now = new Date();
          details.daysInStage = Math.floor(
            (now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24)
          );
          this.selectedApplicationDetails = details;
          this.selectedNotes = notes ?? [];
          this.selectedInterviews = interviews ?? [];
        },
      });
  }

  mapToCard(app: any): ApplicationCard {
    const updated = new Date(app.updatedAt);
    const now = new Date();
    const daysInStage = Math.floor(
      (now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      applicationId: app.applicationId || app.id,
      candidateId: app.candidateId,
      candidateName: app.candidateName || 'Unknown',
      currentTitle: app.currentTitle || '',
      yearsOfExperience: app.yearsExp != null ? Number(app.yearsExp) : null,
      skills: (app.skills || []).slice(0, 3),
      compositeScore: app.compositeScore ?? null,
      scoreLabel: app.scoreLabel ?? null,
      daysInStage,
      stage: app.stage as PipelineStage,
      source: app.source || '',
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
    };
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  getScoreClass(score: number | null): string {
    if (score === null) return 'score--none';
    if (score >= 80) return 'score--high';
    if (score >= 60) return 'score--mid';
    return 'score--low';
  }

  formatSource(source: string): string {
    return source.replace(/_/g, ' ');
  }

  onDragStart(event: DragEvent, card: ApplicationCard, fromStage: PipelineStage): void {
    this.draggingCard = card;
    this.draggingFromStage = fromStage;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', card.applicationId);
    }
  }

  onDragEnd(): void {
    this.draggingCard = null;
    this.draggingFromStage = null;
    this.columns.forEach((col) => (col.dragOver = false));
    this.cdr.detectChanges();
  }

  onDragOver(event: DragEvent, col: StageColumn): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    if (!col.dragOver) {
      col.dragOver = true;
      this.cdr.detectChanges();
    }
  }

  onDragLeave(col: StageColumn): void {
    col.dragOver = false;
    this.cdr.detectChanges();
  }

  onDrop(event: DragEvent, targetCol: StageColumn): void {
    event.preventDefault();
    targetCol.dragOver = false;

    if (!this.draggingCard || !this.draggingFromStage) return;
    if (this.draggingFromStage === targetCol.id) {
      this.cdr.detectChanges();
      return;
    }

    const card      = this.draggingCard;
    const fromStage = this.draggingFromStage;

    // ✅ FIX 3: Soft confirmation for backward moves
    if (isBackwardMove(fromStage, targetCol.id)) {
      const confirmed = window.confirm(
        `⚠️ You are moving "${card.candidateName}" backwards from ` +
        `"${fromStage.toUpperCase()}" to "${targetCol.label.toUpperCase()}".\n\n` +
        `This will revert their pipeline progress. Are you sure?`
      );
      if (!confirmed) {
        this.draggingCard = null;
        this.draggingFromStage = null;
        this.cdr.detectChanges();
        return;
      }
    }

    const fromCol = this.columns.find((c) => c.id === fromStage);
    if (fromCol) {
      fromCol.cards = fromCol.cards.filter(
        (c) => c.applicationId !== card.applicationId
      );
    }
    card.stage = targetCol.id;
    card.daysInStage = 0;
    targetCol.cards.push(card);

    this.draggingCard = null;
    this.draggingFromStage = null;
    this.updatingCardId = card.applicationId;
    this.cdr.detectChanges();

    this.http
      .patch(`${environment.apiUrl}/applications/${card.applicationId}/stage`, {
        stage: targetCol.id,
      })
      .pipe(finalize(() => { this.updatingCardId = null; this.cdr.detectChanges(); }))
      .subscribe({
        next: () => {
          this.toast.success(`Moved to ${targetCol.label}`);
          this.loadApplications();
        },
        error: () => {
          targetCol.cards = targetCol.cards.filter(
            (c) => c.applicationId !== card.applicationId
          );
          card.stage = fromStage;
          const rollbackCol = this.columns.find((c) => c.id === fromStage);
          if (rollbackCol) rollbackCol.cards.push(card);
          this.toast.error('Failed to update stage. Change reverted.');
          this.cdr.detectChanges();
        },
      });
  }

  openApplication(cardId: string): void {
    this.selectedApplicationId = cardId;
    this.selectedApplicationDetails = null;
    this.loadApplicationDetails(cardId);
  }

  closeSidePanel(): void {
    this.selectedApplicationId = null;
    this.selectedApplicationDetails = null;
    this.selectedNotes = [];
    this.selectedInterviews = [];
    this.sidePanelLoading = false;
  }

  goToFullProfile(): void {
    if (this.selectedApplicationId) {
      window.open(`/applications/${this.selectedApplicationId}`, '_blank');
    }
  }

  updateStageFromPanel(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const newStage = select.value as PipelineStage;
    if (!this.selectedApplicationId || !this.selectedApplicationDetails) return;
    if (newStage === this.selectedApplicationDetails.stage) return;

    const oldStage = this.selectedApplicationDetails.stage as PipelineStage;

    // ✅ FIX 3: Soft confirmation for backward moves via side panel
    if (isBackwardMove(oldStage, newStage)) {
      const candidateName = this.selectedApplicationDetails.candidateName ?? 'this candidate';
      const confirmed = window.confirm(
        `⚠️ You are moving "${candidateName}" backwards from ` +
        `"${oldStage.toUpperCase()}" to "${newStage.toUpperCase()}".\n\n` +
        `This will revert their pipeline progress. Are you sure?`
      );
      if (!confirmed) {
        // Reset the select element back to its previous value
        select.value = oldStage;
        return;
      }
    }

    const colFrom = this.columns.find((c) => c.id === oldStage);
    const colTo = this.columns.find((c) => c.id === newStage);

    let movedCard: ApplicationCard | undefined;

    if (colFrom) {
      const idx = colFrom.cards.findIndex(
        (c) => c.applicationId === this.selectedApplicationId
      );
      if (idx !== -1) {
        [movedCard] = colFrom.cards.splice(idx, 1);
        movedCard.stage = newStage;
        if (colTo) colTo.cards.push(movedCard);
      }
    }

    this.selectedApplicationDetails = { ...this.selectedApplicationDetails, stage: newStage };
    this.cdr.detectChanges();

    this.http
      .patch(`${environment.apiUrl}/applications/${this.selectedApplicationId}/stage`, {
        stage: newStage,
      })
      .subscribe({
        next: () => this.toast.success('Stage updated successfully'),
        error: () => {
          this.toast.error('Failed to update stage');
          if (movedCard && colTo && colFrom) {
            const revertIdx = colTo.cards.findIndex(
              (c) => c.applicationId === this.selectedApplicationId
            );
            if (revertIdx !== -1) {
              colTo.cards.splice(revertIdx, 1);
            }
            movedCard.stage = oldStage;
            colFrom.cards.push(movedCard);
          }
          this.selectedApplicationDetails = {
            ...this.selectedApplicationDetails,
            stage: oldStage,
          };
          this.cdr.detectChanges();
        },
      });
  }

  deleteApplication(): void {
    if (!this.selectedApplicationId || !this.selectedApplicationDetails) return;
    if (!confirm('Are you sure you want to completely remove this candidate from the pipeline?')) return;

    const appId = this.selectedApplicationId;
    const currentStage = this.selectedApplicationDetails.stage as PipelineStage;

    this.closeSidePanel();

    this.http.delete(`${environment.apiUrl}/applications/${appId}`)
      .subscribe({
        next: () => {
          this.toast.success('Application removed from pipeline.');
          const col = this.columns.find((c) => c.id === currentStage);
          if (col) {
            col.cards = col.cards.filter((c) => c.applicationId !== appId);
            this.cdr.detectChanges();
          }
        },
        error: () => this.toast.error('Failed to remove application.'),
      });
  }

  goBack(): void {
    this.router.navigate(['/job-offers']);
  }

  trackByCard(_: number, card: ApplicationCard): string {
    return card.applicationId;
  }

  trackByCol(_: number, col: StageColumn): string {
    return col.id;
  }

  openAddCandidateModal(): void {
    this.showAddCandidateModal = true;
    this.activeModalTab = 'search';
    this.searchQuery = '';
    this.searchResults = [];
  }

  closeAddCandidateModal(): void {
    this.showAddCandidateModal = false;
  }

  searchCandidates(): void {
    if (!this.searchQuery.trim()) {
      this.searchResults = [];
      return;
    }
    this.isSearching = true;
    this.http
      .get<any>(
        `${environment.apiUrl}/candidates?search=${encodeURIComponent(this.searchQuery)}&limit=5`
      )
      .pipe(finalize(() => { this.isSearching = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: (res) => {
          this.searchResults = res.data || [];
          this.cdr.detectChanges();
        },
        error: () => {
          this.toast.error('Search failed. Please try again.');
        },
      });
  }

  addExistingCandidate(candidateId: string): void {
    this.http
      .post(
        `${environment.apiUrl}/job-offers/${this.jobId}/applications/from-candidate`,
        { candidateId }
      )
      .subscribe({
        next: () => {
          this.toast.success('Candidate added to pipeline');
          this.closeAddCandidateModal();
          this.loadApplications();
        },
        error: (err) => {
          if (err.status === 400) {
            this.toast.error(err.error?.message || 'Candidate already in pipeline');
          } else {
            this.toast.error('Failed to add candidate');
          }
        },
      });
  }

  onCvUploaded(_res: any): void {
    this.closeAddCandidateModal();
    this.loadApplications();
  }

  // ─── Promotion Lifecycle ──────────────────────────────────────────────────

  openPromoteModal(): void {
    if (!this.selectedApplicationId || !this.selectedApplicationDetails) return;
    
    this.showPromoteModal = true;
    this.promotePayload = {
      employeeId: '',
      hireDate: new Date().toISOString().split('T')[0],
      managerId: ''
    };
    
    this.employeeService.getManagers().subscribe({
      next: (m) => {
        this.managers = m;
        this.cdr.detectChanges();
      },
      error: () => this.toast.error('Failed to load manager list.')
    });
  }

  closePromoteModal(): void {
    this.showPromoteModal = false;
  }

  confirmPromotion(): void {
    if (!this.promotePayload.employeeId || !this.promotePayload.hireDate) {
      this.toast.error('Employee ID and Hire Date are required.');
      return;
    }

    this.promoting = true;
    const appId = this.selectedApplicationId!;
    
    this.employeeService.promoteCandidate({
      applicationId: appId,
      ...this.promotePayload
    }).subscribe({
      next: (result: PromotionResult) => {
        // ✅ FIX 4: Capture and surface competency source
        this.lastPromotionSource = result.competencySource;
        const sourceLabel = result.competencySource === 'manual'
          ? '✅ Skills migrated from HR evaluations.'
          : '⚠️ Skills estimated from AI CV parse — manual review recommended.';
        this.toast.success(`Promoted to Employee! ${sourceLabel}`);
        this.closePromoteModal();
        this.closeSidePanel();
        this.loadApplications();
      },
      error: (err) => {
        this.toast.error(err.error?.message || 'Promotion failed.');
      },
      complete: () => {
        this.promoting = false;
        this.cdr.detectChanges();
      }
    });
  }
}