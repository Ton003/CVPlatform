import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn
} from 'typeorm';
import { JobRoleLevel } from './job-role-level.entity';
import { Department } from './department.entity';
import { CompetenceFamily } from '../../competence-management/entities/family.entity';

@Entity('job_roles')
export class JobRole {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ name: 'family_id', nullable: true })
  familyId: string | null;

  @ManyToOne(() => CompetenceFamily, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'family_id' })
  family: CompetenceFamily;

  @Column({ type: 'smallint', default: 1 })
  level: number; // 1-5

  /**
   * array of { competency_id: uuid, required_level: int }
   */
  @Column({ name: 'sfia_requirements', type: 'jsonb', default: [] })
  sfiaRequirements: any[];

  @Column({ name: 'successor_role_ids', type: 'uuid', array: true, default: '{}' })
  successorRoleIds: string[];

  @Column({ type: 'varchar', length: 20, default: 'DRAFT' })
  status: string; // 'DRAFT' | 'ACTIVE' | 'ARCHIVED'

  @Column({ name: 'department_id', nullable: true })
  departmentId: string | null;

  @ManyToOne(() => Department, d => d.jobRoles, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'department_id' })
  department: Department;

  /* 
    Fields like mission, responsibilities, etc. have been moved 
    to JobRoleLevel to support career pathing (Levels 1-7).
  */

  @OneToMany(() => JobRoleLevel, level => level.role, { cascade: true })
  levels: JobRoleLevel[];

  @Column({ name: 'created_by', type: 'varchar', nullable: true })
  createdBy: string | null;

  @Column({ name: 'updated_by', type: 'varchar', nullable: true })
  updatedBy: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

