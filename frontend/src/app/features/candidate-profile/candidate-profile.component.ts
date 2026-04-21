import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';
import { CountByStatusPipe } from '../../shared/pipes/count-by-status.pipe';

interface CandidateProfile {
  candidateId: string;
  name: string;
  email: string | null;
  location: string | null;
  currentTitle: string | null;
  yearsExp: number | null;
  createdAt: string | null;
  summary: string | null;
  skills: string[];
  education: EducationEntry[];
  experience: ExperienceEntry[];
  languages: LanguageEntry[];
  competencySnapshot: Record<string, { level: number; name: string }>;
}

interface EducationEntry {
  degree?: string;
  institution?: string;
  startDate?: string;
  endDate?: string;
  field?: string;
}

interface ExperienceEntry {
  title?: string;
  company?: string;
  startDate?: string;
  start_date?: string;
  endDate?: string;
  end_date?: string;
  description?: string;
  sfiaTags?: any[];
  source?: 'AI' | 'MANUAL';
}

interface LanguageEntry {
  name?: string;
  level?: string;
}

export type NoteStage = 'screening' | 'interview' | 'offer' | 'rejected';

interface NoteAuthor { id: string; name: string; role: string; }

interface CandidateNoteDto {
  id: string;
  note: string;
  rating: number;
  stage: NoteStage;
  createdAt: string;
  author: NoteAuthor;
}

interface CandidateScore {
  compositeScore: number;
  label: string;
  breakdown: {
    technical: { score: number; weight: number; role: string; available: boolean };
    manager: { score: number | null; weight: number; noteCount: number; available: boolean };
  };
  roleSuggestions: Array<{ role: string; score: number; matchedSkills: string[] }>;
}

@Component({
  selector: 'app-candidate-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CountByStatusPipe],
  templateUrl: './candidate-profile.component.html',
  styleUrls: ['./candidate-profile.component.scss'],
})
export class CandidateProfileComponent implements OnInit {

  candidate: CandidateProfile | null = null;
  loading = true;
  error = '';
  activeTab = 'overview';

  backRoute = '/chatbot';
  backLabel = 'Back to search';

  successMessage = '';
  errorBanner = '';

  notes: CandidateNoteDto[] = [];
  notesLoading = false;
  submitting = false;
  deletingNoteId = '';
  newNote = '';
  newRating = 0;
  newStage: NoteStage = 'screening';

  scoreData: CandidateScore | null = null;
  scoreLoading = false;

  showEmailModal = false;
  emailType: 'interview' | 'status' | 'invite' = 'interview';
  emailStatus: NoteStage = 'screening';
  interviewDate = '';
  interviewLocation = '';
  emailSubmitting = false;

  exportingPdf = false;
  exportingExcel = false;
  deleting = false;

  showAddToJobModal = false;
  jobs: { id: string; title: string; status: string }[] = [];
  selectedJobId = '';
  jobsLoading = false;
  isAddingToJob = false;

  // Role Comparison
  roles: any[] = [];
  selectedCompareRoleId = '';
  comparisonData: any = null;
  comparing = false;

  readonly stages: { value: NoteStage; label: string }[] = [
    { value: 'screening', label: 'Screening' },
    { value: 'interview', label: 'Interview' },
    { value: 'offer', label: 'Offer' },
    { value: 'rejected', label: 'Rejected' },
  ];

  readonly afDimensions = [
    { key: 'Influence', emoji: '🤝', subs: ['Build relationships', 'Take the lead', 'Unite and mobilise'] },
    { key: 'Cooperate', emoji: '💬', subs: ['Communicate with diplomacy', 'Provide support', 'Work collaboratively'] },
    { key: 'Think', emoji: '💡', subs: ['Anticipate challenges', 'Develop a vision', 'Innovate'] },
    { key: 'Act', emoji: '🚀', subs: ['Take initiative', 'Plan and organise', 'Inspect and improve'] },
    { key: 'Feel', emoji: '❤️', subs: ['Spread enthusiasm', 'React swiftly', 'Handle stress'] },
  ];

  readonly tabs = [
    { id: 'overview', label: 'Overview', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { id: 'experience', label: 'Experience', icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
    { id: 'education', label: 'Education', icon: 'M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0112 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z' },
    { id: 'scoring', label: 'Score', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { id: 'gap', label: 'Gap Analysis', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { id: 'notes', label: 'Manager Notes', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
  ];

  readonly starsArray = [1, 2, 3, 4, 5];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly http: HttpClient,
    private readonly auth: AuthService,
    private readonly cdr: ChangeDetectorRef,
  ) { }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    const from = this.route.snapshot.queryParamMap.get('from');

    if (from === 'candidates') {
      this.backRoute = '/candidates'; this.backLabel = 'Back to candidates';
    } else if (from === 'job-offers') {
      this.backRoute = '/job-offers'; this.backLabel = 'Back to job offers';
    } else {
      this.backRoute = '/chatbot'; this.backLabel = 'Back to search';
    }

    if (!id) { this.error = 'No candidate ID provided.'; this.loading = false; return; }
    this.loadProfile(id);
  }

  private get apiUrl(): string { return environment.apiUrl; }

  private loadProfile(id: string): void {
    this.http.get<CandidateProfile>(`${this.apiUrl}/candidates/${id}`).subscribe({
      next: c => {
        this.candidate = c;
        this.loading = false;
        this.loadNotes(id);
        this.loadScore(id);
        this.loadJobs();
        this.loadActiveRoles();
        this.cdr.detectChanges();
      },
      error: err => {
        this.error = err.status === 404 ? 'Candidate not found.' : 'Failed to load profile.';
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  // ── Notes ──────────────────────────────────────────────────────
  loadNotes(candidateId: string): void {
    this.notesLoading = true;
    this.http.get<CandidateNoteDto[]>(`${this.apiUrl}/candidates/${candidateId}/notes`)
      .pipe(finalize(() => { this.notesLoading = false; this.cdr.detectChanges(); }))
      .subscribe({ next: notes => { this.notes = notes; }, error: () => { } });
  }

  submitNote(): void {
    if (!this.newNote.trim() || !this.candidate) return;
    this.submitting = true;
    this.http.post<CandidateNoteDto>(
      `${this.apiUrl}/candidates/${this.candidate.candidateId}/notes`,
      { note: this.newNote.trim(), rating: this.newRating, stage: this.newStage },
    ).pipe(finalize(() => { this.submitting = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: note => {
          this.notes = [note, ...this.notes];
          this.newNote = '';
          this.newRating = 0;
          this.newStage = 'screening';
          this.showSuccess('Note saved successfully.');
          if (note.rating > 0 && this.candidate) this.loadScore(this.candidate.candidateId);
        },
        error: () => { this.showError('Failed to save note. Please try again.'); },
      });
  }

  deleteNote(noteId: string): void {
    if (!this.candidate) return;
    if (!confirm('Are you sure you want to delete this note?')) return;
    this.deletingNoteId = noteId;
    this.cdr.detectChanges();
    this.http.delete(`${this.apiUrl}/candidates/${this.candidate.candidateId}/notes/${noteId}`)
      .pipe(finalize(() => { this.deletingNoteId = ''; this.cdr.detectChanges(); }))
      .subscribe({
        next: () => {
          const removed = this.notes.find(n => n.id === noteId);
          this.notes = this.notes.filter(n => n.id !== noteId);
          this.showSuccess('Note deleted successfully.');
          if (removed?.rating && removed.rating > 0 && this.candidate) {
            this.loadScore(this.candidate.candidateId);
          }
        },
        error: () => { this.showError('Failed to delete note.'); },
      });
  }

  canDeleteNote(note: CandidateNoteDto): boolean {
    const user = this.auth.getCurrentUser();
    if (!user) return false;
    return note.author.id === user.id || user.role === 'admin';
  }

  // ── Scoring ────────────────────────────────────────────────────
  loadScore(candidateId: string): void {
    this.scoreLoading = true;
    this.http.get<CandidateScore>(`${this.apiUrl}/candidates/${candidateId}/score`)
      .pipe(finalize(() => { this.scoreLoading = false; this.cdr.detectChanges(); }))
      .subscribe({ next: s => { this.scoreData = s; }, error: () => { } });
  }

  scoreColor(score: number): string {
    if (score >= 80) return '#22c55e';
    if (score >= 65) return '#6d55fa';
    if (score >= 50) return '#f59e0b';
    return '#f43f5e';
  }

  scoreGradient(score: number): string {
    if (score >= 80) return 'linear-gradient(135deg, #22c55e, #16a34a)';
    if (score >= 65) return 'linear-gradient(135deg, #6d55fa, #9b4dfa)';
    if (score >= 50) return 'linear-gradient(135deg, #f59e0b, #d97706)';
    return 'linear-gradient(135deg, #f43f5e, #dc2626)';
  }

  roleMatchColor(score: number): string {
    if (score >= 70) return 'green';
    if (score >= 50) return 'indigo';
    return 'amber';
  }

  // Circle circumference = 2 * π * 54 ≈ 339.3
  gaugeOffset(score: number): number {
    const circumference = 339.3;
    return circumference - (score / 100) * circumference;
  }

  // ── Email ──────────────────────────────────────────────────────
  openEmailModal(): void { this.showEmailModal = true; }
  closeEmailModal(): void { this.showEmailModal = false; }

  sendEmail(): void {
    if (!this.candidate) return;
    this.emailSubmitting = true;

    const payload: any = { type: this.emailType };
    if (this.emailType === 'status') payload.status = this.emailStatus;
    if (this.emailType === 'interview') {
      payload.interviewDate = this.interviewDate;
      payload.interviewLocation = this.interviewLocation;
    }

    this.http.post(
      `${this.apiUrl}/candidates/${this.candidate.candidateId}/send-email`,
      payload,
    ).pipe(finalize(() => { this.emailSubmitting = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: () => { this.closeEmailModal(); this.showSuccess('Email sent successfully.'); },
        error: err => { this.closeEmailModal(); this.showError(err.error?.message ?? 'Failed to send email.'); },
      });
  }

  // ── Export / Delete ────────────────────────────────────────────
  exportPdf(): void {
    if (!this.candidate) return;
    const name = this.candidate.name.replace(/\s+/g, '-').toLowerCase();
    this.downloadFile(`${this.apiUrl}/candidates/${this.candidate.candidateId}/export/pdf`, `cv-report-${name}.pdf`, true);
  }

  exportExcel(): void {
    if (!this.candidate) return;
    const name = this.candidate.name.replace(/\s+/g, '-').toLowerCase();
    this.downloadFile(`${this.apiUrl}/candidates/${this.candidate.candidateId}/export/xlsx`, `cv-report-${name}.xlsx`, false);
  }

  private downloadFile(url: string, filename: string, isPdf: boolean): void {
    if (isPdf) this.exportingPdf = true; else this.exportingExcel = true;
    this.cdr.detectChanges();
    this.http.get(url, { responseType: 'blob' })
      .pipe(finalize(() => {
        if (isPdf) this.exportingPdf = false; else this.exportingExcel = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: blob => {
          const a = document.createElement('a');
          const u = URL.createObjectURL(blob);
          a.href = u; a.download = filename; a.click(); URL.revokeObjectURL(u);
        },
        error: () => { this.showError('Export failed. Please try again.'); },
      });
  }

  requestDeletion(): void {
    if (!this.candidate) return;
    if (!confirm(`Permanently delete ${this.candidate.name} and all associated data? This cannot be undone.`)) return;
    this.deleting = true;
    this.cdr.detectChanges();
    this.http.delete(`${this.apiUrl}/candidates/${this.candidate.candidateId}`)
      .pipe(finalize(() => { this.deleting = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: () => { this.router.navigate([this.backRoute]); },
        error: () => { this.showError('Failed to delete candidate data.'); },
      });
  }

  // ── Add to Job ──────────────────────────────────────────────────
  openAddToJobModal(): void {
    this.showAddToJobModal = true;
    this.selectedJobId = '';
    if (this.jobs.length === 0) this.loadJobs();
  }

  closeAddToJobModal(): void { this.showAddToJobModal = false; }

  loadJobs(): void {
    this.jobsLoading = true;
    this.http.get<any[]>(`${this.apiUrl}/job-offers?status=open`)
      .pipe(finalize(() => { this.jobsLoading = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: jobs => { this.jobs = jobs || []; this.cdr.detectChanges(); },
        error: () => { },
      });
  }

  addToJob(): void {
    if (!this.selectedJobId || !this.candidate) return;
    this.isAddingToJob = true;
    this.cdr.detectChanges();
    this.http.post(
      `${this.apiUrl}/job-offers/${this.selectedJobId}/applications/from-candidate`,
      { candidateId: this.candidate.candidateId },
    ).pipe(finalize(() => { this.isAddingToJob = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: () => {
          this.showSuccess('Candidate added to job pipeline.');
          this.closeAddToJobModal();
        },
        error: err => {
          if (err.status === 400) {
            this.showError(err.error?.message || 'Candidate already in pipeline.');
          } else {
            this.showError('Failed to add candidate to job.');
          }
        },
      });
  }

  // ── Gap Analysis ────────────────────────────────────────────────
  loadActiveRoles(): void {
    this.http.get<any[]>(`${this.apiUrl}/job-architecture/tree`).subscribe({
      next: (bus: any[]) => {
        const roles: any[] = [];
        (bus || []).forEach((bu: any) => {
          (bu.departments || []).forEach((d: any) => {
            (d.jobRoles || []).forEach((r: any) => {
              roles.push({ ...r, path: `${bu.name} > ${d.name}` });
            });
          });
        });
        this.roles = roles;
        this.cdr.detectChanges();
      },
      error: () => { },
    });
  }

  onCompareRoleChange(): void {
    if (!this.selectedCompareRoleId) { this.comparisonData = null; return; }
    this.comparing = true;
    this.cdr.detectChanges();
    this.http.get<any>(`${this.apiUrl}/job-architecture/roles/${this.selectedCompareRoleId}`)
      .pipe(finalize(() => { this.comparing = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: role => { this.comparisonData = this.calculateComparison(role); },
        error: () => { },
      });
  }

  private calculateComparison(role: any): any {
    const requirements = role.sfiaRequirements || [];
    const snapshot = this.candidate?.competencySnapshot || {};

    return requirements.map((req: any) => {
      const compId = req.competenceId || req.competence_id || req.competencyId;
      const candLvl = snapshot[compId]?.level ?? 0;
      const reqLvl = req.requiredLevel || req.required_level;

      return {
        competencyId: compId,
        name: req.competence?.name || req.name || 'Competency',
        requiredLevel: reqLvl,
        candidateLevel: candLvl,
        gap: candLvl - reqLvl,
        status: candLvl >= reqLvl ? 'met' : (candLvl >= reqLvl - 1 ? 'near' : 'gap'),
      };
    });
  }

  // ── Tab routing ────────────────────────────────────────────────
  setTab(tab: string): void {
    this.activeTab = tab;
    if (tab === 'notes' && this.candidate && !this.notesLoading) this.loadNotes(this.candidate.candidateId);
    if (tab === 'scoring' && this.candidate && !this.scoreData && !this.scoreLoading) this.loadScore(this.candidate.candidateId);
    if (tab === 'gap' && this.roles.length === 0) this.loadActiveRoles();
  }

  private showSuccess(msg: string): void {
    this.successMessage = msg; this.errorBanner = ''; this.cdr.detectChanges();
    setTimeout(() => { this.successMessage = ''; this.cdr.detectChanges(); }, 4000);
  }

  private showError(msg: string): void {
    this.errorBanner = msg; this.successMessage = ''; this.cdr.detectChanges();
    setTimeout(() => { this.errorBanner = ''; this.cdr.detectChanges(); }, 5000);
  }

  // ── Helpers ────────────────────────────────────────────────────
  setRating(r: number): void { this.newRating = this.newRating === r ? 0 : r; }

  stageLabel(stage: NoteStage): string {
    const map: Record<NoteStage, string> = {
      screening: 'Screening', interview: 'Interview', offer: 'Offer', rejected: 'Rejected',
    };
    return map[stage] ?? stage;
  }

  noteInitials(name: string): string {
    return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  }

  get initials(): string {
    if (!this.candidate?.name) return '?';
    return this.candidate.name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  }

  get userName(): string {
    const u = this.auth.getCurrentUser();
    return u ? `${u.first_name} ${u.last_name}` : 'HR Manager';
  }

  get userRole(): string { return this.auth.getCurrentUser()?.role ?? 'hr'; }
  get userInitials(): string {
    return this.userName.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase();
  }

  logout(): void { this.auth.logout(); }

  formatDate(d: string | null | undefined): string {
    if (!d) return '';
    const date = new Date(d);
    return isNaN(date.getTime()) ? d : date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }

  formatDuration(start?: string | null, end?: string | null): string {
    if (!start) return '';
    return `${this.formatDate(start)} – ${end ? this.formatDate(end) : 'Present'}`;
  }

  formatNoteDate(d: string): string {
    return new Date(d).toLocaleDateString('en-US', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  skillColor(i: number): string { return ['indigo', 'purple', 'blue', 'cyan', 'teal'][i % 5]; }

  languageLevelWidth(level?: string): number {
    const map: Record<string, number> = {
      native: 100, fluent: 85, advanced: 70, intermediate: 50, beginner: 30, basic: 25,
    };
    return map[(level ?? '').toLowerCase()] ?? 50;
  }

  gapStatusLabel(status: string): string {
    return { met: '✓ Met', near: '≈ Near', gap: '✗ Gap' }[status] ?? status;
  }
}