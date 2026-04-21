import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique, CreateDateColumn
} from 'typeorm';
import { JobRoleLevel } from './job-role-level.entity';
import { Competence } from '../../competence-management/entities/competence.entity';

@Entity('job_competency_requirements')
@Unique(['jobRoleLevelId', 'competenceId']) // a role level can only require a competence once
export class JobCompetencyRequirement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  jobRoleLevelId: string;

  @ManyToOne(() => JobRoleLevel, level => level.competencyRequirements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'jobRoleLevelId' })
  jobRoleLevel: JobRoleLevel;

  @Column()
  competenceId: string;

  @ManyToOne(() => Competence, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'competenceId' })
  competence: Competence;

  @Column({ type: 'int' })
  requiredLevel: number; // 1-5 (assigned proficiency level)

  @Column({ name: 'is_required', type: 'boolean', default: true })
  isRequired: boolean;  // must-have vs nice-to-have

  @Column({ name: 'is_critical', type: 'boolean', default: false })
  isCritical: boolean;  // deal-breaker if missing

  @Column({ type: 'float', default: 1.0 })
  weight: number;       // relative importance multiplier (0.5–2.0)

  @CreateDateColumn()
  createdAt: Date;
}
