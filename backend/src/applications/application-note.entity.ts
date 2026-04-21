import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Application } from './application.entity';
import { User }        from '../users/entities/user.entity';

@Entity('application_notes')
export class ApplicationNote {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'application_id', type: 'uuid' })
  applicationId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'text' })
  note: string;

  @Column({ type: 'smallint', default: 0 })
  rating: number;   // 0 = no rating, 1-5 stars

  @Column({ type: 'varchar', length: 50, nullable: true })
  stage: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Application, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'application_id' })
  application: Application;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true, eager: true })
  @JoinColumn({ name: 'user_id' })
  author: User;
}
