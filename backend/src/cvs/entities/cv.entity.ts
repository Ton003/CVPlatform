import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('cvs')
export class Cv {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'candidate_id' })
  candidateId: string;

  @Column({ length: 255, name: 'file_name' })
  fileName: string;

  @Column({ name: 'file_path' })
  filePath: string;

  @Column({ length: 100, name: 'mime_type' })
  mimeType: string;

  @Column({ length: 64, nullable: true, unique: true, name: 'file_hash' })
  fileHash: string;

  @Column({ default: false, name: 'is_primary' })
  isPrimary: boolean;

  @Column({ length: 10, nullable: true, default: 'fr' })
  language: string;

  @Column({ length: 20, default: 'pending', name: 'parsing_status' })
  parsingStatus: string;

  @Column({ nullable: true, name: 'uploaded_by' })
  uploadedBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}