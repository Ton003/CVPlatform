import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule }                          from '@angular/common';
import { FormsModule }                           from '@angular/forms';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { HttpClient }                            from '@angular/common/http';
import { finalize }                              from 'rxjs';
import { AuthService }                           from '../../core/services/auth.service';
import { environment }                           from '../../../environments/environment';

interface CandidateProfile {
  candidateId:  string;
  name:         string;
  email:        string | null;
  location:     string | null;
  currentTitle: string | null;
  yearsExp:     number | null;
  createdAt:    string | null;
  summary:      string | null;
  skills:       string[];
  education:    EducationEntry[];
  experience:   ExperienceEntry[];
  languages:    LanguageEntry[];
}

interface EducationEntry {
  degree?:      string;
  institution?: string;
  startDate?:   string;
  endDate?:     string;
  field?:       string;
}

interface ExperienceEntry {
  title?:       string;
  company?:     string;
  startDate?:   string;
  start_date?:  string;
  endDate?:     string;
  end_date?:    string;
  description?: string;
}

interface LanguageEntry {
  name?:  string;
  level?: string;
}

export type NoteStage = 'screening' | 'interview' | 'offer' | 'rejected';
interface NoteAuthor { id: string; name: string; role: string; }
interface CandidateNoteDto {
  id: string; note: string; rating: number; stage: NoteStage; createdAt: string; author: NoteAuthor;
}

interface AssessFirstResult {
  candidateName:       string | null;
  assessmentDate:      string | null;
  personalStyle:       string | null;
  personalStyleDesc:   string | null;
  traits:              string[];
  improvements:        string[];
  talentCloud:         Record<string, string[]>;
  dimensionDetails:    Record<string, Record<string, string[]>>;
  topMotivators:       string[];
  lowMotivators:       string[];
  preferredActivities: Array<{ name: string; description: string }>;
  managementStyle:     Array<{ label: string; pct: number }>;
  soughtManagement:    Array<{ label: string; pct: number }>;
  cultureFit:          string | null;
  cultureDesc:         string | null;
  decisionMaking:      string | null;
  preferredTasks:      string | null;
  learningStyle:       string | null;
  aptitudeDesc:        string | null;
}

interface CandidateScore {
  compositeScore: number;
  label:          string;
  breakdown: {
    technical:   { score: number;        weight: number; role: string;  available: boolean };
    assessfirst: { score: number | null; weight: number;                available: boolean };
    manager:     { score: number | null; weight: number; noteCount: number; available: boolean };
  };
  roleSuggestions: Array<{ role: string; score: number; matchedSkills: string[] }>;
}

@Component({
  selector:    'app-candidate-profile',
  standalone:  true,
  imports:     [CommonModule, FormsModule, RouterLink, RouterLinkActive],
  templateUrl: './candidate-profile.component.html',
  styleUrls:   ['./candidate-profile.component.scss'],
})
export class CandidateProfileComponent implements OnInit {

  candidate: CandidateProfile | null = null;
  loading   = true;
  error     = '';
  activeTab = 'overview';

  backRoute = '/chatbot';
  backLabel = 'Back to search';

  successMessage = '';
  errorBanner    = '';

  notes:       CandidateNoteDto[] = [];
  notesLoading = false;
  submitting   = false;
  deletingNoteId = '';
  newNote      = '';
  newRating    = 0;
  newStage: NoteStage = 'screening';

  afResult:   AssessFirstResult | null = null;
  afLoading   = false;
  afUploading = false;
  afError     = '';

  scoreData:   CandidateScore | null = null;
  scoreLoading = false;

  showEmailModal   = false;
  emailType: 'assessfirst' | 'interview' | 'status' = 'assessfirst';
  emailStatus: NoteStage = 'screening';
  interviewDate = '';
  interviewLocation = '';
  emailSubmitting  = false;

  exportingPdf   = false;
  exportingExcel = false;
  deleting       = false;

  readonly stages: { value: NoteStage; label: string }[] = [
    { value: 'screening', label: 'Screening' },
    { value: 'interview', label: 'Interview' },
    { value: 'offer',     label: 'Offer'     },
    { value: 'rejected',  label: 'Rejected'  },
  ];

  readonly afDimensions = [
    { key: 'Influence', emoji: '🤝', subs: ['Build relationships', 'Take the lead', 'Unite and mobilise'] },
    { key: 'Cooperate', emoji: '💬', subs: ['Communicate with diplomacy', 'Provide support', 'Work collaboratively'] },
    { key: 'Think',     emoji: '💡', subs: ['Anticipate challenges', 'Develop a vision', 'Innovate'] },
    { key: 'Act',       emoji: '🚀', subs: ['Take initiative', 'Plan and organise', 'Inspect and improve'] },
    { key: 'Feel',      emoji: '❤️', subs: ['Spread enthusiasm', 'React swiftly', 'Handle stress'] },
  ];

  readonly tabs = [
    { id: 'overview',    label: 'Overview',      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { id: 'experience',  label: 'Experience',    icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
    { id: 'education',   label: 'Education',     icon: 'M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0112 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z' },
    { id: 'notes',       label: 'Manager Notes', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
    { id: 'assessfirst', label: 'Soft Skills',   icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { id: 'scoring',     label: 'Scoring',       icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' },
  ];

  readonly navItems = [
    { label: 'Search',     route: '/chatbot',    icon: 'M21 21l-4.35-4.35m1.85-5.65a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0z' },
    { label: 'Candidates', route: '/candidates', icon: 'M17 20h5V4H2v16h5m10 0v-2a4 4 0 00-3-3.87M7 20v-2a4 4 0 013-3.87m0 0a4 4 0 10-6 0m6 0a4 4 0 106 0' },
    { label: 'Job Offers', route: '/job-offers', icon: 'M3 7h18M3 12h18M3 17h18' },
    { label: 'Analytics',  route: '/analytics',  icon: 'M11 3v18M3 11h18' },
    { label: 'Settings',   route: '/settings',   icon: 'M10.325 4.317a1 1 0 011.35-.936l.847.49a1 1 0 00.95 0l.847-.49a1 1 0 011.35.936l.165.977a1 1 0 00.564.733l.888.444a1 1 0 010 1.788l-.888.444a1 1 0 00-.564.733l-.165.977a1 1 0 01-1.35.936l-.847-.49a1 1 0 00-.95 0l-.847.49a1 1 0 01-1.35-.936l-.165-.977a1 1 0 00-.564-.733l-.888-.444a1 1 0 010-1.788l.888-.444a1 1 0 00.564-.733l.165-.977z' },
  ];

  constructor(
    private readonly route:  ActivatedRoute,
    private readonly router: Router,
    private readonly http:   HttpClient,
    private readonly auth:   AuthService,
    private readonly cdr:    ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const id   = this.route.snapshot.paramMap.get('id');
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
        this.candidate = c; this.loading = false;
        this.loadNotes(id);
        this.loadAssessFirst(id);
        this.loadScore(id);
        this.cdr.detectChanges();
      },
      error: err => {
        this.error   = err.status === 404 ? 'Candidate not found.' : 'Failed to load profile.';
        this.loading = false; this.cdr.detectChanges();
      },
    });
  }

  // ── Notes ──────────────────────────────────────────────────────
  loadNotes(candidateId: string): void {
    this.notesLoading = true;
    this.http.get<CandidateNoteDto[]>(`${this.apiUrl}/candidates/${candidateId}/notes`)
      .pipe(finalize(() => { this.notesLoading = false; this.cdr.detectChanges(); }))
      .subscribe({ next: notes => { this.notes = notes; }, error: () => {} });
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
        this.newNote = ''; this.newRating = 0; this.newStage = 'screening';
        this.showSuccess('Note saved successfully.');
        // Refresh score when a rated note is added
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
          const removedNote = this.notes.find(n => n.id === noteId);
          this.notes = this.notes.filter(n => n.id !== noteId);
          this.showSuccess('Note deleted successfully.');
          if (removedNote?.rating && removedNote.rating > 0 && this.candidate) {
            this.loadScore(this.candidate.candidateId);
          }
        },
        error: () => { this.showError('Failed to delete note.'); }
      });
  }

  canDeleteNote(note: CandidateNoteDto): boolean {
    const user = this.auth.getCurrentUser();
    if (!user) return false;
    return note.author.id === user.id || user.role === 'admin';
  }

  // ── AssessFirst ────────────────────────────────────────────────
  loadAssessFirst(candidateId: string): void {
    this.afLoading = true;
    this.http.get<AssessFirstResult | null>(`${this.apiUrl}/candidates/${candidateId}/assessfirst`)
      .pipe(finalize(() => { this.afLoading = false; this.cdr.detectChanges(); }))
      .subscribe({ next: r => { this.afResult = r; }, error: () => {} });
  }

  uploadAssessFirst(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file || !this.candidate) return;
    this.afUploading = true; this.afError = '';
    const form = new FormData();
    form.append('file', file);
    this.http.post<AssessFirstResult>(`${this.apiUrl}/candidates/${this.candidate.candidateId}/assessfirst`, form)
      .pipe(finalize(() => { this.afUploading = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: r => {
          this.afResult = r;
          // Refresh score now that AssessFirst is available
          if (this.candidate) this.loadScore(this.candidate.candidateId);
        },
        error: err => { this.afError = err.error?.message ?? 'Upload failed.'; },
      });
    input.value = '';
  }

  // ── Scoring ────────────────────────────────────────────────────
  loadScore(candidateId: string): void {
    this.scoreLoading = true;
    this.http.get<CandidateScore>(`${this.apiUrl}/candidates/${candidateId}/score`)
      .pipe(finalize(() => { this.scoreLoading = false; this.cdr.detectChanges(); }))
      .subscribe({ next: s => { this.scoreData = s; }, error: () => {} });
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

  // Circular gauge: SVG stroke-dashoffset for a 0-100 value
  // Circle circumference = 2 * π * r = 2 * 3.14159 * 54 ≈ 339.3
  gaugeOffset(score: number): number {
    const circumference = 339.3;
    return circumference - (score / 100) * circumference;
  }

  // ── Email ──────────────────────────────────────────────────────
  openEmailModal():  void { this.showEmailModal = true; }
  closeEmailModal(): void { this.showEmailModal = false; }

  sendEmail(): void {
    if (!this.candidate) return;
    this.emailSubmitting = true;
    
    const payload: any = { type: this.emailType };
    if (this.emailType === 'status')    payload.status = this.emailStatus;
    if (this.emailType === 'interview') {
      payload.interviewDate = this.interviewDate;
      payload.interviewLocation = this.interviewLocation;
    }

    this.http.post(
      `${this.apiUrl}/candidates/${this.candidate.candidateId}/send-email`,
      payload
    ).pipe(finalize(() => { this.emailSubmitting = false; this.cdr.detectChanges(); }))
    .subscribe({
      next:  () =>  { this.closeEmailModal(); this.showSuccess('Email sent successfully.'); },
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
      .pipe(finalize(() => { if (isPdf) this.exportingPdf = false; else this.exportingExcel = false; this.cdr.detectChanges(); }))
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
    this.deleting = true; this.cdr.detectChanges();
    this.http.delete(`${this.apiUrl}/candidates/${this.candidate.candidateId}`)
      .pipe(finalize(() => { this.deleting = false; this.cdr.detectChanges(); }))
      .subscribe({
        next:  () => { this.router.navigate([this.backRoute]); },
        error: () => { this.showError('Failed to delete candidate data.'); },
      });
  }

  // ── Tab routing ────────────────────────────────────────────────
  setTab(tab: string): void {
    this.activeTab = tab;
    if (tab === 'notes'       && this.candidate && !this.notesLoading)                      this.loadNotes(this.candidate.candidateId);
    if (tab === 'assessfirst' && this.candidate && !this.afResult    && !this.afLoading)    this.loadAssessFirst(this.candidate.candidateId);
    if (tab === 'scoring'     && this.candidate && !this.scoreData   && !this.scoreLoading) this.loadScore(this.candidate.candidateId);
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
    return ({ screening: 'Screening', interview: 'Interview', offer: 'Offer', rejected: 'Rejected' } as any)[stage] ?? stage;
  }

  stars(n: number): number[] { return [1, 2, 3, 4, 5]; }
  noteInitials(name: string): string { return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase(); }

  get initials(): string {
    if (!this.candidate?.name) return '?';
    return this.candidate.name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  }

  get userName(): string {
    const u = this.auth.getCurrentUser();
    return u ? `${u.first_name} ${u.last_name}` : 'HR Manager';
  }

  get userRole():     string { return this.auth.getCurrentUser()?.role ?? 'hr'; }
  get userInitials(): string { return this.userName.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase(); }

  logout(): void { this.auth.logout(); }

  formatDate(d: string | null | undefined): string {
    if (!d) return '';
    const date = new Date(d);
    return isNaN(date.getTime()) ? d : date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }

  formatDuration(start?: string, end?: string): string {
    if (!start) return '';
    return `${this.formatDate(start)} – ${end ? this.formatDate(end) : 'Present'}`;
  }

  formatNoteDate(d: string): string {
    return new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  skillColor(i: number): string { return ['indigo', 'purple', 'blue', 'cyan', 'teal'][i % 5]; }

  languageLevelWidth(level?: string): number {
    return ({ native: 100, fluent: 85, advanced: 70, intermediate: 50, beginner: 30, basic: 25 } as any)[(level ?? '').toLowerCase()] ?? 50;
  }
}