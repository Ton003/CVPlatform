import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ExtractionResult } from './llm-extraction.service';
import { UploadOptions } from './cv-upload.service';

const LOCAL_URL  = 'http://localhost:8001/v1/chat/completions';
const GROQ_URL   = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const LLM_MODEL  = 'phi-3';
const LLM_TIMEOUT = 90_000;

@Injectable()
export class LlmParserService {
  private readonly logger = new Logger(LlmParserService.name);

  constructor(private readonly httpService: HttpService) {}

  async structure(
    normalizedText: string,
    spacyResult:    ExtractionResult,
    options:        UploadOptions = {},
  ): Promise<LlmResult> {
    const mode   = options.mode ?? 'local';
    const prompt = this.buildPrompt(normalizedText, spacyResult);

    this.logger.log(`✍️  Summary generation via [${mode.toUpperCase()}]...`);

    try {
      const raw = mode === 'groq' && options.apiKey
        ? await this.callGroq(prompt, options.apiKey)
        : await this.callLocal(prompt);

      return this.parseResponse(raw, spacyResult);

    } catch (err) {
      this.logger.warn(`LLM parser failed: ${err.message} — using fallback`);
      return this.fallback();
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
          temperature: 0.1,
          max_tokens:  600,
        },
        { timeout: LLM_TIMEOUT },
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
          temperature: 0.1,
          max_tokens:  600,
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

  private buildPrompt(text: string, spacy: ExtractionResult): string {
    const excerpt = this.truncateAtSentence(text, 900);
    const name    = [spacy.first_name, spacy.last_name].filter(Boolean).join(' ') || 'The candidate';
    const title   = spacy.current_title ? ` (${spacy.current_title})` : '';

    return `You are a professional CV analyst. Return ONLY a JSON object. No markdown, no explanation, no notes.

CANDIDATE: ${name}${title}

CV EXCERPT:
${excerpt}

Extract exactly these 2 fields:

1. summary: A 2-sentence professional summary written in your own words.
   - Highlight: leadership roles, sales performance, creative skills + tools, and academic background.
   - DO NOT copy or paraphrase sentences directly from the CV text.
   - DO NOT start with "Skilled in..." or "I am..." or any phrase lifted from the CV.
   - Describe what this person does professionally and what makes them stand out.
   - Write in third person (e.g. "Mohamed is a...").

2. skills_soft: Max 5 soft skills.
   - Prioritize explicit soft skill keywords found in the CV before inferred ones.
   - Detect leadership and organizational roles as strong signals for skills.
   - Each skill must be 1-3 words maximum.

Return exactly this JSON, nothing else:
{
  "summary": "",
  "skills_soft": []
}`;
  }

  private truncateAtSentence(text: string, maxChars: number): string {
    if (text.length <= maxChars) return text;
    const slice     = text.substring(0, maxChars);
    const lastPunct = Math.max(
      slice.lastIndexOf('. '),
      slice.lastIndexOf('.\n'),
      slice.lastIndexOf('! '),
      slice.lastIndexOf('? '),
    );
    return lastPunct > maxChars * 0.5
      ? slice.substring(0, lastPunct + 1)
      : slice;
  }

  // ── Response parsing ──────────────────────────────────────────────────────

  private parseResponse(raw: string, spacy: ExtractionResult): LlmResult {
    try {
      const cleaned = raw
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/gi, '')
        .replace(/\(Note:.*?\)/gis, '')
        .replace(/^[^{]*/s, '')
        .trim();

      const jsonStart = cleaned.indexOf('{');
      const jsonEnd   = cleaned.lastIndexOf('}');
      if (jsonStart === -1 || jsonEnd === -1) throw new Error('No JSON found');

      const parsed = JSON.parse(cleaned.substring(jsonStart, jsonEnd + 1));

      const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';

      const rawSkills: string[] = Array.isArray(parsed.skills_soft)
        ? parsed.skills_soft.filter((s: any) => typeof s === 'string')
        : [];

      const seen       = new Set<string>();
      const skills_soft: string[] = [];
      for (const skill of rawSkills) {
        const clean = skill.trim();
        const key   = clean.toLowerCase();
        if (!clean || clean.split(' ').length > 3 || clean.length < 2) continue;
        if (seen.has(key)) continue;
        seen.add(key);
        skills_soft.push(clean);
        if (skills_soft.length >= 5) break;
      }

      return { summary, skills_soft };

    } catch (err) {
      this.logger.warn(`Failed to parse LLM response: ${err.message}`);
      return this.fallback();
    }
  }

  private fallback(): LlmResult {
    return { summary: '', skills_soft: [] };
  }
}

export interface LlmResult {
  summary:     string;
  skills_soft: string[];
}