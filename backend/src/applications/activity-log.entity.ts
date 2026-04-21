import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Application } from './application.entity';
import { User }        from '../users/entities/user.entity';

export type ActivityAction =
  | 'application_created'
  | 'stage_changed'
  | 'note_added'
  | 'score_calculated'
  | 'email_sent'
  | 'interview_scheduled'
  | 'interview_completed'
  | 'task_created'
  | 'task_completed'
  | 'note_deleted'
  | 'competency_rated';


@Entity('activity_log')
export class ActivityLog {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'application_id', type: 'uuid' })
  applicationId: string;

  @Column({ name: 'user_id', type: 'uuid' }) // Required for production tracking
  userId: string;

  @Column({ type: 'varchar', length: 100 })
  action: ActivityAction;

  @Column({ type: 'text', nullable: true })
  description: string | null; // e.g. "[User] moved candidate to Interview"

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;  // e.g. { from: 'applied', to: 'screening' }

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Application, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'application_id' })
  application: Application;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true, eager: true })
  @JoinColumn({ name: 'user_id' })
  user: User;
}

