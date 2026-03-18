import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule }                          from '@angular/common';
import { FormsModule }                           from '@angular/forms';
import { ActivatedRoute, Router, RouterLink }    from '@angular/router';
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
  id:        string;
  note:      string;
  rating:    number;
  stage:     NoteStage;
  createdAt: string;
  author:    NoteAuthor;
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

@Component({
  selector:    'app-candidate-profile',
  standalone:  true,
  imports:     [CommonModule, FormsModule, RouterLink],
  templateUrl: './candidate-profile.component.html',
  styleUrls:   ['./candidate-profile.component.scss'],
})
export class CandidateProfileComponent implements OnInit {

  candidate: CandidateProfile | null = null;
  loading   = true;
  error     = '';
  activeTab = 'overview';

  // ✅ Back navigation — set from query param
  backRoute = '/chatbot';
  backLabel = 'Back to search';

  // Inline feedback
  successMessage = '';
  errorBanner    = '';

  // Notes
  notes:        CandidateNoteDto[] = [];
  notesLoading  = false;
  submitting    = false;
  newNote       = '';
  newRating     = 0;
  newStage: NoteStage = 'screening';

  // AssessFirst
  afResult:   AssessFirstResult | null = null;
  afLoading   = false;
  afUploading = false;
  afError     = '';

  // Email Modal
  showEmailModal  = false;
  emailType: 'invite' | 'status' = 'invite';
  emailStatus: NoteStage = 'screening';
  emailSubmitting = false;

  // Exports
  exportingPdf   = false;
  exportingExcel = false;

  // Delete
  deleting = false;

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
    { id: 'education',   label: 'Education',     icon: 'M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z' },
    { id: 'notes',       label: 'Manager Notes', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
    { id: 'assessfirst', label: 'Soft Skills',   icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  ];

  readonly navItems = [
    { label: 'Dashboard', route: '/dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { label: 'Upload CV',  route: '/cv-upload', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12' },
    { label: 'AI Search',  route: '/chatbot',   icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
    { label: 'Candidates', route: '/candidates', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
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

    // ✅ Set back button based on where the user came from
    if (from === 'candidates') {
      this.backRoute = '/candidates';
      this.backLabel = 'Back to candidates';
    } else {
      this.backRoute = '/chatbot';
      this.backLabel = 'Back to search';
    }

    if (!id) { this.error = 'No candidate ID provided.'; this.loading = false; return; }
    this.loadProfile(id);
  }

  private get apiUrl(): string { return environment.apiUrl; }

  private loadProfile(id: string): void {
    this.http.get<CandidateProfile>(`${this.apiUrl}/candidates/${id}`)
      .subscribe({
        next: c => {
          this.candidate = c;
          this.loading   = false;
          this.loadNotes(id);
          this.loadAssessFirst(id);
          this.cdr.detectChanges();
        },
        error: err => {
          this.error   = err.status === 404 ? 'Candidate not found.' : 'Failed to load profile.';
          this.loading = false;
          this.cdr.detectChanges();
        },
      });
  }

  loadNotes(candidateId: string): void {
    this.notesLoading = true;
    this.http.get<CandidateNoteDto[]>(`${this.apiUrl}/candidates/${candidateId}/notes`)
      .pipe(finalize(() => { this.notesLoading = false; this.cdr.detectChanges(); }))
      .subscribe({
        next:  notes => { this.notes = notes; },
        error: ()    => {},
      });
  }

  submitNote(): void {
    if (!this.newNote.trim() || !this.candidate) return;
    this.submitting = true;
    this.http.post<CandidateNoteDto>(
      `${this.apiUrl}/candidates/${this.candidate.candidateId}/notes`,
      { note: this.newNote.trim(), rating: this.newRating, stage: this.newStage },
    ).pipe(
      finalize(() => { this.submitting = false; this.cdr.detectChanges(); })
    ).subscribe({
      next: note => {
        this.notes     = [note, ...this.notes];
        this.newNote   = '';
        this.newRating = 0;
        this.newStage  = 'screening';
        this.showSuccess('Note saved successfully.');
      },
      error: () => { this.showError('Failed to save note. Please try again.'); },
    });
  }

  loadAssessFirst(candidateId: string): void {
    this.afLoading = true;
    this.http.get<AssessFirstResult | null>(
      `${this.apiUrl}/candidates/${candidateId}/assessfirst`
    ).pipe(
      finalize(() => { this.afLoading = false; this.cdr.detectChanges(); })
    ).subscribe({
      next:  r  => { this.afResult = r; },
      error: () => {},
    });
  }

  uploadAssessFirst(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file || !this.candidate) return;
    this.afUploading = true;
    this.afError     = '';
    const form = new FormData();
    form.append('file', file);
    this.http.post<AssessFirstResult>(
      `${this.apiUrl}/candidates/${this.candidate.candidateId}/assessfirst`,
      form,
    ).pipe(
      finalize(() => { this.afUploading = false; this.cdr.detectChanges(); })
    ).subscribe({
      next:  r   => { this.afResult = r; },
      error: err => { this.afError  = err.error?.message ?? 'Upload failed. Please try again.'; },
    });
    input.value = '';
  }

  openEmailModal():  void { this.showEmailModal = true;  }
  closeEmailModal(): void { this.showEmailModal = false; }

  sendEmail(): void {
    if (!this.candidate) return;
    this.emailSubmitting = true;
    this.http.post(
      `${this.apiUrl}/candidates/${this.candidate.candidateId}/send-email`,
      { type: this.emailType, status: this.emailType === 'status' ? this.emailStatus : undefined },
    ).pipe(
      finalize(() => { this.emailSubmitting = false; this.cdr.detectChanges(); })
    ).subscribe({
      next: () => { this.closeEmailModal(); this.showSuccess('Email sent successfully.'); },
      error: err => { this.closeEmailModal(); this.showError(err.error?.message ?? 'Failed to send email.'); },
    });
  }

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
    if (isPdf) this.exportingPdf = true;
    else       this.exportingExcel = true;
    this.cdr.detectChanges();
    this.http.get(url, { responseType: 'blob' })
      .pipe(finalize(() => {
        if (isPdf) this.exportingPdf = false;
        else       this.exportingExcel = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: blob => {
          const a   = document.createElement('a');
          const url = URL.createObjectURL(blob);
          a.href = url; a.download = filename; a.click();
          URL.revokeObjectURL(url);
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
        next:  () => { this.router.navigate([this.backRoute]); }, // ✅ go back to where they came from
        error: () => { this.showError('Failed to delete candidate data.'); },
      });
  }

  setTab(tab: string): void {
    this.activeTab = tab;
    if (tab === 'notes' && this.candidate && !this.notesLoading) {
      this.loadNotes(this.candidate.candidateId);
    }
    if (tab === 'assessfirst' && this.candidate && !this.afResult && !this.afLoading) {
      this.loadAssessFirst(this.candidate.candidateId);
    }
  }

  private showSuccess(msg: string): void {
    this.successMessage = msg; this.errorBanner = '';
    this.cdr.detectChanges();
    setTimeout(() => { this.successMessage = ''; this.cdr.detectChanges(); }, 4000);
  }

  private showError(msg: string): void {
    this.errorBanner = msg; this.successMessage = '';
    this.cdr.detectChanges();
    setTimeout(() => { this.errorBanner = ''; this.cdr.detectChanges(); }, 5000);
  }

  setRating(r: number): void { this.newRating = this.newRating === r ? 0 : r; }

  stageLabel(stage: NoteStage): string {
    return ({ screening: 'Screening', interview: 'Interview', offer: 'Offer', rejected: 'Rejected' } as any)[stage] ?? stage;
  }

  stars(n: number): number[] { return [1, 2, 3, 4, 5]; }

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

  get userRole():    string { return this.auth.getCurrentUser()?.role ?? 'hr'; }
  get userInitials(): string {
    return this.userName.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase();
  }

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
    return new Date(d).toLocaleDateString('en-US', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  skillColor(i: number): string {
    return ['indigo', 'purple', 'blue', 'cyan', 'teal'][i % 5];
  }

  languageLevelWidth(level?: string): number {
    return ({
      native: 100, fluent: 85, advanced: 70,
      intermediate: 50, beginner: 30, basic: 25,
    } as any)[(level ?? '').toLowerCase()] ?? 50;
  }
}