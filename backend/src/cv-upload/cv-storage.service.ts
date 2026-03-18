import { Injectable, Logger }  from '@nestjs/common';
import { InjectRepository }    from '@nestjs/typeorm';
import { Repository }          from 'typeorm';
import * as fs                 from 'fs';
import * as path               from 'path';
import * as crypto             from 'crypto';
import { Candidate }           from '../candidates/entities/candidates.entity';
import { Cv }                  from '../cvs/entities/cv.entity';
import { CvParsedData }        from '../cv-parsed-data/entities/cv-parsed-data.entity';
import { ParsedCvDto }         from './dto/parsed-cv.dto';
import { PdfExtractorService } from './pdf-extractor.service';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB — same as Multer limit

@Injectable()
export class CvStorageService {
  private readonly logger = new Logger(CvStorageService.name);

  constructor(
    @InjectRepository(Candidate)
    private candidateRepo: Repository<Candidate>,
    @InjectRepository(Cv)
    private cvRepo: Repository<Cv>,
    @InjectRepository(CvParsedData)
    private parsedRepo: Repository<CvParsedData>,
    private readonly pdfExtractor: PdfExtractorService,
  ) {}

  async store(
    file:         Express.Multer.File,
    parsed:       ParsedCvDto,
    uploadedById: string,
    gdprConsent:  boolean = false,
  ): Promise<any> {

    // ── Step 1: Hash for duplicate detection ─────────────────────────────
    const fileHash = crypto
      .createHash('sha256')
      .update(file.buffer)
      .digest('hex');

    this.logger.log(`💾 STORAGE — file hash: ${fileHash.substring(0, 12)}...`);

    // ── Step 2: Check for exact duplicate ────────────────────────────────
    const existingCv = await this.cvRepo.findOne({ where: { file_hash: fileHash } });
    if (existingCv) {
      this.logger.log(`⚠️  Duplicate CV detected — cvId: ${existingCv.id}`);
      const existingCandidate = await this.candidateRepo.findOne({
        where: { id: existingCv.candidate_id },
      });
      return {
        message:     'This CV already exists in the database',
        duplicate:   true,
        candidateId: existingCandidate?.id ?? null,
        cvId:        existingCv.id,
      };
    }

    // ── Step 3: Resolve or create candidate ──────────────────────────────
    const email = parsed.email?.toLowerCase().trim()
      || `noemail_${fileHash.substring(0, 12)}@cv.internal`;

    let candidate = await this.candidateRepo.findOne({ where: { email } });

    if (!candidate) {
      this.logger.log(`👤 Creating new candidate — ${parsed.first_name} ${parsed.last_name}`);
      candidate = this.candidateRepo.create({
        first_name:       parsed.first_name    ?? 'Unknown',
        last_name:        parsed.last_name     ?? 'Unknown',
        email,
        phone:            parsed.phone         ?? null,
        linkedin_url:     parsed.linkedin_url  ?? null,
        current_title:    parsed.current_title ?? null,
        years_experience: this.toSmallInt(parsed.years_experience),
        location:         parsed.location      ?? null,
        source:           'upload',
        gdpr_consent:     gdprConsent,
        gdpr_consent_at:  gdprConsent ? new Date() : null,
        created_by:       uploadedById,
      });
      await this.candidateRepo.save(candidate);
    } else {
      this.logger.log(`👤 Existing candidate found — enriching record`);
      let updated = false;

      if (!candidate.phone         && parsed.phone)         { candidate.phone         = parsed.phone;         updated = true; }
      if (!candidate.linkedin_url  && parsed.linkedin_url)  { candidate.linkedin_url  = parsed.linkedin_url;  updated = true; }
      if (!candidate.current_title && parsed.current_title) { candidate.current_title = parsed.current_title; updated = true; }
      if (!candidate.location      && parsed.location)      { candidate.location      = parsed.location;      updated = true; }
      if (!candidate.years_experience && parsed.years_experience) {
        candidate.years_experience = this.toSmallInt(parsed.years_experience);
        updated = true;
      }

      if (updated) {
        await this.candidateRepo.save(candidate);
        this.logger.log(`✅ Candidate record enriched`);
      }
    }

    // ── Step 4: Save PDF file to disk ─────────────────────────────────────
    // ✅ Guard against oversized files reaching disk
    if (file.buffer.length > MAX_FILE_SIZE) {
      throw new Error(`File too large: ${file.buffer.length} bytes`);
    }

    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const filePath = path.join(uploadsDir, `${fileHash}.pdf`);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, file.buffer);
      this.logger.log(`💾 PDF saved to disk: ${filePath}`);
    }

    // ── Step 5: Save CV record ────────────────────────────────────────────
    const cv = this.cvRepo.create({
      candidate_id:   candidate.id,
      file_name:      file.originalname,
      file_path:      filePath,
      mime_type:      file.mimetype,
      file_hash:      fileHash,
      is_primary:     true,
      language:       parsed.language ?? 'fr', // ✅ use detected language, fallback fr
      parsing_status: 'done',
      uploaded_by:    uploadedById,
    });
    await this.cvRepo.save(cv);
    this.logger.log(`✅ CV record saved — cvId: ${cv.id}`);

    // ── Step 6: Generate embedding ────────────────────────────────────────
    this.logger.log(`🔢 Generating CV embedding...`);
    const cvTextForEmbedding = this.buildEmbeddingText(parsed);
    const embedding = await this.pdfExtractor.embedText(cvTextForEmbedding);

    // ── Step 7: Save parsed data + embedding ─────────────────────────────
    const parsedData = this.parsedRepo.create({
      cv_id:                   cv.id,
      raw_text:                null,
      skills_technical:        parsed.skills_technical        ?? [],
      skills_soft:             parsed.skills_soft             ?? [],
      languages:               parsed.languages               ?? [],
      education:               parsed.education               ?? [],
      experience:              parsed.experience              ?? [],
      total_experience_months: this.toSmallInt(parsed.total_experience_months),
      llm_summary:             parsed.llm_summary             ?? null,
      parsed_at:               new Date(),
      embedding:               embedding.length > 0
                                 ? `[${embedding.join(',')}]`
                                 : null,
    });
    await this.parsedRepo.save(parsedData);
    this.logger.log(`✅ Parsed data + embedding saved`);

    // ── Step 8: Return clean response ─────────────────────────────────────
    return {
      message:     'CV uploaded and parsed successfully',
      duplicate:   false,
      candidateId: candidate.id,
      cvId:        cv.id,
      preview: {
        name:             `${parsed.first_name ?? ''} ${parsed.last_name ?? ''}`.trim() || 'Unknown',
        email:            parsed.email,
        location:         parsed.location,
        experience_years: parsed.years_experience,
        current_title:    parsed.current_title,
        skills:           parsed.skills_technical?.slice(0, 6) ?? [],
        summary:          parsed.llm_summary,
      },
    };
  }

  private buildEmbeddingText(parsed: ParsedCvDto): string {
    const parts: string[] = [];

    if (parsed.current_title) parts.push(parsed.current_title);
    if (parsed.llm_summary)   parts.push(parsed.llm_summary);

    if (parsed.skills_technical?.length) {
      parts.push(`Skills: ${parsed.skills_technical.join(', ')}`);
    }
    if (parsed.skills_soft?.length) {
      parts.push(`Soft skills: ${parsed.skills_soft.join(', ')}`);
    }
    if (parsed.experience?.length) {
      const expText = parsed.experience
        .map(e => `${e.title}${e.company ? ` at ${e.company}` : ''}`)
        .join(', ');
      parts.push(`Experience: ${expText}`);
    }
    if (parsed.education?.length) {
      const eduText = parsed.education
        .map(e => `${e.degree ?? ''} ${e.institution ?? ''}`.trim())
        .join(', ');
      parts.push(`Education: ${eduText}`);
    }

    return parts.join('. ');
  }

  private toSmallInt(value: any): number | null {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    if (isNaN(num))  return null;
    if (num > 1900)  return null;
    if (num >= 0 && num <= 50) return Math.round(num);
    return null;
  }
}