import { Injectable, Logger } from '@nestjs/common';
import { HttpService }        from '@nestjs/axios';
import { firstValueFrom }     from 'rxjs';

const GROQ_URL   = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

// ── Output types ──────────────────────────────────────────────────────────────

export interface ExperienceEntry {
  title:       string;
  company:     string | null;
  start_date:  string | null;
  end_date:    string | null;
  description: string | null;
}

export interface EducationEntry {
  degree:      string | null;
  institution: string | null;
  date:        string | null;
}

export interface LanguageEntry {
  name:  string;
  level: string;
}

export interface GroqParsedCv {
  // Personal info
  first_name:              string | null;
  last_name:               string | null;
  location:                string | null;
  current_title:           string | null;

  // Skills
  skills_technical:        string[];
  skills_soft:             string[];

  // Structured sections
  languages:               LanguageEntry[];
  education:               EducationEntry[];
  experience:              ExperienceEntry[];

  // Computed
  years_experience:        number | null;
  total_experience_months: number | null;

  // AI-generated
  llm_summary:             string;
}

export interface GroqParseOptions {
  apiKey: string;
}

// ── Validation limits ─────────────────────────────────────────────────────────
// Sanity-check values before saving to DB

const MAX_YEARS_EXPERIENCE  = 50;
const MAX_EXPERIENCE_ENTRIES = 10;
const MAX_EDUCATION_ENTRIES  = 6;
const MAX_SKILLS             = 30;
const MAX_SOFT_SKILLS        = 8;
const MAX_LANGUAGES          = 6;

@Injectable()
export class GroqCvParserService {
  private readonly logger = new Logger(GroqCvParserService.name);

  constructor(private readonly httpService: HttpService) {}

  // ── Main entry point ──────────────────────────────────────────────────────

  async parse(rawText: string, options: GroqParseOptions): Promise<GroqParsedCv> {
    this.logger.log(`🤖 Groq CV parsing — ${rawText.length} chars`);

    const prompt = this.buildPrompt(rawText);

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          GROQ_URL,
          {
            model:       GROQ_MODEL,
            messages:    [{ role: 'user', content: prompt }],
            temperature: 0.0,   // deterministic — we want structured data
            max_tokens:  2000,
          },
          {
            timeout: 30_000,
            headers: {
              Authorization:  `Bearer ${options.apiKey}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const raw = response.data?.choices?.[0]?.message?.content ?? '';
      this.logger.log(`✅ Groq responded — ${raw.length} chars`);

      return this.parseAndValidate(raw, rawText);

    } catch (err) {
      this.logger.error(`❌ Groq CV parsing failed: ${err.message}`);
      return this.emptyResult();
    }
  }

  /**
   * INFERENCE PIPELINE
   * Takes a job description and extracts SFIA competencies with inferred levels (1-5).
   */
  async inferProficiencyLevels(description: string, options: GroqParseOptions): Promise<any[]> {
    if (!description || description.length < 20) return [];

    const prompt = `Identify SFIA-compliant competencies mentioned in the following job description.
For each competency, infer a proficiency level from 1 to 5 based on the complexity described.

SFIA LEVELS:
1. Follow (basic)
2. Assist (some autonomy)
3. Apply (independent)
4. Enable (supervise/guide)
5. Ensure, advise (strategy/leadership)

TEXT:
${description}

Return ONLY a JSON array of objects:
[
  { "skill": "canonical name", "level": 1-5, "confidence": 0-1 }
]`;

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          GROQ_URL,
          {
            model:       GROQ_MODEL,
            messages:    [{ role: 'user', content: prompt }],
            temperature: 0.0,
            max_tokens:  500,
          },
          {
            timeout: 15_000,
            headers: {
              Authorization:  `Bearer ${options.apiKey}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const raw = response.data?.choices?.[0]?.message?.content ?? '[]';
      const start = raw.indexOf('[');
      const end   = raw.lastIndexOf(']');
      if (start === -1 || end === -1) return [];
      
      return JSON.parse(raw.substring(start, end + 1)).map(item => ({
        skill: item.skill,
        level: Math.min(5, Math.max(1, item.level || 1)),
        confidence: Math.min(1.0, Math.max(0.0, item.confidence || 0.5))
      }));

    } catch (err) {
      this.logger.warn(`Inference failed: ${err.message}`);
      return [];
    }
  }


  // ── Prompt ────────────────────────────────────────────────────────────────
  // Single prompt that extracts EVERYTHING in one call.
  // Key improvements over old version:
  //   - Full CV text (up to 5000 chars instead of 3000)
  //   - Implicit skill extraction ("developed REST APIs" → extract "REST API")
  //   - Experience titles not truncated
  //   - Summary written as a real recruiter would, not copied from CV
  //   - All sections in one JSON response

  private buildPrompt(rawText: string): string {
    // Use up to 5000 chars — covers most CVs fully
    const excerpt = rawText.length > 5000
      ? rawText.substring(0, 5000)
      : rawText;

    return `You are an expert CV parser for a recruitment platform. Extract ALL information from this CV and return ONE JSON object.

CV TEXT:
${excerpt}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXTRACTION RULES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NAMES:
- first_name / last_name: Title Case always. Never ALL CAPS.
- If name is "FERJENI Saif" → first_name="Saif", last_name="Ferjeni"
- If only one name found → put it in first_name, last_name=null

LOCATION:
- City name only, from the contact/header section
- Never a full address

CURRENT_TITLE:
- From profile header or most recent job title
- Max 6 words. Keep the full title — do NOT cut it short
- Examples: "Software Engineering Student", "Full Stack Developer", "DevOps Engineer"

SKILLS_TECHNICAL:
- Extract ALL technical skills from the ENTIRE CV — not just the skills section
- Include skills mentioned in experience descriptions too
  (e.g. "developed REST APIs with Spring Boot" → add "REST API" and "Spring Boot")
- Short canonical names: "Python" not "Python programming language"
- Max ${MAX_SKILLS} items, no duplicates
- Include: programming languages, frameworks, databases, tools, cloud, protocols, OS

SKILLS_SOFT:
- Max ${MAX_SOFT_SKILLS} soft skills
- Only include if explicitly mentioned OR strongly implied by a role
  (e.g. "team leader" → "Leadership", "taught workshops" → "Teaching")
- 1-3 words each

LANGUAGES:
- From the languages section only
- Level normalization:
  maternelle/natif/native/langue maternelle → "native"
  C1/C2/courant/fluent/bilingual → "fluent"
  B2/avancé/advanced → "advanced"
  B1/intermédiaire/intermediate → "intermediate"
  A1/A2/débutant/beginner/notions → "beginner"
  anything else → "intermediate"

EDUCATION:
- Max ${MAX_EDUCATION_ENTRIES} entries
- degree: full degree name (e.g. "Licence en Informatique", "Master en IA", "Ingénieur")
- institution: short name (e.g. "ESPRIT", "INSAT", "Université de Tunis")
- date: year range as written (e.g. "2020-2023", "2021", "En cours")

EXPERIENCE:
- Max ${MAX_EXPERIENCE_ENTRIES} entries
- title: FULL job title, not truncated (e.g. "Développeur Full Stack Junior", "Stage DevOps")
- company: company name or null if freelance/personal project
- start_date / end_date: as written in CV (e.g. "Jan 2023", "2022", "Présent", "Aujourd'hui")
- description: 2-3 sentences summarizing responsibilities and technical projects/tools used in this role.
- Skip purely academic projects — only real work, internships, freelance

YEARS_EXPERIENCE:
- Calculate from experience entries if possible
- For students with only internships: 0
- null if cannot determine

SUMMARY:
- Write a 2-sentence professional summary IN YOUR OWN WORDS
- Sentence 1: Who they are and their main technical domain
- Sentence 2: What makes them stand out — specific skills, achievements, or unique combination
- Write in third person ("Mohamed is a...", "Saif brings...")
- Be specific — mention actual skills from the CV, not generic phrases
- DO NOT start with "Skilled in", "Passionate about", "Dynamic professional"
- Example good summary: "Rassem is a Computer Science student specializing in NLP and machine learning with hands-on Python experience. He combines backend development with AI research, having built projects in natural language processing and PostgreSQL database management."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Return ONLY this JSON, no markdown, no explanation:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "first_name": null,
  "last_name": null,
  "location": null,
  "current_title": null,
  "skills_technical": [],
  "skills_soft": [],
  "languages": [
    { "name": "Arabic", "level": "native" }
  ],
  "education": [
    { "degree": null, "institution": null, "date": null }
  ],
  "experience": [
    { "title": null, "company": null, "start_date": null, "end_date": null, "description": null }
  ],
  "years_experience": null,
  "summary": ""
}`;
  }

  // ── Parse + validate response ─────────────────────────────────────────────

  private parseAndValidate(raw: string, originalText: string): GroqParsedCv {
    let parsed: any = null;

    // Step 1: clean and extract JSON
    try {
      const cleaned = raw
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/gi, '')
        .replace(/\/\/.*$/gm, '')   // remove JS-style comments Groq sometimes adds
        .trim();

      const start = cleaned.indexOf('{');
      const end   = cleaned.lastIndexOf('}');

      if (start === -1 || end === -1) throw new Error('No JSON object found');
      parsed = JSON.parse(cleaned.substring(start, end + 1));

    } catch (err) {
      this.logger.warn(`JSON parse failed: ${err.message} — trying robust extraction`);
      parsed = this.robustExtract(raw);
    }

    if (!parsed) {
      this.logger.error('All parsing attempts failed — returning empty result');
      return this.emptyResult();
    }

    // Step 2: validate and sanitize each field
    return this.sanitize(parsed, originalText);
  }

  // ── Sanitize / validate ───────────────────────────────────────────────────

  private sanitize(p: any, originalText: string): GroqParsedCv {

    // Names — Title Case, never null for both
    const firstName = this.cleanName(p.first_name);
    const lastName  = this.cleanName(p.last_name);

    // Skills — deduplicated, length-validated, max count enforced
    const skillsTechnical = this.cleanSkillArray(p.skills_technical, MAX_SKILLS);
    const skillsSoft      = this.cleanSkillArray(p.skills_soft,      MAX_SOFT_SKILLS);

    // Languages
    const languages = this.cleanLanguages(p.languages);

    // Education
    const education = this.cleanEducation(p.education);

    // Experience
    const experience = this.cleanExperience(p.experience);

    // Years experience — sanity check
    let yearsExp: number | null = null;
    if (typeof p.years_experience === 'number' && p.years_experience >= 0 && p.years_experience <= MAX_YEARS_EXPERIENCE) {
      yearsExp = Math.round(p.years_experience);
    }

    // Recalculate months from experience entries (more reliable than LLM estimate)
    const totalMonths = this.calculateMonths(experience);
    // If LLM gave us years but we couldn't calculate, trust LLM
    const finalYears = totalMonths !== null
      ? Math.floor(totalMonths / 12)
      : yearsExp;

    // Summary — must be non-empty string, max 500 chars
    const summary = typeof p.summary === 'string' && p.summary.trim().length > 20
      ? p.summary.trim().substring(0, 500)
      : '';

    // Current title — max 60 chars
    const currentTitle = typeof p.current_title === 'string' && p.current_title.trim()
      ? p.current_title.trim().substring(0, 60)
      : null;

    const result: GroqParsedCv = {
      first_name:              firstName,
      last_name:               lastName,
      location:                typeof p.location === 'string' ? p.location.trim().substring(0, 100) : null,
      current_title:           currentTitle,
      skills_technical:        skillsTechnical,
      skills_soft:             skillsSoft,
      languages,
      education,
      experience,
      years_experience:        finalYears,
      total_experience_months: totalMonths,
      llm_summary:             summary,
    };

    // Log what we got
    this.logger.log(`✅ Parsed & validated:`);
    this.logger.log(`   Name          : ${result.first_name ?? '?'} ${result.last_name ?? ''}`);
    this.logger.log(`   Title         : ${result.current_title ?? 'NOT FOUND'}`);
    this.logger.log(`   Location      : ${result.location ?? 'NOT FOUND'}`);
    this.logger.log(`   Skills        : ${result.skills_technical.length} → [${result.skills_technical.slice(0, 8).join(', ')}...]`);
    this.logger.log(`   Soft skills   : [${result.skills_soft.join(', ')}]`);
    this.logger.log(`   Languages     : ${result.languages.length}`);
    this.logger.log(`   Education     : ${result.education.length} entries`);
    this.logger.log(`   Experience    : ${result.experience.length} entries`);
    this.logger.log(`   Years exp     : ${result.years_experience ?? 'N/A'}`);
    this.logger.log(`   Summary       : ${result.llm_summary ? result.llm_summary.substring(0, 80) + '...' : 'EMPTY'}`);

    return result;
  }

  // ── Field cleaners ────────────────────────────────────────────────────────

  private cleanName(val: any): string | null {
    if (typeof val !== 'string' || !val.trim()) return null;
    return val.trim()
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  private cleanSkillArray(val: any, maxCount: number): string[] {
    if (!Array.isArray(val)) return [];
    const seen  = new Set<string>();
    const clean: string[] = [];

    for (const item of val) {
      if (typeof item !== 'string') continue;
      const trimmed = item.trim();
      if (!trimmed || trimmed.length < 1 || trimmed.length > 50) continue;
      if (trimmed.split(' ').length > 5) continue; // not a skill, too long
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      clean.push(trimmed);
      if (clean.length >= maxCount) break;
    }
    return clean;
  }

  private cleanLanguages(val: any): LanguageEntry[] {
    if (!Array.isArray(val)) return [];
    const validLevels = new Set(['native', 'fluent', 'advanced', 'intermediate', 'beginner']);

    return val
      .filter(l => l && typeof (l.name ?? l.language) === 'string')
      .slice(0, MAX_LANGUAGES)
      .map(l => {
        const name  = (l.name ?? l.language ?? '').trim();
        const raw   = (l.level ?? '').toLowerCase();
        const level = validLevels.has(raw) ? raw : 'intermediate';
        return { name, level };
      })
      .filter(l => l.name.length > 0);
  }

  private cleanEducation(val: any): EducationEntry[] {
    if (!Array.isArray(val)) return [];
    return val
      .filter(e => e && (e.degree || e.institution))
      .slice(0, MAX_EDUCATION_ENTRIES)
      .map(e => ({
        degree:      typeof e.degree      === 'string' ? e.degree.trim().substring(0, 100)      : null,
        institution: typeof e.institution === 'string' ? e.institution.trim().substring(0, 100) : null,
        date:        typeof e.date        === 'string' ? e.date.trim().substring(0, 30)         :
                     typeof e.date_range  === 'string' ? e.date_range.trim().substring(0, 30)   : null,
      }));
  }

  private cleanExperience(val: any): ExperienceEntry[] {
    if (!Array.isArray(val)) return [];
    return val
      .filter(e => e && e.title)
      .slice(0, MAX_EXPERIENCE_ENTRIES)
      .map(e => ({
        title:      typeof e.title      === 'string' ? e.title.trim().substring(0, 100)      : '',
        company:    typeof e.company    === 'string' ? e.company.trim().substring(0, 100)    : null,
        start_date: typeof e.start_date === 'string' ? e.start_date.trim().substring(0, 30)  : null,
        end_date:   typeof e.end_date   === 'string' ? e.end_date.trim().substring(0, 30)    : null,
        description: typeof e.description === 'string' ? e.description.trim().substring(0, 1000) : null,
      }))
      .filter(e => e.title.length > 0);
  }

  // ── Experience months calculator ──────────────────────────────────────────

  private calculateMonths(experience: ExperienceEntry[]): number | null {
    if (!experience.length) return null;
    let total = 0, counted = 0;

    for (const entry of experience) {
      const start = this.parseDate(entry.start_date);
      const end   = this.isPresent(entry.end_date)
        ? new Date()
        : this.parseDate(entry.end_date);

      if (!start || !end || end < start) continue;

      const months =
        (end.getFullYear() - start.getFullYear()) * 12 +
        (end.getMonth()    - start.getMonth());

      if (months > 0 && months < 600) { // sanity: max 50 years
        total += months;
        counted++;
      }
    }

    return counted > 0 ? total : null;
  }

  private isPresent(val: string | null): boolean {
    if (!val) return false;
    const lower = val.toLowerCase();
    return lower.includes('present') || lower.includes('aujourd') ||
           lower.includes('actuel')  || lower.includes('current') ||
           lower.includes('en cours');
  }

  private parseDate(raw: string | null): Date | null {
    if (!raw) return null;

    // Handle year only: "2023"
    if (/^\d{4}$/.test(raw.trim())) {
      return new Date(parseInt(raw), 0, 1);
    }

    // Handle "Month YYYY" in French or English
    const monthMap: Record<string, number> = {
      jan: 0, fév: 1, feb: 1, mar: 2, avr: 3, apr: 3,
      mai: 4, may: 4, jun: 5, jui: 5, jul: 6, aoû: 7,
      aug: 7, sep: 8, oct: 9, nov: 10, déc: 11, dec: 11,
    };

    const match = raw.toLowerCase().match(/([a-zéûô]+)[\s./-]+(\d{4})/);
    if (match) {
      const monthKey = match[1].substring(0, 3);
      const year     = parseInt(match[2]);
      const month    = monthMap[monthKey];
      if (month !== undefined && year > 1950 && year <= new Date().getFullYear() + 1) {
        return new Date(year, month, 1);
      }
    }

    // Fallback to native Date parser
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }

  // ── Robust fallback extractor ─────────────────────────────────────────────
  // Used when JSON.parse fails — tries to extract individual fields

  private robustExtract(raw: string): any {
    const extractString = (field: string): string | null => {
      const match = raw.match(new RegExp(`"${field}"\\s*:\\s*"([^"]*)"`, 'i'));
      return match ? match[1].trim() : null;
    };

    const extractArray = (field: string): any[] => {
      const fieldIdx = raw.indexOf(`"${field}"`);
      if (fieldIdx === -1) return [];
      const bracketStart = raw.indexOf('[', fieldIdx);
      if (bracketStart === -1) return [];

      let depth = 0, end = -1, inStr = false, escape = false;
      for (let i = bracketStart; i < raw.length; i++) {
        const ch = raw[i];
        if (escape)      { escape = false; continue; }
        if (ch === '\\') { escape = true;  continue; }
        if (ch === '"')  { inStr = !inStr; continue; }
        if (inStr)       continue;
        if (ch === '[' || ch === '{') depth++;
        if (ch === ']' || ch === '}') {
          depth--;
          if (depth === 0 && ch === ']') { end = i; break; }
        }
      }

      if (end === -1) return [];
      try { return JSON.parse(raw.substring(bracketStart, end + 1)); }
      catch { return []; }
    };

    return {
      first_name:       extractString('first_name'),
      last_name:        extractString('last_name'),
      location:         extractString('location'),
      current_title:    extractString('current_title'),
      summary:          extractString('summary'),
      years_experience: null,
      skills_technical: extractArray('skills_technical'),
      skills_soft:      extractArray('skills_soft'),
      languages:        extractArray('languages'),
      education:        extractArray('education'),
      experience:       extractArray('experience'),
    };
  }

  // ── Empty result fallback ─────────────────────────────────────────────────

  private emptyResult(): GroqParsedCv {
    return {
      first_name: null, last_name: null, location: null, current_title: null,
      skills_technical: [], skills_soft: [], languages: [],
      education: [], experience: [],
      years_experience: null, total_experience_months: null,
      llm_summary: '',
    };
  }
}