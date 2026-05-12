import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Employee } from './employee.entity';
import { JobRoleLevel } from '../../job-architecture/entities/job-role-level.entity';
import { Department } from '../../job-architecture/entities/department.entity';

export enum EmployeeHistoryEventType {
  PROMOTION = 'promotion',
  TRANSFER = 'transfer',
  HIRE = 'hire',
  OTHER = 'other',
}

@Entity('employee_history')
export class EmployeeHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'employee_id' })
  employeeId: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Relation<Employee>;

  @Column({
    type: 'enum',
    enum: EmployeeHistoryEventType,
    default: EmployeeHistoryEventType.OTHER,
  })
  eventType: EmployeeHistoryEventType;

  @Column({ type: 'date' })
  effectiveDate: Date;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  // Previous State
  @Column({ type: 'uuid', name: 'old_role_level_id', nullable: true })
  oldRoleLevelId: string | null;

  @ManyToOne(() => JobRoleLevel, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'old_role_level_id' })
  oldRoleLevel: Relation<JobRoleLevel> | null;

  @Column({ type: 'uuid', name: 'old_department_id', nullable: true })
  oldDepartmentId: string | null;

  @ManyToOne(() => Department, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'old_department_id' })
  oldDepartment: Relation<Department> | null;

  // New State
  @Column({ type: 'uuid', name: 'new_role_level_id', nullable: true })
  newRoleLevelId: string | null;

  @ManyToOne(() => JobRoleLevel, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'new_role_level_id' })
  newRoleLevel: Relation<JobRoleLevel> | null;

  @Column({ type: 'uuid', name: 'new_department_id', nullable: true })
  newDepartmentId: string | null;

  @ManyToOne(() => Department, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'new_department_id' })
  newDepartment: Relation<Department> | null;

  @Column({ type: 'varchar', name: 'recorded_by', nullable: true })
  recordedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
