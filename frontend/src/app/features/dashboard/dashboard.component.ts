import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule }      from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { HttpClient }        from '@angular/common/http';
import { finalize, forkJoin } from 'rxjs';
import { AuthService }       from '../../core/services/auth.service';
import { User }              from '../../shared/models/user.model';
import { environment }       from '../../../environments/environment';

interface DashboardStats {
  totalCandidates: number;
  addedThisWeek:   number;
  stages: {
    applied: number; screening: number; interview: number;
    assessment: number; offer: number; rejected: number;
    [key: string]: number;
  };
  recentCandidates: Array<{
    candidateId: string; name: string;
    currentTitle: string | null; createdAt: string;
  }>;
  topSkills: Array<{ skill: string; count: number }>;
}

interface JobSummary {
  id: string; title: string; status: string;
  location: string | null; createdAt: string;
}

@Component({
  selector:    'app-dashboard',
  standalone:  true,
  imports:     [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrls:   ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {
  currentUser:  User | null = null;
  statsLoading  = true;
  stats:        DashboardStats | null = null;

  // Job-centric
  openJobs:        JobSummary[] = [];
  totalApps        = 0;
  appsByStage: Record<string, number> = {};
  recentApps: any[] = [];
  jobsLoading      = true;

  readonly stages = [
    { id: 'applied',    label: 'Applied',    color: 'var(--accent)' },
    { id: 'screening',  label: 'Screening',  color: 'var(--purple)' },
    { id: 'interview',  label: 'Interview',  color: '#3b82f6' },
    { id: 'assessment', label: 'Assessment', color: 'var(--warning)' },
    { id: 'offer',      label: 'Offer',      color: 'var(--success)' },
    { id: 'rejected',   label: 'Rejected',   color: 'var(--danger)' },
  ];

  constructor(
    private readonly authService: AuthService,
    private readonly router:      Router,
    private readonly http:        HttpClient,
    private readonly cdr:         ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.loadAll();
  }

  get today(): string {
    return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  loadAll(): void {
    this.statsLoading = true;
    this.jobsLoading  = true;

    // Load candidate stats + jobs + applications in parallel
    forkJoin({
      stats: this.http.get<DashboardStats>(`${environment.apiUrl}/dashboard/stats`),
      jobs:  this.http.get<any[]>(`${environment.apiUrl}/job-offers`),
      apps:  this.http.get<any>(`${environment.apiUrl}/applications?limit=200`),
    }).pipe(finalize(() => {
      this.statsLoading = false;
      this.jobsLoading  = false;
      this.cdr.detectChanges();
    })).subscribe({
      next: ({ stats, jobs, apps }) => {
        this.stats    = stats;
        this.openJobs = jobs.filter(j => j.status === 'open').slice(0, 5);

        const appList: any[] = Array.isArray(apps) ? apps : (apps.data ?? []);
        this.totalApps = appList.length;

        // Count by stage
        this.appsByStage = {};
        this.stages.forEach(s => this.appsByStage[s.id] = 0);
        appList.forEach(a => {
          if (this.appsByStage[a.stage] !== undefined) {
            this.appsByStage[a.stage]++;
          }
        });

        // Recent 5 applications
        this.recentApps = appList.slice(0, 5);
        this.cdr.detectChanges();
      },
      error: () => { this.cdr.detectChanges(); },
    });
  }

  getRoleBadgeLabel(role: string): string {
    const labels: Record<string, string> = {
      admin: 'Administrator', hr: 'HR Manager', manager: 'Manager',
    };
    return labels[role] || role;
  }

  initials(name: string): string {
    return (name || '?').split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  }

  formatDate(d: string): string {
    return new Date(d).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }

  getStageCount(stage: string): number {
    return this.appsByStage[stage] ?? 0;
  }

  stageBarWidth(count: number): number {
    const max = Math.max(...Object.values(this.appsByStage), 1);
    return Math.round((count / max) * 100);
  }

  get totalInPipeline(): number {
    return this.totalApps;
  }

  openProfile(id: string): void {
    this.router.navigate(['/candidates', id]);
  }

  viewPipeline(jobId: string): void {
    this.router.navigate(['/job-offers', jobId, 'pipeline']);
  }

  openApplication(id: string): void {
    this.router.navigate(['/applications', id]);
  }

  getStageBadgeStyle(stage: string): string {
    const s = this.stages.find(s => s.id === stage);
    return s ? s.color : 'var(--text-muted)';
  }
}