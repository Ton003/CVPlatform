import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CvUploadService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/api/cv-upload`;

  uploadCv(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(this.apiUrl, formData).pipe(
      timeout(300000) // 5 minutes timeout
    );
  }
}