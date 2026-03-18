import { Injectable, Logger } from '@nestjs/common';
import { HttpService }        from '@nestjs/axios';
import { ConfigService }      from '@nestjs/config';
import { firstValueFrom }     from 'rxjs';
import { ExtractedFilters }   from './keyword-extractor.service';
import { ConversationMessageDto, LastCandidateDto } from './dto/recommend.dto';

export interface GroqIntentResult {
  filters:    ExtractedFilters;
  isRelevant: boolean;
}

export interface RerankedCandidate {
  name:           string;
  score:          number;
  fit:            'excellent' | 'good' | 'partial' | 'poor';
  relevantSkills: string[];
  strengths:      string[];
  gaps:           string[];
}

export interface RagAnalysis {
  answer:           string;
  bestMatch:        string;
  candidateNotes:   RerankedCandidate[];
  followUpQuestion: string;
  searchAgain:      boolean;
  newQuery:         string;
  rankedOrder:      string[];
}

export interface FollowUpResult {
  isFollowUp:  boolean;
  searchAgain: boolean;
  newQuery:    string;
}

export interface PreScoredCandidate {
  candidateId:  string;
  name:         string;
  matchScore:   number;
  score?:       number;
  currentTitle: string | null;
  location:     string | null;
  yearsExp:     number | null;
  skills:       string[];
  summary:      string | null;
  email?:       string | null;
  education?:   any[];
  experience?:  any[];
  languages?:   any[];
  [key: string]: any;
}

const ROLE_SKILL_DOMAINS: Array<{
  keywords: string[]; coreSkills: string[]; niceToHave: string[];
}> = [
  { keywords: ['devops','sre','infrastructure','cloud engineer','platform engineer'], coreSkills: ['Docker','Kubernetes','Linux','Jenkins','GitLab CI','Ansible','Terraform','CI/CD','AWS','Azure','GCP'], niceToHave: ['Python','Go','Prometheus','Grafana','ELK'] },
  { keywords: ['machine learning','ml','ai engineer','data scientist','nlp','deep learning','data engineer'], coreSkills: ['Python','TensorFlow','PyTorch','scikit-learn','Pandas','NumPy','NLP','Machine Learning','Deep Learning'], niceToHave: ['Docker','AWS','Spark','Airflow','OpenCV'] },
  { keywords: ['frontend','front-end','react developer','vue developer','angular developer','ui developer'], coreSkills: ['React','Vue','Angular','TypeScript','JavaScript','HTML','CSS','Next.js','Tailwind'], niceToHave: ['Node.js','Jest','Figma','Webpack'] },
  { keywords: ['backend','back-end','java developer','spring','node.js','nodejs developer','api developer','nestjs'], coreSkills: ['Node.js','Java','Spring Boot','NestJS','Express','PostgreSQL','MySQL','MongoDB','REST API','Docker'], niceToHave: ['Kubernetes','CI/CD','AWS','Microservices','Redis'] },
  { keywords: ['fullstack','full stack','full-stack'], coreSkills: ['JavaScript','TypeScript','React','Node.js','PostgreSQL','REST API','HTML','CSS'], niceToHave: ['Docker','Vue','Angular','GraphQL','Redis'] },
  { keywords: ['network','networking','cisco','ccna','telecom'], coreSkills: ['Cisco','OSPF','BGP','VLAN','TCP/IP','Firewalls','VPN','Linux','Wireshark'], niceToHave: ['Python','Ansible','SDN','Fortinet'] },
  { keywords: ['mobile','android','ios','flutter','react native'], coreSkills: ['Flutter','React Native','Swift','Kotlin','Android','iOS','Dart','Firebase'], niceToHave: ['GraphQL','Redux','CI/CD'] },
  { keywords: ['cybersecurity','security engineer','pentest','penetration'], coreSkills: ['Linux','Networking','Firewall','VPN','Python','IDS/IPS','Wireshark'], niceToHave: ['Metasploit','Nmap','SIEM','AWS'] },
  { keywords: ['system admin','sysadmin','system administration'], coreSkills: ['Linux','Ubuntu','Windows Server','Bash','Networking','Docker','Backup'], niceToHave: ['Ansible','Terraform','Monitoring'] },
];

function getRoleDomain(query: string) {
  const lower = query.toLowerCase();
  return ROLE_SKILL_DOMAINS.find(d => d.keywords.some(k => lower.includes(k))) ?? null;
}

function scoreToFit(score: number): 'excellent' | 'good' | 'partial' | 'poor' {
  if (score >= 75) return 'excellent';
  if (score >= 55) return 'good';
  if (score >= 35) return 'partial';
  return 'poor';
}

function parseJSON(raw: string): any {
  const clean = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
  const start = clean.indexOf('{');
  const end   = clean.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found');
  return JSON.parse(clean.substring(start, end + 1));
}

@Injectable()
export class GroqService {
  private readonly logger    = new Logger(GroqService.name);
  private readonly groqUrl:   string;
  private readonly groqModel: string;

  constructor(
    private readonly httpService:   HttpService,
    private readonly configService: ConfigService,
  ) {
    this.groqUrl   = this.configService.getOrThrow<string>('GROQ_API_URL');
    this.groqModel = this.configService.get<string>('GROQ_MODEL') ?? 'llama-3.3-70b-versatile';
  }

  async parseIntent(query: string, apiKey: string): Promise<GroqIntentResult> {
    this.logger.log(`🌐 parseIntent: "${query.substring(0, 60)}"`);

    const prompt = `Extract structured job requirements from this recruiting query. Return ONLY valid JSON, no markdown.

Query: "${query}"

{
  "skills": [],
  "minYears": null,
  "location": null,
  "title": null,
  "degree": null,
  "institution": null,
  "language": null,
  "isRelevant": true
}

Rules:
- skills: specific technical skills implied by the query (in English).
  Always infer skills from job titles/domains even if not explicitly stated.
  Examples:
    "network engineering internship" → ["cisco", "tcp/ip", "ospf", "vlan", "linux", "networking"]
    "DevOps engineer"               → ["docker", "kubernetes", "ci/cd", "linux", "jenkins"]
    "full stack developer"          → ["javascript", "react", "node", "sql", "rest api"]
    "data scientist"                → ["python", "machine learning", "pandas", "sql"]
    "mobile developer"              → ["flutter", "react native", "android", "ios", "dart"]
    "frontend developer"            → ["javascript", "react", "html", "css", "typescript"]
    "backend developer"             → ["java", "python", "node", "sql", "rest api", "docker"]
    "cybersecurity analyst"         → ["linux", "firewall", "vpn", "networking", "ids/ips"]
    "system administrator"          → ["linux", "ubuntu", "windows server", "bash", "networking"]
  Return specific technologies, not generic terms like "programming" or "development".
- minYears: minimum years as number, null if not mentioned
- location: city/country if mentioned, null otherwise
- title: job title if mentioned, null otherwise
- degree: "bachelor"/"master"/"engineer"/"phd"/"licence" if mentioned, null otherwise
- institution: university/school if mentioned, null otherwise
- language: spoken language required, null otherwise
- isRelevant: false ONLY if completely unrelated to recruiting (e.g. cooking recipes, math homework)`;

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          this.groqUrl,
          { model: this.groqModel, messages: [{ role: 'user', content: prompt }], temperature: 0.0, max_tokens: 300 },
          { timeout: 15_000, headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } },
        ),
      );
      const parsed = parseJSON(response.data?.choices?.[0]?.message?.content ?? '{}');
      this.logger.log(`✅ parseIntent: skills=[${parsed.skills?.join(', ')}] loc=${parsed.location}`);
      return {
        filters: {
          skills:      Array.isArray(parsed.skills) ? parsed.skills : [],
          minYears:    typeof parsed.minYears === 'number' ? parsed.minYears : null,
          location:    parsed.location    ?? null,
          title:       parsed.title       ?? null,
          degree:      parsed.degree      ?? null,
          institution: parsed.institution ?? null,
          language:    parsed.language    ?? null,
          limit:       15,
        },
        isRelevant: parsed.isRelevant !== false,
      };
    } catch (err) {
      this.logger.warn(`parseIntent failed: ${err.message}`);
      return {
        filters: { skills: [], minYears: null, location: null, title: null, degree: null, institution: null, language: null, limit: 15 },
        isRelevant: true,
      };
    }
  }

  async scoreWithLLM(
    query:      string,
    candidates: any[],
    apiKey:     string,
  ): Promise<Array<{ name: string; score: number; reason: string }>> {

    const domain = getRoleDomain(query);
    const domainHint = domain
      ? `\nDOMAIN CONTEXT: For this role, core skills are: ${domain.coreSkills.slice(0, 8).join(', ')}`
      : '';

    const profiles = candidates.slice(0, 15).map((c: any, i: number) => {
      const exp = (c.experience ?? []).slice(0, 3)
        .map((e: any) => `${e.title ?? ''}${e.company ? ' @ ' + e.company : ''}`.trim())
        .filter(Boolean).join(', ') || 'no experience listed';

      return `[${i + 1}] ${c.name}
Skills: ${(c.skills ?? []).join(', ') || 'none'}
Experience: ${c.yearsExp != null ? c.yearsExp + ' yrs' : 'unspecified'} — ${exp}
Summary: ${c.summary?.substring(0, 150) ?? 'N/A'}`;
    }).join('\n\n');

    const prompt = `You are a senior technical recruiter. Score each candidate 0-100 for this specific job query.

JOB QUERY: "${query}"${domainHint}

CANDIDATES:
${profiles}

SCORING RULES — READ CAREFULLY:

RANGE DEFINITIONS:
- 85-100: Has the SPECIFIC skills asked for, directly or through clear domain equivalence
- 65-84:  Has most required skills, small gaps
- 40-64:  Has adjacent/partial skills — related but not the requested specialization
- 15-39:  Has one loosely related skill (e.g. Python for a TensorFlow query)
- 0-14:   Profile is unrelated to the query

STRICT RULES:
1. If a candidate's skills do NOT include what was asked, and have NO domain equivalence, score them 0-20.
2. Domain equivalence IS allowed for ML/data science: "NLP + Model Training + Data Preprocessing" = ML experience → score 75+
3. Domain equivalence IS allowed for DevOps: "Docker + CI/CD + Jenkins + Linux" = strong DevOps → score 75+
4. Experience years are a TIEBREAKER ONLY — never score a senior with wrong skills above a junior with right skills
5. Spread scores across the FULL 0-100 range.
6. Score based ONLY on what is in the query.

Return ONLY valid JSON, no markdown:
{
  "scores": [
    { "name": "exact name as given", "score": 85, "reason": "one sentence referencing their actual skills" }
  ]
}`;

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          this.groqUrl,
          { model: this.groqModel, messages: [{ role: 'user', content: prompt }], temperature: 0.0, max_tokens: 800 },
          { timeout: 20_000, headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } },
        ),
      );
      const parsed = parseJSON(response.data?.choices?.[0]?.message?.content ?? '{}');
      const scores = Array.isArray(parsed.scores) ? parsed.scores : [];
      this.logger.log(
        `🎯 Scored ${scores.length}: ` +
        scores.slice(0, 5).map((s: any) => `${s.name?.split(' ')[0]}:${s.score}`).join(' | ')
      );
      return scores;
    } catch (err) {
      this.logger.warn(`scoreWithLLM failed: ${err.message}`);
      return [];
    }
  }

  async rerank(
    query:            string,
    candidates:       any[],
    apiKey:           string,
    history:          ConversationMessageDto[] = [],
    preScoredByRank?: PreScoredCandidate[],
  ): Promise<RagAnalysis> {

    const ordered = preScoredByRank ?? candidates;
    const domain  = getRoleDomain(query);
    this.logger.log(`📝 Narrative for ${ordered.length} candidates`);

    const profiles = ordered.slice(0, 8).map((c: any, i: number) => {
      const score = c.matchScore ?? c.score ?? 0;
      const exp   = (c.experience ?? []).slice(0, 1)
        .map((e: any) => `${e.title ?? ''}${e.company ? ' @ ' + e.company : ''}`.trim())
        .filter(Boolean).join(', ') || 'N/A';
      return `[${i + 1}] ${c.name} | Score:${score} | ${c.currentTitle ?? 'N/A'} | ${c.yearsExp ?? '?'} yrs | ${c.location ?? 'N/A'}
Skills: ${(c.skills ?? []).slice(0, 12).join(', ') || 'N/A'}
Work: ${exp}`;
    }).join('\n\n');

    const domainContext = domain
      ? `\nROLE CONTEXT: Core skills for this role: ${domain.coreSkills.join(', ')}\n`
      : '';

    const systemPrompt = `You are an expert technical recruiter writing candidate analysis for a hiring manager.

RECRUITER QUERY: "${query}"
${domainContext}
CANDIDATES (scored and ranked — do NOT change order or scores):
${profiles}

Write professional narrative. Scores and ranking are final.

For each candidate:
1. strengths — 1 sentence max 12 words, name a SPECIFIC skill from their profile
2. gaps — 1 sentence max 12 words, name the most critical missing skill
3. relevantSkills — list 2-5 skills from their actual profile relevant to this query — ONLY list skills that appear in their Skills list above
4. fit — derived from score: 75+→"excellent" | 55-74→"good" | 35-54→"partial" | 0-34→"poor"
5. answer — 2-3 sentence professional summary in SAME LANGUAGE as the query
6. bestMatch — "Name — has [specific skills] making them strongest for [specific reason]"
7. followUpQuestion — one smart question to refine this search further

Return ONLY valid JSON, no markdown:
{
  "answer": "...",
  "bestMatch": "...",
  "rankedOrder": ["name1", "name2"],
  "candidateNotes": [
    {
      "name": "exact name",
      "score": 75,
      "fit": "good",
      "relevantSkills": ["skill1", "skill2"],
      "strengths": ["one specific strength sentence"],
      "gaps": ["one specific gap sentence"]
    }
  ],
  "followUpQuestion": "...",
  "searchAgain": false,
  "newQuery": ""
}`;

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-2).map((h: ConversationMessageDto) => ({ role: h.role, content: h.content })),
      { role: 'user', content: query },
    ];

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          this.groqUrl,
          { model: this.groqModel, messages, temperature: 0.1, max_tokens: 900 },
          { timeout: 30_000, headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } },
        ),
      );

      const parsed = parseJSON(response.data?.choices?.[0]?.message?.content ?? '');

      const notes: RerankedCandidate[] = (Array.isArray(parsed.candidateNotes) ? parsed.candidateNotes : [])
        .map((n: any) => {
          const preScored = (preScoredByRank ?? []).find(
            p => p.name.toLowerCase().trim() === (n.name ?? '').toLowerCase().trim()
          );
          const authScore = preScored?.matchScore ?? preScored?.score ?? n.score ?? 0;
          return {
            name:           n.name           ?? '',
            score:          authScore,
            fit:            scoreToFit(authScore),
            relevantSkills: Array.isArray(n.relevantSkills) ? n.relevantSkills : [],
            strengths:      Array.isArray(n.strengths) ? n.strengths.slice(0, 1) : [],
            gaps:           Array.isArray(n.gaps)      ? n.gaps.slice(0, 1)      : [],
          };
        });

      const rankedOrder = Array.isArray(parsed.rankedOrder) && parsed.rankedOrder.length > 0
        ? parsed.rankedOrder
        : ordered.map((c: any) => c.name);

      this.logger.log(`✅ Narrative done — top: ${rankedOrder[0]} | notes: ${notes.length}`);

      return {
        answer:           parsed.answer           ?? '',
        bestMatch:        parsed.bestMatch         ?? '',
        rankedOrder,
        candidateNotes:   notes,
        followUpQuestion: parsed.followUpQuestion  ?? '',
        searchAgain:      parsed.searchAgain       === true,
        newQuery:         parsed.newQuery           ?? '',
      };

    } catch (err) {
      this.logger.warn(`Narrative failed: ${err.message}`);
      const fallback: RerankedCandidate[] = (preScoredByRank ?? candidates).slice(0, 10).map((c: any) => ({
        name:           c.name,
        score:          c.matchScore ?? c.score ?? 0,
        fit:            scoreToFit(c.matchScore ?? c.score ?? 0),
        relevantSkills: (c.skills ?? []).slice(0, 5),
        strengths:      ['Review profile skills above'],
        gaps:           ['Manual review recommended'],
      }));
      return {
        answer:           'Candidates found — please review profiles below.',
        bestMatch:        ordered[0]?.name ?? '',
        rankedOrder:      ordered.map((c: any) => c.name),
        candidateNotes:   fallback,
        followUpQuestion: 'Would you like to filter by location, experience level, or a specific technology?',
        searchAgain:      false,
        newQuery:         '',
      };
    }
  }

  async classifyIntent(
    message:        string,
    history:        ConversationMessageDto[],
    lastCandidates: LastCandidateDto[],
    apiKey:         string,
  ): Promise<FollowUpResult> {
    this.logger.log(`🔀 classifyIntent: "${message.substring(0, 60)}"`);

    const historyText = history.slice(-6)
      .map((h: ConversationMessageDto) => `${h.role}: ${h.content}`)
      .join('\n');

    const candidateList = lastCandidates.length > 0
      ? lastCandidates.map((c: LastCandidateDto) => `- ${c.name}: ${c.skills?.slice(0, 8).join(', ')}`).join('\n')
      : 'No candidates shown yet.';

    const prompt = `You are an HR assistant. Classify this recruiter message as FOLLOW_UP or NEW_SEARCH.

CONVERSATION HISTORY:
${historyText}

CANDIDATES CURRENTLY SHOWN:
${candidateList}

NEW MESSAGE: "${message}"

CLASSIFICATION RULES — apply in order:

1. FOLLOW_UP (searchAgain=false) — message is about the candidates already shown:
   - References a candidate by name: "tell me about Rassem", "what about Mortadha?"
   - Uses pronouns for a shown candidate: "does he know X?", "what is her email?", "can she do Y?"
   - Asks yes/no about a shown candidate's skills: "does he know Docker?", "can she do React?"
   - Asks for contact details: "what is his email?", "give me her phone"
   - Acknowledgement: "thanks", "ok", "got it"

2. FOLLOW_UP (searchAgain=true) — SAME role but adding a constraint:
   - Adds location: "only in Tunis", "from Ariana"
   - Adds experience: "with 3 years experience", "senior only"
   - Adds language: "must speak French"
   - Narrows same domain: "but only backend", "with Angular specifically"

3. NEW_SEARCH — completely different request:
   - Different role or technology domain
   - Explicit new search: "find", "search for", "show me", "I need"

CRITICAL RULES:
- "does he/she know X?", "can he/she do Y?" about a shown candidate → ALWAYS FOLLOW_UP false
- "what about [name]?" → ALWAYS FOLLOW_UP false
- Only NEW_SEARCH when the message clearly requests a DIFFERENT candidate pool or role

Return ONLY valid JSON:
{
  "isFollowUp": true,
  "searchAgain": false,
  "newQuery": ""
}`;

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          this.groqUrl,
          { model: this.groqModel, messages: [{ role: 'user', content: prompt }], temperature: 0.0, max_tokens: 120 },
          { timeout: 8_000, headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } },
        ),
      );
      const parsed = parseJSON(response.data?.choices?.[0]?.message?.content ?? '{}');
      const result: FollowUpResult = {
        isFollowUp:  parsed.isFollowUp  !== false,
        searchAgain: parsed.searchAgain === true,
        newQuery:    parsed.newQuery     ?? '',
      };
      this.logger.log(`✅ Intent: isFollowUp=${result.isFollowUp} searchAgain=${result.searchAgain}`);
      return result;
    } catch (err) {
      this.logger.warn(`classifyIntent failed: ${err.message}`);
      return { isFollowUp: false, searchAgain: false, newQuery: '' };
    }
  }

  async generateConversationalReply(
    message:        string,
    history:        ConversationMessageDto[],
    lastCandidates: LastCandidateDto[],
    apiKey:         string,
  ): Promise<string> {
    this.logger.log(`💬 Conversational reply — ${lastCandidates.length} candidates in context`);

    const candidateContext = lastCandidates.length > 0
      ? lastCandidates.map((c: LastCandidateDto, i: number) =>
          `[${i + 1}] ${c.name} | ${c.currentTitle ?? 'N/A'} | ${c.location ?? 'N/A'} | ` +
          `${c.yearsExp ?? 0} yrs | Score: ${c.matchScore ?? 0}%\n` +
          `    Skills: ${c.skills?.join(', ') ?? 'N/A'}\n` +
          `    Email: ${c.email ?? 'not provided'}`
        ).join('\n')
      : 'No candidates in context.';

    const systemPrompt = `You are an HR assistant in a conversation with a recruiter.

CANDIDATES IN CONTEXT:
${candidateContext}

RULES:
- Write natural conversational prose — no tables, no pipe-separated data
- Only reference candidates listed above. Use their exact names.
- Never invent skills, experience, or details not in the list above
- If a detail is not available: say "I don't have that from their CV — contact them directly"
- Respond in the SAME LANGUAGE as the recruiter
- Be concise and professional`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-8).map((h: ConversationMessageDto) => ({ role: h.role, content: h.content })),
      { role: 'user', content: message },
    ];

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          this.groqUrl,
          { model: this.groqModel, messages, temperature: 0.3, max_tokens: 600 },
          { timeout: 15_000, headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } },
        ),
      );
      return response.data?.choices?.[0]?.message?.content?.trim() ?? 'Sorry, could not process that.';
    } catch (err) {
      this.logger.warn(`conversationalReply failed: ${err.message}`);
      return 'Sorry, I could not process that request. Please try again.';
    }
  }

  async generateRagAnalysis(
    query: string, candidates: any[], apiKey: string, history: ConversationMessageDto[] = [],
  ): Promise<RagAnalysis> {
    return this.rerank(query, candidates, apiKey, history);
  }

  async generateRecommendation(query: string, candidates: any[], apiKey: string): Promise<string> {
    const r = await this.rerank(query, candidates, apiKey, []);
    return r.answer;
  }
}