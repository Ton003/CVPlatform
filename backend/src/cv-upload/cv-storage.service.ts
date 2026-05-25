import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Candidate } from '../candidates/entities/candidates.entity';
import { Cv } from '../cvs/entities/cv.entity';
import { CvParsedData } from '../cv-parsed-data/entities/cv-parsed-data.entity';
import { CandidateCareerEntry } from '../candidates/entities/candidate-career-entry.entity';
import { ParsedCvDto } from './dto/parsed-cv.dto';
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
  ) {}

  async store(
    file: Express.Multer.File,
    parsed: ParsedCvDto,
    uploadedById: string,
    gdprConsent: boolean = false,
  ): Promise<any> {
    const fileHash = this.generateFileHash(file.buffer);
    this.logger.log(` STORAGE — file hash: ${fileHash.substring(0, 12)}...`);

    // 1. Duplicate Detection
    const duplicateResult = await this.checkExistingCv(fileHash);
    if (duplicateResult) return duplicateResult;

    // 2. Candidate Resolution (Create or Update)
    const candidate = await this.upsertCandidate(
      parsed,
      uploadedById,
      gdprConsent,
    );

    // 3. File Storage
    const filePath = await this.saveFileToDisk(file.buffer, fileHash);

    // 4. CV Metadata
    const cv = await this.saveCvRecord(
      candidate.id,
      file.originalname,
      filePath,
      file.mimetype,
      fileHash,
      uploadedById,
      parsed.language,
      'done',
    );

    // 5. Embedding & Parsed Data
    const embedding = await this.generateEmbedding(parsed);
    await this.saveParsedData(cv.id, parsed, embedding);

    // 6. Career Timeline
    await this.saveCareerEntries(candidate.id, parsed.experience || []);

    return this.buildResponse(candidate, cv, parsed);
  }

  /**
   * Initial storage for async parsing flow.
   * Creates candidate (if needed) and CV record in 'parsing' state.
   */
  async storeInitial(
    file: Express.Multer.File,
    candidateData: Partial<Candidate>,
    uploadedById: string,
  ): Promise<{ candidate: Candidate; cv: Cv }> {
    const fileHash = this.generateFileHash(file.buffer);

    // Upsert candidate based on provided data (email is key)
    let candidate = await this.candidateRepo.findOne({
      where: { email: candidateData.email! },
    });
    if (!candidate) {
      candidate = this.candidateRepo.create({
        ...candidateData,
        source: 'portal',
        createdBy: uploadedById,
      });
    } else {
      Object.assign(candidate, candidateData);
    }
    candidate = await this.candidateRepo.save(candidate);

    // Save file
    const filePath = await this.saveFileToDisk(file.buffer, fileHash);

    // Create CV record in 'parsing' state
    const cv = await this.saveCvRecord(
      candidate.id,
      file.originalname,
      filePath,
      file.mimetype,
      fileHash,
      uploadedById,
      'en',
      'parsing',
    );

    return { candidate, cv };
  }

  /**
   * Finalize parsing: save parsed data, embedding, and career entries.
   */
  async updateParsedData(cvId: string, parsed: ParsedCvDto): Promise<void> {
    const cv = await this.cvRepo.findOne({ where: { id: cvId } });
    if (!cv) return;

    // 1. Embedding & Parsed Data
    const embedding = await this.generateEmbedding(parsed);
    await this.saveParsedData(cv.id, parsed, embedding);

    // 2. Career Timeline
    await this.saveCareerEntries(cv.candidateId, parsed.experience || []);

    // 3. Update CV status
    cv.parsingStatus = 'done';
    if (parsed.language) cv.language = parsed.language;
    await this.cvRepo.save(cv);

    this.logger.log(` CV ${cvId} parsing finalized.`);
  }

  async updateStatus(
    cvId: string,
    status: 'parsing' | 'done' | 'failed',
  ): Promise<void> {
    const cv = await this.cvRepo.findOne({ where: { id: cvId } });
    if (!cv) return;
    cv.parsingStatus = status;
    await this.cvRepo.save(cv);
  }

  async getParseStatus(cvId: string) {
    const cv = await this.cvRepo.findOne({
      where: { id: cvId },
      relations: ['parsedData'],
    });
    if (!cv) throw new NotFoundException('CV not found');
    return {
      status: cv.parsingStatus,
      hasData: !!cv['parsedData'],
    };
  }

  private generateFileHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  private async checkExistingCv(fileHash: string): Promise<any | null> {
    const existingCv = await this.cvRepo.findOne({
      where: { fileHash: fileHash },
    });
    if (!existingCv) return null;

    this.logger.log(` Duplicate CV metadata found — cvId: ${existingCv.id}`);
    const existingCandidate = await this.candidateRepo.findOne({
      where: { id: existingCv.candidateId },
    });

    if (existingCandidate) {
      this.logger.log(
        ` Associated candidate found: ${existingCandidate.id} (Status: ${existingCandidate.status})`,
      );

      // If candidate is hired, block with a duplicate message.
      // If candidate is NOT hired (e.g. was un-hired by employee deletion),
      // we still tell them it exists, but the UI can now offer to "view/reset" it.
      return {
        message:
          existingCandidate.status === 'hired'
            ? 'This candidate is already an active employee.'
            : 'This CV already exists in the database.',
        duplicate: true,
        candidateId: existingCandidate.id,
        cvId: existingCv.id,
        status: existingCandidate.status,
      };
    }

    this.logger.warn(` Orphaned CV detected (no candidate) — cleaning up...`);
    await this.cvRepo.remove(existingCv);
    this.logger.log(
      `🧹 Orphaned CV record removed. Proceeding with fresh upload.`,
    );
    return null;
  }

  private async upsertCandidate(
    parsed: ParsedCvDto,
    uploadedById: string,
    gdprConsent: boolean,
  ): Promise<Candidate> {
    const email =
      parsed.email?.toLowerCase().trim() ||
      `noemail_${crypto.randomBytes(6).toString('hex')}@cv.internal`;
    let candidate = await this.candidateRepo.findOne({ where: { email } });

    const candidateData = {
      firstName: parsed.firstName ?? 'Unknown',
      lastName: parsed.lastName ?? 'Unknown',
      email,
      phone: parsed.phone ?? null,
      linkedinUrl: parsed.linkedinUrl ?? null,
      currentTitle: parsed.currentTitle ?? null,
      yearsExperience: this.toSmallInt(parsed.yearsExperience),
      location: parsed.location ?? null,
      source: 'upload',
      gdprConsent: gdprConsent,
      gdprConsentAt: gdprConsent ? new Date() : null,
      createdBy: uploadedById,
    };

    if (!candidate) {
      this.logger.log(
        `👤 Creating new candidate — ${candidateData.firstName} ${candidateData.lastName}`,
      );
      candidate = this.candidateRepo.create(candidateData);
    } else {
      this.logger.log(
        `👤 Existing candidate found (${email}) — updating record`,
      );
      Object.assign(candidate, {
        ...candidateData,
        // Preserve creation info if updating
        gdprConsent: gdprConsent || candidate.gdprConsent,
        gdprConsentAt:
          gdprConsent && !candidate.gdprConsent
            ? new Date()
            : candidate.gdprConsentAt,
      });
    }

    return this.candidateRepo.save(candidate);
  }

  private async saveFileToDisk(
    buffer: Buffer,
    fileHash: string,
  ): Promise<string> {
    if (buffer.length > MAX_FILE_SIZE) {
      throw new Error(`File too large: ${buffer.length} bytes`);
    }

    const fileName = `${fileHash}.pdf`;
    const uploadDir = path.join(process.cwd(), 'uploads');

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const fullPath = path.join(uploadDir, fileName);
    await fs.promises.writeFile(fullPath, buffer);
    this.logger.log(` PDF saved to disk: ${fileName}`);

    return `/uploads/${fileName}`;
  }

  private async saveCvRecord(
    candidateId: string,
    fileName: string,
    filePath: string,
    mimeType: string,
    fileHash: string,
    uploadedById: string,
    language: string = 'fr',
    status: 'parsing' | 'done' | 'failed' = 'done',
  ): Promise<Cv> {
    const cv = this.cvRepo.create({
      candidateId: candidateId,
      fileName: fileName,
      filePath: filePath,
      mimeType: mimeType,
      fileHash: fileHash,
      isPrimary: true,
      language: language || 'fr',
      parsingStatus: status,
      uploadedBy: uploadedById,
    });
    const saved = await this.cvRepo.save(cv);
    this.logger.log(` CV record saved — cvId: ${saved.id}`);
    return saved;
  }

  private async generateEmbedding(parsed: ParsedCvDto): Promise<number[]> {
    this.logger.log(` Generating CV embedding...`);
    const text = this.buildEmbeddingText(parsed);
    return this.pdfExtractor.embedText(text);
  }

  private async saveParsedData(
    cvId: string,
    parsed: ParsedCvDto,
    embedding: number[],
  ): Promise<CvParsedData> {
    const parsedData = this.parsedRepo.create({
      cvId: cvId,
      rawText: null,
      skillsTechnical: parsed.skillsTechnical ?? [],
      skillsSoft: parsed.skillsSoft ?? [],
      languages: parsed.languages ?? [],
      education: parsed.education ?? [],
      experience: parsed.experience ?? [],
      totalExperienceMonths: this.toSmallInt(parsed.totalExperienceMonths),
      llmSummary: parsed.llmSummary ?? null,
      parsedAt: new Date(),
      embedding: embedding.length > 0 ? `[${embedding.join(',')}]` : null,
    });
    const saved = await this.parsedRepo.save(parsedData);
    this.logger.log(` Parsed data + embedding saved`);
    return saved;
  }

  private async saveCareerEntries(
    candidateId: string,
    experience: any[],
  ): Promise<void> {
    if (!experience.length) return;

    this.logger.log(` Saving ${experience.length} career entries...`);
    const careerEntries = experience.map((exp) => {
      const tags = exp.inferredTags || [];
      const avgConfidence =
        tags.length > 0
          ? tags.reduce((sum: number, t: any) => sum + (t.confidence || 0), 0) /
            tags.length
          : 0;

      return this.careerEntryRepo.create({
        candidateId,
        roleTitle: exp.title,
        company: exp.company,
        startDate: this.normalizeDate(exp.startDate),
        endDate: this.normalizeDate(exp.endDate),
        rawDescription: exp.description,
        sfiaTags: tags,
        source: 'AI',
        confidenceScore: avgConfidence,
      });
    });
    await this.careerEntryRepo.save(careerEntries);
    this.logger.log(` Career entries saved`);
  }

  private buildResponse(
    candidate: Candidate,
    cv: Cv,
    parsed: ParsedCvDto,
  ): any {
    return {
      message: 'CV processed successfully',
      action: 'saved',
      duplicate: false,
      candidateId: candidate.id,
      cvId: cv.id,
      preview: {
        name: `${candidate.firstName} ${candidate.lastName}`.trim(),
        email: candidate.email,
        location: candidate.location,
        experience_years: parsed.yearsExperience,
        current_title: candidate.currentTitle,
        skills: parsed.skillsTechnical?.slice(0, 6) ?? [],
        summary: parsed.llmSummary,
      },
    };
  }

  private buildEmbeddingText(parsed: ParsedCvDto): string {
    const parts: string[] = [];

    if (parsed.currentTitle) parts.push(parsed.currentTitle);
    if (parsed.llmSummary) parts.push(parsed.llmSummary);

    if (parsed.skillsTechnical?.length) {
      parts.push(`Skills: ${parsed.skillsTechnical.join(', ')}`);
    }
    if (parsed.skillsSoft?.length) {
      parts.push(`Soft skills: ${parsed.skillsSoft.join(', ')}`);
    }
    if (parsed.experience?.length) {
      const expText = parsed.experience
        .map((e) => `${e.title}${e.company ? ` at ${e.company}` : ''}`)
        .join(', ');
      parts.push(`Experience: ${expText}`);
    }
    if (parsed.education?.length) {
      const eduText = parsed.education
        .map((e) => `${e.degree ?? ''} ${e.institution ?? ''}`.trim())
        .join(', ');
      parts.push(`Education: ${eduText}`);
    }

    return parts.join('. ');
  }

  private toSmallInt(value: any): number | null {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    if (isNaN(num)) return null;
    if (num >= 0 && num <= 1200) return Math.round(num); // Max 100 years experience in months
    return null;
  }

  private normalizeDate(dateStr: string | null | undefined): string | null {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null; // Fallback to null for unparsable dates like "Present"
    return d.toISOString().split('T')[0];
  }
}
