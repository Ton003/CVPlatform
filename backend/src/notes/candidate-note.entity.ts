import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Candidate } from '../candidates/entities/candidates.entity';
import { User }      from '../users/entities/user.entity';

export type NoteStage = 'screening' | 'interview' | 'offer' | 'rejected';

@Entity('candidate_notes')
export class CandidateNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'candidate_id' })
  candidateId: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'text' })
  note: string;

  @Column({ type: 'smallint', default: 0 })
  rating: number; // 0 = no rating, 1-5 = star rating

  @Column({
    type: 'varchar',
    length: 20,
    default: 'screening',
  })
  stage: NoteStage;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Candidate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_id' })
  candidate: Candidate;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
