import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Application } from '../application.entity';
import { User } from '../../users/entities/user.entity';
import { ApplicationAssessmentItem } from './application-assessment-item.entity';
import { ApplicationCompetencyScore } from '../application-competency-score.entity';

export enum AssessmentStatus {
  DRAFT     = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
}

@Entity('application_assessments')
export class ApplicationAssessment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'application_id' })
  applicationId: string;

  @ManyToOne(() => Application, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'application_id' })
  application: Relation<Application>;

  @Column({ name: 'evaluator_id', nullable: true })
  evaluatorId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'evaluator_id' })
  evaluator: Relation<User> | null;

  @Column({ type: 'enum', enum: AssessmentStatus, default: AssessmentStatus.DRAFT })
  status: AssessmentStatus;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({ type: 'varchar', name: 'cycle_label', length: 255, nullable: true })
  cycleLabel: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @OneToMany(() => ApplicationAssessmentItem, (item) => item.assessment, { cascade: true })
  items: Relation<ApplicationAssessmentItem[]>;

  @OneToMany(() => ApplicationCompetencyScore, (score) => score.assessment)
  scores: Relation<ApplicationCompetencyScore[]>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
