import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Candidate } from './candidates.entity';

@Entity('candidate_career_entries')
export class CandidateCareerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'candidate_id' })
  candidateId: string;

  @ManyToOne(() => Candidate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_id' })
  candidate: Candidate;

  @Column({ name: 'role_title', type: 'varchar', length: 255 })
  roleTitle: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  company: string | null;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: string | null;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string | null;

  /**
   * Array of { competencyId: uuid, inferredLevel: int, confidence: float }
   */
  @Column({ name: 'sfia_tags', type: 'jsonb', default: [] })
  sfiaTags: any[];

  @Column({ name: 'raw_description', type: 'text', nullable: true })
  rawDescription: string | null;

  @Column({ type: 'varchar', length: 20, default: 'AI' })
  source: 'AI' | 'MANUAL';

  @Column({ name: 'confidence_score', type: 'float', default: 0 })
  confidenceScore: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
