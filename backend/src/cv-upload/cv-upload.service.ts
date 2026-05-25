import { Injectable, Logger } from '@nestjs/common';
import { Candidate } from '../candidates/entities/candidates.entity';
import { PdfExtractorService } from './pdf-extractor.service';
import { AiCvParserService } from './ai-cv-parser.service';
import { CvStorageService } from './cv-storage.service';
import { RegexExtractorService } from './regex-extractor.service';
import { ParsedCvDto } from './dto/parsed-cv.dto';

export interface UploadOptions {
  apiKey?: string;
  gdprConsent?: boolean;
}

@Injectable()
export class CvUploadService {
  private readonly logger = new Logger(CvUploadService.name);

  constructor(
    private readonly pdfExtractor: PdfExtractorService,
    private readonly aiCvParser: AiCvParserService,
    private readonly cvStorage: CvStorageService,
    private readonly regexExtractor: RegexExtractorService,
  ) {}

  async processUpload(
    file: Express.Multer.File,
    uploadedById: string,
    options: UploadOptions = {},
  ): Promise<any> {
    const parsed = await this.parseCv(file.buffer, options);
    return this.cvStorage.store(
      file,
      parsed,
      uploadedById,
      options.gdprConsent ?? false,
    );
  }

  async processUploadAsync(
    file: Express.Multer.File,
    candidateData: Partial<Candidate>,
    uploadedById: string,
    options: UploadOptions = {},
  ): Promise<any> {
    const { candidate, cv } = await this.cvStorage.storeInitial(
      file,
      candidateData,
      uploadedById,
    );

    // Background parsing
    setImmediate(async () => {
      try {
        const parsed = await this.parseCv(file.buffer, options);
        await this.cvStorage.updateParsedData(cv.id, parsed);
      } catch (err) {
        this.logger.error(
          `❌ Background parsing failed for CV ${cv.id}: ${err.message}`,
        );
        await this.cvStorage.updateStatus(cv.id, 'failed');
      }
    });

    return { candidateId: candidate.id, cvId: cv.id };
  }

  async getParseStatus(cvId: string) {
    return this.cvStorage.getParseStatus(cvId);
  }

  async parseCv(
    pdfBuffer: Buffer,
    options: UploadOptions = {},
  ): Promise<ParsedCvDto> {
    this.logger.log('════════════════════════════════════════');
    this.logger.log(` CV PARSING PIPELINE [AI API]`);
    this.logger.log('════════════════════════════════════════');
    this.logger.log(' STEP 1 — PDF Text Extraction...');
    const rawText = await this.pdfExtractor.extractText(pdfBuffer);
    this.logger.log(` STEP 1 DONE — ${rawText.length} characters`);
    this.logger.log(' STEP 1b — Regex Extraction...');
    const regexData = this.regexExtractor.extract(rawText);
    if (!options.apiKey) {
      this.logger.error(' Missing AI API Key — cannot proceed with parsing');
      throw new Error('AI API Key is required for CV parsing.');
    }

    this.logger.log(' STEP 2 — AI CV Parsing...');
    const aiResult = await this.aiCvParser.parse(rawText, {
      apiKey: options.apiKey,
    });
    const email = regexData.email ?? null;
    const phone = regexData.phone ?? null;
    const linkedinUrl = regexData.linkedin_url ?? null;
    this.logger.log(' STEP 4 — SFIA Inference for Career Entries...');
    await Promise.allSettled(
      aiResult.experience.map(async (entry) => {
        if (entry.description) {
          try {
            entry['inferredTags'] = await this.aiCvParser.inferProficiencyLevels(
              entry.description,
              { apiKey: options.apiKey! },
            );
          } catch (e) {
            this.logger.warn(`Failed to infer tags for an experience entry: ${e.message}`);
            entry['inferredTags'] = [];
          }
        }
      }),
    );
    this.logger.log(' STEP 5 — Assembling result...');
    const result: ParsedCvDto = {
      firstName: aiResult.first_name,
      lastName: aiResult.last_name,
      email,
      phone,
      linkedinUrl,
      location: aiResult.location,
      currentTitle: aiResult.current_title,
      skillsTechnical: aiResult.skills_technical,
      skillsSoft: aiResult.skills_soft,
      languages: aiResult.languages,
      education: aiResult.education,
      experience: aiResult.experience as any[],
      yearsExperience: aiResult.years_experience,
      totalExperienceMonths: aiResult.total_experience_months,
      llmSummary: aiResult.llm_summary,
    };

    this.logger.log('════════════════════════════════════════');
    this.logger.log(' AI PIPELINE COMPLETE');
    this.logger.log('════════════════════════════════════════');

    return result;
  }
}
