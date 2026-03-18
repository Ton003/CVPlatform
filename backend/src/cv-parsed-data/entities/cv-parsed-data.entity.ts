import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('cv_parsed_data')
export class CvParsedData {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  cv_id: string;

  @Column({ type: 'text', nullable: true, default: null })
  raw_text: string | null;

  @Column({ type: 'jsonb', nullable: true, default: null })
  skills_technical: string[] | null;

  @Column({ type: 'jsonb', nullable: true, default: null })
  skills_soft: string[] | null;

  @Column({ type: 'jsonb', nullable: true, default: null })
  languages: object[] | null;

  @Column({ type: 'jsonb', nullable: true, default: null })
  education: object[] | null;

  @Column({ type: 'jsonb', nullable: true, default: null })
  experience: object[] | null;

  @Column({ type: 'smallint', nullable: true, default: null })
  total_experience_months: number | null;

  @Column({ type: 'text', nullable: true, default: null })
  llm_summary: string | null;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  parsed_at: Date | null;

  // ── NEW: vector embedding for semantic search ─────────────────────────
  @Column({ type: 'text', nullable: true, default: null })
  embedding: string | null;  // stored as "[0.1,0.2,...]" text, cast to vector in queries
}