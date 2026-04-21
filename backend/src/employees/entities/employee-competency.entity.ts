import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import type { Relation } from 'typeorm';
import { EmployeeAssessment } from './employee-assessment.entity';
import { Employee } from './employee.entity';
import { Competence } from '../../competence-management/entities/competence.entity';

export enum CompetencySource {
  ASSESSMENT_IMPORT = 'assessment_import',
  MANUAL = 'manual',
  PERFORMANCE_REVIEW = 'performance_review'
}

@Entity('employee_competencies')
export class EmployeeCompetency {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'employee_id' })
  employeeId: string;

  @ManyToOne(() => Employee, (e) => e.competencies, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Relation<Employee>;

  @Column({ name: 'competence_id' })
  competenceId: string;

  @ManyToOne(() => Competence, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'competence_id' })
  competence: Relation<Competence>;

  @Column({ name: 'current_level', type: 'int', default: 1 })
  currentLevel: number;  // 1-5, current assessed proficiency

  @Column({ name: 'target_level', type: 'int', nullable: true })
  targetLevel: number | null;  // 1-5, target for role/development

  @Column({ type: 'int', nullable: true })
  gap: number | null;  // targetLevel - currentLevel (negative = deficit)

  @Column({ name: 'gap_percentage', type: 'float', nullable: true })
  gapPercentage: number | null;  // gap as % of targetLevel

  @Column({ name: 'is_required', type: 'boolean', default: false })
  isRequired: boolean;  // is this competency mandatory for the role

  @Column({ name: 'last_evaluated_at', type: 'timestamptz', nullable: true })
  lastEvaluatedAt: Date | null;

  @Column({
    type: 'enum',
    enum: CompetencySource,
    default: CompetencySource.MANUAL
  })
  source: CompetencySource;

  /** FK → last submitted assessment that set this level. Null until first assessment. */
  @Column({ name: 'last_assessment_id', nullable: true })
  lastAssessmentId: string | null;

  @ManyToOne(() => EmployeeAssessment, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'last_assessment_id' })
  lastAssessment: Relation<EmployeeAssessment> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
