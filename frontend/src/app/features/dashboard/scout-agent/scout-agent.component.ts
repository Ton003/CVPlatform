import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { interval, Subscription } from 'rxjs';

interface ScoutInsight {
  id: string;
  type: 'MATCH' | 'MOBILITY' | 'RISK';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  action: 'NONE' | 'NOTIFY' | 'ESCALATE';
  confidence: number;
  score: number;
  reasoning: string;
  status: string;
  candidateId?: string;
  employeeId?: string;
  jobId?: string;
  candidate?: any;
  employee?: any;
  job?: any;
  updatedAt: string;
  metadata?: any;
}

@Component({
  selector: 'app-scout-agent',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scout-agent.component.html',
  styleUrls: ['./scout-agent.component.scss']
})
export class ScoutAgentComponent implements OnInit, OnDestroy {
  insights: ScoutInsight[] = [];
  groupedInsights: any[] = [];
  filteredInsights: any[] = [];
  loading = true;
  lastSync: Date | null = null;
  currentMission: 'ALL' | 'RECRUIT' | 'RETAIN' | 'GROW' = 'ALL';
  missionModes: Array<'ALL' | 'RECRUIT' | 'RETAIN' | 'GROW'> = ['ALL', 'RECRUIT', 'RETAIN', 'GROW'];
  private pollSub?: Subscription;

  actioningId: string | null = null;

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit() {
    this.fetchInsights();
    // Poll every 5 minutes
    this.pollSub = interval(300000).subscribe(() => this.fetchInsights());
  }

  ngOnDestroy() {
    this.pollSub?.unsubscribe();
  }

  triggerScan() {
    this.loading = true;
    const timestamp = new Date().getTime();
    this.http.get(`${environment.apiUrl}/intelligence/trigger-agent?t=${timestamp}`)
      .subscribe({
        next: () => {
          setTimeout(() => this.fetchInsights(), 1000);
        },
        error: (err) => {
          console.error('Scan failed', err);
          this.fetchInsights();
        }
      });
  }

  fetchInsights() {
    const timestamp = new Date().getTime();
    this.http.get<ScoutInsight[]>(`${environment.apiUrl}/intelligence/scout-insights?t=${timestamp}`)
      .subscribe({
        next: (res) => {
          this.insights = Array.isArray(res) ? res : [];
          try {
            this.applyFilter();
          } catch (e) {
            console.error('Filter error', e);
            this.filteredInsights = [];
          }
          this.loading = false;
          this.lastSync = new Date();
        },
        error: (err) => {
          console.error('Failed to fetch scout insights', err);
          this.loading = false;
          this.insights = [];
          this.filteredInsights = [];
        }
      });
  }

  setMission(mission: 'ALL' | 'RECRUIT' | 'RETAIN' | 'GROW') {
    this.currentMission = mission;
    this.applyFilter();
  }

  private applyFilter() {
    let rawFiltered: ScoutInsight[] = [];
    if (this.currentMission === 'ALL') {
      rawFiltered = this.insights;
    } else if (this.currentMission === 'RECRUIT') {
      rawFiltered = this.insights.filter(i => i.type === 'MATCH');
    } else if (this.currentMission === 'RETAIN') {
      rawFiltered = this.insights.filter(i => i.type === 'RISK');
    } else if (this.currentMission === 'GROW') {
      rawFiltered = this.insights.filter(i => i.type === 'MOBILITY');
    }

    // Grouping logic
    const groups = new Map<string, any>();

    rawFiltered.forEach(insight => {
      const subjectId = insight.candidateId || insight.employeeId || 'unknown';
      const isEmployee = !!insight.employeeId;
      const subjectName = isEmployee 
        ? `${insight.employee?.firstName} ${insight.employee?.lastName}`
        : `${insight.candidate?.firstName} ${insight.candidate?.lastName}`;

      if (!groups.has(subjectId)) {
        groups.set(subjectId, {
          ...insight,
          subjectName: subjectName.trim() || 'Unknown Subject',
          isEmployee,
          insights: [insight],
          matches: insight.job ? [{ job: insight.job, score: insight.score }] : [],
          allReasoning: [insight.reasoning]
        });
      } else {
        const group = groups.get(subjectId);
        group.insights.push(insight);
        if (insight.job) {
          group.matches.push({ job: insight.job, score: insight.score });
        }
        if (insight.reasoning && !group.allReasoning.includes(insight.reasoning)) {
          group.allReasoning.push(insight.reasoning);
        }
        // Keep the highest priority and score for the card header
        if (this.priorityWeight(insight.priority) > this.priorityWeight(group.priority)) {
          group.priority = insight.priority;
        }
        group.score = Math.max(group.score, insight.score);
        group.confidence = Math.max(group.confidence, insight.confidence);
      }
    });

    this.filteredInsights = Array.from(groups.values());
  }

  private priorityWeight(p: string): number {
    if (p === 'HIGH') return 3;
    if (p === 'MEDIUM') return 2;
    if (p === 'LOW') return 1;
    return 0;
  }

  updateStatus(insight: ScoutInsight, status: string) {
    this.http.patch(`${environment.apiUrl}/intelligence/scout-insights/${insight.id}/status`, { status })
      .subscribe(() => {
        this.insights = this.insights.filter(i => i.id !== insight.id);
        this.applyFilter();
      });
  }

  actionDossier(insight: any) {
    // Use the first insight's ID from the grouped insights
    const insightId = insight.id;
    this.actioningId = insightId;

    this.http.get<{ navigateTo: string; type: string; entityId: string; created?: boolean }>(
      `${environment.apiUrl}/intelligence/scout-insights/${insightId}/action`
    ).subscribe({
      next: (result) => {
        this.actioningId = null;
        // Remove from list
        this.insights = this.insights.filter(i => i.id !== insightId);
        this.applyFilter();
        // Navigate to the target
        const queryParams: any = { from: 'scout' };
        if (result.created) queryParams.created = 'true';
        this.router.navigate([result.navigateTo], { queryParams });
      },
      error: (err) => {
        console.error('Action failed', err);
        this.actioningId = null;
        // Fallback: try direct navigation based on insight data
        if (insight.candidateId) {
          this.router.navigate(['/candidates', insight.candidateId], { queryParams: { from: 'scout' } });
        } else if (insight.employeeId) {
          this.router.navigate(['/employees', insight.employeeId], { queryParams: { from: 'scout' } });
        }
      }
    });
  }

  getAvatarGradient(insight: ScoutInsight): string {
    const name = insight.candidate?.firstName || insight.employee?.firstName || 'A';
    const colors = [
      ['#6366f1', '#a855f7'], // Indigo -> Purple
      ['#3b82f6', '#2dd4bf'], // Blue -> Teal
      ['#f59e0b', '#ef4444'], // Amber -> Red
      ['#10b981', '#3b82f6'], // Emerald -> Blue
    ];
    const idx = name.charCodeAt(0) % colors.length;
    return `linear-gradient(135deg, ${colors[idx][0]}, ${colors[idx][1]})`;
  }

  getPriorityColor(priority: string): string {
    switch (priority) {
      case 'HIGH': return '#ef4444';
      case 'MEDIUM': return '#f59e0b';
      case 'LOW': return '#10b981';
      default: return '#6b7280';
    }
  }

  getActionLabel(action: string): string {
    if (action === 'ESCALATE') return 'Critical Action';
    if (action === 'NOTIFY') return 'Recommendation';
    return 'Observation';
  }

  getTrend(insight: ScoutInsight): 'up' | 'down' | 'stable' {
    const history = insight.metadata?.history || [];
    if (history.length < 2) return 'stable';
    const last = history[history.length - 1].score;
    const prev = history[history.length - 2].score;
    if (last > prev) return 'up';
    if (last < prev) return 'down';
    return 'stable';
  }
}
