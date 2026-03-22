import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

const LOCAL_URL  = 'http://localhost:8001/v1/chat/completions';
const GROQ_URL   = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const LLM_MODEL  = 'phi-3';
const TIMEOUT    = 180_000;

// ── Output types ─────────────────────────────────────────────────────────────

export interface ExperienceEntry {
  title:      string;
  company:    string | null;
  start_date: string | null;
  end_date:   string | null;
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

export interface ExtractionResult {
  first_name:               string | null;
  last_name:                string | null;
  email:                    string | null;
  phone:                    string | null;
  linkedin_url:             string | null;
  location:                 string | null;
  current_title:            string | null;
  skills_technical:         string[];
  languages:                LanguageEntry[];
  education:                EducationEntry[];
  experience:               ExperienceEntry[];
  years_experience:         number | null;
  total_experience_months:  number | null;
  job_titles:               string[];
  companies:                string[];
  degrees:                  string[];
  institutions:             string[];
  dates:                    string[];
  entities_raw:             Record<string, string[]>;
  normalized_text:          string;
}

export interface ExtractionOptions {
  mode?:   'local' | 'groq';
  apiKey?: string;
}

@Injectable()
export class LlmExtractionService {
  private readonly logger = new Logger(LlmExtractionService.name);

  constructor(private readonly httpService: HttpService) {}

  async extract(rawText: string, options: ExtractionOptions = {}): Promise<ExtractionResult> {
    const mode   = options.mode ?? 'local';
    const prompt = this.buildPrompt(rawText);

    this.logger.log(`🤖 Extracting via [${mode.toUpperCase()}]...`);

    try {
      const raw = mode === 'groq' && options.apiKey
        ? await this.callGroq(prompt, options.apiKey)
        : await this.callLocal(prompt);

      this.logger.log(`✅ LLM extraction done`);
      return this.parseResponse(raw, rawText);

    } catch (err) {
      this.logger.warn(`❌ LLM extraction failed: ${err.message} — returning empty result`);
      return this.emptyResult(rawText);
    }
  }

  // ── API callers ───────────────────────────────────────────────────────────

  private async callLocal(prompt: string): Promise<string> {
    const response = await firstValueFrom(
      this.httpService.post(
        LOCAL_URL,
        {
          model:       LLM_MODEL,
          messages:    [{ role: 'user', content: prompt }],
          temperature: 0.0,
          max_tokens:  1200,
        },
        { timeout: TIMEOUT },
      ),
    );
    return response.data?.choices?.[0]?.message?.content ?? '';
  }

  private async callGroq(prompt: string, apiKey: string): Promise<string> {
    const response = await firstValueFrom(
      this.httpService.post(
        GROQ_URL,
        {
          model:       GROQ_MODEL,
          messages:    [{ role: 'user', content: prompt }],
          temperature: 0.0,
          max_tokens:  1500,
        },
        {
          timeout: 30_000,
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type':  'application/json',
          },
        },
      ),
    );
    return response.data?.choices?.[0]?.message?.content ?? '';
  }

  // ── Prompt ────────────────────────────────────────────────────────────────

  private buildPrompt(text: string): string {
    const excerpt = text.length > 3000 ? text.substring(0, 3000) : text;

    return `Extract CV data. Return ONLY valid JSON, no markdown, no explanation.

CV:
${excerpt}

Return ONLY this JSON:
{
  "first_name": null,
  "last_name": null,
  "location": null,
  "current_title": null,
  "skills_technical": [],
  "languages": [],
  "education": [],
  "experience": []
}

Rules:
- first_name/last_name: given name and family name. Title Case always, never ALL CAPS. If name is ALL CAPS like "FERJENI Saif" then first_name="Saif" last_name="Ferjeni"
- location: city only, from contact section
- current_title: from profile or header section, max 10 words
- skills_technical: ALL programming languages and tools mentioned anywhere in CV. Max 20 items. Short names only: "Python" not "Python programming language"
- languages: from LANGUES section only. Use field name "name" not "language". Level mapping: maternelle/natif=native, C1/C2=fluent, B2=advanced, B1=intermediate, A1/A2=beginner
- education: degree + institution short name + date range. Max 3 entries. Use field name "date" not "date_range"
- experience: title max 4 words (job title only, never description sentences) + company (null if freelance) + start_date + end_date as written in CV
- CRITICAL: use EXACTLY these field names — no variations, no comments inside JSON
- null for missing fields, [] for missing arrays`;
  }

  // ── Response parser ───────────────────────────────────────────────────────

  private parseResponse(raw: string, rawText: string): ExtractionResult {
    this.logger.log(`🔍 RAW RESPONSE LENGTH: ${raw.length} chars`);
    this.logger.log(`🔍 RAW RESPONSE:\n${raw}`);

    try {
      const cleaned = raw
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/gi, '')
        .replace(/\/\/.*$/gm, '')
        .trim();

      const start = cleaned.indexOf('{');
      const end   = cleaned.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        const parsed = JSON.parse(cleaned.substring(start, end + 1));
        return this.buildResult(parsed, rawText);
      }
    } catch (err) {
      this.logger.warn(`Normal parse failed: ${err.message} — trying robust extraction`);
    }

    try {
      const parsed = this.extractFieldsRobustly(raw);
      this.logger.log(`✅ Robust field extraction succeeded`);
      return this.buildResult(parsed, rawText);
    } catch (err) {
      this.logger.warn(`Robust extraction failed: ${err.message}`);
      return this.emptyResult(rawText);
    }
  }

  private extractFieldsRobustly(raw: string): any {
    return {
      first_name:       this.extractStringField(raw, 'first_name'),
      last_name:        this.extractStringField(raw, 'last_name'),
      location:         this.extractStringField(raw, 'location'),
      current_title:    this.extractStringField(raw, 'current_title'),
      skills_technical: this.extractArrayField(raw, 'skills_technical'),
      languages:        this.extractArrayField(raw, 'languages'),
      education:        this.extractArrayField(raw, 'education'),
      experience:       this.extractArrayField(raw, 'experience'),
    };
  }

  private extractStringField(raw: string, field: string): string | null {
    const match = raw.match(new RegExp(`"${field}"\\s*:\\s*"([^"]*)"`, 'i'));
    return match ? match[1].trim() : null;
  }

  private extractArrayField(raw: string, field: string): any[] {
    const fieldIndex = raw.indexOf(`"${field}"`);
    if (fieldIndex === -1) return [];

    const bracketStart = raw.indexOf('[', fieldIndex);
    if (bracketStart === -1) return [];

    let depth = 0, end = -1, inStr = false, escape = false;

    for (let i = bracketStart; i < raw.length; i++) {
      const ch = raw[i];
      if (escape)      { escape = false; continue; }
      if (ch === '\\') { escape = true;  continue; }
      if (ch === '"')  { inStr = !inStr; continue; }
      if (inStr)       { continue; }
      if (ch === '[' || ch === '{') depth++;
      if (ch === ']' || ch === '}') {
        depth--;
        if (depth === 0 && ch === ']') { end = i; break; }
      }
    }

    if (end === -1) {
      const partial = raw.substring(bracketStart) + ']}';
      try {
        const attempt = JSON.parse('{"arr":' + partial);
        return Array.isArray(attempt.arr) ? attempt.arr : [];
      } catch { return []; }
    }

    try {
      const parsed = JSON.parse(raw.substring(bracketStart, end + 1));
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  private buildResult(parsed: any, rawText: string): ExtractionResult {
    const experience = this.parseExperience(parsed.experience);
    const education  = this.parseEducation(parsed.education);

    const result: ExtractionResult = {
      first_name:              this.str(parsed.first_name),
      last_name:               this.str(parsed.last_name),
      email:                   this.str(parsed.email),
      phone:                   this.str(parsed.phone),
      linkedin_url:            this.str(parsed.linkedin_url),
      location:                this.str(parsed.location),
      current_title:           this.str(parsed.current_title),
      skills_technical:        this.strArray(parsed.skills_technical),
      languages:               this.parseLanguages(parsed.languages),
      education,
      experience,
      years_experience:        null,
      total_experience_months: null,
      job_titles:              experience.map(e => e.title),
      companies:               experience.map(e => e.company).filter(Boolean) as string[],
      degrees:                 education.map(e => e.degree).filter(Boolean) as string[],
      institutions:            education.map(e => e.institution).filter(Boolean) as string[],
      dates:                   education.map(e => e.date).filter(Boolean) as string[],
      entities_raw:            {},
      normalized_text:         rawText,
    };

    const months = this.calculateExperienceMonths(result.experience);
    result.total_experience_months = months;
    result.years_experience        = months !== null ? Math.floor(months / 12) : null;

    return result;
  }

  private calculateExperienceMonths(experience: ExperienceEntry[]): number | null {
    if (!experience.length) return null;
    let totalMonths = 0, counted = 0;

    for (const entry of experience) {
      const start = this.parseDate(entry.start_date);
      const end   = entry.end_date?.toLowerCase().includes('present') ||
                    entry.end_date?.toLowerCase().includes('aujourd')
        ? new Date()
        : this.parseDate(entry.end_date);

      if (!start || !end) continue;
      const months = (end.getFullYear() - start.getFullYear()) * 12 +
                     (end.getMonth()    - start.getMonth());
      if (months > 0) { totalMonths += months; counted++; }
    }

    return counted > 0 ? totalMonths : null;
  }

  private parseDate(raw: string | null): Date | null {
    if (!raw) return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }

  private str(val: any): string | null {
    if (typeof val === 'string' && val.trim()) return val.trim();
    return null;
  }

  private strArray(val: any): string[] {
    if (!Array.isArray(val)) return [];
    return val
      .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      .map(s => s.trim());
  }

  private parseLanguages(val: any): LanguageEntry[] {
    if (!Array.isArray(val)) return [];
    const normalizeLevel = (level: string | null): string => {
      if (!level) return 'unknown';
      const l = level.toLowerCase();
      if (l.includes('natif') || l.includes('maternelle') || l.includes('native')) return 'native';
      if (l.includes('c1')    || l.includes('c2')         || l.includes('fluent')) return 'fluent';
      if (l.includes('b2')    || l.includes('advanced'))                           return 'advanced';
      if (l.includes('b1')    || l.includes('intermediate'))                       return 'intermediate';
      if (l.includes('a1')    || l.includes('a2') || l.includes('beginner'))       return 'beginner';
      const valid = new Set(['native','fluent','advanced','intermediate','beginner','unknown']);
      return valid.has(l) ? l : 'unknown';
    };
    return val
      .filter(l => l && (typeof l.name === 'string' || typeof l.language === 'string'))
      .map(l => ({ name: (l.name ?? l.language ?? '').trim(), level: normalizeLevel(l.level) }))
      .filter(l => l.name.length > 0);
  }

  private parseEducation(val: any): EducationEntry[] {
    if (!Array.isArray(val)) return [];
    return val
      .filter(e => e && (e.degree || e.institution) && !e.language && !e.name)
      .map(e => ({
        degree:      this.str(e.degree),
        institution: this.str(e.institution),
        date:        this.str(e.date ?? e.date_range),
      }));
  }

  private parseExperience(val: any): ExperienceEntry[] {
    if (!Array.isArray(val)) return [];
    return val
      .filter(e => e && e.title && !e.project)
      .map(e => ({
        title:      e.title.trim(),
        company:    this.str(e.company),
        start_date: this.str(e.start_date),
        end_date:   this.str(e.end_date),
      }));
  }

  private emptyResult(rawText = ''): ExtractionResult {
    return {
      first_name: null, last_name: null, email: null,
      phone: null, linkedin_url: null, location: null,
      current_title: null, skills_technical: [],
      languages: [], education: [], experience: [],
      years_experience: null, total_experience_months: null,
      job_titles: [], companies: [], degrees: [],
      institutions: [], dates: [], entities_raw: {},
      normalized_text: rawText,
    };
  }
}