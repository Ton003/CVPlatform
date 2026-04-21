import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, OneToMany, JoinColumn, Index,
} from 'typeorm';
import { CompetenceFamily } from './family.entity';
import { CompetenceLevel }  from './competence-level.entity';

@Entity('competences')
@Index('idx_competence_family', ['familyId'])
export class Competence {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'family_id', type: 'uuid' })
  familyId: string;

  @ManyToOne(() => CompetenceFamily, (f) => f.competences, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'family_id' })
  family: CompetenceFamily;

  @OneToMany(() => CompetenceLevel, (l) => l.competence, { cascade: true, eager: true })
  levels: CompetenceLevel[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
