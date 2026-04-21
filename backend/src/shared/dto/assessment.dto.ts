export class AssessmentItemUpdateDto {
  competenceId: string;
  level: number | null;
  notes?: string;
}

export class AssessmentUpdateDto {
  cycleLabel?: string;
  notes?: string;
}

export interface AssessmentSummary {
  totalCompetencies: number;
  assessedCount: number;
  completionRate: number;
  averageScore?: number;
}
