import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BusinessUnit } from './business-unit.entity';
import { JobRole } from './job-role.entity';

@Entity('departments')
export class Department {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'business_unit_id' })
  businessUnitId: string;

  @ManyToOne(() => BusinessUnit, bu => bu.departments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_unit_id' })
  businessUnit: BusinessUnit;

  @OneToMany(() => JobRole, role => role.department)
  jobRoles: JobRole[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
