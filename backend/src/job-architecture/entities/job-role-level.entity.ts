import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn
} from 'typeorm';
import { JobRole } from './job-role.entity';
import { JobCompetencyRequirement } from './job-competency-requirement.entity';

@Entity('job_role_levels')
export class JobRoleLevel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  jobRoleId: string;

  @ManyToOne(() => JobRole, role => role.levels, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'jobRoleId' })
  role: JobRole;

  @Column({ type: 'int' })
  levelNumber: number; // 1 to 7

  @Column({ length: 255 })
  title: string; // e.g. "Level 1"

  @Column({ type: 'text', nullable: true })
  mission: string | null;

  @Column({ type: 'jsonb', default: [] })
  responsibilities: string[];

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @OneToMany(() => JobCompetencyRequirement, req => req.jobRoleLevel, { cascade: true })
  competencyRequirements: JobCompetencyRequirement[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
