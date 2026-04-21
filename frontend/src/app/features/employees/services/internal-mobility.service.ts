import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Observable } from 'rxjs';

export interface GapItem {
  competenceId: string;
  name: string;
  category: string;
  currentLevel: number;
  requiredLevel: number;
  gap: number;
}

export interface GapAnalysisReport {
  title: string;
  gaps: GapItem[];
  priorityGaps: GapItem[];
  summary: {
    totalRequirements: number;
    metCount: number;
    gapCount: number;
  };
}

export interface UnifiedScoreResult {
  totalScore: number;
  isComplete: boolean;
  breakdown: {
    technical: { score: number; weight: number; available: boolean };
    behavioral: { score: number; weight: number; available: boolean };
    interview: { score: number; weight: number; available: boolean };
    managerial: { score: number; weight: number; available: boolean };
  };
  suggestedAction: 'promotion_ready' | 'near_ready' | 'requires_training' | 'not_suitable';
}

@Injectable({
  providedIn: 'root'
})
export class InternalMobilityService {
  private apiUrl = `${environment.apiUrl}/internal-mobility`;

  constructor(private http: HttpClient) {}

  getGapAnalysis(employeeId: string, levelId: string): Observable<GapAnalysisReport> {
    return this.http.get<GapAnalysisReport>(`${this.apiUrl}/gap-analysis/${employeeId}/${levelId}`);
  }

  getEmployeeScore(employeeId: string, offerId: string): Observable<UnifiedScoreResult> {
    return this.http.get<UnifiedScoreResult>(`${this.apiUrl}/score/${employeeId}/${offerId}`);
  }

  getOfferMatches(offerId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/offer-matches/${offerId}`);
  }
}
