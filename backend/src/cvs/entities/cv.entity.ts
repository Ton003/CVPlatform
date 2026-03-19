import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('cvs')
export class Cv {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  candidate_id: string;

  @Column({ length: 255 })
  file_name: string;

  @Column()
  file_path: string;

  @Column({ length: 100 })
  mime_type: string;

  @Column({ length: 64, nullable: true, unique: true })
  file_hash: string;

  @Column({ default: false })
  is_primary: boolean;

  @Column({ length: 10, nullable: true, default: 'fr' })
  language: string;

  @Column({ length: 20, default: 'pending' })
  parsing_status: string;

  @Column({ nullable: true })
  uploaded_by: string;

  @CreateDateColumn()
  created_at: Date;
}