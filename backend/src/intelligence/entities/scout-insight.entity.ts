import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Candidate } from '../../candidates/entities/candidates.entity';
import { Employee } from '../../employees/entities/employee.entity';
import { JobOffer } from '../../job-offers/job-offer.entity';
import { Department } from '../../job-architecture/entities/department.entity';

export enum InsightType {
  MATCH = 'MATCH',
  MOBILITY = 'MOBILITY',
  RISK = 'RISK',
}

export enum InsightPriority {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export enum InsightAction {
  NONE = 'NONE',
  NOTIFY = 'NOTIFY',
  ESCALATE = 'ESCALATE',
}

export enum InsightStatus {
  NEW = 'NEW',
  DISMISSED = 'DISMISSED',
  ACTIONED = 'ACTIONED',
}

@Entity('scout_insights')
export class ScoutInsight {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: InsightType,
  })
  type: InsightType;

  @Column({ name: 'candidate_id', nullable: true })
  candidateId: string | null;

  @ManyToOne(() => Candidate, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_id' })
  candidate: Candidate | null;

  @Column({ name: 'employee_id', nullable: true })
  employeeId: string | null;

  @ManyToOne(() => Employee, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee | null;

  @Column({ name: 'job_id', nullable: true })
  jobId: string | null;

  @ManyToOne(() => JobOffer, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id' })
  job: JobOffer | null;

  @Column({ name: 'department_id', nullable: true })
  departmentId: string | null;

  @ManyToOne(() => Department, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'department_id' })
  department: Department | null;

  @Column({
    type: 'enum',
    enum: InsightPriority,
    default: InsightPriority.MEDIUM,
  })
  priority: InsightPriority;

  @Column({
    type: 'enum',
    enum: InsightAction,
    default: InsightAction.NOTIFY,
  })
  action: InsightAction;

  @Column({ type: 'float', default: 0 })
  confidence: number;

  @Column({ type: 'int', default: 0 })
  score: number;

  @Column({ type: 'text', nullable: true })
  reasoning: string | null;

  @Column({
    type: 'enum',
    enum: InsightStatus,
    default: InsightStatus.NEW,
  })
  status: InsightStatus;

  @Column({ type: 'jsonb', nullable: true })
  metadata: any;

  @CreateDateColumn({ name: 'first_detected_at' })
  firstDetectedAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
