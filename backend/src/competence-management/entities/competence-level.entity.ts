import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, Index, Check,
} from 'typeorm';
import { Competence } from './competence.entity';

@Entity('competence_levels')
@Index('idx_level_competence', ['competenceId'])
@Check('chk_level_range', '"level" BETWEEN 1 AND 5')
export class CompetenceLevel {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'competence_id', type: 'uuid' })
  competenceId: string;

  /** 1 = Aware, 2 = Basic, 3 = Intermediate, 4 = Advanced, 5 = Expert */
  @Column({ type: 'smallint' })
  level: number;

  @Column({ type: 'text' })
  description: string;

  @ManyToOne(() => Competence, (c) => c.levels, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'competence_id' })
  competence: Competence;
}
