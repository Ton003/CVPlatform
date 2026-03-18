import { Injectable, Logger } from '@nestjs/common';
import { HttpService }        from '@nestjs/axios';
import { ConfigService }      from '@nestjs/config';
import { firstValueFrom }     from 'rxjs';
import { ExtractedFilters }   from './keyword-extractor.service';

export interface Phi3IntentResult {
  filters:    ExtractedFilters;
  isRelevant: boolean;
}

@Injectable()
export class Phi3IntentService {
  private readonly logger:   Logger = new Logger(Phi3IntentService.name);
  private readonly llmUrl:   string;
  private readonly llmModel: string;
  private readonly timeout   = 120_000;

  constructor(
    private readonly httpService:   HttpService,
    private readonly configService: ConfigService,
  ) {
    this.llmUrl   = this.configService.getOrThrow<string>('LOCAL_LLM_URL');
    this.llmModel = this.configService.get<string>('LOCAL_LLM_MODEL') ?? 'phi-3';
  }

  async parseIntent(query: string): Promise<Phi3IntentResult> {
    this.logger.log(`🧠 Phi-3 intent parsing...`);

    const prompt = `Extract job requirements. Return ONLY valid JSON, no explanation, no markdown.

Query: "${query}"

Return ONLY this exact JSON:
{"skills":[],"minYears":null,"location":null,"title":null,"degree":null,"institution":null,"language":null,"isRelevant":true}

Rules:
- skills: array of technical skill strings in English, empty array if none
- minYears: number or null
- location: city or country string or null
- title: job title string or null
- degree: one of "bachelor", "master", "engineer", "licence", "phd" or null
- institution: university/school name or null
- language: spoken language required e.g. "French", "English", "Arabic" or null
- isRelevant: false ONLY if query is completely unrelated to hiring (food, sports, nonsense words)`;

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          this.llmUrl,
          {
            model:       this.llmModel,
            messages:    [{ role: 'user', content: prompt }],
            temperature: 0.0,
            max_tokens:  200,
          },
          { timeout: this.timeout },
        ),
      );

      const raw    = response.data?.choices?.[0]?.message?.content ?? '';
      const result = this.parseRobustly(raw);
      this.logger.log(`✅ Phi-3 intent: skills=[${result.filters.skills.join(', ')}] relevant=${result.isRelevant}`);
      return result;

    } catch (err) {
      this.logger.warn(`Phi-3 intent parse failed: ${err.message}`);
      return this.emptyResult(true);
    }
  }

  private parseRobustly(raw: string): Phi3IntentResult {
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
        return this.buildResult(parsed);
      }
    } catch { /* fall through */ }

    try {
      return this.buildResult({
        skills:      this.extractArrayField(raw, 'skills'),
        minYears:    this.extractNumberField(raw, 'minYears'),
        location:    this.extractStringField(raw, 'location'),
        title:       this.extractStringField(raw, 'title'),
        degree:      this.extractStringField(raw, 'degree'),
        institution: this.extractStringField(raw, 'institution'),
        language:    this.extractStringField(raw, 'language'),
        isRelevant:  this.extractBooleanField(raw, 'isRelevant'),
      });
    } catch {
      return this.emptyResult(true);
    }
  }

  private buildResult(parsed: any): Phi3IntentResult {
    return {
      filters: {
        skills:      Array.isArray(parsed.skills) ? parsed.skills.filter((s: any) => typeof s === 'string') : [],
        minYears:    typeof parsed.minYears    === 'number' ? parsed.minYears    : null,
        location:    typeof parsed.location    === 'string' ? parsed.location    : null,
        title:       typeof parsed.title       === 'string' ? parsed.title       : null,
        degree:      typeof parsed.degree      === 'string' ? parsed.degree      : null,
        institution: typeof parsed.institution === 'string' ? parsed.institution : null,
        language:    typeof parsed.language    === 'string' ? parsed.language    : null,
        limit:       5,
      },
      isRelevant: parsed.isRelevant !== false,
    };
  }

  private extractStringField(raw: string, field: string): string | null {
    const match = raw.match(new RegExp(`"${field}"\\s*:\\s*"([^"]*)"`, 'i'));
    return match ? match[1].trim() : null;
  }

  private extractNumberField(raw: string, field: string): number | null {
    const match = raw.match(new RegExp(`"${field}"\\s*:\\s*(\\d+)`, 'i'));
    return match ? parseInt(match[1]) : null;
  }

  private extractBooleanField(raw: string, field: string): boolean {
    const match = raw.match(new RegExp(`"${field}"\\s*:\\s*(true|false)`, 'i'));
    return match ? match[1].toLowerCase() === 'true' : true;
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
      if (inStr)       continue;
      if (ch === '[' || ch === '{') depth++;
      if (ch === ']' || ch === '}') {
        depth--;
        if (depth === 0 && ch === ']') { end = i; break; }
      }
    }

    if (end === -1) return [];
    try {
      const parsed = JSON.parse(raw.substring(bracketStart, end + 1));
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  private emptyResult(isRelevant: boolean): Phi3IntentResult {
    return {
      filters: {
        skills: [], minYears: null, location: null, title: null,
        degree: null, institution: null, language: null, limit: 5,
      },
      isRelevant,
    };
  }
}