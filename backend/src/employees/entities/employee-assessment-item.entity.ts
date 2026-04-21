import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { EmployeeAssessment } from './employee-assessment.entity';
import { Competence } from '../../competence-management/entities/competence.entity';

@Entity('employee_assessment_items')
@Unique(['assessmentId', 'competenceId'])
export class EmployeeAssessmentItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'assessment_id' })
  assessmentId: string;

  @ManyToOne(() => EmployeeAssessment, (a) => a.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assessment_id' })
  assessment: Relation<EmployeeAssessment>;

  @Column({ name: 'competence_id' })
  competenceId: string;

  @ManyToOne(() => Competence, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'competence_id' })
  competence: Relation<Competence>;

  /** 1–5 or null if evaluator has not rated this competency yet */
  @Column({ type: 'int', nullable: true })
  level: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
