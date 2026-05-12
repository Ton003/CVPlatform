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

/**
 * Immutable append-only audit log of every score computation.
 * Never updated — only inserted. Provides full traceability.
 */
@Entity('scoring_audit_log')
export class ScoringAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'application_id', type: 'uuid' })
  applicationId: string;

  /** What triggered this computation */
  @Column({ type: 'varchar', length: 50, nullable: true })
  trigger: string | null; // 'manual_refresh' | 'assessment_submit' | 'stage_change' | 'verdict_request'

  @Column({ name: 'triggered_by', type: 'uuid', nullable: true })
  triggeredBy: string | null;

  /** Snapshot of all raw inputs at time of computation */
  @Column({ name: 'inputs_snapshot', type: 'jsonb' })
  inputsSnapshot: Record<string, any>;

  /** Full scoring result stored for replay */
  @Column({ name: 'result_snapshot', type: 'jsonb' })
  resultSnapshot: Record<string, any>;

  @CreateDateColumn({ name: 'computed_at', type: 'timestamptz' })
  computedAt: Date;

  // ── Relations ────────────────────────────────────────────────────
  @ManyToOne(() => Application, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'application_id' })
  application: Application;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'triggered_by' })
  triggeredByUser: User;
}
