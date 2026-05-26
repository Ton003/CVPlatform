import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { Application, ApplicationStage } from './application.entity';
import { ApplicationNote } from './application-note.entity';
import { ActivityLog } from './activity-log.entity';
import { ApplicationCompetencyScore } from './application-competency-score.entity';
import {
  ApplicationAssessment,
  AssessmentStatus,
} from './entities/application-assessment.entity';
import { ApplicationAssessmentItem } from './entities/application-assessment-item.entity';

import { CandidateSnapshotService } from '../candidates/candidate-snapshot.service';
import { Task } from './entities/task.entity';
import { HiringOutcome } from './entities/hiring-outcome.entity';
import { Interview } from '../interviews/interview.entity';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { MailService } from '../mail/mail.service';
import { AiService } from '../chatbot/ai.service';
import { ConfigService } from '@nestjs/config';

const VALID_STAGES: ApplicationStage[] = [
  'applied',
  'screening',
  'interview',
  'assessment',
  'offer',
  'hired',
  'rejected',
];

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    @InjectRepository(Application)
    private readonly appRepo: Repository<Application>,
    @InjectRepository(ApplicationNote)
    private readonly noteRepo: Repository<ApplicationNote>,
    @InjectRepository(ActivityLog)
    private readonly logRepo: Repository<ActivityLog>,
    @InjectRepository(ApplicationCompetencyScore)
    private readonly compScoreRepo: Repository<ApplicationCompetencyScore>,
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Task) private readonly taskRepo: Repository<Task>,
    @InjectRepository(HiringOutcome)
    private readonly outcomeRepo: Repository<HiringOutcome>,
    @InjectRepository(ApplicationAssessment)
    private readonly assessmentRepo: Repository<ApplicationAssessment>,
    @InjectRepository(ApplicationAssessmentItem)
    private readonly assessmentItemRepo: Repository<ApplicationAssessmentItem>,
    @InjectRepository(Interview)
    private readonly interviewRepo: Repository<Interview>,
    private readonly snapshotService: CandidateSnapshotService,
    private readonly notifications: NotificationsGateway,
    private readonly mailService: MailService,
    private readonly aiService: AiService,
    private readonly configService: ConfigService,
  ) {}

  private ensureArray(val: any): string[] {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return String(val)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }

  async create(
    dto: {
      jobId: string;
      candidateId: string;
      source?: string;
      coverNote?: string;
    },
    userId: string,
  ) {
    const existing = await this.appRepo.findOne({
      where: { jobId: dto.jobId, candidateId: dto.candidateId },
    });
    if (existing)
      throw new BadRequestException(
        'Candidate has already applied to this job',
      );

    return this.createBaseApplication(
      {
        ...dto,
        stage: 'applied',
        description: `Application created via ${dto.source ?? 'manual'}`,
      },
      userId,
    );
  }

  async createApplicationFromExistingCandidate(
    candidateId: string,
    jobId: string,
    userId: string,
  ) {
    const existing = await this.appRepo.findOne({
      where: { jobId, candidateId },
    });
    if (existing)
      throw new BadRequestException(
        'Candidate is already in this job pipeline',
      );

    return this.createBaseApplication(
      {
        jobId,
        candidateId,
        source: 'manual',
        stage: 'screening',
        description: 'Added existing candidate to job pipeline',
      },
      userId,
    );
  }

  private async createBaseApplication(params: any, userId: string) {
    const app = this.appRepo.create({
      jobId: params.jobId,
      candidateId: params.candidateId,
      source: params.source ?? 'manual',
      coverNote: params.coverNote ?? null,
      stage: params.stage,
    });
    const saved = await this.appRepo.save(app);

    await this.logRepo.save(
      this.logRepo.create({
        applicationId: saved.id,
        userId,
        action: 'application_created',
        description: params.description,
        metadata: { source: params.source ?? 'manual' },
 }),
 );

 // Real-time notification
 this.notifications.emitNotification('application_created', {
      applicationId: saved.id,
      jobId: saved.jobId,
      candidateId: saved.candidateId,
    });

    return saved;
  }

  async list(filters: {
    jobId?: string;
    stage?: string;
    page: number;
    limit: number;
    scopedJobIds?: string[];
  }) {
    const { jobId, stage, page, limit, scopedJobIds } = filters;
    const qb = this.dataSource
      .createQueryBuilder()
      .select([
        'a.id AS "applicationId"',
        'a.stage AS stage',
        'a.created_at AS "createdAt"',
        'a.updated_at AS "updatedAt"',
        'c.first_name || \' \' || c.last_name AS "candidateName"',
        'c.id::text AS "candidateId"',
        'c.email AS email',
        'c.current_title AS "currentTitle"',
        'c.years_experience AS "yearsExp"',
        'j.title AS "jobTitle"',
        'a.match_score AS "compositeScore"',
        'a.source AS source',
      ])
      .from('applications', 'a')
      .leftJoin('candidates', 'c', 'c.id::text = a.candidate_id::text')
      .leftJoin('job_offers', 'j', 'j.id::text = a.job_id::text');

    if (jobId) qb.andWhere('a.job_id = :jobId::uuid', { jobId });
    if (stage) qb.andWhere('a.stage = :stage', { stage });
    else
      qb.andWhere('a.stage NOT IN (:...exclude)', {
        exclude: ['hired', 'converted'],
      });

    if (scopedJobIds && scopedJobIds.length > 0) {
      qb.andWhere('a.job_id::text IN (:...scopedIds)', { scopedIds: scopedJobIds });
    } else if (scopedJobIds && scopedJobIds.length === 0) {
      // If we are a manager but have no jobs, we MUST see nothing
      return { data: [], total: 0, page, limit };
    }

    const total = await qb.getCount();
    const rows = await qb
      .orderBy('a.created_at', 'DESC')
      .limit(limit)
      .offset((page - 1) * limit)
      .getRawMany();

    return { data: rows, total, page, limit };
  }

  async findOne(id: string) {
    const rows = await this.dataSource.query(
      `
      SELECT
        a.id AS "applicationId", a.stage, a.cover_note AS "coverNote",
        a.created_at AS "createdAt", a.updated_at AS "updatedAt",
        c.id::text AS "candidateId", c.first_name || ' ' || c.last_name AS "candidateName", 
        c.email, c.phone, c.location, c.linkedin_url AS "linkedinUrl",
        c.current_title AS "currentTitle", c.years_experience AS "yearsExp",
        a.job_id::text AS "jobId", j.title AS "jobTitle", r.department_id AS "departmentId",
        j.hiring_manager AS "hiringManagerId",
        a.match_score AS "compositeScore",
        a.source,
        c.competency_snapshot AS "competencySnapshot",
        p.skills_technical AS "skills",
        p.experience,
        p.education,
        p.llm_summary AS "summary",
        p.languages
      FROM applications a
      LEFT JOIN candidates c ON c.id::text = a.candidate_id::text
      LEFT JOIN job_offers j ON j.id::text = a.job_id::text
      LEFT JOIN job_role_levels l ON l.id = j.job_role_level_id
      LEFT JOIN job_roles r ON r.id = l."jobRoleId"
      LEFT JOIN cvs v ON v.id = (
        SELECT v2.id FROM cvs v2 
        WHERE v2.candidate_id::text = c.id::text 
        ORDER BY v2.is_primary DESC, v2.created_at DESC LIMIT 1
      )
      LEFT JOIN cv_parsed_data p ON p.cv_id::text = v.id::text
      WHERE a.id = $1::uuid LIMIT 1
    `,
      [id],
    );

    if (!rows.length)
      throw new NotFoundException('Application dossier not found');
    return rows[0];
  }

  async updateStage(id: string, newStage: string, userId: string) {
    if (!VALID_STAGES.includes(newStage as ApplicationStage))
      throw new BadRequestException(`Invalid stage: ${newStage}`);
    const app = await this.appRepo.findOne({ where: { id } });
    if (!app) throw new NotFoundException(`Application ${id} not found`);

    const oldStage = app.stage;
    app.stage = newStage as ApplicationStage;
    await this.appRepo.save(app);

    await this.logRepo.save(
      this.logRepo.create({
        applicationId: id,
        userId,
        action: 'stage_changed',
        description: `Stage changed from ${oldStage} to ${newStage}`,
 metadata: { from: oldStage, to: newStage },
 }),
 );

 // Real-time notification
 this.notifications.emitNotification('stage_changed', {
 applicationId: id,
 from: oldStage,
 to: newStage,
 });

 // Automated Emails
 try {
 const fullApp = await this.appRepo.findOne({
 where: { id },
 relations: ['candidate', 'job'],
      });

      if (
        fullApp &&
        fullApp.candidate &&
        fullApp.candidate.email &&
        fullApp.job
      ) {
        if (newStage === 'rejected') {
          await this.mailService.sendRejectionEmail(
            fullApp.candidate.email,
            `${fullApp.candidate.firstName} ${fullApp.candidate.lastName}`,
            fullApp.job.title,
          );
        } else if (['interview', 'assessment', 'offer'].includes(newStage)) {
          await this.mailService.sendApplicationStatusUpdate(
            fullApp.candidate.email,
            `${fullApp.candidate.firstName} ${fullApp.candidate.lastName}`,
            fullApp.job.title,
            newStage,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `Failed to send automated email for stage ${newStage}`,
        err,
      );
    }

    return app;
  }

  async remove(id: string) {
    const app = await this.appRepo.findOne({ where: { id } });
    if (!app) throw new NotFoundException(`Application ${id} not found`);
    await this.appRepo.remove(app);
  }

  async getActivity(applicationId: string) {
    return this.logRepo.find({
      where: { applicationId },
      order: { createdAt: 'DESC' },
    });
  }

  async getNotes(applicationId: string) {
    return this.dataSource.query(
      `
      SELECT n.id, n.note, n.rating, n.created_at AS "createdAt",
             u.id::text AS "authorId", u.first_name AS "authorFirstName", u.last_name AS "authorLastName"
      FROM application_notes n
      LEFT JOIN users u ON u.id::text = n.user_id::text
      WHERE n.application_id = $1::uuid ORDER BY n.created_at DESC
    `,
      [applicationId],
    );
  }

  async addNote(applicationId: string, dto: any, userId: string) {
    const note = await this.noteRepo.save(
      this.noteRepo.create({
        applicationId,
        userId,
        note: dto.note,
        rating: dto.rating ?? 0,
        stage: dto.stage ?? null,
      }),
    );
    return note;
  }

  async getScore(applicationId: string, headerKey?: string) {
    const appRows = await this.dataSource.query(
      `
      SELECT 
        a.id, a.match_score as "matchScore", j.description, j.snapshot,
        c.id as "candidateId", cpd.skills_technical as "candidateSkills"
      FROM applications a
      JOIN job_offers j ON j.id::text = a.job_id::text
      JOIN candidates c ON c.id::text = a.candidate_id::text
      LEFT JOIN (
        SELECT DISTINCT ON (candidate_id) * FROM cvs 
        WHERE parsing_status = 'done' ORDER BY candidate_id, created_at DESC
      ) cv ON cv.candidate_id = c.id::text
      LEFT JOIN cv_parsed_data cpd ON cpd.cv_id = cv.id::text
      WHERE a.id = $1::uuid
    `,
      [applicationId],
    );

    if (!appRows.length) throw new NotFoundException('Application not found');
    const app = appRows[0];

    const compScores = await this.compScoreRepo.find({
      where: { applicationId },
    });

    // 1. Technical Match (AI-Driven with Keyword Fallback) - 30%
    let technicalScore = app.matchScore || 0;

    // Priority: 1. Header Key (Sidebar) 2. Env Key (Admin)
    const apiKey =
      headerKey ||
      this.configService.get<string>('AI_API_KEY') ||
      this.configService.get<string>('GROQ_API_KEY');
    const candidateSkills = Array.isArray(app.candidateSkills)
      ? app.candidateSkills
      : [];

    let jobSkills: string[] = [];
    let usedAi = false;

    if (apiKey && app.description) {
      try {
        jobSkills = await this.aiService.extractJobSkills(
          app.description,
          apiKey,
        );
        usedAi = true;
      } catch (err) {
        this.logger.warn(
          `AI Scoring failed (401/error), using emergency keyword fallback: ${err.message}`,
        );
      }
    }

    // EMERGENCY FALLBACK: If AI failed or no API key, do a direct keyword scan
    if (!usedAi || jobSkills.length === 0) {
      const text = (app.description || '').toLowerCase();
      // If we don't have AI-extracted skills, we'll see how many of the candidate's skills
      // appear directly in the job description text.
      if (candidateSkills.length > 0 && text.length > 10) {
        const matches = candidateSkills.filter((s) => {
          const skill = s.toLowerCase().trim();
          if (skill.length < 2) return false;
          // Use regex to find whole word matches to avoid "Java" matching "JavaScript"
          const regex = new RegExp(
            `\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
            'i',
          );
          return regex.test(text);
        });

        // We calculate a score based on how many candidate skills matched the JD
        // capped at 100 but usually around 30-80 for a good match
        technicalScore = Math.min(
          100,
          Math.round(
            (matches.length / Math.max(5, candidateSkills.length * 0.5)) * 100,
          ),
        );

        // Ensure that if "Python" is in both, we at least get a decent base score
        if (matches.length > 0 && technicalScore < 40)
          technicalScore = 40 + matches.length * 5;
        if (technicalScore > 100) technicalScore = 100;
      }
    } else {
      // AI Success Path
      const matches = jobSkills.filter((s: string) =>
        candidateSkills.some(
          (cs: string) =>
            cs.toLowerCase().includes(s.toLowerCase()) ||
            s.toLowerCase().includes(cs.toLowerCase()),
        ),
      );
      technicalScore = Math.round((matches.length / jobSkills.length) * 100);
    }

    // 2. Evaluation (Human Competency) - 70%
    let evaluationScore = 0;
    const hasEvaluation = compScores.length > 0;
    if (hasEvaluation) {
      const sum = compScores.reduce(
        (acc, s) => acc + (s.evaluatedLevel / 5) * 100,
        0,
      );
      evaluationScore = Math.round(sum / compScores.length);
    }

    // 3. Final Weighted Calculation
    const techWeight = 30;
    const evalWeight = 70;

    let finalScore = 0;
    if (hasEvaluation) {
      finalScore = Math.round(
        technicalScore * (techWeight / 100) +
          evaluationScore * (evalWeight / 100),
      );
    } else {
      finalScore = technicalScore; // 100% Technical until evaluation starts
    }

    return {
      totalScore: finalScore,
      compositeScore: finalScore, // Support both names for legacy frontend compatibility
      breakdown: {
        technical: {
          score: technicalScore,
          weight: hasEvaluation ? techWeight : 100,
          available: true,
          label: 'AI Tech Match',
          sub: 'Skills extracted from CV vs Job Description',
        },
        evaluation: {
          score: evaluationScore,
          weight: hasEvaluation ? evalWeight : 0,
          available: hasEvaluation,
          label: 'Human Evaluation',
          sub: 'Verified ratings from competency matrix',
        },
      },
      isComplete: hasEvaluation,
    };
  }

  async getTasks(applicationId: string) {
    return this.taskRepo.find({
      where: { applicationId },
      order: { createdAt: 'DESC' },
    });
  }

  async addTask(applicationId: string, title: string) {
    return this.taskRepo.save(this.taskRepo.create({ applicationId, title }));
  }

  async recordOutcome(applicationId: string, dto: any, userId: string) {
    const app = await this.appRepo.findOne({ where: { id: applicationId } });
    if (!app) throw new NotFoundException('Application not found');

    return this.outcomeRepo.save(
      this.outcomeRepo.create({
        applicationId,
        finalStage: app.stage,
        outcome: dto.outcome,
        rejectionReason: dto.rejectionReason,
        recordedBy: userId,
      }),
    );
  }

  async getOutcome(applicationId: string) {
    const outcome = await this.outcomeRepo.findOne({
      where: { applicationId },
    });
    return outcome || null;
  }

  async getCompetencies(applicationId: string) {
    const rows = await this.compScoreRepo.find({ where: { applicationId } });
    const scores: Record<string, number> = {};
    rows.forEach((r) => {
      scores[r.competenceId] = r.evaluatedLevel;
    });
    return scores;
  }

  async updateCompetencyRating(
    applicationId: string,
    competenceId: string,
    evaluatedLevel: number,
  ) {
    let score = await this.compScoreRepo.findOne({
      where: { applicationId, competenceId },
    });
    if (score) {
      score.evaluatedLevel = evaluatedLevel;
    } else {
      score = this.compScoreRepo.create({
        applicationId,
        competenceId,
        evaluatedLevel,
      });
    }
    return this.compScoreRepo.save(score);
  }

  async getInterviews(applicationId: string) {
    return this.interviewRepo.find({
      where: { applicationId },
      order: { scheduledAt: 'DESC' },
    });
  }

  async getAssessments(applicationId: string) {
    return this.assessmentRepo.find({
      where: { applicationId },
      order: { createdAt: 'DESC' },
    });
  }

  async getAssessment(id: string) {
    const assessment = await this.assessmentRepo.findOne({
      where: { id },
      relations: ['items', 'items.competence'],
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    return assessment;
  }

  async createAssessment(applicationId: string, userId: string | null) {
    const assessment = this.assessmentRepo.create({
      applicationId,
      evaluatorId: userId,
      status: AssessmentStatus.DRAFT,
    });
    return this.assessmentRepo.save(assessment);
  }

  async updateAssessmentItems(assessmentId: string, items: any[]) {
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(ApplicationAssessmentItem, { assessmentId });
      const entities = items.map((i) =>
        manager.create(ApplicationAssessmentItem, {
          assessmentId,
          competenceId: i.competenceId,
          level: i.level,
          notes: i.notes,
        }),
      );
      await manager.save(entities);
    });
    return this.getAssessment(assessmentId);
  }

  async submitAssessment(assessmentId: string) {
    const assessment = await this.getAssessment(assessmentId);
    assessment.status = AssessmentStatus.SUBMITTED;
    assessment.submittedAt = new Date();

    await this.dataSource.transaction(async (manager) => {
      await manager.save(assessment);
      // Sync items to global competency scores
      for (const item of assessment.items) {
        if (item.level !== null) {
          await manager.upsert(
            ApplicationCompetencyScore,
            {
              applicationId: assessment.applicationId,
              competenceId: item.competenceId,
              evaluatedLevel: item.level,
              ratedBy: assessment.evaluatorId ?? undefined,
              assessmentId: assessment.id,
            },
            ['applicationId', 'competenceId'],
          );
        }
      }
    });

    return assessment;
  }
}
