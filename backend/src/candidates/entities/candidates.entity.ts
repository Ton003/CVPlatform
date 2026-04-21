import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { CandidateCompetency } from './candidate-competency.entity';

@Entity('candidates')
export class Candidate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  first_name: string;

  @Column({ type: 'varchar', length: 100 })
  last_name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ type: 'text', nullable: true })
  linkedin_url: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  current_title: string | null;

  @Column({ type: 'smallint', nullable: true })
  years_experience: number | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  location: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  source: string | null;

  @Column({ type: 'boolean', default: false })
  gdpr_consent: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  gdpr_consent_at: Date | null;

  @Column({ type: 'varchar', length: 30, default: 'active' })
  status: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', nullable: true })
  created_by: string | null;

  @Column({ name: 'competency_snapshot', type: 'jsonb', nullable: true })
  competencySnapshot: any | null;

  @Column({ name: 'snapshot_updated_at', type: 'timestamptz', nullable: true })
  snapshotUpdatedAt: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => CandidateCompetency, (cc) => cc.candidate)
  competencies: CandidateCompetency[];

  @UpdateDateColumn()
  updated_at: Date;
}