export enum GapAction {
  PROMOTION_READY = 'promotion_ready',
  NEAR_READY = 'near_ready',
  REQUIRES_TRAINING = 'requires_training',
  NOT_SUITABLE = 'not_suitable'
}

export interface GapItem {
  competencyId: string;
  name: string;
  category: 'technical' | 'behavioral' | 'managerial';
  currentLevel: number;
  requiredLevel: number;
  gap: number; // current - required
}

export interface DevelopmentPlan {
  priorityGaps: GapItem[];
  suggestedAction: GapAction;
}
