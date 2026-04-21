import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { ApplicationAssessment } from './application-assessment.entity';
import { Competence } from '../../competence-management/entities/competence.entity';

@Entity('application_assessment_items')
@Unique(['assessmentId', 'competenceId'])
export class ApplicationAssessmentItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'assessment_id' })
  assessmentId: string;

  @ManyToOne(() => ApplicationAssessment, (a) => a.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assessment_id' })
  assessment: Relation<ApplicationAssessment>;

  @Column({ name: 'competence_id' })
  competenceId: string;

  @ManyToOne(() => Competence)
  @JoinColumn({ name: 'competence_id' })
  competence: Relation<Competence>;

  @Column({ type: 'int', nullable: true })
  level: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
