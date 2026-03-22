import { Component }               from '@angular/core';
import { CommonModule }            from '@angular/common';
import { FormsModule }             from '@angular/forms';
import { HttpClient }              from '@angular/common/http';
import { finalize }                from 'rxjs';
import { AuthService }             from '../../core/services/auth.service';
import { ApiKeyService }           from '../../core/services/api-key.service';
import { ToastService }            from '../../core/services/toast.service';
import { environment }             from '../../../environments/environment';

@Component({
  selector:    'app-cv-upload',
  standalone:  true,
  imports:     [CommonModule, FormsModule],
  templateUrl: './cv-upload.component.html',
  styleUrls:   ['./cv-upload.component.scss'],
})
export class CvUploadComponent {
  selectedFile: File | null = null;
  isDragging    = false;
  isLoading     = false;
  result:  any    = null;
  error:   string = '';

  mode:       'local' | 'groq' = 'local';
  gdprConsent = false;

  tips = [
    { title: 'Upload a PDF',           desc: 'Only PDF files are supported. Make sure the CV is text-readable (not a scanned image).' },
    { title: 'Select extraction mode', desc: 'Local (Phi-3) runs offline on your CPU. AI Mode (Groq) is faster and more accurate.' },
    { title: 'AI extracts data',       desc: 'Skills, experience, education, and contact details are extracted automatically.' },
    { title: 'Candidate indexed',      desc: 'The candidate profile is stored and becomes immediately searchable via Candidate Search.' },
  ];

  constructor(
    private readonly http:        HttpClient,
    private readonly authService: AuthService,
    private readonly apiKey:      ApiKeyService,
    private readonly toast:       ToastService,
  ) {}

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

    const formData = new FormData();
    formData.append('file',        this.selectedFile);
    formData.append('mode',        this.mode);
    formData.append('gdprConsent', String(this.gdprConsent));
    if (this.mode === 'groq') formData.append('apiKey', this.apiKey.get());

    this.http.post<any>(`${environment.apiUrl}/cv-upload`, formData).pipe(
      finalize(() => this.isLoading = false)
    ).subscribe({
      next: (res) => {
        this.result = res;
        this.selectedFile = null;
        this.toast.success('CV uploaded and processed successfully.');
      },
      error: (err) => {
        if      (err.status === 401) this.error = 'Session expired. Please log in again.';
        else if (err.status === 400) this.error = err.error?.message ?? 'Invalid file or missing fields.';
        else if (err.status === 0)   this.error = 'Cannot reach the server. Make sure the backend is running.';
        else                         this.error = err.error?.message ?? 'Upload failed. Please try again.';
        this.toast.error(this.error);
      },
    });
  }

  logout(): void { this.authService.logout(); }
}