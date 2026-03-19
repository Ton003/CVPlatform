import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('assessfirst_results')
export class AssessFirstResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'candidate_id', unique: true })
  candidateId: string;

  @Column({ type: 'uuid', name: 'uploaded_by' })
  uploadedBy: string;

  // SWIPE — Personality
  @Column({ type: 'varchar', length: 100, name: 'candidate_name', nullable: true })
  candidateName: string | null;

  @Column({ type: 'varchar', length: 20, name: 'assessment_date', nullable: true })
  assessmentDate: string | null;

  @Column({ type: 'varchar', length: 100, name: 'personal_style', nullable: true })
  personalStyle: string | null;

  @Column({ type: 'text', name: 'personal_style_desc', nullable: true })
  personalStyleDesc: string | null;

  @Column({ type: 'jsonb', default: [] })
  traits: string[];

  @Column({ type: 'jsonb', default: [] })
  improvements: string[];

  @Column({ type: 'jsonb', name: 'talent_cloud', default: {} })
  talentCloud: Record<string, string[]>;

  @Column({ type: 'jsonb', name: 'dimension_details', default: {} })
  dimensionDetails: Record<string, Record<string, string[]>>;

  // DRIVE — Motivations
  @Column({ type: 'jsonb', name: 'top_motivators', default: [] })
  topMotivators: string[];

  @Column({ type: 'jsonb', name: 'low_motivators', default: [] })
  lowMotivators: string[];

  @Column({ type: 'jsonb', name: 'preferred_activities', default: [] })
  preferredActivities: Array<{ name: string; description: string }>;

  @Column({ type: 'jsonb', name: 'management_style', default: [] })
  managementStyle: Array<{ label: string; pct: number }>;

  @Column({ type: 'jsonb', name: 'sought_management', default: [] })
  soughtManagement: Array<{ label: string; pct: number }>;

  @Column({ type: 'varchar', length: 50, name: 'culture_fit', nullable: true })
  cultureFit: string | null;

  @Column({ type: 'text', name: 'culture_desc', nullable: true })
  cultureDesc: string | null;

  // BRAIN — Aptitude
  @Column({ type: 'varchar', length: 100, name: 'decision_making', nullable: true })
  decisionMaking: string | null;

  @Column({ type: 'varchar', length: 100, name: 'preferred_tasks', nullable: true })
  preferredTasks: string | null;

  @Column({ type: 'varchar', length: 100, name: 'learning_style', nullable: true })
  learningStyle: string | null;

  @Column({ type: 'text', name: 'aptitude_desc', nullable: true })
  aptitudeDesc: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  // ✅ ManyToOne relations removed — candidateId and uploadedBy as plain UUIDs
  // is sufficient. The CASCADE delete is handled by the DB FK constraint directly.
}