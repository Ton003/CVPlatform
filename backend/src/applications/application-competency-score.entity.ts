import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn, Unique,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Application } from './application.entity';
import { Competence }  from '../competence-management/entities/competence.entity';
import { User }        from '../users/entities/user.entity';
import { ApplicationAssessment } from './entities/application-assessment.entity';

@Entity('application_competency_scores')
@Unique(['applicationId', 'competenceId'])
export class ApplicationCompetencyScore {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'application_id', type: 'uuid' })
  applicationId: string;

  @Column({ name: 'competence_id', type: 'uuid' })
  competenceId: string;

  @Column({ name: 'evaluated_level', type: 'smallint' })
  evaluatedLevel: number;  // 1-5, recruiter's rating of the candidate

  @Column({ name: 'expected_level', type: 'smallint', nullable: true })
  expectedLevel: number | null;  // 1-5, what the job requires

  @Column({ type: 'smallint', nullable: true })
  gap: number | null;  // expectedLevel - evaluatedLevel (negative = deficit)

  @Column({ name: 'rated_by', type: 'uuid' })
  ratedBy: string;

  @Column({ name: 'assessment_id', type: 'uuid', nullable: true })
  assessmentId: string | null;

  @Column({ name: 'normalized_score', type: 'decimal', precision: 5, scale: 2, default: 0 })
  normalizedScore: number;

  @Column({ name: 'weighted_score', type: 'decimal', precision: 5, scale: 2, default: 0 })
  weightedScore: number;

  // ── Relations ────────────────────────────────────────────────────────
  @ManyToOne(() => Application, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'application_id' })
  application: Application;

  @ManyToOne(() => Competence, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'competence_id' })
  competence: Competence;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'rated_by' })
  user: Relation<User>;

  @ManyToOne(() => ApplicationAssessment, (a) => a.scores, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'assessment_id' })
  assessment: Relation<ApplicationAssessment>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
