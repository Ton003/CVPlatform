import { Injectable, Logger } from '@nestjs/common';
import { HttpService }        from '@nestjs/axios';
import { ConfigService }      from '@nestjs/config';
import { firstValueFrom }     from 'rxjs';

export interface RerankCandidate {
  candidateId: string;
  name:        string;
  profileText: string;
}

export interface RerankResult {
  candidateId: string;
  name:        string;
  score:       number;
}

@Injectable()
export class PdfExtractorService {
  private readonly logger = new Logger(PdfExtractorService.name);
  private readonly pythonUrl: string; // ✅ from env, not hardcoded

  constructor(
    private readonly httpService:    HttpService,
    private readonly configService:  ConfigService,
  ) {
    this.pythonUrl = this.configService.getOrThrow<string>('PYTHON_SERVICE_URL');
  }

  async extractText(pdfBuffer: Buffer): Promise<string> {
    const base64Pdf = pdfBuffer.toString('base64');

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.pythonUrl}/extract`,
          { pdf_base64: base64Pdf },
          { timeout: 30_000 },
        ),
      );
      const text: string = response.data.text ?? '';
      this.logger.log(`✅ PDF extracted — ${text.length} characters`);
      return text;
    } catch (err) {
      this.logger.error(`❌ PDF extraction failed: ${err.message}`);
      throw new Error(`PDF extraction failed: ${err.message}`);
    }
  }

  async embedText(text: string): Promise<number[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.pythonUrl}/embed`,
          { text },
          { timeout: 15_000 },
        ),
      );
      const embedding: number[] = response.data.embedding ?? [];
      this.logger.log(`✅ Embedding generated — ${embedding.length} dimensions`);
      return embedding;
    } catch (err) {
      this.logger.warn(`⚠️ Embedding failed: ${err.message} — skipping vector`);
      return [];
    }
  }

  async rerankCandidates(
    query:      string,
    candidates: RerankCandidate[],
  ): Promise<RerankResult[]> {
    if (!candidates.length) return [];

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.pythonUrl}/rerank`,
          { query, candidates },
          { timeout: 15_000 },
        ),
      );

      const results: RerankResult[] = response.data.results ?? [];
      this.logger.log(
        `✅ Reranked ${results.length} candidates — ` +
        `top: ${results[0]?.name} (${results[0]?.score?.toFixed(2)})`
      );
      return results;

    } catch (err) {
      this.logger.warn(`⚠️ Reranking failed: ${err.message} — returning original order`);
      return candidates.map(c => ({ candidateId: c.candidateId, name: c.name, score: 0 }));
    }
  }

  static buildProfileText(candidate: any): string {
    const parts: string[] = [];

    if (candidate.currentTitle)       parts.push(candidate.currentTitle);
    if (candidate.skills?.length)     parts.push(`Skills: ${candidate.skills.slice(0, 15).join(', ')}`);
    if (candidate.summary)            parts.push(candidate.summary.substring(0, 200));
    if (candidate.education?.length) {
      const edu = candidate.education
        .slice(0, 2)
        .map((e: any) => [e.degree, e.institution].filter(Boolean).join(' at '))
        .join(', ');
      if (edu) parts.push(`Education: ${edu}`);
    }
    if (candidate.experience?.length) {
      const exp = candidate.experience
        .slice(0, 3)
        .map((e: any) => e.title + (e.company ? ` at ${e.company}` : ''))
        .join(', ');
      if (exp) parts.push(`Experience: ${exp}`);
    }
    if (candidate.languages?.length) {
      parts.push(`Languages: ${candidate.languages.map((l: any) => l.name).join(', ')}`);
    }

    return parts.join('. ');
  }
}