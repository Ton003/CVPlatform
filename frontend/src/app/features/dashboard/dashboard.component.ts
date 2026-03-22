import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule }      from '@angular/common';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { HttpClient }        from '@angular/common/http';
import { finalize }          from 'rxjs';
import { AuthService }       from '../../core/services/auth.service';
import { User }              from '../../shared/models/user.model';
import { SidebarComponent }  from '../../shared/sidebar/sidebar.component';
import { environment }       from '../../../environments/environment';

interface DashboardStats {
  totalCandidates: number;
  addedThisWeek:   number;
  weekTrend:       string;
  stages: {
    screening: number;
    interview: number;
    offer:     number;
    rejected:  number;
    [key: string]: number;
  };
  recentCandidates: Array<{
    candidateId:  string;
    name:         string;
    currentTitle: string | null;
    location:     string | null;
    createdAt:    string;
    skills:       string[];
  }>;
  topSkills: Array<{ skill: string; count: number }>;
}

@Component({
  selector:    'app-dashboard',
  standalone:  true,
  imports:     [CommonModule, RouterLink, SidebarComponent],
  templateUrl: './dashboard.component.html',
  styleUrls:   ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {
  currentUser:  User | null = null;
  statsLoading  = true;
  stats:        DashboardStats | null = null;

  constructor(
    private readonly authService: AuthService,
    private readonly router:      Router,
    private readonly http:        HttpClient,
    private readonly cdr:         ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.loadStats();
  }

  loadStats(): void {
    this.statsLoading = true;
    this.http.get<DashboardStats>(`${environment.apiUrl}/dashboard/stats`)
      .pipe(finalize(() => { this.statsLoading = false; this.cdr.detectChanges(); }))
      .subscribe({
        next:  s  => { this.stats = s; },
        error: () => { this.stats = null; },
      });
  }

  logout(): void { this.authService.logout(); }

  getRoleBadgeLabel(role: string): string {
    const labels: Record<string, string> = {
      admin:   'Administrator',
      hr:      'HR Manager',
      manager: 'Manager',
    };
    return labels[role] || role;
  }

  initials(name: string): string {
    return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  }

  formatDate(d: string): string {
    return new Date(d).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }

  getStageCount(stage: string): number {
    if (!this.stats) return 0;
    return this.stats.stages[stage] ?? 0;
  }

  stageBarWidth(count: number): number {
    if (!this.stats) return 0;
    const max = Math.max(
      this.stats.stages.screening,
      this.stats.stages.interview,
      this.stats.stages.offer,
      this.stats.stages.rejected,
      1,
    );
    return Math.round((count / max) * 100);
  }

  get totalInPipeline(): number {
    if (!this.stats) return 0;
    const s = this.stats.stages;
    return s.screening + s.interview + s.offer + s.rejected;
  }

  openProfile(id: string): void {
    this.router.navigate(['/candidates', id]);
  }
}