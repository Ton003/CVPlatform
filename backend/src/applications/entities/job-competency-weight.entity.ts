import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { JobRoleLevel } from '../../job-architecture/entities/job-role-level.entity';
import { Competence } from '../../competence-management/entities/competence.entity';
import { User } from '../../users/entities/user.entity';

/**
 * Stores per-job-role-level importance multipliers for competencies.
 * weight = 0.5 → minor signal
 * weight = 1.0 → standard (default)
 * weight = 2.0 → critical blocker
 */
@Entity('job_competency_weights')
@Unique(['jobRoleLevelId', 'competenceId'])
export class JobCompetencyWeight {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'job_role_level_id', type: 'uuid' })
  jobRoleLevelId: string;

  @Column({ name: 'competence_id', type: 'uuid' })
  competenceId: string;

  /** Multiplier applied during scoring. Default 1.0 = normal importance. */
  @Column({ type: 'decimal', precision: 4, scale: 2, default: 1.0 })
  weight: number;

  @Column({ name: 'set_by', type: 'uuid', nullable: true })
  setBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  // ── Relations ────────────────────────────────────────────────────
  @ManyToOne(() => JobRoleLevel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_role_level_id' })
  jobRoleLevel: JobRoleLevel;

  @ManyToOne(() => Competence, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'competence_id' })
  competence: Competence;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'set_by' })
  user: User;
}
