import { Injectable, Logger }       from '@nestjs/common';
import { PdfExtractorService }      from './pdf-extractor.service';
import { GroqCvParserService }      from './groq-cv-parser.service';
import { SkillNormalizerService }   from './skill-normalizer.service';
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
    private readonly groqCvParser:    GroqCvParserService,   // ← new single-call service
    private readonly skillNormalizer: SkillNormalizerService,
    private readonly cvStorage:       CvStorageService,
    private readonly regexExtractor:  RegexExtractorService,
    // Local LLM services kept but only used in local mode
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
    const linkedin_url = regexData.linkedin_url ?? null;

    // ── Step 4: Skill Normalization ───────────────────────────────────────
    this.logger.log('🔧 STEP 4 — Skill Normalization...');
    const skills_technical = this.skillNormalizer.normalize(groqResult.skills_technical);
    this.logger.log(`   Before: ${groqResult.skills_technical.length} → After: ${skills_technical.length}`);

    // ── Step 5: Assemble ParsedCvDto ──────────────────────────────────────
    this.logger.log('📦 STEP 5 — Assembling result...');
    const result: ParsedCvDto = {
      first_name:              groqResult.first_name,
      last_name:               groqResult.last_name,
      email,
      phone,
      linkedin_url,
      location:                groqResult.location,
      current_title:           groqResult.current_title,
      skills_technical,
      skills_soft:             groqResult.skills_soft,
      languages:               groqResult.languages,
      education:               groqResult.education,
      experience:              groqResult.experience,
      years_experience:        groqResult.years_experience,
      total_experience_months: groqResult.total_experience_months,
      llm_summary:             groqResult.llm_summary,
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
    extracted.linkedin_url = regexData.linkedin_url ?? extracted.linkedin_url;

    // Title case name fix
    if (extracted.first_name) {
      extracted.first_name = extracted.first_name
        .split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }
    if (extracted.last_name) {
      extracted.last_name = extracted.last_name
        .split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }

    this.logger.log(`✅ STEP 2 DONE`);
    this.logger.log(`   Name    : ${extracted.first_name ?? '?'} ${extracted.last_name ?? ''}`);
    this.logger.log(`   Skills  : ${extracted.skills_technical.length} found`);

    // ── Step 3: Skill Normalization ───────────────────────────────────────
    this.logger.log('🔧 STEP 3 — Skill Normalization...');
    const skills_technical = this.skillNormalizer.normalize(extracted.skills_technical);

    // ── Step 4: LLM Summary + Soft Skills ────────────────────────────────
    this.logger.log('✍️  STEP 4 — Local LLM Summary...');
    const llmResult = await this.llmParser.structure(rawText, {
      ...extracted,
      skills_technical,
      normalized_text: rawText,
    }, options);

    // ── Step 5: Assemble ──────────────────────────────────────────────────
    const result: ParsedCvDto = {
      first_name:              extracted.first_name,
      last_name:               extracted.last_name,
      email:                   extracted.email,
      phone:                   extracted.phone,
      linkedin_url:            extracted.linkedin_url,
      location:                extracted.location,
      current_title:           extracted.current_title,
      skills_technical,
      skills_soft:             llmResult.skills_soft,
      languages:               extracted.languages,
      education:               extracted.education,
      experience:              extracted.experience,
      years_experience:        extracted.years_experience,
      total_experience_months: extracted.total_experience_months,
      llm_summary:             llmResult.summary,
    };

    this.logger.log('════════════════════════════════════════');
    this.logger.log('   LOCAL PIPELINE COMPLETE');
    this.logger.log('════════════════════════════════════════');

    return result;
  }
}