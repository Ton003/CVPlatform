import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn
} from 'typeorm';
import { JobRoleLevel } from '../job-architecture/entities/job-role-level.entity';
import { JobRole } from '../job-architecture/entities/job-role.entity';
import { Employee } from '../employees/entities/employee.entity';

@Entity('job_offers')
export class JobOffer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Selection now targets a specific Role (e.g. "Software Engineer") at a specific Level.
   */
  @Column({ name: 'job_role_id', nullable: true })
  jobRoleId: string | null;

  @ManyToOne(() => JobRole, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'job_role_id' })
  jobRole: JobRole;

  @Column({ name: 'job_role_level_id', nullable: true })
  jobRoleLevelId: string | null;

  @ManyToOne(() => JobRoleLevel, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'job_role_level_id' })
  jobRoleLevel: JobRoleLevel;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'contract_type', type: 'varchar', length: 50, nullable: true })
  contractType: string | null;

  @Column({ name: 'work_mode', type: 'varchar', length: 50, nullable: true })
  workMode: string | null;

  @Column({ name: 'salary_min', type: 'decimal', precision: 12, scale: 2, nullable: true })
  salaryMin: number | null;

  @Column({ name: 'salary_max', type: 'decimal', precision: 12, scale: 2, nullable: true })
  salaryMax: number | null;

  @Column({ type: 'varchar', length: 10, default: 'TND' })
  currency: string;

  @Column({ name: 'openings_count', type: 'integer', default: 1 })
  openingsCount: number;

  @Column({ name: 'hiring_manager', type: 'uuid', nullable: true })
  hiringManagerId: string | null;

  @ManyToOne(() => Employee, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'hiring_manager' })
  hiringManager: Employee | null;

  @Column({ type: 'timestamp', nullable: true })
  deadline: Date | null;

  /**
   * Stores a snapshot of the JobRole requirements at the time of creation.
   * This ensures the offer remains valid even if the core JobRole changes.
   */
  @Column({ type: 'jsonb', default: {} })
  snapshot: any;

  @Column({ type: 'varchar', length: 50, default: 'open' })
  status: string;

  @Column({ type: 'varchar', length: 50, default: 'both' })
  visibility: string;

  @Column({ name: 'created_by', type: 'varchar', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}