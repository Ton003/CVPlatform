import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { CandidateCompetency } from './candidate-competency.entity';

@Entity('candidates')
export class Candidate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, name: 'first_name' })
  firstName: string;

  @Column({ type: 'varchar', length: 100, name: 'last_name' })
  lastName: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ type: 'text', nullable: true, name: 'linkedin_url' })
  linkedinUrl: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'current_title' })
  currentTitle: string | null;

  @Column({ type: 'smallint', nullable: true, name: 'years_experience' })
  yearsExperience: number | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  location: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  source: string | null;

  @Column({ type: 'boolean', default: false, name: 'gdpr_consent' })
  gdprConsent: boolean;

  @Column({ type: 'timestamptz', nullable: true, name: 'gdpr_consent_at' })
  gdprConsentAt: Date | null;

  @Column({ type: 'varchar', length: 30, default: 'active' })
  status: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'created_by' })
  createdBy: string | null;

  @Column({ name: 'competency_snapshot', type: 'jsonb', nullable: true })
  competencySnapshot: any | null;

  @Column({ name: 'snapshot_updated_at', type: 'timestamptz', nullable: true })
  snapshotUpdatedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => CandidateCompetency, (cc) => cc.candidate)
  competencies: CandidateCompetency[];

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}