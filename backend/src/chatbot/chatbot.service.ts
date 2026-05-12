import { Injectable, Logger } from '@nestjs/common';
import { KeywordExtractorService } from './keyword-extractor.service';
import { CvSearchService, FullCandidate } from './cv-search.service';
import { PdfExtractorService } from '../cv-upload/pdf-extractor.service';
import { AiService } from './ai.service';
import { RecommendDto } from './dto/recommend.dto';
import {
  RecommendationResultDto,
  CandidateMatchDto,
} from './dto/recommendation-result.dto';

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);

  constructor(
    private readonly keywordExtractor: KeywordExtractorService,
    private readonly cvSearch: CvSearchService,
    private readonly pdfExtractor: PdfExtractorService,
    private readonly aiService: AiService,
  ) {}

  /**
   * ✅ Main recommendation entry point - routes between Groq RAG and local pipelines
   */
  async recommend(
    dto: RecommendDto,
    scopedCandidateIds?: string[],
    scopedDepartmentId?: string,
  ): Promise<RecommendationResultDto> {
    this.logger.log(`💬 [Search] "${dto.message.substring(0, 80)}"`);

    // AI Search Pipeline
    if (dto.apiKey) {
      return this.runAiPipeline(dto, scopedCandidateIds, scopedDepartmentId);
    }
    return {
      message: 'Please provide an AI API Key to enable search functionality.',
      total: 0,
      candidates: [],
      mode: 'groq',
    };
  }

  private async runAiPipeline(
    dto: RecommendDto,
    scopedCandidateIds?: string[],
    scopedDepartmentId?: string,
  ): Promise<RecommendationResultDto> {
    const t0 = Date.now();

    // 1. Embedding & Search
    const queryEmbedding = await this.pdfExtractor.embedText(dto.message);
    const filters = this.keywordExtractor.extract(dto.message);

    const recalled = await this.cvSearch.findByEmbedding(
      queryEmbedding,
      dto.limit || 20,
      dto.personType,
      scopedCandidateIds,
      scopedDepartmentId,
    );

    if (!recalled.length) {
      return {
        message: 'No candidates found matching your criteria.',
        total: 0,
        candidates: [],
        mode: 'groq',
      };
    }

    // 2. Enrichment & Narrative Generation
    const enriched: FullCandidate[] = await Promise.all(
      recalled.slice(0, 10).map(async (c) => {
        try {
          const full = await this.cvSearch.findFullCandidate(c.candidateId);
          return { ...full, similarity: c.similarity }; // Preserve similarity score
        } catch (err) {
          return c as FullCandidate;
        }
      }),
    );

    const reranked = await this.aiService.rerank(
      dto.message,
      enriched,
      dto.apiKey!,
      dto.history || [],
      [],
    );

    const candidates: CandidateMatchDto[] = enriched.map((c) => ({
      candidateId: c.candidateId,
      name: c.name,
      email: c.email,
      location: c.location,
      currentTitle: c.currentTitle,
      yearsExp: c.yearsExp,
      skills: c.skills,
      summary: c.summary,
      matchScore: Math.round((c.similarity || 0) * 100),
      matchedSkills: [], // Populated by frontend or scoring service
    }));

    this.logger.log(`✅ Pipeline completed in ${Date.now() - t0}ms`);

    return {
      message: reranked.answer,
      total: candidates.length,
      candidates,
      mode: 'groq',
    };
  }
}
