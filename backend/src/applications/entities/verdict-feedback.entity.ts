import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { ApplicationVerdict } from './application-verdict.entity';
import { User }               from '../../users/entities/user.entity';

/**
 * Structured human feedback on the quality of an AI verdict.
 * Submitted via the post-decision toast in the UI.
 */
@Entity('verdict_feedback')
export class VerdictFeedback {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'verdict_id', type: 'uuid' })
  verdictId: string;

  @Column({ name: 'reviewer_id', type: 'uuid' })
  reviewerId: string;

  /** Did the human agree with the AI recommendation? */
  @Column({ type: 'boolean' })
  agreed: boolean;

  /** If disagreed, why? */
  @Column({ name: 'override_reason', type: 'varchar', length: 300, nullable: true })
  overrideReason: string | null;

  /** How useful was the verdict panel? 1–5 */
  @Column({ name: 'quality_rating', type: 'smallint', nullable: true })
  qualityRating: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  // ── Relations ────────────────────────────────────────────────────
  @ManyToOne(() => ApplicationVerdict, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'verdict_id' })
  verdict: ApplicationVerdict;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reviewer_id' })
  reviewer: User;
}
