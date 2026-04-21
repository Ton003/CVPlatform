import {
  Component, OnInit, ChangeDetectorRef, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { EmployeeService } from '../../core/services/employee.service';
import { AssessmentPanelComponent } from '../employees/employee-profile/assessment-panel.component';

export type AppTab = 'overview' | 'notes' | 'scoring' | 'activity' | 'interviews' | 'evaluation';

export interface Interview {
  id: string;
  applicationId: string;
  type: string;
  status: string;
  scheduledAt: string;
  interviewerName?: string;
  meetingUrl?: string;
  technicalScore?: number;
  communicationScore?: number;
  // API returns 'comments' but we also handle 'feedback' for display
  feedback?: string;
  comments?: string;
  decision?: string;
}

export interface Task {
  id: string;
  applicationId: string;
  title: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high';
  completed: boolean;
}

export interface JobCompetency {
  competenceId: string;
  name: string;
  description?: string;
  category: string;
  familyName?: string;
  requiredLevel: number;
}

// Promote modal state
export interface PromoteForm {
  employeeId: string;
  hireDate: string;
  managerId: string;
}

@Component({
  selector: 'app-application-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, AssessmentPanelComponent],
  templateUrl: './application-detail.component.html',
  styleUrls: ['./application-detail.component.scss'],
})
export class ApplicationDetailComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private toast = inject(ToastService);
  private auth = inject(AuthService);
  private employeeService = inject(EmployeeService);

  applicationId = '';
  app: any = null;
  loading = true;
  error = '';
  activeTab: AppTab = 'overview';

  // Notes
  notes: any[] = [];
  notesLoading = false;
  newNote = '';
  newRating = 0;
  newStage = 'screening';
  savingNote = false;
  deletingNoteId = '';

  // Scoring
  score: any = null;
  scoreLoading = false;

  // Evaluation
  jobCompetencies: JobCompetency[] = [];
  competencyScores: Record<string, number> = {};
  evaluationLoading = false;
  savingCompId: string | null = null;
  showAssessmentPanel = false;

  // Activity
  activity: any[] = [];
  activityLoading = false;

  // Interviews
  interviews: Interview[] = [];
  interviewsLoading = false;
  showInterviewModal = false;
  showFeedbackModal = false;
  selectedInterview: Interview | null = null;
  interviewForm = { type: 'Technical', scheduledAt: '', interviewerName: '', meetingUrl: '' };
  feedbackForm = { technicalScore: 0, communicationScore: 0, feedback: '', decision: 'pass' };
  feedbackCompRatings: Record<string, number> = {};
  isScheduling = false;
  minDate = '';
  maxDate = '';

  // Tasks
  tasks: Task[] = [];
  tasksLoading = false;
  newTaskTitle = '';

  // Promote modal (replaces browser prompt())
  showPromoteModal = false;
  promoting = false;
  managers: any[] = [];
  promoteForm: PromoteForm = { employeeId: '', hireDate: '', managerId: '' };

  readonly tabs: { id: AppTab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { id: 'evaluation', label: 'Evaluation', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
    { id: 'notes', label: 'Notes', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
    { id: 'scoring', label: 'Scoring', icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' },
    { id: 'interviews', label: 'Interviews', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
    { id: 'activity', label: 'Activity', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  ];

  readonly stageNoteOptions = [
    { value: 'applied', label: 'Applied' },
    { value: 'screening', label: 'Screening' },
    { value: 'interview', label: 'Interview' },
    { value: 'assessment', label: 'Assessment' },
    { value: 'offer', label: 'Offer' },
    { value: 'rejected', label: 'Rejected' },
  ];

  readonly interviewTypes = ['Technical', 'HR', 'Final'];

  ngOnInit(): void {
    this.applicationId = this.route.snapshot.paramMap.get('id') || '';
    this.initDateRestrictions();
    this.loadApplication();
  }

  private initDateRestrictions(): void {
    const now = new Date();
    this.minDate = this.formatDateForInput(now);
    const farFuture = new Date();
    farFuture.setFullYear(now.getFullYear() + 5);
    this.maxDate = this.formatDateForInput(farFuture);
  }

  private formatDateForInput(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d}T${hh}:${mm}`;
  }

  loadApplication(): void {
    this.loading = true;
    this.http
      .get<any>(`${environment.apiUrl}/applications/${this.applicationId}`)
      .pipe(finalize(() => { this.loading = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: (data) => {
          this.app = data;
          this.loadNotes();
          this.loadScore();
          this.loadTasks();
          this.cdr.detectChanges();
        },
        error: () => { this.error = 'Failed to load application.'; },
      });
  }

  switchTab(tab: AppTab): void {
    this.activeTab = tab;
    // Always reload on tab switch for freshness
    if (tab === 'activity') this.loadActivity();
    if (tab === 'interviews') this.loadInterviews();
    if (tab === 'evaluation') this.loadEvaluation();
    this.cdr.detectChanges();
  }

  // ── Notes ──────────────────────────────────────────────────────
  loadNotes(): void {
    this.notesLoading = true;
    this.http
      .get<any[]>(`${environment.apiUrl}/applications/${this.applicationId}/notes`)
      .pipe(finalize(() => { this.notesLoading = false; this.cdr.detectChanges(); }))
      .subscribe({ next: (n) => { this.notes = n; this.cdr.detectChanges(); } });
  }

  submitNote(): void {
    if (!this.newNote.trim()) return;
    this.savingNote = true;
    this.http
      .post<any>(`${environment.apiUrl}/applications/${this.applicationId}/notes`, {
        note: this.newNote.trim(),
        rating: this.newRating || null,
        stage: this.newStage,
      })
      .pipe(finalize(() => { this.savingNote = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: (n) => {
          this.notes = [n, ...this.notes];
          this.newNote = '';
          this.newRating = 0;
          this.toast.success('Note saved.');
          if (n.rating > 0) this.loadScore();
        },
        error: () => { this.toast.error('Failed to save note.'); },
      });
  }

  deleteNote(noteId: string): void {
    if (!confirm('Delete this note?')) return;
    this.deletingNoteId = noteId;
    this.http
      .delete(`${environment.apiUrl}/applications/${this.applicationId}/notes/${noteId}`)
      .pipe(finalize(() => { this.deletingNoteId = ''; this.cdr.detectChanges(); }))
      .subscribe({
        next: () => {
          this.notes = this.notes.filter(n => n.id !== noteId);
          this.toast.success('Note deleted.');
          this.loadScore();
        },
        error: () => { this.toast.error('Failed to delete note.'); },
      });
  }

  canDeleteNote(note: any): boolean {
    const user = this.auth.getCurrentUser();
    if (!user) return false;
    return note.author?.id === user.id || user.role === 'admin';
  }

  setRating(r: number): void { this.newRating = this.newRating === r ? 0 : r; }
  stars(): number[] { return [1, 2, 3, 4, 5]; }

  updateAppStage(newStage: string): void {
    if (!this.app || this.app.stage === newStage) return;
    this.http
      .patch<any>(`${environment.apiUrl}/applications/${this.applicationId}/stage`, { stage: newStage })
      .subscribe({
        next: () => {
          this.app.stage = newStage;
          this.toast.success(`Stage updated to ${newStage}`);
          this.cdr.detectChanges();
        },
        error: () => { this.toast.error('Failed to update stage.'); },
      });
  }

  // ── Scoring ────────────────────────────────────────────────────
  loadScore(): void {
    this.scoreLoading = true;
    this.http
      .get<any>(`${environment.apiUrl}/applications/${this.applicationId}/score`)
      .pipe(finalize(() => { this.scoreLoading = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: (s) => {
          if (s) {
            // Normalise: always expose both compositeScore and totalScore as the same value
            s.totalScore = s.totalScore ?? s.compositeScore ?? 0;
            s.compositeScore = s.totalScore;
          }
          this.score = s;
          this.cdr.detectChanges();
        },
        error: () => { this.score = null; this.cdr.detectChanges(); }
      });
  }

  // ── Interviews ─────────────────────────────────────────────────
  loadInterviews(): void {
    this.interviewsLoading = true;
    this.http
      .get<Interview[]>(`${environment.apiUrl}/applications/${this.applicationId}/interviews`)
      .pipe(finalize(() => { this.interviewsLoading = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: (list) => {
          // Normalise: map 'comments' → 'feedback' for consistent display
          this.interviews = list.map(i => ({
            ...i,
            feedback: i.feedback ?? i.comments ?? ''
          }));
          this.cdr.detectChanges();
        }
      });
  }

  scheduleInterview(): void {
    if (!this.interviewForm.scheduledAt || !this.interviewForm.interviewerName?.trim()) {
      this.toast.error('Please fill in date and interviewer name.');
      return;
    }
    this.isScheduling = true;
    this.http
      .post<Interview>(`${environment.apiUrl}/applications/${this.applicationId}/interviews`, {
        ...this.interviewForm
      })
      .pipe(finalize(() => { this.isScheduling = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: (i) => {
          this.interviews = [...this.interviews, i];
          this.showInterviewModal = false;
          this.interviewForm = { type: 'Technical', scheduledAt: '', interviewerName: '', meetingUrl: '' };
          this.toast.success('Interview scheduled.');
        },
        error: (err) => { this.toast.error(err.error?.message ?? 'Failed to schedule interview.'); }
      });
  }

  openFeedbackModal(interview: Interview): void {
    this.selectedInterview = interview;
    this.feedbackForm = {
      technicalScore: interview.technicalScore || 0,
      communicationScore: interview.communicationScore || 0,
      // Support both field names from API
      feedback: interview.feedback || interview.comments || '',
      decision: interview.decision || 'pass'
    };
    // Pre-populate per-competency ratings from saved evaluation scores
    this.feedbackCompRatings = { ...this.competencyScores };
    // Ensure competencies loaded
    if (!this.jobCompetencies.length && this.app?.jobId) this.loadEvaluation();
    this.showFeedbackModal = true;
    this.cdr.detectChanges();
  }

  closeFeedbackModal(): void {
    this.showFeedbackModal = false;
    this.selectedInterview = null;
    this.feedbackCompRatings = {};
    this.cdr.detectChanges();
  }

  setFeedbackCompRating(compId: string, level: number): void {
    // Toggle off if clicking same level
    const current = this.feedbackCompRatings[compId];
    this.feedbackCompRatings = {
      ...this.feedbackCompRatings,
      [compId]: current === level ? 0 : level
    };
  }

  // Allow toggling feedback general star scores too
  setFeedbackTechScore(s: number): void {
    this.feedbackForm.technicalScore = this.feedbackForm.technicalScore === s ? 0 : s;
  }

  setFeedbackCommScore(s: number): void {
    this.feedbackForm.communicationScore = this.feedbackForm.communicationScore === s ? 0 : s;
  }

  submitFeedback(): void {
    if (!this.selectedInterview) return;
    const payload = {
      technicalScore: this.feedbackForm.technicalScore,
      communicationScore: this.feedbackForm.communicationScore,
      comments: this.feedbackForm.feedback,
      feedback: this.feedbackForm.feedback, // send both to be safe
      decision: this.feedbackForm.decision,
      status: 'completed'
    };
    this.http
      .patch<Interview>(`${environment.apiUrl}/interviews/${this.selectedInterview.id}`, payload)
      .subscribe({
        next: (i) => {
          // Normalise response
          const normalised: Interview = {
            ...i,
            feedback: i.feedback ?? i.comments ?? this.feedbackForm.feedback
          };
          const idx = this.interviews.findIndex(it => it.id === normalised.id);
          if (idx > -1) {
            this.interviews = [
              ...this.interviews.slice(0, idx),
              normalised,
              ...this.interviews.slice(idx + 1)
            ];
          }
          this.closeFeedbackModal();
          this.toast.success('Feedback saved.');
          this.saveAllCompRatings();
          this.cdr.detectChanges();
        },
        error: () => this.toast.error('Failed to save feedback.')
      });
  }

  private saveAllCompRatings(): void {
    const entries = Object.entries(this.feedbackCompRatings).filter(([, v]) => v > 0);
    if (!entries.length) { this.loadScore(); return; }

    const calls = entries.map(([compId, level]) =>
      this.http.put(
        `${environment.apiUrl}/applications/${this.applicationId}/competencies/${compId}`,
        { evaluatedLevel: level }
      )
    );

    forkJoin(calls).subscribe({
      next: () => {
        this.competencyScores = { ...this.competencyScores, ...this.feedbackCompRatings };
        this.loadScore();
        this.cdr.detectChanges();
      },
      error: () => this.toast.error('Some competency ratings failed to save.')
    });
  }

  // ── Tasks ──────────────────────────────────────────────────────
  loadTasks(): void {
    this.tasksLoading = true;
    this.http
      .get<Task[]>(`${environment.apiUrl}/applications/${this.applicationId}/tasks`)
      .pipe(finalize(() => { this.tasksLoading = false; this.cdr.detectChanges(); }))
      .subscribe({ next: (t) => { this.tasks = t; this.cdr.detectChanges(); } });
  }

  addTask(): void {
    if (!this.newTaskTitle.trim()) return;
    this.http
      .post<Task>(`${environment.apiUrl}/applications/${this.applicationId}/tasks`, {
        applicationId: this.applicationId,
        title: this.newTaskTitle.trim(),
        priority: 'medium',
      })
      .subscribe({
        next: (t) => {
          this.tasks = [...this.tasks, t];
          this.newTaskTitle = '';
          this.cdr.detectChanges();
        },
        error: () => { this.toast.error('Failed to add task.'); }
      });
  }

  toggleTask(task: Task): void {
    this.http
      .patch<Task>(`${environment.apiUrl}/tasks/${task.id}`, { completed: !task.completed })
      .subscribe({
        next: (t) => {
          const idx = this.tasks.findIndex(it => it.id === t.id);
          if (idx > -1) {
            this.tasks = [...this.tasks.slice(0, idx), t, ...this.tasks.slice(idx + 1)];
          }
          this.cdr.detectChanges();
        }
      });
  }

  deleteTask(id: string): void {
    this.http.delete(`${environment.apiUrl}/tasks/${id}`).subscribe({
      next: () => { this.tasks = this.tasks.filter(t => t.id !== id); this.cdr.detectChanges(); }
    });
  }

  // ── Evaluation ────────────────────────────────────────────────
  loadEvaluation(): void {
    if (!this.app?.jobId) {
      this.evaluationLoading = false;
      this.cdr.detectChanges();
      return;
    }
    this.evaluationLoading = true;

    const reqs$ = this.http.get<JobCompetency[]>(`${environment.apiUrl}/job-offers/${this.app.jobId}/requirements`);
    const scores$ = this.http.get<Record<string, number>>(`${environment.apiUrl}/applications/${this.applicationId}/competencies`);

    forkJoin([reqs$, scores$])
      .pipe(finalize(() => { this.evaluationLoading = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: ([reqs, rawScores]) => {
          this.jobCompetencies = reqs;
          // Coerce all score values to numbers (backend may return strings)
          const coerced: Record<string, number> = {};
          Object.entries(rawScores || {}).forEach(([k, v]) => { coerced[k] = Number(v); });
          this.competencyScores = coerced;
          this.cdr.detectChanges();
        },
        error: () => this.toast.error('Failed to load evaluation data.')
      });
  }

  openAssessment(): void {
    this.showAssessmentPanel = true;
    this.cdr.detectChanges();
  }

  onAssessmentSubmitted(): void {
    this.showAssessmentPanel = false;
    this.loadEvaluation();
    this.loadScore();
    this.toast.success('Assessment submitted successfully.');
    this.cdr.detectChanges();
  }

  updateCompetencyRating(compId: string, level: number): void {
    if (this.savingCompId) return;

    // Toggle off if clicking same level
    const current = this.competencyScores[compId];
    const newLevel = current === level ? 0 : level;

    const oldScores = { ...this.competencyScores };
    this.competencyScores = { ...this.competencyScores, [compId]: newLevel };
    this.savingCompId = compId;
    this.cdr.detectChanges();

    this.http
      .put(`${environment.apiUrl}/applications/${this.applicationId}/competencies/${compId}`, { evaluatedLevel: newLevel })
      .pipe(finalize(() => { this.savingCompId = null; this.cdr.detectChanges(); }))
      .subscribe({
        next: () => {
          this.toast.success('Rating updated.');
          this.loadScore();
        },
        error: () => {
          this.competencyScores = oldScores;
          this.toast.error('Failed to save rating.');
        }
      });
  }

  getEvaluationGroups(): [string, JobCompetency[]][] {
    const groups: Record<string, JobCompetency[]> = {};
    this.jobCompetencies.forEach(jc => {
      const cat = (jc.category || 'TECHNICAL').toUpperCase();
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(jc);
    });
    return Object.entries(groups).filter(([, items]) => items.length > 0);
  }

  getCategoryStats(items: JobCompetency[]) {
    const rated = items.filter(it => (this.competencyScores[it.competenceId] ?? 0) > 0).length;
    return { rated, total: items.length, pct: Math.round((rated / items.length) * 100) };
  }

  getGapInfo(required: number, evaluated?: number) {
    if (evaluated === undefined || evaluated === null || evaluated === 0) return null;
    const gap = evaluated - required;
    return {
      value: gap > 0 ? `+${gap}` : gap === 0 ? '=' : `${gap}`,
      status: gap >= 0 ? 'match' : gap === -1 ? 'near' : 'gap'
    };
  }

  getGapColor(required: number, evaluated?: number): string {
    if (!evaluated) return 'var(--text-muted)';
    const gap = evaluated - required;
    if (gap >= 0) return 'var(--success)';
    if (gap === -1) return 'var(--warning)';
    return 'var(--danger)';
  }

  // ── Activity ───────────────────────────────────────────────────
  loadActivity(): void {
    this.activityLoading = true;
    this.http
      .get<any[]>(`${environment.apiUrl}/applications/${this.applicationId}/activity`)
      .pipe(finalize(() => { this.activityLoading = false; this.cdr.detectChanges(); }))
      .subscribe({ next: (a) => { this.activity = a; this.cdr.detectChanges(); } });
  }

  getActivityIcon(action: string): string {
    const map: Record<string, string> = {
      application_created: '📥', stage_changed: '🔀', note_added: '📝',
      assessfirst_uploaded: '🧠', score_calculated: '⭐', email_sent: '📧',
      interview_scheduled: '📅', interview_completed: '✅', task_created: '📌',
      task_completed: '✔️', note_deleted: '🗑️',
    };
    return map[action] ?? '🔹';
  }

  formatActivityLabel(action: string): string {
    return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  // ── Promote to Employee (modal-based) ──────────────────────────
  openPromoteModal(): void {
    this.promoteForm = {
      employeeId: `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
      hireDate: new Date().toISOString().split('T')[0],
      managerId: ''
    };
    this.showPromoteModal = true;
    
    this.employeeService.getManagers().subscribe({
      next: (m) => {
        this.managers = m;
        this.cdr.detectChanges();
      },
      error: () => this.toast.error('Failed to load manager list.')
    });
    
    this.cdr.detectChanges();
  }

  confirmPromotion(): void {
    if (!this.promoteForm.employeeId.trim() || !this.promoteForm.hireDate) {
      this.toast.error('Please fill in employee ID and hire date.');
      return;
    }
    this.promoting = true;
    this.cdr.detectChanges();

    this.employeeService.promoteCandidate({
      applicationId: this.applicationId,
      employeeId: this.promoteForm.employeeId.trim(),
      hireDate: this.promoteForm.hireDate,
      managerId: this.promoteForm.managerId || undefined
    }).pipe(finalize(() => { this.promoting = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: (emp) => {
          this.showPromoteModal = false;
          this.toast.success('Candidate successfully promoted to Employee!');
          this.router.navigate(['/employees', emp.id]);
        },
        error: (err) => {
          this.toast.error(err.error?.message || 'Failed to promote candidate.');
        }
      });
  }

  // ── Navigation ─────────────────────────────────────────────────
  goBack(): void {
    if (this.app?.jobId) {
      this.router.navigate(['/job-offers', this.app.jobId, 'pipeline']);
    } else {
      this.router.navigate(['/job-offers']);
    }
  }

  viewCandidateProfile(): void {
    if (this.app?.candidateId) this.router.navigate(['/candidates', this.app.candidateId]);
  }

  hasSkill(skill: string): boolean {
    if (!this.app?.skills || !skill) return false;
    const s = skill.toLowerCase();
    return this.app.skills.some((cs: string) => cs.toLowerCase() === s || cs.toLowerCase().includes(s));
  }

  // ── Score helpers ──────────────────────────────────────────────
  scoreColor(score: number): string {
    if (score >= 80) return '#22c55e';
    if (score >= 65) return '#6d55fa';
    if (score >= 50) return '#f59e0b';
    return '#f43f5e';
  }

  scoreGradient(score: number): string {
    if (score >= 80) return 'linear-gradient(135deg,#22c55e,#16a34a)';
    if (score >= 65) return 'linear-gradient(135deg,#6d55fa,#9b4dfa)';
    if (score >= 50) return 'linear-gradient(135deg,#f59e0b,#d97706)';
    return 'linear-gradient(135deg,#f43f5e,#dc2626)';
  }

  gaugeOffset(score: number): number {
    const clamped = Math.min(100, Math.max(0, score));
    return 339.3 - (clamped / 100) * 339.3;
  }

  scoreLabel(score: number): string {
    if (score >= 80) return 'Exceptional';
    if (score >= 60) return 'Strong';
    if (score >= 40) return 'Fair';
    return 'Weak';
  }

  // ── Interview icon helper (case-insensitive) ───────────────────
  getInterviewIcon(type: string): string {
    const t = (type || '').toLowerCase();
    if (t === 'technical') return '⚙️';
    if (t === 'final') return '🏁';
    return '💬';
  }

  // ── Misc helpers ───────────────────────────────────────────────
  getInitials(name: string): string {
    return (name || '?').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  }

  noteInitials(name: string): string {
    return (name || '?').split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  }

  skillColor(i: number): string {
    return ['indigo', 'purple', 'blue', 'cyan', 'teal'][i % 5];
  }

  languageLevelWidth(level?: string): number {
    return ({ native: 100, fluent: 85, advanced: 70, intermediate: 50, beginner: 30, basic: 25 } as any)[(level || '').toLowerCase()] ?? 50;
  }

  formatDate(d: string): string {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  formatNoteDate(d: string): string {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  formatDuration(start?: string, end?: string): string {
    if (!start) return '';
    const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    return `${fmt(start)} — ${end ? fmt(end) : 'Present'}`;
  }

  getStageBadgeClass(stage: string): string {
    const map: Record<string, string> = {
      applied: 'stage--applied',
      screening: 'stage--screening',
      interview: 'stage--interview',
      assessment: 'stage--assessment',
      offer: 'stage--offer',
      rejected: 'stage--rejected',
    };
    return map[stage] ?? '';
  }

  trackByNote(_: number, n: any): string { return n.id; }
  trackByAct(_: number, a: any): string { return a.id; }
  trackByTask(_: number, t: Task): string { return t.id; }
}