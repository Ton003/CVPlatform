import { Component, ChangeDetectorRef, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule }                  from '@angular/common';
import { FormsModule }                   from '@angular/forms';
import { HttpClient }                    from '@angular/common/http';
import { Router }                        from '@angular/router';
import { finalize }                      from 'rxjs';
import { AuthService }                   from '../../core/services/auth.service';
import { ApiKeyService }                 from '../../core/services/api-key.service';
import { ToastService }                  from '../../core/services/toast.service';
import { environment }                   from '../../../environments/environment';

@Component({
  selector:    'app-cv-upload',
  standalone:  true,
  imports:     [CommonModule, FormsModule],
  templateUrl: './cv-upload.component.html',
  styleUrls:   ['./cv-upload.component.scss'],
})
export class CvUploadComponent implements OnInit {
  selectedFile: File | null = null;
  isDragging    = false;
  isLoading     = false;
  result:  any    = null;
  error:   string = '';

  mode:       'local' | 'groq' = 'local';
  gdprConsent = false;

  // Job selection
  @Input() preselectedJobId?: string;
  @Output() uploadComplete = new EventEmitter<any>();

  jobs: { id: string; title: string }[] = [];
  selectedJobId = '';
  jobsLoading   = false;



  constructor(
    private readonly http:        HttpClient,
    private readonly authService: AuthService,
    private readonly apiKey:      ApiKeyService,
    private readonly toast:       ToastService,
    private readonly cdr:         ChangeDetectorRef,
    private readonly router:      Router,
  ) {}

  ngOnInit(): void {
    if (this.preselectedJobId) {
      this.selectedJobId = this.preselectedJobId;
    } else {
      this.loadJobs();
    }
  }

  loadJobs(): void {
    this.jobsLoading = true;
    this.http
      .get<any[]>(`${environment.apiUrl}/job-offers`)
      .pipe(finalize(() => { this.jobsLoading = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: (jobs) => {
          this.jobs = jobs
            .filter(j => j.status === 'open')
            .map(j => ({ id: j.id, title: j.title }));
          this.cdr.detectChanges();
        },
        error: () => {
          this.toast.error('Failed to load job offers.');
        },
      });
  }

  toggleMode(m: 'local' | 'groq') { this.mode = m; this.result = null; this.error = ''; }

  get canUpload(): boolean {
    if (!this.selectedFile) return false;
    if (this.isLoading)     return false;
    if (!this.gdprConsent)  return false;
    if (this.mode === 'groq' && !this.apiKey.has()) return false;
    return true;
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) this.setFile(input.files[0]);
  }

  onDragOver(event: DragEvent) { event.preventDefault(); this.isDragging = true; }
  onDragLeave() { this.isDragging = false; }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragging = false;
    const file = event.dataTransfer?.files[0];
    if (file) this.setFile(file);
  }

  setFile(file: File) {
    if (file.type !== 'application/pdf') {
      this.error = 'Only PDF files are accepted.';
      this.selectedFile = null;
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.error = 'File too large. Maximum size is 10MB.';
      this.selectedFile = null;
      return;
    }
    this.selectedFile = file;
    this.error        = '';
    this.result       = null;
  }

  removeFile() { this.selectedFile = null; this.error = ''; this.result = null; }

  upload() {
    if (!this.canUpload || !this.selectedFile) return;
    this.isLoading = true;
    this.error     = '';
    this.result    = null;
    this.cdr.detectChanges();

    const formData = new FormData();
    formData.append('file',        this.selectedFile);
    formData.append('mode',        this.mode);
    formData.append('gdprConsent', String(this.gdprConsent));
    if (this.mode === 'groq') formData.append('apiKey', this.apiKey.get());

    this.http.post<any>(`${environment.apiUrl}/cv-upload`, formData).pipe(
      finalize(() => { this.isLoading = false; this.cdr.detectChanges(); })
    ).subscribe({
      next: (res) => {
        this.result       = res;
        this.selectedFile = null;
        this.cdr.detectChanges();

        if (this.selectedJobId && res.candidateId) {
          this.http.post(`${environment.apiUrl}/applications`, {
            jobId:       this.selectedJobId,
            candidateId: res.candidateId,
            stage:       'applied',
            source:      'cv_upload',
          }).subscribe({
            next: () => {
              this.toast.success('CV uploaded and candidate added to pipeline.');
              this.uploadComplete.emit(res);
              if (!this.preselectedJobId) {
                this.router.navigate(['/job-offers', this.selectedJobId, 'pipeline']);
              }
            },
            error: () => {
              this.toast.error('CV uploaded but failed to create application.');
            },
          });
        } else {
          this.toast.success('CV uploaded and processed successfully.');
          this.uploadComplete.emit(res);
        }
      },
      error: (err) => {
        if      (err.status === 401) this.error = 'Session expired. Please log in again.';
        else if (err.status === 400) this.error = err.error?.message ?? 'Invalid file or missing fields.';
        else if (err.status === 0)   this.error = 'Cannot reach the server. Make sure the backend is running.';
        else                         this.error = err.error?.message ?? 'Upload failed. Please try again.';
        this.toast.error(this.error);
        this.cdr.detectChanges();
      },
    });
  }

  logout(): void { this.authService.logout(); }
}