import { Injectable, Logger }  from '@nestjs/common';
import { InjectRepository }    from '@nestjs/typeorm';
import { ConfigService }       from '@nestjs/config';
import { Repository }          from 'typeorm';
import * as crypto             from 'crypto';
import * as fs                 from 'fs';
import * as path               from 'path';
import { Candidate }           from '../candidates/entities/candidates.entity';
import { Cv }                  from '../cvs/entities/cv.entity';
import { CvParsedData }        from '../cv-parsed-data/entities/cv-parsed-data.entity';
import { CandidateCareerEntry } from '../candidates/entities/candidate-career-entry.entity';
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
    @InjectRepository(CandidateCareerEntry)
    private careerEntryRepo: Repository<CandidateCareerEntry>,
    private readonly pdfExtractor: PdfExtractorService,
    private readonly configService: ConfigService,
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
      this.logger.log(`⚠️  Duplicate CV metadata found — cvId: ${existingCv.id}`);
      const existingCandidate = await this.candidateRepo.findOne({
        where: { id: existingCv.candidate_id },
      });

      if (existingCandidate) {
        this.logger.log(`✅ Associated candidate found: ${existingCandidate.id}`);
        return {
          message:     'This CV already exists in the database',
          duplicate:   true,
          candidateId: existingCandidate.id,
          cvId:        existingCv.id,
        };
      } else {
        this.logger.warn(`🛑 Orphaned CV detected (no candidate) — cleaning up...`);
        // The candidate was deleted but the CV remained. Clean it up and proceed.
        // Cascade should handle parsed data if defined, but we'll be safe or just let the new save overwrite/conflict if not careful.
        // Actually, it's better to just delete the old CV record so Step 5 can create a fresh one.
        await this.cvRepo.remove(existingCv);
        this.logger.log(`🧹 Orphaned CV record removed. Proceeding with fresh upload.`);
      }
    }

    // ── Step 3: Resolve or create candidate ──────────────────────────────
    const email = parsed.email?.toLowerCase().trim()
      || `noemail_${fileHash.substring(0, 12)}@cv.internal`;

    let candidate = await this.candidateRepo.findOne({ where: { email } });
    let isUpdate = false;

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
      // ✅ FIX 6: Candidate deduplication — always update record with latest
      // CV parse results so re-uploads keep the profile current.
      this.logger.log(`👤 Existing candidate found (${email}) — updating with latest CV data`);
      isUpdate = true;

      candidate.first_name       = parsed.first_name    ?? candidate.first_name;
      candidate.last_name        = parsed.last_name     ?? candidate.last_name;
      candidate.phone            = parsed.phone         ?? candidate.phone;
      candidate.linkedin_url     = parsed.linkedin_url  ?? candidate.linkedin_url;
      candidate.current_title    = parsed.current_title ?? candidate.current_title;
      candidate.location         = parsed.location      ?? candidate.location;
      candidate.years_experience = this.toSmallInt(parsed.years_experience) ?? candidate.years_experience;

      await this.candidateRepo.save(candidate);
      this.logger.log(`✅ Candidate record updated`);
    }

    // ── Step 4: Save PDF to Local Disk ────────────────────────────────────
    // ✅ Guard against oversized files
    if (file.buffer.length > MAX_FILE_SIZE) {
      throw new Error(`File too large: ${file.buffer.length} bytes`);
    }

    const fileName = `${fileHash}.pdf`;
    const uploadDir = path.join(process.cwd(), 'uploads');
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const fullPath = path.join(uploadDir, fileName);
    
    // Write file to disk
    await fs.promises.writeFile(fullPath, file.buffer);
    this.logger.log(`💾 PDF saved to disk: ${fullPath}`);

    // In a real app with local storage, you'd serve the static files or use a proxy.
    // For now, we store the local relative path.
    const filePath = `/uploads/${fileName}`;

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

    // ── Step 8: Save Career Entries ───────────────────────────────────────
    if (parsed.experience?.length) {
      this.logger.log(`📜 Saving ${parsed.experience.length} career entries...`);
      // Delete existing AI entries to avoid duplicates on re-upload if logic dictates
      // For now, we'll just add new ones or handle deduplication
      const careerEntries = parsed.experience.map(exp => {
        // Extract average confidence if available in tags
        const tags = exp.inferredTags || [];
        const avgConfidence = tags.length > 0 
          ? tags.reduce((sum: number, t: any) => sum + (t.confidence || 0), 0) / tags.length 
          : 0;

        return this.careerEntryRepo.create({
          candidateId:     candidate.id,
          roleTitle:       exp.title,
          company:         exp.company,
          startDate:       this.normalizeDate(exp.start_date),
          endDate:         this.normalizeDate(exp.end_date),
          rawDescription:  exp.description,
          sfiaTags:        tags,
          source:          'AI',
          confidenceScore: avgConfidence,
        });
      });
      await this.careerEntryRepo.save(careerEntries);
      this.logger.log(`✅ Career entries saved`);
    }

    // ── Step 9: Return clean response ─────────────────────────────────────

    // ✅ FIX 6: Return action flag so API consumers know if this was a create or update
    return {
      message:     isUpdate ? 'CV re-parsed and candidate record updated' : 'CV uploaded and parsed successfully',
      action:      isUpdate ? 'updated' : 'created',
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

  private normalizeDate(dateStr: string | null | undefined): string | null {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null; // Fallback to null for unparsable dates like "Present"
    return d.toISOString().split('T')[0];
  }
}