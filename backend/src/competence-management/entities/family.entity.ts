import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  OneToMany, Index,
} from 'typeorm';
import { Competence } from './competence.entity';

export enum CompetenceCategory {
  TECHNICAL  = 'TECHNICAL',
  BEHAVIORAL = 'BEHAVIORAL',
  MANAGERIAL = 'MANAGERIAL',
}

@Entity('competence_families')
@Index('idx_family_category', ['category'])
export class CompetenceFamily {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'enum', enum: CompetenceCategory })
  category: CompetenceCategory;

  @Column({ default: 0 })
  competenceCount: number;

  @OneToMany(() => Competence, (c) => c.family, { cascade: true })
  competences: Competence[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
