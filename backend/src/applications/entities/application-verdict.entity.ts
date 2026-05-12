import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Application } from '../application.entity';

export type VerdictRecommendation =
  | 'ADVANCE'
  | 'INTERVIEW'
  | 'HOLD'
  | 'REJECT'
  | 'INSUFFICIENT_DATA';
export type VerdictConfidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type GapImpact = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface VerdictStrength {
  competenceId: string;
  sfiaCode: string;
  sfiaName: string;
  evaluatedLevel: number;
  requiredLevel: number;
  delta: number;
  reason: string;
}

export interface VerdictGap {
  competenceId: string;
  sfiaCode: string;
  sfiaName: string;
  evaluatedLevel: number | null;
  requiredLevel: number;
  delta: number;
  impact: GapImpact;
  reason: string;
}

export interface RiskFlag {
  code: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
}

export interface VerdictScoreBreakdown {
  competency: number | null;
  interview: number | null;
  experience: number | null;
  final: number;
  weights: {
    competency: number;
    interview: number;
    experience: number;
  };
}

/**
 * Persisted AI Verdict for a specific application.
 * One row per application (upserted on refresh).
 */
@Entity('application_verdicts')
export class ApplicationVerdict {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'application_id', type: 'uuid', unique: true })
  applicationId: string;

  @Column({ name: 'match_score', type: 'smallint' })
  matchScore: number; // 0–100

  @Column({ type: 'varchar', length: 20 })
  confidence: VerdictConfidence;

  @Column({ type: 'varchar', length: 30 })
  recommendation: VerdictRecommendation;

  @Column({ type: 'jsonb' })
  strengths: VerdictStrength[];

  @Column({ type: 'jsonb' })
  gaps: VerdictGap[];

  @Column({ name: 'risk_flags', type: 'jsonb' })
  riskFlags: RiskFlag[];

  @Column({ name: 'score_breakdown', type: 'jsonb' })
  scoreBreakdown: VerdictScoreBreakdown;

  @Column({ name: 'rated_competencies', type: 'smallint' })
  ratedCompetencies: number;

  @Column({ name: 'total_competencies', type: 'smallint' })
  totalCompetencies: number;

  @CreateDateColumn({ name: 'computed_at', type: 'timestamptz' })
  computedAt: Date;

  // ── Relations ────────────────────────────────────────────────────
  @ManyToOne(() => Application, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'application_id' })
  application: Application;
}
