import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';

// Forward-reference avoids circular import between User ↔ Employee
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255, name: 'password_hash' })
  passwordHash: string;

  @Column({ type: 'varchar', length: 100, name: 'first_name' })
  firstName: string;

  @Column({ type: 'varchar', length: 100, name: 'last_name' })
  lastName: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'hr',
  })
  role: 'admin' | 'hr' | 'manager';

  @Column({ type: 'varchar', length: 100, nullable: true })
  department: string;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  /**
   * Hard link to the Employee record that represents this user's organisational identity.
   * departmentId is DERIVED from here at JWT generation — never trusted from requests.
   * Mandatory for role = 'manager'. Optional for role = 'hr' / 'admin'.
   */
  @Column({ name: 'employee_id', type: 'uuid', nullable: true, unique: true })
  employeeId: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
