import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Application } from '../application.entity';
import { User } from '../../users/entities/user.entity';

export type HiringOutcomeType =
  | 'hired'
  | 'rejected'
  | 'withdrew'
  | 'offer_declined';

/**
 * Captures the final outcome of every application.
 * Auto-created when stage transitions to 'hired' or 'rejected'.
 * Performance rating is filled 6 months post-hire.
 */
@Entity('hiring_outcomes')
export class HiringOutcome {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'application_id', type: 'uuid', unique: true })
  applicationId: string;

  @Column({ name: 'final_stage', type: 'varchar', length: 30 })
  finalStage: string;

  @Column({ type: 'varchar', length: 20 })
  outcome: HiringOutcomeType;

  /** Why was this candidate rejected? Used for calibration analytics. */
  @Column({
    name: 'rejection_reason',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  rejectionReason: string | null;

  /** Snapshot of match score at the moment of decision */
  @Column({ name: 'match_score_at_decision', type: 'smallint', nullable: true })
  matchScoreAtDecision: number | null;

  /** Snapshot of AI verdict recommendation at decision time */
  @Column({
    name: 'verdict_at_decision',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  verdictAtDecision: string | null;

  @Column({ name: 'recorded_by', type: 'uuid', nullable: true })
  recordedBy: string | null;

  // ── Post-hire performance (filled ~6 months after hire) ──────────
  @Column({ name: 'performance_rating', type: 'smallint', nullable: true })
  performanceRating: number | null; // 1–5

  @Column({ name: 'performance_notes', type: 'text', nullable: true })
  performanceNotes: string | null;

  @Column({ name: 'performance_at', type: 'timestamptz', nullable: true })
  performanceAt: Date | null;

  @CreateDateColumn({ name: 'recorded_at', type: 'timestamptz' })
  recordedAt: Date;

  // ── Relations ────────────────────────────────────────────────────
  @ManyToOne(() => Application, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'application_id' })
  application: Application;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'recorded_by' })
  recorder: User;
}
