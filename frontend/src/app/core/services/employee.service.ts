import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Employee {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  hireDate: string;
  status: string;
  jobRoleId: string;
  jobRoleLevelId: string;
  managerId?: string;
  jobRole?: any;
  jobRoleLevel?: any;
  manager?: any;
  competencies?: any[];
  personalDetails?: any;
  department?: any;
  businessUnit?: any;
}

@Injectable({ providedIn: 'root' })
export class EmployeeService {
  private readonly baseUrl = `${environment.apiUrl}/employees`;

  constructor(private readonly http: HttpClient) {}

  list(params: any): Observable<any> {
    return this.http.get<any>(this.baseUrl, { params });
  }

  findOne(id: string): Observable<Employee> {
    return this.http.get<Employee>(`${this.baseUrl}/${id}`);
  }

  promoteCandidate(payload: { applicationId: string; employeeId: string; hireDate: string; managerId?: string }): Observable<Employee> {
    return this.http.post<Employee>(`${this.baseUrl}/promote`, payload);
  }

  getManagers(): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/users/managers`);
  }

  create(payload: any): Observable<Employee> {
    return this.http.post<Employee>(this.baseUrl, payload);
  }

  update(id: string, payload: any): Observable<Employee> {
    return this.http.patch<Employee>(`${this.baseUrl}/${id}`, payload);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }



  // Assessments
  createAssessmentDraft(employeeId: string, payload: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/${employeeId}/assessments`, payload);
  }

  getAssessmentHistory(employeeId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/${employeeId}/assessments`);
  }

  getAssessment(id: string): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/assessments/${id}`);
  }

  updateAssessmentItems(id: string, items: any[]): Observable<any> {
    return this.http.patch<any>(`${environment.apiUrl}/assessments/${id}/items`, { items });
  }

  submitAssessment(id: string): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/assessments/${id}/submit`, {});
  }
}
