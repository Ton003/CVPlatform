import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

// ─── Shared enums & types ─────────────────────────────────────────────────────

export type CompetencyCategory = 'technical' | 'behavioral' | 'cognitive';
export type CompetenceCategory = 'TECHNICAL' | 'BEHAVIORAL' | 'MANAGERIAL';

// ─── Old models (kept for backward-compat with job-offer scoring) ─────────────

export interface Competency {
  id:          string;
  name:        string;
  category:    CompetencyCategory;
  description: string | null;
}

export interface JobCompetency {
  id:            string;
  jobId:         string;
  competencyId:  string;
  requiredLevel: number;
  competency:    Competency;
}

// ─── New Competence Management models ────────────────────────────────────────

export interface CompetenceFamily {
  id:        string;
  name:      string;
  category:  CompetenceCategory;
  createdAt: string;
  updatedAt: string;
  competenceCount?: number;
}

export interface CompetenceLevel {
  id:            string;
  competenceId:  string;
  level:         number;  // 1–5
  description:   string;
}

export interface Competence {
  id:          string;
  name:        string;
  description: string | null;
  familyId:    string;
  levels:      CompetenceLevel[];
  createdAt:   string;
  updatedAt:   string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class CompetencyService {
  private base        = `${environment.apiUrl}/competencies`;
  private familyBase  = `${environment.apiUrl}/families`;
  private competBase  = `${environment.apiUrl}/competences`;

  constructor(private http: HttpClient) {}

  // ── Old API (job-offer scoring) ────────────────────────────────────────────

  getAll(category?: CompetencyCategory): Observable<Competency[]> {
    const url = category ? `${this.base}?category=${category}` : this.base;
    return this.http.get<Competency[]>(url);
  }

  getForJob(jobId: string): Observable<JobCompetency[]> {
    return this.http.get<JobCompetency[]>(`${this.base}/job/${jobId}`);
  }

  assign(jobId: string, competencyId: string, requiredLevel: number): Observable<JobCompetency> {
    return this.http.post<JobCompetency>(`${this.base}/job`, { jobId, competencyId, requiredLevel });
  }

  updateLevel(assignmentId: string, requiredLevel: number): Observable<JobCompetency> {
    return this.http.patch<JobCompetency>(`${this.base}/job/${assignmentId}`, { requiredLevel });
  }

  unassign(assignmentId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/job/${assignmentId}`);
  }

  create(name: string, category: CompetencyCategory, description?: string): Observable<Competency> {
    return this.http.post<Competency>(this.base, { name, category, description });
  }

  deleteMaster(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  // ── New Competence Management API ─────────────────────────────────────────

  /** GET /families?category=TECHNICAL */
  getFamilies(category?: CompetenceCategory): Observable<CompetenceFamily[]> {
    let params = new HttpParams();
    if (category) params = params.set('category', category);
    return this.http.get<CompetenceFamily[]>(this.familyBase, { params });
  }

  createFamily(name: string, category: CompetenceCategory): Observable<CompetenceFamily> {
    return this.http.post<CompetenceFamily>(this.familyBase, { name, category });
  }

  updateFamily(id: string, data: { name?: string; category?: CompetenceCategory }): Observable<CompetenceFamily> {
    return this.http.patch<CompetenceFamily>(`${this.familyBase}/${id}`, data);
  }

  deleteFamily(id: string): Observable<void> {
    return this.http.delete<void>(`${this.familyBase}/${id}`);
  }

  /** GET /competences?familyId=<uuid> */
  getCompetences(familyId: string): Observable<Competence[]> {
    return this.http.get<Competence[]>(`${this.competBase}?familyId=${familyId}`);
  }

  createCompetence(name: string, description: string, familyId: string): Observable<Competence> {
    return this.http.post<Competence>(this.competBase, { name, description, familyId });
  }

  updateCompetence(id: string, data: Partial<{ name: string; description: string; familyId: string }>): Observable<Competence> {
    return this.http.patch<Competence>(`${this.competBase}/${id}`, data);
  }

  deleteCompetence(id: string): Observable<void> {
    return this.http.delete<void>(`${this.competBase}/${id}`);
  }

  /** PUT /competences/:id/levels — replace all 5 levels */
  updateCompetenceLevels(
    competenceId: string,
    levels: { level: number; description: string }[],
  ): Observable<Competence> {
    return this.http.put<Competence>(`${this.competBase}/${competenceId}/levels`, { levels });
  }
}
