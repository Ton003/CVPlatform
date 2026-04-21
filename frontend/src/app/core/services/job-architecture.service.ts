import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface BusinessUnit {
  id: string;
  name: string;
  description?: string;
  departments?: Department[];
}

export interface Department {
  id: string;
  name: string;
  description?: string;
  businessUnitId: string;
  jobRoles?: JobRole[];
}

export interface JobRole {
  id: string;
  name: string;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  departmentId: string;
  levels?: JobRoleLevel[];
}

export interface JobRoleLevel {
  id: string;
  jobRoleId: string;
  levelNumber: number;
  title: string;
  mission?: string;
  responsibilities?: string[];
  description?: string;
  competencyRequirements?: JobCompetencyRequirement[];
}

export interface JobCompetencyRequirement {
  id: string;
  jobRoleLevelId: string;
  competenceId: string;
  requiredLevel: number;
  competence?: any;
}

@Injectable({ providedIn: 'root' })
export class JobArchitectureService {
  private readonly baseUrl = environment.apiUrl + '/job-architecture';

  constructor(private readonly http: HttpClient) {}

  getTree(): Observable<BusinessUnit[]> {
    return this.http.get<BusinessUnit[]>(`${this.baseUrl}/tree`);
  }

  getJobRole(id: string): Observable<JobRole> {
    return this.http.get<JobRole>(`${this.baseUrl}/roles/${id}`);
  }

  getJobRoleRank(id: string): Observable<JobRoleLevel> {
    return this.http.get<JobRoleLevel>(`${this.baseUrl}/levels/${id}`);
  }

  createBusinessUnit(name: string, description?: string): Observable<BusinessUnit> {
    return this.http.post<BusinessUnit>(`${this.baseUrl}/business-units`, { name, description });
  }

  createDepartment(businessUnitId: string, name: string, description?: string): Observable<Department> {
    return this.http.post<Department>(`${this.baseUrl}/departments`, { businessUnitId, name, description });
  }

  createJobRole(departmentId: string, name: string, rankCount: number = 5): Observable<JobRole> {
    return this.http.post<JobRole>(`${this.baseUrl}/roles`, { departmentId, name, levelCount: rankCount });
  }

  updateBusinessUnit(id: string, name?: string, description?: string): Observable<BusinessUnit> {
    return this.http.patch<BusinessUnit>(`${this.baseUrl}/business-units/${id}`, { name, description });
  }

  updateDepartment(id: string, name?: string, description?: string): Observable<Department> {
    return this.http.patch<Department>(`${this.baseUrl}/departments/${id}`, { name, description });
  }

  updateJobRole(id: string, name?: string, status?: string): Observable<JobRole> {
    return this.http.patch<JobRole>(`${this.baseUrl}/roles/${id}`, { name, status });
  }

  updateJobRoleRank(
    id: string, 
    data: { 
      mission?: string; 
      responsibilities?: string[]; 
      description?: string;
      title?: string;
    }
  ): Observable<JobRoleLevel> {
    return this.http.patch<JobRoleLevel>(`${this.baseUrl}/levels/${id}`, data);
  }

  updateRoleRankCompetencies(
    rankId: string, 
    requirements: { competenceId: string; requiredLevel: number }[]
  ): Observable<JobRoleLevel> {
    return this.http.patch<JobRoleLevel>(`${this.baseUrl}/levels/${rankId}/competencies`, { requirements });
  }

  deleteBusinessUnit(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/business-units/${id}`);
  }

  deleteDepartment(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/departments/${id}`);
  }

  deleteJobRole(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/roles/${id}`);
  }
}
