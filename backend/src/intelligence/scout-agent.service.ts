import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, In, IsNull, Not } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ScoutInsight, InsightType, InsightPriority, InsightAction, InsightStatus } from './entities/scout-insight.entity';
import { JobOffer } from '../job-offers/job-offer.entity';
import { Employee, RiskLevel, EmployeeStatus } from '../employees/entities/employee.entity';
import { Application } from '../applications/application.entity';
import { Candidate } from '../candidates/entities/candidates.entity';
import { ChatbotService } from '../chatbot/chatbot.service';
import { GroqService } from '../chatbot/groq.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ScoutAgentService implements OnModuleInit {
  private readonly logger = new Logger(ScoutAgentService.name);
  private isRunning = false;

  constructor(
    @InjectRepository(ScoutInsight)
    private readonly insightRepo: Repository<ScoutInsight>,
    @InjectRepository(JobOffer)
    private readonly jobRepo: Repository<JobOffer>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(Candidate)
    private readonly candidateRepo: Repository<Candidate>,
    @InjectRepository(Application)
    private readonly applicationRepo: Repository<Application>,
    private readonly chatbotService: ChatbotService,
    private readonly groqService: GroqService,
    private readonly configService: ConfigService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    this.logger.log('🤖 Strategic Talent Scout Agent initialized.');
    // Optional: Run on startup for demo purposes
    // this.runAgentLoop();
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  async handleCron() {
    this.logger.log('🕒 Triggering scheduled agent loop...');
    await this.runAgentLoop();
  }

  async runAgentLoop() {
    if (this.isRunning) {
      this.logger.warn('⚠️ Agent loop is already running. Skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    this.logger.log('🚀 Agent Perception Phase started...');

    try {
      // 1. Perception: Fetch Context
      const openJobs = await this.jobRepo.find({ 
        where: { status: 'open' },
        relations: ['jobRole', 'jobRole.department', 'jobRoleLevel']
      });
      const criticalEmployees = await this.employeeRepo.find({
        where: [
          { impactOfLoss: RiskLevel.HIGH },
          { retentionRisk: RiskLevel.HIGH },
        ],
        relations: ['jobRole', 'jobRoleLevel', 'competencies'],
      });

      // Fetch all candidate IDs and Emails of active employees to exclude them from recruitment scans
      const employees = await this.employeeRepo.find({
        select: ['candidateId', 'email']
      });
      const hiredCandidateIds = employees.map(e => e.candidateId).filter(id => !!id);
      const hiredEmails = employees.map(e => e.email?.toLowerCase()).filter(email => !!email);

      // RECONCILIATION: Fix "ghost" candidates who are employees but not marked as 'converted'
      if (hiredEmails.length > 0) {
        await this.candidateRepo.createQueryBuilder()
          .update()
          .set({ status: 'converted' })
          .where('LOWER(email) IN (:...emails)', { emails: hiredEmails })
          .andWhere('status != :converted', { converted: 'converted' })
          .execute();
      }

      this.logger.log(`👁️ Perceived ${openJobs.length} open jobs and ${criticalEmployees.length} critical employees. Excluding ${hiredCandidateIds.length} already hired candidates.`);

      // 2. Deterministic Analysis & Feedback Adjustment
      const rawInsights: Partial<ScoutInsight>[] = [];

      // A. External Match Analysis
      for (const job of openJobs.slice(0, 5)) {
        const matches = await this.findExternalMatches(job, hiredCandidateIds as string[], hiredEmails);
        rawInsights.push(...matches);
      }

      // B. Internal Mobility Analysis
      for (const job of openJobs.slice(0, 5)) {
        const mobility = await this.findInternalMobility(job);
        rawInsights.push(...mobility);
      }

      // C. Retention Risk Analysis
      const risks = await this.analyzeRetentionRisks(criticalEmployees);
      rawInsights.push(...risks);

      this.logger.log(`📊 Generated ${rawInsights.length} raw insights before prioritization.`);

      // 3. Pre-Prioritization (Sort by score and pick top 10)
      const prioritized = rawInsights
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, 10);

      if (prioritized.length === 0) {
        this.logger.log('✅ No high-value insights found in this cycle.');
        return;
      }

      // 4. LLM Reasoning & Decision Layer
      this.logger.log(`🧠 LLM Reasoning Phase for top ${prioritized.length} insights...`);
      const refinedInsights = await this.refineWithLLM(prioritized);

      // 5. Memory Sync (Upsert)
      await this.syncMemory(refinedInsights);

      // 6. Proactive Cleanup: Archive any 'MATCH' insights for people who are now employees
      if (hiredCandidateIds.length > 0 || hiredEmails.length > 0) {
        await this.insightRepo.createQueryBuilder()
          .update()
          .set({ status: InsightStatus.DISMISSED })
          .where('type = :type', { type: 'MATCH' })
          .andWhere('status = :status', { status: InsightStatus.NEW })
          .andWhere('(candidateId IN (:...ids) OR EXISTS (SELECT 1 FROM candidates c WHERE c.id = candidateId AND LOWER(c.email) IN (:...emails)))', 
            { ids: hiredCandidateIds, emails: hiredEmails })
          .execute();
      }

      const duration = (Date.now() - startTime) / 1000;
      this.logger.log(`✅ Agent loop completed in ${duration}s.`);
    } catch (error) {
      this.logger.error(`❌ Agent loop failed: ${error.message}`, error.stack);
    } finally {
      this.isRunning = false;
    }
  }

  private async findExternalMatches(job: JobOffer, excludeIds: string[] = [], hiredEmails: string[] = []): Promise<Partial<ScoutInsight>[]> {
    const query = `Find candidates for ${job.title}: ${job.description}`;
    const result = await this.chatbotService.recommend({
      message: query,
      mode: 'local',
      limit: 10,
    });

    const insights: Partial<ScoutInsight>[] = [];
    for (const cand of result.candidates) {
      // Triple-Lock Exclusion: Skip if ID matches OR if Email matches an existing employee
      const c = await this.candidateRepo.findOneBy({ id: cand.candidateId });
      if (!c || excludeIds.includes(cand.candidateId) || hiredEmails.includes(c.email?.toLowerCase())) {
        continue;
      }

      // Check if this candidate was dismissed for this job before
      const pastAction = await this.insightRepo.findOne({
        where: { candidateId: cand.candidateId, jobId: job.id },
      });

      let adjustedScore = cand.matchScore;
      if (pastAction?.status === InsightStatus.DISMISSED) {
        adjustedScore *= 0.8;
      } else if (pastAction?.status === InsightStatus.ACTIONED) {
        adjustedScore *= 1.2;
      }

      insights.push({
        type: InsightType.MATCH,
        candidateId: cand.candidateId,
        jobId: job.id,
        departmentId: job.jobRole?.departmentId ?? null,
        score: Math.min(Math.round(adjustedScore), 100),
        reasoning: `Potential match for ${job.title}.`,
      });
    }
    return insights;
  }

  private async findInternalMobility(job: JobOffer): Promise<Partial<ScoutInsight>[]> {
    const employees = await this.employeeRepo.find({
      where: { status: EmployeeStatus.ACTIVE },
      relations: ['competencies', 'jobRoleLevel', 'jobRole', 'department'],
    });

    const insights: Partial<ScoutInsight>[] = [];
    for (const emp of employees) {
      // PROACTIVE LOGIC: Match by department OR competency overlap
      const titleMatch = job.title.toLowerCase().includes(emp.jobRole.name.toLowerCase());
      const sameDept = emp.department?.name === job.jobRole?.department?.name;
      
      if (titleMatch || (sameDept && emp.jobRoleLevel?.levelNumber < 3)) {
        insights.push({
          type: InsightType.MOBILITY,
          employeeId: emp.id,
          jobId: job.id,
          departmentId: job.jobRole?.departmentId ?? null,
          score: titleMatch ? 90 : 75,
          reasoning: `Internal mobility: ${emp.firstName} is in the ${emp.department?.name || 'same'} department and ready for a ${job.title} role.`,
        });
      }
    }
    return insights;
  }

  private async analyzeRetentionRisks(employees: Employee[]): Promise<Partial<ScoutInsight>[]> {
    const insights: Partial<ScoutInsight>[] = [];
    for (const emp of employees) {
      // PROACTIVE LOGIC: Flag if High Impact OR High Risk (instead of requiring both)
      // or if they have been in the same role for > 3 years (simulated tenure check)
      const isCritical = emp.impactOfLoss === RiskLevel.HIGH;
      const isRisk = emp.retentionRisk === RiskLevel.HIGH || emp.retentionRisk === RiskLevel.MEDIUM;

      if (isCritical || isRisk) {
        insights.push({
          type: InsightType.RISK,
          employeeId: emp.id,
          departmentId: emp.departmentId ?? null,
          score: isCritical && isRisk ? 95 : 80,
          reasoning: `Retention Alert: ${emp.firstName} ${emp.lastName} is a ${isCritical ? 'High Impact' : 'Moderate Risk'} asset that requires engagement.`,
        });
      }
    }
    return insights;
  }

  private async refineWithLLM(insights: Partial<ScoutInsight>[]): Promise<Partial<ScoutInsight>[]> {
    const apiKey = this.configService.get<string>('GROQ_API_KEY');
    if (!apiKey) {
      this.logger.warn('GROQ_API_KEY not found. Skipping LLM refinement.');
      return insights.map(i => ({
        ...i,
        priority: i.score && i.score > 80 ? InsightPriority.HIGH : InsightPriority.MEDIUM,
        action: i.score && i.score > 90 ? InsightAction.ESCALATE : InsightAction.NOTIFY,
        confidence: 0.7,
      }));
    }

    // Batch prompt construction
    const context = await Promise.all(insights.map(async (i, idx) => {
      let subject = '';
      if (i.candidateId) {
        const c = await this.candidateRepo.findOneBy({ id: i.candidateId });
        subject = `[EXTERNAL LEAD] ${c?.firstName} ${c?.lastName}`;
      } else if (i.employeeId) {
        const e = await this.employeeRepo.findOneBy({ id: i.employeeId });
        subject = `[CURRENT EMPLOYEE] ${e?.firstName} ${e?.lastName}`;
      }

      let target = '';
      if (i.jobId) {
        const j = await this.jobRepo.findOneBy({ id: i.jobId });
        target = `Job: ${j?.title}`;
      }

      return `[${idx}] ${subject} | ${target} | Type: ${i.type} | Raw Score: ${i.score}`;
    }));

    const prompt = `You are the BIAT Strategic Talent Agent. Analyze these 10 workforce insights and refine them with professional business reasoning.
CRITICAL: Maintain high consistency. If an insight has a high score, ensure high priority.
For each insight, return:
1. Reasoning: Concise, high-impact business value (e.g. "Addresses critical skill gap", "Top-tier talent for expansion").
2. Priority: HIGH, MEDIUM, or LOW.
3. Action: ESCALATE (score > 90), NOTIFY (score > 70), or NONE.
4. Confidence: 0.8 to 1.0 (since these are pre-filtered matches).

Insights to analyze:
${context.join('\n')}

Return ONLY a JSON array:
[{"index": 0, "reasoning": "...", "priority": "...", "action": "...", "confidence": 0.95}, ...]`;

    try {
      const responseContent = await this.groqService.executePrompt(prompt, apiKey, 0.1);
      this.logger.log(`🤖 LLM Raw Response: ${responseContent.substring(0, 100)}...`);
      const results = this.parseLLMResponse(responseContent);
      this.logger.log(`✅ Parsed ${results.length} refined insights from LLM.`);

      return insights.map((insight, idx) => {
        const refined = results.find((r: any) => r.index === idx);
        if (refined) {
          return {
            ...insight,
            reasoning: refined.reasoning,
            priority: refined.priority as InsightPriority,
            action: refined.action as InsightAction,
            confidence: refined.confidence,
          };
        }
        return insight;
      });
    } catch (err) {
      this.logger.error(`LLM refinement failed: ${err.message}`);
      return insights;
    }
  }

  private parseLLMResponse(raw: string): any[] {
    try {
      const start = raw.indexOf('[');
      const end = raw.lastIndexOf(']');
      if (start === -1 || end === -1) return [];
      const clean = raw.substring(start, end + 1);
      return JSON.parse(clean);
    } catch (e) {
      this.logger.error(`Failed to parse LLM response: ${e.message}`, raw);
      return [];
    }
  }

  private async syncMemory(insights: Partial<ScoutInsight>[]) {
    this.logger.log(`💾 Syncing ${insights.length} insights to memory...`);
    let savedCount = 0;

    for (const data of insights) {
      // Deduplication logic: Check if a similar active insight exists
      const existing = await this.insightRepo.findOne({
        where: {
          type: data.type,
          candidateId: data.candidateId || IsNull(),
          employeeId: data.employeeId || IsNull(),
          jobId: data.jobId || IsNull(),
          status: InsightStatus.NEW,
        },
      });

      if (existing) {
        existing.score = data.score || existing.score;
        existing.reasoning = data.reasoning || existing.reasoning;
        existing.priority = data.priority || existing.priority;
        existing.action = data.action || existing.action;
        existing.confidence = data.confidence || existing.confidence;
        existing.departmentId = data.departmentId || existing.departmentId;
        existing.updatedAt = new Date();
        
        await this.insightRepo.save(existing);
      } else {
        const newInsight = this.insightRepo.create({
          ...data,
          status: InsightStatus.NEW,
          firstDetectedAt: new Date(),
          metadata: { history: [{ score: data.score, date: new Date() }] },
        });
        await this.insightRepo.save(newInsight);
      }
      savedCount++;
    }
    this.logger.log(`✅ Successfully saved/updated ${savedCount} insights.`);
  }

  /**
   * ✅ Returns active scout insights.
   * ABAC: HR/Admin see all. Managers see only those in their department or on their jobs.
   */
  async getScoutInsights(
    scopedJobIds: string[] = [], 
    departmentId: string | null = null,
    isManager: boolean = false
  ) {
    // ABAC: If user is a manager but has no linked jobs/dept, they see NOTHING.
    if (isManager && scopedJobIds.length === 0 && !departmentId) {
      return [];
    }

    const qb = this.insightRepo.createQueryBuilder('i')
      .where('i.status = :status', { status: InsightStatus.NEW })
      .leftJoinAndSelect('i.candidate', 'candidate')
      .leftJoinAndSelect('i.employee', 'employee')
      .leftJoinAndSelect('i.job', 'job');

    // ABAC scoping logic
    if (scopedJobIds.length > 0 || departmentId) {
      qb.andWhere(
        new (require('typeorm')).Brackets((bqb) => {
          if (scopedJobIds.length > 0) {
            bqb.orWhere('i.jobId IN (:...jobIds)', { jobIds: scopedJobIds });
          }
          if (departmentId) {
            bqb.orWhere('i.departmentId = :deptId', { deptId: departmentId });
            bqb.orWhere('employee.departmentId = :deptId', { deptId: departmentId });
          }
        })
      );
    }

    return qb.orderBy('i.priority', 'ASC')
             .addOrderBy('i.updatedAt', 'DESC')
             .getMany();
  }

  async updateInsightStatus(id: string, status: InsightStatus) {
    const insight = await this.insightRepo.findOneBy({ id });
    if (!insight) return;
    insight.status = status;
    await this.insightRepo.save(insight);
  }

  /**
   * Context-aware action handler for VIEW DOSSIER button.
   * - MATCH insights: auto-creates a draft application if needed, navigates to application dossier
   * - MOBILITY insights: navigates to employee profile
   * - RISK insights: navigates to employee profile
   */
  async actionInsight(insightId: string, userId: string): Promise<{
    navigateTo: string;
    type: 'application' | 'candidate' | 'employee';
    entityId: string;
    created?: boolean;
  }> {
    const insight = await this.insightRepo.findOne({
      where: { id: insightId },
      relations: ['candidate', 'employee', 'job'],
    });

    if (!insight) {
      throw new Error(`Insight ${insightId} not found`);
    }

    // Mark as actioned
    insight.status = InsightStatus.ACTIONED;
    await this.insightRepo.save(insight);

    // ── MATCH: External candidate → Job match ──
    if (insight.type === InsightType.MATCH && insight.candidateId && insight.jobId) {
      // Check if an application already exists
      const existing = await this.applicationRepo.findOne({
        where: { candidateId: insight.candidateId, jobId: insight.jobId },
      });

      if (existing) {
        return {
          navigateTo: `/applications/${existing.id}`,
          type: 'application',
          entityId: existing.id,
          created: false,
        };
      }

      // Auto-create a draft application
      const app = this.applicationRepo.create({
        candidateId: insight.candidateId,
        jobId: insight.jobId,
        source: 'scout_agent',
        stage: 'screening' as any,
        coverNote: `Auto-created by Astra Scout Agent. Reasoning: ${insight.reasoning}`,
      });
      const saved = await this.applicationRepo.save(app);

      this.logger.log(`📋 Auto-created application ${saved.id} for candidate ${insight.candidateId} → job ${insight.jobId}`);

      return {
        navigateTo: `/applications/${saved.id}`,
        type: 'application',
        entityId: saved.id,
        created: true,
      };
    }

    // ── MATCH without job (candidate-only) ──
    if (insight.type === InsightType.MATCH && insight.candidateId) {
      return {
        navigateTo: `/candidates/${insight.candidateId}`,
        type: 'candidate',
        entityId: insight.candidateId,
      };
    }

    // ── MOBILITY / RISK: Employee insights ──
    if (insight.employeeId) {
      return {
        navigateTo: `/employees/${insight.employeeId}`,
        type: 'employee',
        entityId: insight.employeeId,
      };
    }

    // Fallback: candidate profile
    if (insight.candidateId) {
      return {
        navigateTo: `/candidates/${insight.candidateId}`,
        type: 'candidate',
        entityId: insight.candidateId,
      };
    }

    throw new Error('Insight has no actionable target');
  }
}
