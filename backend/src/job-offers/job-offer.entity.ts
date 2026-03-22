import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('job_offers')
export class JobOffer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  location: string | null;

  @Column({ name: 'required_skills', type: 'jsonb', default: [] })
  requiredSkills: string[];

  @Column({ name: 'min_years', type: 'integer', nullable: true })
  minYears: number | null;

  @Column({ type: 'varchar', length: 50, default: 'open' })
  status: string;

  @Column({ name: 'created_by', type: 'varchar', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}