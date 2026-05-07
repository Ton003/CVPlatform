import { Injectable, Logger } from '@nestjs/common';
import { KeywordExtractorService, ExtractedFilters } from './keyword-extractor.service';
import { CvSearchService, FullCandidate } from './cv-search.service';
import { PdfExtractorService } from '../cv-upload/pdf-extractor.service';
import { GroqService } from './groq.service';
import { RecommendDto } from './dto/recommend.dto';
import { RecommendationResultDto, CandidateMatchDto } from './dto/recommendation-result.dto';

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);

  constructor(
    private readonly keywordExtractor: KeywordExtractorService,
    private readonly cvSearch: CvSearchService,
    private readonly pdfExtractor: PdfExtractorService,
    private readonly groqService: GroqService,
  ) {}

  /**
   * ✅ Main recommendation entry point - routes between Groq RAG and local pipelines
   */
  async recommend(
    dto: RecommendDto, 
    scopedCandidateIds?: string[], 
    scopedDepartmentId?: string
  ): Promise<RecommendationResultDto> {
    const mode = dto.mode ?? 'local';
    const history = dto.history ?? [];
    const lastCandidates = dto.lastCandidates ?? [];

    this.logger.log(`💬 [Chatbot] "${dto.message.substring(0, 80)}" | Mode: ${mode}`);

    // Groq AI Pipeline
    if (mode === 'groq' && dto.apiKey) {
      // 1. Intent Analysis
      if (history.length > 0) {
        const intent = await this.groqService.classifyIntent(dto.message, history, lastCandidates, dto.apiKey);
        if (intent.isFollowUp && !intent.searchAgain) {
          const reply = await this.groqService.generateConversationalReply(dto.message, history, lastCandidates, dto.apiKey);
          return { message: reply, total: 0, candidates: [], mode: 'groq' };
        }
      }

      // 2. Retrieval & Scoring
      return this.runGroqPipeline(dto, scopedCandidateIds, scopedDepartmentId);
    }

    // Fallback to local logic (placeholder for simplified response)
    return { message: 'Local mode is currently in maintenance.', total: 0, candidates: [], mode: 'local' };
  }

  private async runGroqPipeline(
    dto: RecommendDto,
    scopedCandidateIds?: string[],
    scopedDepartmentId?: string
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
      scopedDepartmentId
    );
    
    if (!recalled.length) {
      return { message: 'No candidates found matching your criteria.', total: 0, candidates: [], mode: 'groq' };
    }

    // 2. Enrichment & Narrative Generation
    const enriched: FullCandidate[] = await Promise.all(
      recalled.slice(0, 10).map(c => this.cvSearch.findFullCandidate(c.candidateId).catch(() => c as FullCandidate))
    );

    const reranked = await this.groqService.rerank(dto.message, enriched, dto.apiKey!, dto.history || [], []);

    const candidates: CandidateMatchDto[] = enriched.map(c => ({
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