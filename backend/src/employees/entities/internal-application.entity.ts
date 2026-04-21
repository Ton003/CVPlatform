import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Employee } from './employee.entity';
import { JobOffer } from '../../job-offers/job-offer.entity';

export enum InternalApplicationStatus {
  APPLIED = 'applied',
  MANAGER_APPROVED = 'manager_approved',
  INTERVIEWING = 'interviewing',
  SELECTED = 'selected',
  REJECTED = 'rejected',
  TRANSFERRED = 'transferred'
}

@Entity('internal_applications')
export class InternalApplication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ name: 'job_offer_id', type: 'uuid' })
  jobOfferId: string;

  @ManyToOne(() => JobOffer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_offer_id' })
  jobOffer: JobOffer;

  @Column({
    type: 'enum',
    enum: InternalApplicationStatus,
    default: InternalApplicationStatus.APPLIED
  })
  status: InternalApplicationStatus;

  @Column({ name: 'manager_notes', type: 'text', nullable: true })
  managerNotes: string | null;

  @Column({ name: 'hr_notes', type: 'text', nullable: true })
  hrNotes: string | null;

  @Column({ name: 'applied_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  appliedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
