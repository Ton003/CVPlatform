import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  OneToOne,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Candidate } from '../../candidates/entities/candidates.entity';
import { User } from '../../users/entities/user.entity';
import { JobRole } from '../../job-architecture/entities/job-role.entity';
import { JobRoleLevel } from '../../job-architecture/entities/job-role-level.entity';
import { Department } from '../../job-architecture/entities/department.entity';
import { EmployeeCompetency } from './employee-competency.entity';

export enum EmployeeStatus {
  PROBATION = 'probation',
  ACTIVE = 'active',
  NOTICE = 'notice',
  RETIRED = 'retired',
  TERMINATED = 'terminated'
}

@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'employee_id', unique: true })
  employeeId: string;

  @Column({ name: 'candidate_id', nullable: true })
  candidateId: string | null;

  @OneToOne(() => Candidate, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'candidate_id' })
  candidate: Candidate | null;

  @Column({ name: 'user_id', nullable: true })
  userId: string | null;

  @OneToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ name: 'first_name', length: 100 })
  firstName: string;

  @Column({ name: 'last_name', length: 100 })
  lastName: string;

  @Column({ name: 'email', length: 255, unique: true })
  email: string;

  @Column({ name: 'hire_date', type: 'date' })
  hireDate: Date;

  @Column({
    type: 'enum',
    enum: EmployeeStatus,
    default: EmployeeStatus.PROBATION
  })
  status: EmployeeStatus;

  @Column({ name: 'job_role_id' })
  jobRoleId: string;

  @ManyToOne(() => JobRole)
  @JoinColumn({ name: 'job_role_id' })
  jobRole: JobRole;

  @Column({ name: 'job_role_level_id' })
  jobRoleLevelId: string;

  @ManyToOne(() => JobRoleLevel)
  @JoinColumn({ name: 'job_role_level_id' })
  jobRoleLevel: JobRoleLevel;

  @Column({ name: 'department_id', nullable: true })
  departmentId: string | null;

  @ManyToOne(() => Department, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'department_id' })
  department: Department;

  @ManyToOne(() => Employee, { nullable: true })
  @JoinColumn({ name: 'manager_id' })
  manager: Employee | null;

  @OneToMany(() => EmployeeCompetency, (ec) => ec.employee, { cascade: true })
  competencies: Relation<EmployeeCompetency[]>;

  @Column({ name: 'personal_details', type: 'jsonb', nullable: true })
  personalDetails: any;

  @Column({ name: 'llm_summary', type: 'text', nullable: true })
  llmSummary: string | null;

  @Column({ type: 'text', nullable: true })
  embedding: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
