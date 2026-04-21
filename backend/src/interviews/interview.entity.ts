import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { Application } from '../applications/application.entity';

export type InterviewType = 'HR' | 'Technical' | 'Final';
export type InterviewStatus = 'scheduled' | 'completed' | 'cancelled';
export type InterviewDecision = 'pass' | 'fail' | 'maybe';

@Entity('interviews')
export class Interview {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'application_id', type: 'uuid' })
  applicationId: string;

  @Column({ name: 'scheduled_at', type: 'timestamptz' })
  scheduledAt: Date;

  @Column({
    type: 'varchar',
    length: 50,
  })
  type: InterviewType;

  @Column({ name: 'interviewer_name', type: 'varchar', length: 200 })
  interviewerName: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: 'scheduled',
  })
  status: InterviewStatus;

  @Column({ name: 'meeting_url', type: 'varchar', length: 512, nullable: true })
  meetingUrl: string | null;

  // ── Feedback (Added after interview) ───────────────────────────
  @Column({ name: 'technical_score', type: 'smallint', nullable: true })
  technicalScore: number | null; // 1-5

  @Column({ name: 'communication_score', type: 'smallint', nullable: true })
  communicationScore: number | null; // 1-5

  @Column({ type: 'text', nullable: true })
  comments: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  decision: InterviewDecision | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // ── Relations ────────────────────────────────────────────────────
  @ManyToOne(() => Application, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'application_id' })
  application: Application;
}
