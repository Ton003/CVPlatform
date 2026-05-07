import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { EmployeeService, Employee } from '../../../core/services/employee.service';
import { finalize } from 'rxjs/operators';
import { InternalMobilityService, GapAnalysisReport } from '../services/internal-mobility.service';
import { JobArchitectureService } from '../../../core/services/job-architecture.service';
import { GapAnalysisHeatmapComponent } from './gap-analysis-heatmap.component';
import { AssessmentPanelComponent } from './assessment-panel.component';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';

interface CompetencyDelta {
  name: string;
  category: string;
  target: number;
  current: number;
  delta: number;
  status: 'met' | 'gap-minor' | 'gap-major' | 'surpassed';
  source?: string;
  lastEvaluatedAt?: string | null;
}

@Component({
  selector: 'app-employee-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, GapAnalysisHeatmapComponent, AssessmentPanelComponent],
  templateUrl: './employee-profile.component.html',
  styleUrls: ['./employee-profile.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeProfileComponent implements OnInit {
  employee: Employee | null = null;
  loading = true;
  error = '';
  activeTab: 'overview' | 'development' = 'overview';
  backLabel = 'Back to employees';
  backRoute = '/employees';

  // Succession & Risk label maps
  readonly successionLabels: Record<string, string> = {
    ready_now: 'Ready Now',
    ready_1_yr: 'Ready in 1 Year',
    ready_2_yrs: 'Ready in 2 Years',
    not_ready: 'Not Ready',
  };
  readonly riskLabels: Record<string, string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
  };
  readonly successionColors: Record<string, string> = {
    ready_now: '#10b981',
    ready_1_yr: '#3b82f6',
    ready_2_yrs: '#f59e0b',
    not_ready: '#ef4444',
  };
  readonly riskColors: Record<string, string> = {
    low: '#10b981',
    medium: '#f59e0b',
    high: '#ef4444',
  };

  // Assessment
  showAssessmentPanel = false;
  assessmentMode: 'current' | 'next' = 'current';
  nextLevelRequirements: any[] = [];
  loadingNextReqs = false;
  
  // Promotion Workflow
  promoting = false;
  showPromoteModal = false;
  promoteForm = {
    effectiveDate: new Date().toISOString().split('T')[0],
    notes: ''
  };

  // Career History
  careerHistory: any[] = [];
  historyLoading = false;

  // Edit Mode
  isEditing = false;
  saving = false;
  editForm = {
    firstName: '',
    lastName: '',
    email: '',
    status: '',
    phone: '',
    location: '',
    skills: '',
    successionReadiness: '' as string,
    retentionRisk: '' as string,
    impactOfLoss: '' as string,
  };

  // Overview heatmap (current rank)
  deltas: CompetencyDelta[] = [];

  // Career development (next rank gap analysis)
  targetReport: GapAnalysisReport | null = null;
  devLoading = false;
  devError = '';
  nextLevel: { id: string; title: string; levelNumber: number } | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly employeeService: EmployeeService,
    private readonly mobilityService: InternalMobilityService,
    private readonly jobArchService: JobArchitectureService,
    private readonly toast: ToastService,
    private readonly auth: AuthService,
    private readonly cdr: ChangeDetectorRef,
    private readonly location: Location,
    private readonly router: Router
  ) { }

  get userRole(): string {
    return this.auth.getCurrentUser()?.role || 'hr';
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    const from = this.route.snapshot.queryParamMap.get('from');

    if (from === 'scout' || from === 'dashboard') {
      this.backLabel = 'Back to dashboard';
      this.backRoute = '/dashboard';
    } else {
      this.backLabel = 'Back to employees';
      this.backRoute = '/employees';
    }

    if (id) this.loadEmployee(id);
  }

  // FIX: exposed as a method so retry button can call it directly with the current employee id
  retryLoad(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.error = '';
      this.cdr.markForCheck();
      this.loadEmployee(id);
    }
  }

  loadEmployee(id: string): void {
    this.loading = true;
    this.error = '';
    this.employeeService.findOne(id)
      .pipe(finalize(() => { this.loading = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: (emp) => {
          this.employee = emp;
          this.nextLevel = (emp as any).nextJobRoleLevel ?? null;
          // Reset development tab state on re-load so stale data is cleared
          this.targetReport = null;
          this.devError = '';
          this.calculateOverviewDeltas();
          
          // If we are already on the development tab, we need to load the gap analysis for the new rank
          if (this.activeTab === 'development' && this.nextLevel) {
            this.loadTargetGap(this.employee.id, this.nextLevel.id);
          }
          
          this.loadHistory(id);
          this.cdr.markForCheck();
        },
        error: () => { this.error = 'Failed to load employee profile.'; }
      });
  }

  loadHistory(id: string): void {
    this.historyLoading = true;
    this.employeeService.getHistory(id)
      .pipe(finalize(() => { this.historyLoading = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: (hist) => { this.careerHistory = hist; },
        error: () => { console.error('Failed to load career history'); }
      });
  }

  // Build the overview competency heatmap from loaded relations
  calculateOverviewDeltas(): void {
    if (!this.employee) return;

    const requirements = (this.employee.jobRoleLevel as any)?.competencyRequirements ?? [];
    const proficiencies = this.employee.competencies ?? [];

    this.deltas = requirements.map((req: any) => {
      const compId = req.competenceId ?? req.competency?.id;
      const proficiency = proficiencies.find((p: any) =>
        p.competenceId === compId || p.competence?.id === compId
      );
      const actual = proficiency?.currentLevel ?? 0;

      const diff = actual - req.requiredLevel;
      let status: CompetencyDelta['status'] = 'met';
      if (diff > 0) status = 'surpassed';
      else if (diff === 0) status = 'met';
      else if (diff === -1) status = 'gap-minor';
      else status = 'gap-major';

      return {
        name: req.competence?.name ?? 'Unknown Competency',
        category: req.competence?.family?.category ?? req.competence?.category ?? '',
        target: req.requiredLevel,
        current: actual,
        delta: diff,
        status,
        source: proficiency?.source,
        lastEvaluatedAt: proficiency?.lastEvaluatedAt ?? null
      };
    });
  }

  startAssessment(): void {
    this.assessmentMode = 'current';
    this.showAssessmentPanel = true;
    this.cdr.markForCheck();
  }

  startNextLevelAssessment(): void {
    if (!this.nextLevel) return;
    this.loadingNextReqs = true;
    this.cdr.markForCheck();

    this.jobArchService.getJobRoleRank(this.nextLevel.id).subscribe({
      next: (level) => {
        this.nextLevelRequirements = (level as any).competencyRequirements ?? [];
        this.assessmentMode = 'next';
        this.showAssessmentPanel = true;
        this.loadingNextReqs = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.toast.error('Could not load next level requirements.');
        this.loadingNextReqs = false;
        this.cdr.markForCheck();
      }
    });
  }

  openPromoteModal(): void {
    if (!this.employee || !this.nextLevel) return;
    this.promoteForm = {
      effectiveDate: new Date().toISOString().split('T')[0],
      notes: `Promoted to ${this.nextLevel.title}`
    };
    this.showPromoteModal = true;
    this.cdr.markForCheck();
  }

  cancelPromotion(): void {
    this.showPromoteModal = false;
    this.cdr.markForCheck();
  }

  confirmPromotion(): void {
    if (!this.employee || !this.nextLevel) return;
    
    this.promoting = true;
    this.cdr.markForCheck();

    this.employeeService.promoteToNextLevel(this.employee.id, this.promoteForm).subscribe({
      next: (result) => {
        this.toast.success(`Promoted to ${result.newLevelTitle}!`);
        this.promoting = false;
        this.showPromoteModal = false;
        this.assessmentMode = 'current';
        this.nextLevelRequirements = [];
        this.showAssessmentPanel = false;
        this.loadEmployee(this.employee!.id); // Reload to get fresh state
      },
      error: (err) => {
        this.promoting = false;
        
        // Check if error is due to unmet competencies
        if (err.error?.gaps && err.error?.gaps.length > 0) {
           this.toast.error(err.error.message || 'Cannot promote: Unmet competency requirements.');
        } else {
           this.toast.error(err.error?.message || 'Failed to promote employee.');
        }
        this.cdr.markForCheck();
      }
    });
  }

  onAssessmentSubmitted(): void {
    if (this.employee) {
      this.loadEmployee(this.employee.id);
    }
  }

  setTab(tab: 'overview' | 'development'): void {
    this.activeTab = tab;
    if (tab === 'development' && this.employee && !this.targetReport && !this.devLoading && this.nextLevel) {
      this.loadTargetGap(this.employee.id, this.nextLevel.id);
    }
    this.cdr.markForCheck();
  }

  loadTargetGap(employeeId: string, levelId: string): void {
    this.devLoading = true;
    this.devError = '';
    this.cdr.markForCheck();
    this.mobilityService.getGapAnalysis(employeeId, levelId)
      .pipe(finalize(() => { this.devLoading = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: (report) => { this.targetReport = report; this.cdr.markForCheck(); },
        error: () => { this.devError = 'Could not load development plan data.'; }
      });
  }

  getInitials(): string {
    if (!this.employee) return '?';
    return `${this.employee.firstName[0]}${this.employee.lastName[0]}`.toUpperCase();
  }

  // ── Helpers ────────────────────────────────────────────────────
  goBack(): void {
    this.router.navigate([this.backRoute]);
  }

  getTenure(): string {
    if (!this.employee) return '';
    const hire = new Date(this.employee.hireDate);
    const now = new Date();
    const diffDays = Math.ceil(Math.abs(now.getTime() - hire.getTime()) / 86400000);
    if (diffDays < 30) return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
    const months = Math.floor(diffDays / 30.44);
    if (months < 12) return `${months} month${months !== 1 ? 's' : ''}`;
    const years = +(months / 12).toFixed(1);
    return `${years} year${years !== 1 ? 's' : ''}`;
  }

  // FIX: readiness is computed from overview deltas (current rank requirements)
  // which is the correct semantic — how ready is this person for their CURRENT rank
  get readinessScore(): number {
    if (!this.deltas.length) return 0;
    const met = this.deltas.filter(d => d.status === 'met' || d.status === 'surpassed').length;
    return Math.round((met / this.deltas.length) * 100);
  }

  get readinessLabel(): string {
    const s = this.readinessScore;
    if (s >= 80) return 'Fully Proficient';
    if (s >= 50) return 'Proficient';
    return 'Developing';
  }

  get readinessColor(): string {
    const s = this.readinessScore;
    if (s >= 80) return '#10b981';
    if (s >= 50) return '#f59e0b';
    return '#ef4444';
  }

  // FIX: assessmentRequirements resolves the competency requirements consistently
  // The template was calling employee.jobRoleLevel?.competencyRequirements which
  // doesn't exist on the typed interface — it's cast as `any` in calculateOverviewDeltas
  get assessmentRequirements(): any[] {
    if (this.assessmentMode === 'next' && this.nextLevelRequirements.length > 0) {
      return this.nextLevelRequirements;
    }
    return (this.employee?.jobRoleLevel as any)?.competencyRequirements ?? [];
  }

  // --- Edit Logic ---
  toggleEdit(): void {
    if (!this.employee) return;
    this.isEditing = true;
    this.editForm = {
      firstName: this.employee.firstName,
      lastName: this.employee.lastName,
      email: this.employee.email,
      status: this.employee.status,
      phone: this.employee.personalDetails?.phone || '',
      location: this.employee.personalDetails?.location || '',
      skills: Array.isArray(this.employee.personalDetails?.skills) 
        ? this.employee.personalDetails.skills.join(', ') 
        : (this.employee.personalDetails?.skills || ''),
      successionReadiness: this.employee.successionReadiness || '',
      retentionRisk: this.employee.retentionRisk || '',
      impactOfLoss: this.employee.impactOfLoss || '',
    };
    this.cdr.markForCheck();
  }

  cancelEdit(): void {
    this.isEditing = false;
    this.cdr.markForCheck();
  }

  saveProfile(): void {
    if (!this.employee) return;
    this.saving = true;
    this.cdr.markForCheck();

    const payload = {
      firstName: this.editForm.firstName,
      lastName: this.editForm.lastName,
      email: this.editForm.email,
      status: this.editForm.status,
      personalDetails: {
        ...this.employee.personalDetails,
        phone: this.editForm.phone,
        location: this.editForm.location,
        skills: this.editForm.skills.split(',').map(s => s.trim()).filter(s => !!s)
      },
      successionReadiness: this.editForm.successionReadiness || null,
      retentionRisk: this.editForm.retentionRisk || null,
      impactOfLoss: this.editForm.impactOfLoss || null,
    };

    this.employeeService.update(this.employee.id, payload)
      .pipe(finalize(() => { this.saving = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: (updated) => {
          this.employee = updated;
          this.isEditing = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.toast.error('Failed to update profile.');
        }
      });
  }

  toggleManager(): void {
    if (!this.employee) return;
    this.saving = true;
    this.cdr.markForCheck();
    this.employeeService.toggleManager(this.employee.id)
      .pipe(finalize(() => { this.saving = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: (updated) => {
          this.employee = updated;
          this.toast.success(`User is ${updated.isManager ? 'now' : 'no longer'} designated as a Manager.`);
          this.cdr.markForCheck();
        },
        error: () => {
          this.toast.error('Failed to toggle manager status.');
        }
      });
  }

  get skills(): string[] {
    const s = this.employee?.personalDetails?.skills;
    if (Array.isArray(s)) return s;
    if (typeof s === 'string') return s.split(',').map(x => x.trim()).filter(x => !!x);
    return [];
  }

  stars(n = 5) { return Array.from({ length: n }, (_, i) => i + 1); }
}