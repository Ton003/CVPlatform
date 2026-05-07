import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('cv_parsed_data')
export class CvParsedData {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, name: 'cv_id' })
  cvId: string;

  @Column({ type: 'text', nullable: true, default: null, name: 'raw_text' })
  rawText: string | null;

  @Column({ type: 'jsonb', nullable: true, default: null, name: 'skills_technical' })
  skillsTechnical: string[] | null;

  @Column({ type: 'jsonb', nullable: true, default: null, name: 'skills_soft' })
  skillsSoft: string[] | null;

  @Column({ type: 'jsonb', nullable: true, default: null })
  languages: object[] | null;

  @Column({ type: 'jsonb', nullable: true, default: null })
  education: object[] | null;

  @Column({ type: 'jsonb', nullable: true, default: null })
  experience: object[] | null;

  @Column({ type: 'smallint', nullable: true, default: null, name: 'total_experience_months' })
  totalExperienceMonths: number | null;

  @Column({ type: 'text', nullable: true, default: null, name: 'llm_summary' })
  llmSummary: string | null;

  @Column({ type: 'timestamptz', nullable: true, default: null, name: 'parsed_at' })
  parsedAt: Date | null;

  // ── NEW: vector embedding for semantic search ─────────────────────────
  @Column({ type: 'text', nullable: true, default: null })
  embedding: string | null;  // stored as "[0.1,0.2,...]" text, cast to vector in queries
}