import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Candidate } from './candidates.entity';
import { Competence } from '../../competence-management/entities/competence.entity';

@Entity('candidate_competencies')
@Index(['candidateId', 'competenceId'], { unique: true })
export class CandidateCompetency {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'candidate_id', type: 'uuid' })
  candidateId: string;

  @ManyToOne(() => Candidate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_id' })
  candidate: Candidate;

  @Column({ name: 'competence_id', type: 'uuid' })
  competenceId: string;

  @ManyToOne(() => Competence)
  @JoinColumn({ name: 'competence_id' })
  competence: Competence;

  @Column({ type: 'int' })
  level: number;

  @Column({ type: 'varchar', length: 50, default: 'MANUAL' })
  source: string; // 'MANUAL' | 'AI' | 'ASSESSMENT'

  @Column({ name: 'source_application_id', type: 'uuid', nullable: true })
  sourceApplicationId: string | null;

  @Column({ name: 'rated_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  ratedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
