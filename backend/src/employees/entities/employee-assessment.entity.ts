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
import { Employee } from './employee.entity';
import { User } from '../../users/entities/user.entity';
import { EmployeeAssessmentItem } from './employee-assessment-item.entity';

export enum AssessmentStatus {
  DRAFT     = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
}

@Entity('employee_assessments')
export class EmployeeAssessment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'employee_id' })
  employeeId: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Relation<Employee>;

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

  @OneToMany(() => EmployeeAssessmentItem, (item) => item.assessment, { cascade: true })
  items: Relation<EmployeeAssessmentItem[]>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
