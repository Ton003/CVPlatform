import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { finalize, firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { environment } from '../../../environments/environment';
import { ConfirmModalComponent } from '../../shared/confirm-modal/confirm-modal.component';
import {
  CompetencyService,
  Competency,
  JobCompetency,
  CompetencyCategory,
} from '../../core/services/competency.service';
import { JobArchitectureService, JobRoleLevel } from '../../core/services/job-architecture.service';

export interface JobOffer {
  id: string;
  jobRoleId?: string;
  jobRoleLevelId: string;
  title: string;
  description: string;
  contractType: string | null;
  workMode: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string;
  openingsCount: number;
  hiringManager: string | null;
  deadline: string | null;
  snapshot: any; 
  status: string;
  visibility: string;
  createdAt: string;
  pipelineCount?: number;
}

export interface CompetencyRow {
  assignmentId: string;
  competencyId: string;
  name: string;
  category: CompetencyCategory;
  requiredLevel: number;
  saving: boolean;
}

type FormStep = 'basics' | 'details' | 'review';



@Component({
  selector: 'app-job-offers',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, ConfirmModalComponent],
  templateUrl: './job-offers.component.html',
  styleUrls: ['./job-offers.component.scss'],
})
export class JobOffersComponent implements OnInit {
  offers: JobOffer[] = [];
  loading = false;
  error = '';
  viewMode: 'grid' | 'list' = 'grid';

  // Modal State
  showModal = false;
  saving = false;
  editingId = '';
  formStep: FormStep = 'basics';

  // Delete State
  deleteModal = false;
  pendingDeleteId = '';
  deletingId = '';

  // Form State
  form = this.getEmptyForm();
  selectedRoleId = ''; // Intermediate role selection
  availableRanks: JobRoleLevel[] = [];

  // Architecture Data
  activeRoles: any[] = [];
  selectedRankBlueprint: any | null = null;
  loadingBlueprint = false;



  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly toast: ToastService,
    private readonly cdr: ChangeDetectorRef,
    private readonly competencySvc: CompetencyService,
    private readonly jaService: JobArchitectureService,
  ) {}

  ngOnInit(): void {
    this.loadOffers();
  }

  private getEmptyForm() {
    return {
      jobRoleLevelId: '',
      title: '',
      description: '',
      contractType: 'CDI',
      workMode: 'Hybrid',
      salaryMin: null as number | null,
      salaryMax: null as number | null,
      currency: 'TND',
      openingsCount: 1,
      hiringManager: '',
      deadline: '',
      visibility: 'both',
      status: 'open',
    };
  }



  goNextStep(): void {
    if (this.formStep === 'basics') {
      if (!this.form.jobRoleLevelId) {
        this.toast.error('Please select a specific Job Role Rank.');
        return;
      }
      this.formStep = 'details';
    } else if (this.formStep === 'details') {
      this.formStep = 'review';
    }
    this.cdr.markForCheck();
  }

  goPrevStep(): void {
    const steps: FormStep[] = ['basics', 'details', 'review'];
    const idx = steps.indexOf(this.formStep);
    if (idx > 0) this.formStep = steps[idx - 1];
    this.cdr.markForCheck();
  }

  loadOffers(): void {
    this.loading = true;
    this.http.get<JobOffer[]>(`${environment.apiUrl}/job-offers`)
      .pipe(finalize(() => { this.loading = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: (rows) => this.offers = rows,
        error: () => this.error = 'Failed to load offers.'
      });
  }

  async openNewForm(): Promise<void> {
    this.editingId = '';
    this.formStep = 'basics';
    this.form = this.getEmptyForm();
    this.selectedRoleId = '';
    this.availableRanks = [];
    this.selectedRankBlueprint = null;
    this.showModal = true;
    await this.loadActiveRoles();
  }

  async loadActiveRoles(): Promise<void> {
    try {
      const bus = await firstValueFrom(this.jaService.getTree());
      const roles: any[] = [];
      (bus || []).forEach((bu: any) => {
        (bu.departments || []).forEach((d: any) => {
          (d.jobRoles || []).forEach((r: any) => {
            if (r.status === 'ACTIVE') {
              roles.push({ 
                ...r, 
                path: `${bu.name} > ${d.name}`,
                buName: bu.name,
                departmentName: d.name
              });
            }
          });
        });
      });
      this.activeRoles = roles;
      this.cdr.markForCheck();
    } catch {
      this.toast.error('Failed to load active roles.');
    }
  }

  onRoleChange(): void {
    const role = this.activeRoles.find(r => r.id === this.selectedRoleId);
    this.availableRanks = role?.levels || [];
    this.form.jobRoleLevelId = '';
    this.selectedRankBlueprint = null;
    this.cdr.markForCheck();
  }

  onRankChange(): void {
    if (!this.form.jobRoleLevelId) {
      this.selectedRankBlueprint = null;
      return;
    }
    this.loadingBlueprint = true;
    this.jaService.getJobRoleRank(this.form.jobRoleLevelId).subscribe({
      next: (rank) => {
        const role = this.activeRoles.find(r => r.id === this.selectedRoleId);
        this.selectedRankBlueprint = {
          ...rank,
          roleName: role?.name,
          buName: role?.buName,
          departmentName: role?.departmentName
        } as any;
        
        if (!this.form.title && role) {
          this.form.title = `${role.name} - ${rank.title}`;
        }
        this.loadingBlueprint = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingBlueprint = false;
        this.toast.error('Failed to load rank blueprint.');
        this.cdr.markForCheck();
      }
    });
  }

  submitForm(): void {
    this.saving = true;
    this.cdr.markForCheck();

    const req = this.editingId
      ? this.http.patch(`${environment.apiUrl}/job-offers/${this.editingId}`, {
          title:         this.form.title,
          description:   this.form.description,
          contractType:  this.form.contractType,
          workMode:      this.form.workMode,
          salaryMin:     this.form.salaryMin,
          salaryMax:     this.form.salaryMax,
          currency:      this.form.currency,
          openingsCount: this.form.openingsCount,
          hiringManager: this.form.hiringManager || null,
          deadline:      this.form.deadline || null,
          visibility:    this.form.visibility,
          status:        this.form.status,
        })
      : this.http.post(`${environment.apiUrl}/job-offers`, { ...this.form });

    req.pipe(finalize(() => { this.saving = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: () => {
          this.toast.success('Campaign published.');
          this.showModal = false;
          this.loadOffers();
        },
        error: () => this.toast.error('Failed to save offer.')
      });
  }

  // --- DELETE, NAVIGATION, FORMATS (OMITTED FOR BREVITY BUT KEPT IN FINAL MERGE) ---
  requestDelete(id: string, event: MouseEvent): void { event.stopPropagation(); this.pendingDeleteId = id; this.deleteModal = true; }
  confirmDelete(): void {
    const id = this.pendingDeleteId;
    const offerToDelete = this.offers.find(o => o.id === id);
    this.offers = this.offers.filter(o => o.id !== id);
    this.deleteModal = false;
    this.cdr.markForCheck();

    this.http.delete(`${environment.apiUrl}/job-offers/${id}`).subscribe({
      next: () => {
        this.toast.success('Deleted.');
      },
      error: () => {
        if (offerToDelete) this.offers = [...this.offers, offerToDelete];
        this.toast.error('Failed to delete job offer.');
        this.cdr.markForCheck();
      }
    });
  }
  cancelDelete(): void { this.deleteModal = false; }
  viewMatches(id: string, event: MouseEvent): void { event.stopPropagation(); this.router.navigate(['/job-offers', id, 'matches']); }
  viewPipeline(id: string, event: MouseEvent): void { event.stopPropagation(); this.router.navigate(['/job-offers', id, 'pipeline']); }
  viewComparison(id: string, event: MouseEvent): void { event.stopPropagation(); this.router.navigate(['/job-offers', id, 'compare']); }
  formatDate(d: string): string { return new Date(d).toLocaleDateString('en-GB'); }
  expandedSkills: Record<string, boolean> = {};

  toggleSkills(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.expandedSkills[id] = !this.expandedSkills[id];
  }

  visibleSkills(list: any[] | undefined, id: string): any[] {
    const l = list || [];
    return this.expandedSkills[id] ? l : l.slice(0, 5);
  }
  get userRole(): string { return this.auth.getCurrentUser()?.role ?? 'hr'; }
  async openEditForm(offer: JobOffer, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    this.editingId = offer.id;
    this.formStep = 'basics';
    this.form = {
      jobRoleLevelId: offer.jobRoleLevelId,
      title: offer.title,
      description: offer.description,
      contractType: offer.contractType || 'CDI',
      workMode: offer.workMode || 'Remote',
      salaryMin: offer.salaryMin,
      salaryMax: offer.salaryMax,
      currency: offer.currency || 'TND',
      openingsCount: offer.openingsCount || 1,
      hiringManager: offer.hiringManager || '',
      deadline: offer.deadline ? new Date(offer.deadline).toISOString().split('T')[0] : '',
      visibility: offer.visibility || 'both',
      status: offer.status,
    };
    this.showModal = true;
    this.cdr.markForCheck();
    
    await this.loadActiveRoles();
    this.selectedRoleId = offer.jobRoleId || '';
    this.onRoleChange();
    this.form.jobRoleLevelId = offer.jobRoleLevelId || '';
    this.onRankChange();
  }
  closeModal(): void { this.showModal = false; }
}