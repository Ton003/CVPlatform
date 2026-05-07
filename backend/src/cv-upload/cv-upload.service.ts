import { Injectable, Logger }       from '@nestjs/common';
import { Candidate } from '../candidates/entities/candidates.entity';
import { PdfExtractorService }      from './pdf-extractor.service';
import { GroqCvParserService }      from './groq-cv-parser.service';
import { CvStorageService }         from './cv-storage.service';
import { RegexExtractorService }    from './regex-extractor.service';
import { ParsedCvDto }              from './dto/parsed-cv.dto';

// ── Local LLM services (untouched — used when mode = 'local') ────────────────
import { LlmExtractionService }     from './llm-extraction.service';
import { LlmParserService }         from './llm-parser.service';

export interface UploadOptions {
  mode?:        'local' | 'groq';
  apiKey?:      string;
  gdprConsent?: boolean;
}

@Injectable()
export class CvUploadService {
  private readonly logger = new Logger(CvUploadService.name);

  constructor(
    private readonly pdfExtractor:    PdfExtractorService,
    private readonly groqCvParser:    GroqCvParserService,
    private readonly cvStorage:       CvStorageService,
    private readonly regexExtractor:  RegexExtractorService,
    private readonly llmExtraction:   LlmExtractionService,
    private readonly llmParser:       LlmParserService,
  ) {}

  async processUpload(
    file:         Express.Multer.File,
    uploadedById: string,
    options:      UploadOptions = {},
  ): Promise<any> {
    const parsed = await this.parseCv(file.buffer, options);
    return this.cvStorage.store(file, parsed, uploadedById, options.gdprConsent ?? false);
  }

  async processUploadAsync(
    file:          Express.Multer.File,
    candidateData: Partial<Candidate>,
    uploadedById:  string,
    options:       UploadOptions = {},
  ): Promise<any> {
    const { candidate, cv } = await this.cvStorage.storeInitial(file, candidateData, uploadedById);
    
    // Background parsing
    setImmediate(async () => {
      try {
        const parsed = await this.parseCv(file.buffer, options);
        await this.cvStorage.updateParsedData(cv.id, parsed);
      } catch (err) {
        this.logger.error(`❌ Background parsing failed for CV ${cv.id}: ${err.message}`);
        await this.cvStorage.updateStatus(cv.id, 'failed');
      }
    });

    return { candidateId: candidate.id, cvId: cv.id };
  }

  async getParseStatus(cvId: string) {
    return this.cvStorage.getParseStatus(cvId);
  }

  async parseCv(pdfBuffer: Buffer, options: UploadOptions = {}): Promise<ParsedCvDto> {
    const mode = options.mode ?? 'local';

    this.logger.log('════════════════════════════════════════');
    this.logger.log(`   CV PARSING PIPELINE [${mode.toUpperCase()}]`);
    this.logger.log('════════════════════════════════════════');

    // ── Step 1: PDF Text Extraction (shared by both modes) ────────────────
    this.logger.log('📄 STEP 1 — PDF Text Extraction...');
    const rawText = await this.pdfExtractor.extractText(pdfBuffer);
    this.logger.log(`✅ STEP 1 DONE — ${rawText.length} characters`);
    this.logger.log(`   First 300 chars:\n---\n${rawText.substring(0, 300)}\n---`);

    if (!rawText || rawText.length < 50) {
      this.logger.warn('⚠️  Very short text — PDF may be scanned/image-based');
    }

    // ── Step 1b: Regex Extraction (always runs — overrides LLM for contact) 
    this.logger.log('🔍 STEP 1b — Regex Extraction...');
    const regexData = this.regexExtractor.extract(rawText);

    // ── Route to correct pipeline ─────────────────────────────────────────
    return mode === 'groq' && options.apiKey
      ? this.runGroqPipeline(rawText, regexData, options)
      : this.runLocalPipeline(rawText, regexData, options);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GROQ PIPELINE — single LLM call, returns everything
  // ══════════════════════════════════════════════════════════════════════════

  private async runGroqPipeline(
    rawText:   string,
    regexData: any,
    options:   UploadOptions,
  ): Promise<ParsedCvDto> {

    // ── Step 2: Single Groq call — extracts + summarizes in one shot ──────
    this.logger.log('🤖 STEP 2 — Groq CV Parsing (single call)...');
    const groqResult = await this.groqCvParser.parse(rawText, { apiKey: options.apiKey! });

    // ── Step 3: Regex always wins for email/phone/linkedin ────────────────
    // Regex is more reliable than LLM for contact info patterns
    const email        = regexData.email        ?? null;
    const phone        = regexData.phone        ?? null;
    const linkedinUrl = regexData.linkedin_url ?? null;

    // ── Step 4: Skill Normalization ───────────────────────────────────────
    const skillsTechnical = groqResult.skills_technical;

    // ── Step 5: SFIA Inference for Career Entries (Parallelized) ─────────
    this.logger.log('🧠 STEP 5 — SFIA Inference for Career Entries...');
    await Promise.all(groqResult.experience.map(async (entry) => {
      if (entry.description) {
        entry['inferredTags'] = await this.groqCvParser.inferProficiencyLevels(
          entry.description, 
          { apiKey: options.apiKey! }
        );
      }
    }));

    // ── Step 6: Assemble ParsedCvDto ──────────────────────────────────────
    this.logger.log('📦 STEP 6 — Assembling result...');
    const result: ParsedCvDto = {
      firstName:               groqResult.first_name,
      lastName:                groqResult.last_name,
      email,
      phone,
      linkedinUrl,
      location:                groqResult.location,
      currentTitle:            groqResult.current_title,
      skillsTechnical,
      skillsSoft:              groqResult.skills_soft,
      languages:               groqResult.languages,
      education:               groqResult.education,
      experience:              groqResult.experience as any[],
      yearsExperience:         groqResult.years_experience,
      totalExperienceMonths:   groqResult.total_experience_months,
      llmSummary:              groqResult.llm_summary,
    };


    this.logger.log('════════════════════════════════════════');
    this.logger.log('   GROQ PIPELINE COMPLETE');
    this.logger.log('════════════════════════════════════════');
    this.logger.log(JSON.stringify(result, null, 2));

    return result;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LOCAL PIPELINE — original 2-call flow, untouched
  // ══════════════════════════════════════════════════════════════════════════

  private async runLocalPipeline(
    rawText:   string,
    regexData: any,
    options:   UploadOptions,
  ): Promise<ParsedCvDto> {

    // ── Step 2: LLM Structured Extraction ────────────────────────────────
    this.logger.log('🤖 STEP 2 — Local LLM Extraction...');
    const extracted = await this.llmExtraction.extract(rawText, options);

    // Regex always wins for contact info
    extracted.email        = regexData.email        ?? extracted.email;
    extracted.phone        = regexData.phone        ?? extracted.phone;
    extracted.linkedinUrl  = regexData.linkedin_url ?? extracted.linkedinUrl;

    // Title case name fix
    if (extracted.firstName) {
      extracted.firstName = extracted.firstName
        .split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }
    if (extracted.lastName) {
      extracted.lastName = extracted.lastName
        .split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }

    this.logger.log(`✅ STEP 2 DONE`);
    this.logger.log(`   Name    : ${extracted.firstName ?? '?'} ${extracted.lastName ?? ''}`);
    this.logger.log(`   Skills  : ${extracted.skillsTechnical.length} found`);

    // ── Step 3: Skill Normalization ───────────────────────────────────────
    const skillsTechnical = extracted.skillsTechnical;

    // ── Step 4: LLM Summary + Soft Skills ────────────────────────────────
    this.logger.log('✍️  STEP 4 — Local LLM Summary...');
    const llmResult = await this.llmParser.structure(rawText, {
      ...extracted,
      skillsTechnical,
      normalizedText: rawText,
    }, options);

    // ── Step 5: Assemble ──────────────────────────────────────────────────
    const result: ParsedCvDto = {
      firstName:               extracted.firstName,
      lastName:                extracted.lastName,
      email:                   extracted.email,
      phone:                   extracted.phone,
      linkedinUrl:             extracted.linkedinUrl,
      location:                extracted.location,
      currentTitle:            extracted.currentTitle,
      skillsTechnical,
      skillsSoft:              llmResult.skillsSoft,
      languages:               extracted.languages,
      education:               extracted.education,
      experience:              extracted.experience as any[],
      yearsExperience:         extracted.yearsExperience,
      totalExperienceMonths:   extracted.totalExperienceMonths,
      llmSummary:              llmResult.summary,
    };

    this.logger.log('════════════════════════════════════════');
    this.logger.log('   LOCAL PIPELINE COMPLETE');
    this.logger.log('════════════════════════════════════════');

    return result;
  }
}