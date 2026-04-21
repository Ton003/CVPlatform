import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn, OneToMany, Unique,
} from 'typeorm';
import { Candidate } from '../candidates/entities/candidates.entity';
import { JobOffer }  from '../job-offers/job-offer.entity';

export type ApplicationStage =
  | 'applied'
  | 'screening'
  | 'interview'
  | 'assessment'
  | 'offer'
  | 'rejected';

@Entity('applications')
@Unique(['jobId', 'candidateId'])
export class Application {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ── Foreign keys ────────────────────────────────────────────────
  @Column({ name: 'job_id', type: 'uuid' })
  jobId: string;

  @Column({ name: 'candidate_id', type: 'uuid' })
  candidateId: string;

  // ── Pipeline stage ───────────────────────────────────────────────
  @Column({
    type: 'varchar',
    length: 50,
    default: 'applied',
  })
  stage: ApplicationStage;

  // ── Source — how candidate entered the system ────────────────────
  @Column({ type: 'varchar', length: 100, nullable: true })
  source: string | null;   // 'cv_upload' | 'manual' | 'referral'

  // ── Cover letter or additional notes at application time ─────────
  @Column({ type: 'text', name: 'cover_note', nullable: true })
  coverNote: string | null;

  // ── Timestamps ───────────────────────────────────────────────────
  @Column({ name: 'match_score', type: 'float', nullable: true })
  matchScore: number | null;

  @Column({ name: 'competency_gap', type: 'jsonb', nullable: true })
  competencyGap: any | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;


  // ── Relations ────────────────────────────────────────────────────
  @ManyToOne(() => Candidate, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'candidate_id' })
  candidate: Candidate;

  @ManyToOne(() => JobOffer, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'job_id' })
  job: JobOffer;
}
