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
import { Employee } from './employee.entity';
import { JobOffer } from '../../job-offers/job-offer.entity';

@Entity('employee_role_matches')
@Index(['employeeId', 'jobOfferId'], { unique: true })
export class EmployeeRoleMatch {
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

  @Column({ name: 'total_score', type: 'int' })
  totalScore: number;

  @Column({ name: 'is_complete', type: 'boolean', default: false })
  isComplete: boolean;

  @Column({ type: 'jsonb', nullable: true })
  breakdown: any;

  @Column({ name: 'last_calculated_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  lastCalculatedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
