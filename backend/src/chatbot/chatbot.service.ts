import { Injectable, Logger }      from '@nestjs/common';
import { KeywordExtractorService, ExtractedFilters } from './keyword-extractor.service';
import { CvSearchService, RawCandidate, FullCandidate } from './cv-search.service';
import { PdfExtractorService }                       from '../cv-upload/pdf-extractor.service';
import { Phi3IntentService }                         from './phi3-intent.service';
import { GroqService, RerankedCandidate }            from './groq.service';
import { RecommendDto }                              from './dto/recommend.dto';
import {
  RecommendationResultDto,
  CandidateMatchDto,
}                                                    from './dto/recommendation-result.dto';

// Local pipeline thresholds (Phi-3 mode — untouched)
const LOCAL_MIN_SCORE    = 22;
const TIER1_MIN_SCORE    = 35;
const TIER2_SEMANTIC_MIN = 40;

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);

  constructor(
    private readonly keywordExtractor: KeywordExtractorService,
    private readonly cvSearch:         CvSearchService,
    private readonly pdfExtractor:     PdfExtractorService,
    private readonly phi3Intent:       Phi3IntentService,
    private readonly groqService:      GroqService,
  ) {}

  // ════════════════════════════════════════════════════════════
  // ENTRY POINT
  // ════════════════════════════════════════════════════════════

  async recommend(dto: RecommendDto): Promise<RecommendationResultDto> {
    const t0             = Date.now();
    const mode           = dto.mode ?? 'local';
    const history        = dto.history        ?? [];
    const lastCandidates = dto.lastCandidates ?? [];

    this.logger.log(
      `💬 [${mode.toUpperCase()}] "${dto.message.substring(0, 80)}" ` +
      `| history:${history.length} | ctx:${lastCandidates.length}`
    );

    if (history.length === 0 && this.isNonsenseQuery(dto.message)) {
      return { message: 'Please enter a valid job description.', total: 0, candidates: [], mode };
    }

    // Follow-up detection (Groq mode only)
    // classifyIntent is the single source of truth — no heuristic pre-checks.
    // Pre-checks like looksLikeSkillQuery cause false positives:
    //   "does he know Docker?" contains 'docker' → was forcing new search incorrectly.
    if (mode === 'groq' && dto.apiKey && history.length > 0) {
      const intent = await this.groqService.classifyIntent(
        dto.message, history, lastCandidates, dto.apiKey,
      );
      this.logger.log(`🔀 isFollowUp=${intent.isFollowUp} searchAgain=${intent.searchAgain}`);

      if (intent.isFollowUp && !intent.searchAgain) {
        const reply = await this.groqService.generateConversationalReply(
          dto.message, history, lastCandidates, dto.apiKey,
        );
        return { message: reply, total: 0, candidates: [], aiRecommendation: reply, ragAnalysis: null, mode };
      }

      if (intent.isFollowUp && intent.searchAgain && intent.newQuery) {
        this.logger.log(`🔄 Refined: "${intent.newQuery}"`);
        return this.runGroqPipeline({ ...dto, message: intent.newQuery, lastCandidates: [] }, t0);
      }
    }

    return mode === 'groq' && dto.apiKey
      ? this.runGroqPipeline(dto, t0)
      : this.runLocalPipeline(dto, t0);
  }

  // ════════════════════════════════════════════════════════════
  // GROQ RAG PIPELINE
  //
  // Stage 1 — RETRIEVE: Groq parses intent → keyword + pgvector recall
  // Stage 2 — SCORE:    Groq scores each candidate 0-100 (LLM-as-judge)
  // Stage 3 — GENERATE: Groq writes narrative on pre-scored candidates
  // ════════════════════════════════════════════════════════════

  private async runGroqPipeline(dto: RecommendDto, t0: number): Promise<RecommendationResultDto> {
    const history = dto.history ?? [];

    // Stage 1A: Parse intent + embed query (parallel)
    const intentResult = { filters: null as ExtractedFilters | null, isRelevant: true };
    const tier1Filters = this.keywordExtractor.extract(dto.message);

    const [queryEmbedding] = await Promise.all([
      this.pdfExtractor.embedText(dto.message),
      this.groqService.parseIntent(dto.message, dto.apiKey!)
        .then(r => { intentResult.filters = r.filters; intentResult.isRelevant = r.isRelevant; })
        .catch(err => this.logger.warn(`parseIntent failed: ${err.message}`)),
    ]);

    if (!intentResult.isRelevant) {
      return {
        message: "This doesn't appear to be a recruiting query. Try describing a role or skills.",
        total: 0, candidates: [], mode: 'groq',
      };
    }

    const groqFilters = intentResult.filters;
    const recallFilters: ExtractedFilters = groqFilters ? {
      skills:      this.mergeSkills(tier1Filters.skills, groqFilters.skills),
      minYears:    groqFilters.minYears    ?? tier1Filters.minYears,
      location:    groqFilters.location    ?? tier1Filters.location,
      title:       groqFilters.title       ?? tier1Filters.title,
      degree:      tier1Filters.degree,
      institution: tier1Filters.institution,
      language:    groqFilters.language    ?? tier1Filters.language,
      limit:       30,
    } : { ...tier1Filters, limit: 30 };

    this.logger.log(`📋 Recall skills:[${recallFilters.skills.join(', ')}]`);

    // Stage 1B: Dual recall (keyword SQL + pgvector)
    const recalled = await this.recallCandidates(recallFilters, queryEmbedding);
    this.logger.log(`📦 Recalled: ${recalled.length} — ${Date.now() - t0}ms`);

    if (recalled.length === 0) {
      return { message: 'No candidates found for this role.', total: 0, candidates: [], mode: 'groq' };
    }

    // Stage 1C: Enrich — fetch full CV data (capped at 15 for Groq token limit)
    const enriched: FullCandidate[] = await Promise.all(
      recalled.slice(0, 15).map((c: RawCandidate) =>
        this.cvSearch.findFullCandidate(c.candidateId).catch(() => c as unknown as FullCandidate)
      )
    );
    this.logger.log(`📄 Enriched: ${enriched.length} profiles — ${Date.now() - t0}ms`);

    // Stage 2: LLM scoring — Groq reads full CV vs job query, returns 0-100
    const llmScores = await this.groqService.scoreWithLLM(dto.message, enriched, dto.apiKey!);
    this.logger.log(`🎯 LLM scored — ${Date.now() - t0}ms`);

    // Build score lookup (fuzzy first-name fallback for partial name matches)
    const scoreMap = new Map<string, number>();
    for (const s of llmScores) scoreMap.set((s.name ?? '').toLowerCase().trim(), s.score);

    const getLLMScore = (name: string): number => {
      const key = name.toLowerCase().trim();
      if (scoreMap.has(key)) return scoreMap.get(key)!;
      const first = key.split(' ')[0];
      for (const [k, v] of scoreMap.entries()) {
        if (k.split(' ')[0] === first) return v;
      }
      return 0;
    };

    // Build scored list sorted by LLM score
    const scoredCandidates: CandidateMatchDto[] = enriched
      .map(c => ({
        candidateId:   c.candidateId,
        name:          c.name,
        email:         c.email        ?? null,
        location:      c.location     ?? null,
        currentTitle:  c.currentTitle ?? null,
        yearsExp:      c.yearsExp     ?? null,
        skills:        c.skills       ?? [],
        summary:       c.summary      ?? null,
        matchScore:    getLLMScore(c.name),
        matchedSkills: [],
      } as CandidateMatchDto))
      .sort((a, b) => b.matchScore - a.matchScore);

    this.logger.log(
      `📊 Scores: [${scoredCandidates.slice(0, 6).map(c => `${c.name.split(' ')[0]}:${c.matchScore}`).join(' | ')}]`
    );

    // How many to show — respect explicit count from query ("give me 1", "show 3")
    const explicitCount = this.extractRequestedCount(dto.message);
    const limit         = explicitCount != null
      ? Math.min(explicitCount, 10)
      : Math.min(Math.max(recallFilters.limit ?? 5, 3), 8);

    // Only show candidates the LLM found relevant (score >= 20)
    // If LLM scoring failed entirely (all zeros) fall back to top 3
    const hasScores     = scoredCandidates.some(c => c.matchScore >= 20);
    const finalCandidates = hasScores
      ? scoredCandidates.filter(c => c.matchScore >= 20).slice(0, limit)
      : scoredCandidates.slice(0, Math.min(3, limit));

    // Stage 3: Groq writes narrative (does NOT re-score or reorder)
    const reranked = await this.groqService.rerank(
      dto.message, enriched, dto.apiKey!, history,
      finalCandidates.map(c => ({ ...c, score: c.matchScore })),
    );
    this.logger.log(`✍️  Narrative done — ${Date.now() - t0}ms`);

    // Merge narrative notes onto candidates
    const noteMap = new Map<string, any>();
    for (const note of reranked.candidateNotes) noteMap.set((note.name ?? '').toLowerCase().trim(), note);
    const getNote = (name: string) => {
      const key = name.toLowerCase().trim();
      if (noteMap.has(key)) return noteMap.get(key);
      const first = key.split(' ')[0];
      for (const [k, v] of noteMap.entries()) { if (k.split(' ')[0] === first) return v; }
      return null;
    };

    const queryTerms = recallFilters.skills.map(s => s.toLowerCase());

    const outputCandidates: CandidateMatchDto[] = finalCandidates.map(c => {
      const note = getNote(c.name);

      // Green chips — skills from CV that match query terms
      const matchedSkills = (c.skills ?? []).filter((cs: string) => {
        const cl = cs.toLowerCase();
        return queryTerms.some(q =>
          cl === q || (cl.length >= 4 && q.length >= 4 && (cl.includes(q) || q.includes(cl)))
        );
      });

      // Groq's relevantSkills — validated: only show skills that actually exist in CV
      const relevantSkills = (note?.relevantSkills ?? []).filter((rs: string) =>
        (c.skills ?? []).some((cs: string) => {
          const a = cs.toLowerCase(), b = rs.toLowerCase();
          return a === b || (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a)));
        })
      );

      return {
        candidateId:   c.candidateId,
        name:          c.name,
        email:         c.email        ?? null,
        location:      c.location     ?? null,
        currentTitle:  c.currentTitle ?? null,
        yearsExp:      c.yearsExp     ?? null,
        skills:        c.skills       ?? [],
        summary:       c.summary      ?? null,
        matchScore:    c.matchScore,
        matchedSkills,
        strength:      note?.strengths?.[0] ?? null,
        gap:           note?.gaps?.[0]      ?? null,
        fit:           note?.fit            ?? this.scoreToFit(c.matchScore),
        relevantSkills,
      } as any;
    });

    this.logger.log(
      `✅ DONE: ${Date.now() - t0}ms — recalled:${recalled.length} ` +
      `display:${outputCandidates.length} top:${outputCandidates[0]?.matchScore ?? 0}/100`
    );

    return {
      message:          reranked.answer,
      total:            outputCandidates.length,
      candidates:       outputCandidates,
      aiRecommendation: reranked.answer,
      ragAnalysis: {
        answer:           reranked.answer,
        bestMatch:        reranked.bestMatch,
        rankedOrder:      finalCandidates.map(c => c.name),
        candidateNotes:   reranked.candidateNotes.map(n => ({
          ...n,
          groqScore: n.score ?? 0,
        })),
        followUpQuestion: reranked.followUpQuestion,
        searchAgain:      reranked.searchAgain,
        newQuery:         reranked.newQuery,
      },
      mode: 'groq',
    };
  }

  // ════════════════════════════════════════════════════════════
  // LOCAL PIPELINE (Phi-3) — untouched
  // ════════════════════════════════════════════════════════════

  private async runLocalPipeline(dto: RecommendDto, t0: number): Promise<RecommendationResultDto> {
    const tier1Filters   = this.keywordExtractor.extract(dto.message);
    const queryEmbedding = await this.pdfExtractor.embedText(dto.message);
    const recalled       = await this.recallCandidates(tier1Filters, queryEmbedding);
    let scored           = this.localScoreCandidates(recalled, tier1Filters, queryEmbedding);

    const tier2Best       = scored[0]?.matchScore ?? 0;
    const hasSkills       = tier1Filters.skills.length > 0;
    const tier2Sufficient = (hasSkills && tier2Best >= TIER1_MIN_SCORE) || (!hasSkills && tier2Best >= TIER2_SEMANTIC_MIN);

    if (!tier2Sufficient) {
      const r = await this.phi3Intent.parseIntent(dto.message);
      if (!r.isRelevant) {
        return { message: "This doesn't seem to be a recruitment query.", total: 0, candidates: [], mode: 'local' };
      }
      const merged = this.mergeFilters(tier1Filters, r.filters);
      const r2     = await this.recallCandidates(merged, queryEmbedding);
      scored       = this.localScoreCandidates(r2, merged, queryEmbedding);
    }

    const topN = scored.filter(c => c.matchScore >= LOCAL_MIN_SCORE).slice(0, tier1Filters.limit ?? 5);
    return { message: `Found ${topN.length} candidate(s).`, total: topN.length, candidates: topN, mode: 'local' };
  }

  private localScoreCandidates(
    candidates: (RawCandidate | FullCandidate)[],
    filters:    ExtractedFilters,
    embedding:  number[],
  ): CandidateMatchDto[] {
    const LW_SKILLS = 45, LW_SEMANTIC = 20, LW_LOCATION = 8,
          LW_YEARS  = 12, LW_LANG     = 5,  LW_DEGREE   = 10;

    return candidates.map(candidate => {
      const c    = candidate as any;   // FullCandidate at runtime — cast once, use everywhere
      let score  = 0;
      const matchedSkills: string[] = [];

      if (filters.skills.length > 0) {
        const low  = (c.skills ?? []).map((s: string) => s.toLowerCase());
        const seen = new Set<string>();
        for (const req of filters.skills) {
          const r = req.toLowerCase();
          if (low.some((s: string) => s.includes(r)) && !seen.has(r)) { seen.add(r); matchedSkills.push(req); }
        }
        if (matchedSkills.length > 0) {
          score += Math.min(LW_SKILLS, Math.max(15, Math.round(matchedSkills.length / filters.skills.length * LW_SKILLS)));
        }
      } else { score += Math.round(LW_SKILLS * 0.4); }

      const sim = c.similarity ?? null;
      if (sim !== null) { score += Math.round(sim * LW_SEMANTIC); }
      else if (c.embedding) {
        try {
          score += Math.round(
            this.cosineSimilarity(embedding, JSON.parse(`[${c.embedding.replace(/[\[\]]/g, '')}]`)) * LW_SEMANTIC
          );
        } catch { /* skip */ }
      }

      if (filters.minYears != null) {
        const y = c.yearsExp ?? 0;
        if      (y >= filters.minYears)          score += LW_YEARS;
        else if (y >= filters.minYears * 0.75)   score += Math.round(LW_YEARS * 0.6);
        else if (y >= filters.minYears * 0.5)    score += Math.round(LW_YEARS * 0.3);
      }

      if (filters.location && c.location) {
        const cl = c.location.toLowerCase();
        const ql = filters.location!.toLowerCase();
        if      (cl.includes(ql) || ql.includes(cl)) score += LW_LOCATION;
        else if (this.sameCountry(cl, ql))            score += Math.round(LW_LOCATION * 0.4);
      }

      if (filters.degree && c.education?.some((e: any) =>
        e.degree?.toLowerCase().includes(filters.degree!.toLowerCase())
      )) score += LW_DEGREE;

      if (filters.language && c.languages?.some((l: any) =>
        l.name?.toLowerCase().includes(filters.language!.toLowerCase())
      )) score += LW_LANG;

      return {
        candidateId:  c.candidateId, name: c.name,
        email:        c.email ?? null, location: c.location ?? null,
        currentTitle: c.currentTitle ?? null, yearsExp: c.yearsExp ?? null,
        skills:       c.skills ?? [], summary: c.summary ?? null,
        matchScore:   Math.min(score, 100), matchedSkills,
      };
    }).sort((a, b) => b.matchScore - a.matchScore);
  }

  // ════════════════════════════════════════════════════════════
  // SHARED: Dual recall
  // ════════════════════════════════════════════════════════════

  private async recallCandidates(filters: ExtractedFilters, embedding: number[]): Promise<RawCandidate[]> {
    const candidates: RawCandidate[] = [];

    if (filters.skills.length > 0 || filters.minYears || filters.location ||
        filters.institution || filters.language || filters.degree) {
      const kw = await this.cvSearch.findByFilters(filters);
      candidates.push(...kw);
      this.logger.log(`🔍 Keyword recall: ${kw.length} for [${filters.skills.join(',')}]`);
    }

    if (embedding.length > 0) {
      const sem   = await this.cvSearch.findByEmbedding(embedding, 30);
      const ids   = new Set(candidates.map(c => c.candidateId));
      const added = sem.filter((c: RawCandidate) => !ids.has(c.candidateId));
      candidates.push(...added);
      this.logger.log(`🔍 Semantic recall: +${added.length} (total: ${candidates.length})`);
    }

    return candidates;
  }

  // ════════════════════════════════════════════════════════════
  // UTILITIES
  // ════════════════════════════════════════════════════════════

  private scoreToFit(score: number): 'excellent' | 'good' | 'partial' | 'poor' {
    if (score >= 75) return 'excellent';
    if (score >= 55) return 'good';
    if (score >= 35) return 'partial';
    return 'poor';
  }

  private extractRequestedCount(text: string): number | null {
    const patterns = [
      /\bgive\s+me\s+(\d+)\b/i,
      /\bshow\s+(?:me\s+)?(?:top\s+)?(\d+)\b/i,
      /\bfind\s+(?:me\s+)?(\d+)\b/i,
      /\btop\s+(\d+)\b/i,
      /\b(\d+)\s+(?:candidate|developer|engineer|profile|person|people)\b/i,
      /\bjust\s+(\d+)\b/i,
      /\bonly\s+(\d+)\b/i,
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n >= 1 && n <= 20) return n;
      }
    }
    return null;
  }

  private looksLikeSkillQuery(text: string): boolean {
    return /\b(python|javascript|typescript|java|php|c\+\+|c#|ruby|go|rust|swift|kotlin|dart|scala|bash|shell|sql|nosql|html|css|react|angular|vue|svelte|nextjs|nuxtjs|node|nodejs|nestjs|express|django|flask|fastapi|spring|laravel|rails|docker|kubernetes|k8s|ansible|terraform|jenkins|gitlab|github|linux|aws|azure|gcp|devops|machine learning|deep learning|nlp|tensorflow|pytorch|scikit|pandas|numpy|spark|kafka|redis|mongodb|postgresql|mysql|sqlite|firebase|flutter|android|ios|react native|figma|photoshop|cisco|ccna|networking|ospf|bgp|vlan|microservices|graphql|blockchain|unity|unreal)\b/i
      .test(text);
  }

  private isNonsenseQuery(text: string): boolean {
    const c = text.trim().toLowerCase();
    if (c.length < 4) return true;
    if (/^[^a-zA-Z]+$/.test(c)) return true;
    const words = c.split(/\s+/).filter(w => w.length > 1);
    if (new Set(words).size === 1 && words.length >= 4) return true;
    const tot = c.replace(/\s/g, '').length;
    if (tot > 8 && new Set(c.replace(/\s/g, '')).size / tot < 0.2) return true;
    return false;
  }

  private mergeSkills(a: string[], b: string[]): string[] {
    const res = [...b];
    const low = new Set(b.map(s => s.toLowerCase()));
    for (const s of a) { if (!low.has(s.toLowerCase())) res.push(s); }
    return res;
  }

  private mergeFilters(base: ExtractedFilters, ov: ExtractedFilters): ExtractedFilters {
    return { ...base, skills: this.mergeSkills(base.skills, ov.skills), minYears: ov.minYears ?? base.minYears, location: ov.location ?? base.location, title: ov.title ?? base.title };
  }

  private sameCountry(a: string, b: string): boolean {
    const GROUPS = [
      ['tunis','sfax','sousse','tunisia','tunisie','ben arous','ariana','nabeul','hammam','jendouba','monastir','bizerte'],
      ['paris','lyon','france','marseille','bordeaux','toulouse'],
      ['london','manchester','uk','england','scotland'],
      ['usa','new york','california','texas','chicago'],
    ];
    return GROUPS.some(g => g.some(x => a.includes(x)) && g.some(x => b.includes(x)));
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    let dot = 0, ma = 0, mb = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; ma += a[i]*a[i]; mb += b[i]*b[i]; }
    return ma && mb ? dot / (Math.sqrt(ma) * Math.sqrt(mb)) : 0;
  }
}