import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource }             from 'typeorm';
import { User }                               from '../users/entities/user.entity';
import { Application, ApplicationStage }      from './application.entity';
import { ApplicationNote }                    from './application-note.entity';
import { ActivityLog }                        from './activity-log.entity';
import { ApplicationCompetencyScore }         from './application-competency-score.entity';
import { ApplicationAssessment, AssessmentStatus } from './entities/application-assessment.entity';
import { ApplicationAssessmentItem }          from './entities/application-assessment-item.entity';
import { AssessmentItemUpdateDto, AssessmentUpdateDto, AssessmentSummary } from '../shared/dto/assessment.dto';



const VALID_STAGES: ApplicationStage[] = [
  'applied', 'screening', 'interview', 'assessment', 'offer', 'rejected',
];

// Role catalog for job-specific scoring
const ROLE_CATALOG: Record<string, string[]> = {
  'Frontend Developer':        ['javascript', 'typescript', 'react', 'angular', 'vue', 'html', 'css', 'tailwind', 'bootstrap'],
  'Backend Developer':         ['node', 'nodejs', 'nestjs', 'express', 'java', 'spring', 'python', 'django', 'flask', 'fastapi', 'php', 'laravel', 'sql', 'postgresql', 'mysql', 'mongodb', 'docker'],
  'Full Stack Developer':      ['javascript', 'typescript', 'react', 'angular', 'node', 'nodejs', 'sql', 'postgresql', 'docker', 'html', 'css'],
  'DevOps Engineer':           ['docker', 'kubernetes', 'jenkins', 'linux', 'ansible', 'terraform', 'aws', 'azure', 'gcp', 'bash'],
  'Data Scientist':            ['python', 'machine learning', 'deep learning', 'pandas', 'numpy', 'tensorflow', 'pytorch', 'scikit', 'sql', 'nlp'],
  'Machine Learning Engineer': ['python', 'tensorflow', 'pytorch', 'scikit', 'nlp', 'machine learning', 'deep learning', 'pandas'],
  'Mobile Developer':          ['flutter', 'dart', 'react native', 'android', 'ios', 'kotlin', 'swift', 'java'],
  'Network Engineer':          ['cisco', 'tcp/ip', 'networking', 'linux', 'firewall', 'vpn', 'ccna', 'routing'],
  'UI/UX Designer':            ['figma', 'photoshop', 'illustrator', 'ui', 'ux', 'prototyping', 'wireframing', 'css'],
  'System Administrator':      ['linux', 'ubuntu', 'windows server', 'bash', 'networking', 'docker', 'vmware', 'active directory'],
};

@Injectable()
export class ApplicationsService {

  constructor(
    @InjectRepository(Application)
    private readonly appRepo: Repository<Application>,

    @InjectRepository(ApplicationNote)
    private readonly noteRepo: Repository<ApplicationNote>,

    @InjectRepository(ActivityLog)
    private readonly logRepo: Repository<ActivityLog>,

    @InjectRepository(ApplicationCompetencyScore)
    private readonly compScoreRepo: Repository<ApplicationCompetencyScore>,

    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  private ensureArray(val: any): string[] {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        // Fallback for comma-separated strings
        return val.split(',').map(s => s.trim()).filter(Boolean);
      }
    }
    return [];
  }

  // ── Create application ───────────────────────────────────────────
  async create(dto: { jobId: string; candidateId: string; source?: string; coverNote?: string }, userId: string) {
    // Check for duplicate application
    const existing = await this.appRepo.findOne({
      where: { jobId: dto.jobId, candidateId: dto.candidateId },
    });
    if (existing) throw new BadRequestException('Candidate has already applied to this job');

    const app = this.appRepo.create({
      jobId:       dto.jobId,
      candidateId: dto.candidateId,
      source:      dto.source ?? 'manual',
      coverNote:   dto.coverNote ?? null,
      stage:       'applied',
    });
    const saved = await this.appRepo.save(app);

    // Log activity
    await this.logRepo.save(this.logRepo.create({
      applicationId: saved.id,
      userId,
      action:   'application_created',
      description: `Application created via ${dto.source ?? 'manual'}`,
      metadata: { source: dto.source ?? 'manual' },
    }));

    return saved;
  }

  // ── Create application from existing candidate ───────────────────
  async createApplicationFromExistingCandidate(candidateId: string, jobId: string, userId: string) {
    const existing = await this.appRepo.findOne({
      where: { jobId, candidateId },
    });
    if (existing) throw new BadRequestException('Candidate is already in this job pipeline');

    const app = this.appRepo.create({
      jobId,
      candidateId,
      source: 'manual',
      stage: 'screening',
    });
    const saved = await this.appRepo.save(app);

    // Log activity
    await this.logRepo.save(this.logRepo.create({
      applicationId: saved.id,
      userId,
      action: 'application_created',
      description: `Added existing candidate to job pipeline`,
      metadata: { source: 'manual' },
    }));

    return saved;
  }

  // ── List applications ────────────────────────────────────────────
  async list(filters: { jobId?: string; stage?: string; page: number; limit: number }) {
    const { jobId, stage, page, limit } = filters;

    const qb = this.dataSource.createQueryBuilder()
      .select([
        'a.id                                            AS "applicationId"',
        'a.stage                                         AS stage',
        'a.source                                        AS source',
        'a.created_at                                    AS "createdAt"',
        'a.updated_at                                    AS "updatedAt"',
        `CONCAT(c.first_name, ' ', c.last_name)          AS "candidateName"`,
        'c.id::text                                      AS "candidateId"',
        'c.email                                         AS email',
        'c.current_title                                 AS "currentTitle"',
        'c.location                                      AS location',
        'c.years_experience                              AS "yearsExp"',
        'j.title                                         AS "jobTitle"',
        'j.id::text                                      AS "jobId"',
        'cpd.skills_technical                            AS skills',
      ])
      .from('applications', 'a')
      .leftJoin('candidates', 'c', 'c.id::text = a.candidate_id::text')
      .leftJoin('job_offers', 'j', 'j.id::text = a.job_id::text')
      .leftJoin(qb => {
        return qb
          .select('*')
          .from('cvs', 'cv_inner')
          .where('cv_inner.parsing_status = :status', { status: 'done' })
          .distinctOn(['cv_inner.candidate_id'])
          .orderBy('cv_inner.candidate_id')
          .addOrderBy('cv_inner.created_at', 'DESC');
      }, 'cv', 'cv.candidate_id = c.id::text')
      .leftJoin('cv_parsed_data', 'cpd', 'cpd.cv_id = cv.id::text');

    if (jobId)  qb.andWhere('a.job_id = :jobId::uuid',   { jobId });
    if (stage)  qb.andWhere('a.stage = :stage',          { stage });

    const total = await qb.getCount();
    const rows  = await qb
      .orderBy('a.created_at', 'DESC')
      .limit(limit)
      .offset((page - 1) * limit)
      .getRawMany();

    // Enrich rows with score
    const enrichedRows = await Promise.all(
      rows.map(async (row) => {
        try {
          const scoreData = await this.getScore(row.applicationId);
          return { ...row, compositeScore: scoreData?.totalScore || null };
        } catch (err) {
          // Fallback if getScore fails for some incomplete applications
          return { ...row, compositeScore: null };
        }
      })
    );

    return { data: enrichedRows, total, page, limit };
  }

  // ── Find one application (full detail) ───────────────────────────
  async findOne(id: string) {
    const rows = await this.dataSource.query(`
      SELECT
        a.id                                            AS "applicationId",
        a.stage,
        a.source,
        a.cover_note                                    AS "coverNote",
        a.created_at                                    AS "createdAt",
        a.updated_at                                    AS "updatedAt",
        c.id::text                                      AS "candidateId",
        CONCAT(c.first_name, ' ', c.last_name)          AS "candidateName",
        c.email,
        c.location,
        c.current_title                                 AS "currentTitle",
        c.years_experience                              AS "yearsExp",
        j.id::text                                      AS "jobId",
        j.title                                         AS "jobTitle",
        j.description                                   AS "jobDescription",
        '[]'::jsonb                                     AS "requiredSkills",
        j.status                                        AS "jobStatus",
        cpd.skills_technical                            AS skills,
        cpd.llm_summary                                 AS summary,
        cpd.education,
        cpd.experience,
        cpd.languages
      FROM applications a
      LEFT JOIN candidates c       ON c.id::text = a.candidate_id::text
      LEFT JOIN job_offers j       ON j.id::text = a.job_id::text
      LEFT JOIN (
        SELECT DISTINCT ON (candidate_id) *
        FROM cvs
        WHERE parsing_status = 'done'
        ORDER BY candidate_id, created_at DESC
      ) cv ON cv.candidate_id = c.id::text
      LEFT JOIN cv_parsed_data cpd ON cpd.cv_id = cv.id::text
      WHERE a.id = $1::uuid
      LIMIT 1
    `, [id]);

    if (!rows.length) throw new NotFoundException(`Application ${id} not found`);
    return rows[0];
  }

  // ── Update stage ─────────────────────────────────────────────────
  async updateStage(id: string, newStage: string, userId: string) {
    if (!VALID_STAGES.includes(newStage as ApplicationStage)) {
      throw new BadRequestException(`Invalid stage: ${newStage}`);
    }

    const app = await this.appRepo.findOne({ where: { id } });
    if (!app) throw new NotFoundException(`Application ${id} not found`);

    const oldStage = app.stage;
    app.stage = newStage as ApplicationStage;
    await this.appRepo.save(app);

    // Log stage change
    await this.logRepo.save(this.logRepo.create({
      applicationId: id,
      userId,
      action:   'stage_changed',
      description: `Stage changed from ${oldStage} to ${newStage}`,
      metadata: { from: oldStage, to: newStage },
    }));

    return app;
  }

  // ── Remove application ───────────────────────────────────────────
  async remove(id: string) {
    const app = await this.appRepo.findOne({ where: { id } });
    if (!app) throw new NotFoundException(`Application ${id} not found`);
    await this.appRepo.remove(app);
  }

  // ── Get notes for application ────────────────────────────────────
  async getNotes(applicationId: string) {
    const rows = await this.dataSource.query(`
      SELECT
        n.id,
        n.note,
        n.rating,
        n.stage,
        n.created_at  AS "createdAt",
        u.id::text    AS "authorId",
        CONCAT(u.first_name, ' ', u.last_name) AS "authorName",
        u.role        AS "authorRole"
      FROM application_notes n
      LEFT JOIN users u ON u.id::text = n.user_id::text
      WHERE n.application_id = $1::uuid
      ORDER BY n.created_at DESC
    `, [applicationId]);

    return rows.map((r: any) => ({
      id:        r.id,
      note:      r.note,
      rating:    r.rating,
      stage:     r.stage,
      createdAt: r.createdAt,
      author: {
        id:   r.authorId,
        name: r.authorName?.trim() ?? 'Unknown',
        role: r.authorRole ?? 'hr',
      },
    }));
  }

  // ── Add note ─────────────────────────────────────────────────────
  async addNote(
    applicationId: string,
    dto: { note: string; rating?: number; stage?: string },
    userId: string,
  ) {
    const app = await this.appRepo.findOne({ where: { id: applicationId } });
    if (!app) throw new NotFoundException(`Application ${applicationId} not found`);

    const note = await this.noteRepo.save(this.noteRepo.create({
      applicationId,
      userId,
      note:   dto.note,
      rating: dto.rating ?? 0,
      stage:  dto.stage  ?? null,
    }));

    // Log activity
    await this.logRepo.save(this.logRepo.create({
      applicationId,
      userId,
      action:   'note_added',
      description: `Added a note with ${dto.rating ?? 0}-star rating`,
      metadata: { rating: dto.rating ?? 0 },
    }));

    // Return with author info
    const rows = await this.dataSource.query(`
      SELECT
        CONCAT(u.first_name, ' ', u.last_name) AS name,
        u.role
      FROM users u WHERE u.id = $1::uuid LIMIT 1
    `, [userId]);

    const user = rows[0];
    return {
      id:        note.id,
      note:      note.note,
      rating:    note.rating,
      stage:     note.stage,
      createdAt: note.createdAt,
      author: {
        id:   userId,
        name: user?.name?.trim() ?? 'Unknown',
        role: user?.role ?? 'hr',
      },
    };
  }

  // ── Get activity log ─────────────────────────────────────────────
  async getActivity(applicationId: string) {
    const rows = await this.dataSource.query(`
      SELECT
        l.id,
        l.action,
        l.metadata,
        l.created_at AS "createdAt",
        CONCAT(u.first_name, ' ', u.last_name) AS "userName",
        u.role AS "userRole"
      FROM activity_log l
      LEFT JOIN users u ON u.id::text = l.user_id::text
      WHERE l.application_id = $1::uuid
      ORDER BY l.created_at DESC
    `, [applicationId]);

    return rows;
  }

  // ── Get score (Competency-Rating First) ────────────────────────
  async getScore(applicationId: string) {
    // 1. Fetch application + job context
    const rows = await this.dataSource.query(`
      SELECT
        j.id                 AS "jobId",
        j.job_role_level_id  AS "jobRoleLevelId",
        a.candidate_id       AS "candidateId",
        cpd.skills_technical AS skills,
        COALESCE(j.snapshot->'skills', '[]'::jsonb) AS "requiredSkills",
        j.title              AS "jobTitle"
      FROM applications a
      LEFT JOIN candidates c       ON c.id::text = a.candidate_id::text
      LEFT JOIN (
        SELECT DISTINCT ON (candidate_id) *
        FROM cvs
        WHERE parsing_status = 'done'
        ORDER BY candidate_id, created_at DESC
      ) cv ON cv.candidate_id = c.id::text
      LEFT JOIN cv_parsed_data cpd ON cpd.cv_id = cv.id::text
      LEFT JOIN job_offers j       ON j.id::text = a.job_id::text
      WHERE a.id = $1::uuid
      LIMIT 1
    `, [applicationId]);

    if (!rows.length) throw new NotFoundException(`Application ${applicationId} not found`);

    const appData = rows[0];
    const candidateSkills: string[] = this.ensureArray(appData.skills);
    const jobSkillsList: string[]   = this.ensureArray(appData.requiredSkills);

    // ── A. Fetch ALL job competency requirements + any existing ratings ──
    const compRows = await this.dataSource.query(`
      SELECT
        jcr."requiredLevel",
        c.id   AS "competenceId",
        c.name,
        f.category,
        acs.evaluated_level AS "evaluatedLevel"
      FROM job_competency_requirements jcr
      JOIN competences c         ON c.id = jcr."competenceId"
      JOIN competence_families f ON f.id = c.family_id
      LEFT JOIN application_competency_scores acs
        ON acs.competence_id = c.id AND acs.application_id = $2::uuid
      WHERE jcr."jobRoleLevelId" = $1::uuid
    `, [appData.jobRoleLevelId, applicationId]);

    const totalRequirements = compRows.length;
    const ratedRows = compRows.filter((r: any) => r.evaluatedLevel !== null && r.evaluatedLevel !== undefined);
    const ratedCount = ratedRows.length;

    // ── B. Competency Score (Primary — 100% of final score when ratings exist) ──
    let competencyScore: number | null = null;
    let isComplete = false;

    if (ratedCount > 0) {
      let totalPct = 0;
      for (const req of compRows) {
        // Unrated items contribute 0; penalises incomplete evaluations fairly
        if (req.evaluatedLevel !== null && req.evaluatedLevel !== undefined) {
          totalPct += Math.min(req.evaluatedLevel / req.requiredLevel, 1.0) * 100;
        }
      }
      competencyScore = Math.round(totalPct / totalRequirements);
      isComplete = ratedCount === totalRequirements;
    }

    // ── C. Per-category breakdown (informational) ───────────────────
    const calcCategory = (cat: string) => {
      const items = compRows.filter((c: any) => c.category === cat);
      if (!items.length) return null;
      const rated = items.filter((c: any) => c.evaluatedLevel !== null && c.evaluatedLevel !== undefined);
      if (!rated.length) return null;
      const total = items.reduce((sum: number, it: any) => {
        if (it.evaluatedLevel !== null && it.evaluatedLevel !== undefined) {
          return sum + Math.min(it.evaluatedLevel / it.requiredLevel, 1.0) * 100;
        }
        return sum;
      }, 0);
      return Math.round(total / items.length);
    };

    const techScore       = calcCategory('TECHNICAL');
    const behavioralScore = calcCategory('BEHAVIORAL');
    const managerialScore = calcCategory('MANAGERIAL');

    // ── D. Interview scores (informational — displayed but not in composite) ──
    const interviewRows = await this.dataSource.query(`
      SELECT technical_score, communication_score
      FROM interviews
      WHERE application_id = $1::uuid AND status = 'completed'
    `, [applicationId]);

    let interviewScore: number | null = null;
    if (interviewRows.length > 0) {
      let totalPoints = 0;
      interviewRows.forEach((r: any) => {
        const avg = ((r.technical_score || 0) + (r.communication_score || 0)) / 2;
        totalPoints += (avg / 5) * 100;
      });
      interviewScore = Math.round(totalPoints / interviewRows.length);
    }

    // ── E. Final Score ──────────────────────────────────────────────
    // Competency ratings = 100% weight. Fall back to interview score if no ratings yet.
    let finalScore: number;
    if (competencyScore !== null) {
      finalScore = competencyScore;
    } else if (interviewScore !== null) {
      finalScore = interviewScore;
    } else {
      finalScore = 0;
    }

    // ── F. Explanation ──────────────────────────────────────────────
    const strengths: string[] = [];
    const risks: string[] = [];

    if (techScore !== null && techScore >= 80) strengths.push(`Strong technical fit (${techScore}%)`);
    if (behavioralScore !== null && behavioralScore >= 80) strengths.push(`Excellent behavioral alignment`);
    if (interviewScore !== null && interviewScore >= 80) strengths.push(`Outstanding interview performance`);
    if (ratedCount === 0 && totalRequirements > 0) risks.push(`No competency ratings yet — use the Evaluation tab to rate this candidate`);
    if (ratedCount > 0 && !isComplete) risks.push(`${totalRequirements - ratedCount} of ${totalRequirements} competencies still unrated`);
    if (techScore !== null && techScore < 50) risks.push(`Significant technical gap detected`);

    const result = {
      totalScore: finalScore,
      isComplete,
      ratedCount,
      totalRequirements,
      breakdown: {
        technical:   { score: techScore,       available: techScore !== null },
        behavioral:  { score: behavioralScore, available: behavioralScore !== null },
        managerial:  { score: managerialScore, available: managerialScore !== null },
        interview:   { score: interviewScore,  available: interviewScore !== null },
      },
      explanation: {
        strengths: strengths.slice(0, 3),
        risks:     risks.slice(0, 3),
      },
      matchedSkills: jobSkillsList.filter(js => candidateSkills.some(cs => cs.includes(js) || js.includes(cs))),
      missingSkills: jobSkillsList.filter(js => !candidateSkills.some(cs => cs.includes(js) || js.includes(cs))),
    };

    await this.appRepo.update(applicationId, { matchScore: finalScore });

    return result;
  }

  // ── Remove note ──────────────────────────────────────────────────
  async removeNote(applicationId: string, noteId: string, userId: string) {
    const note = await this.noteRepo.findOne({
      where: { id: noteId, applicationId },
    });
    if (!note) throw new NotFoundException(`Note ${noteId} not found`);

    // In a production app, we would verify note.userId === userId OR user.role === 'admin'
    // For now, we will allow the deletion if the note exists for this application.
    
    await this.noteRepo.remove(note);

    // Log activity
    await this.logRepo.save(this.logRepo.create({
      applicationId,
      userId,
      action:   'note_deleted',
      metadata: { noteId, rating: note.rating },
    }));
  }

  // ── Competency Ratings ───────────────────────────────────────────
  async updateCompetencyScore(appId: string, compId: string, level: number, userId: string) {
    if (level < 1 || level > 5) throw new BadRequestException('Level must be between 1 and 5');

    // Upsert logic
    const app = await this.appRepo.findOne({ where: { id: appId }, relations: ['job'] });
    const reqs = await this.dataSource.query(
      `SELECT "requiredLevel" FROM job_competency_requirements
       WHERE "jobRoleLevelId" = $1 AND "competenceId" = $2`,
      [app?.job?.jobRoleLevelId, compId]
    );

    const expectedLevel = reqs.length > 0 ? reqs[0].requiredLevel : null;
    const gap = expectedLevel !== null ? level - expectedLevel : null;

    const existing = await this.compScoreRepo.findOne({ 
      where: { applicationId: appId, competenceId: compId } 
    });

    if (existing) {
      existing.evaluatedLevel = level;
      existing.expectedLevel = expectedLevel;
      existing.gap = gap;
      existing.ratedBy = userId;
      await this.compScoreRepo.save(existing);
    } else {
      await this.compScoreRepo.save(this.compScoreRepo.create({
        applicationId: appId,
        competenceId: compId,
        evaluatedLevel: level,
        expectedLevel: expectedLevel,
        gap: gap,
        ratedBy: userId,
      }));
    }

    // Log Activity
    await this.logRepo.save(this.logRepo.create({
      applicationId: appId,
      userId,
      action: 'competency_rated',
      description: `Rated a competency at level ${level}`,
      metadata: { competencyId: compId, evaluatedLevel: level },
    }));
  }

  async getCompetencyScores(appId: string) {
    const rows = await this.dataSource.query(`
      SELECT competence_id AS "competenceId", evaluated_level AS "evaluatedLevel"
      FROM application_competency_scores
      WHERE application_id = $1::uuid
    `, [appId]);
    
    const map: Record<string, number> = {};
    rows.forEach((r: any) => { map[r.competenceId] = r.evaluatedLevel; });
    return map;
  }

  // ── Recruitment Assessment Lifecycle (Phases 1-7) ───────────────

  async createAssessmentDraft(applicationId: string, userId: string) {
    await this.verifyReviewerAccess(applicationId, userId);

    const existingDraft = await this.dataSource.getRepository(ApplicationAssessment).findOne({
      where: { applicationId, evaluatorId: userId, status: AssessmentStatus.DRAFT }
    });
    if (existingDraft) return this.enrichAssessment(existingDraft);

    const draft = this.dataSource.getRepository(ApplicationAssessment).create({
      applicationId,
      evaluatorId: userId,
      status: AssessmentStatus.DRAFT
    });
    const saved = await this.dataSource.getRepository(ApplicationAssessment).save(draft);
    return this.enrichAssessment(saved);
  }

  async getAssessment(id: string) {
    const assessment = await this.dataSource.getRepository(ApplicationAssessment).findOne({
      where: { id },
      relations: ['items', 'items.competence']
    });
    if (!assessment) throw new NotFoundException(`Assessment ${id} not found`);
    return this.enrichAssessment(assessment);
  }

  async updateAssessment(id: string, dto: AssessmentUpdateDto, userId: string) {
    const assessment = await this.dataSource.getRepository(ApplicationAssessment).findOne({ where: { id } });
    if (!assessment) throw new NotFoundException(`Assessment ${id} not found`);
    if (assessment.status !== AssessmentStatus.DRAFT) throw new BadRequestException('Cannot edit a submitted assessment');
    if (assessment.evaluatorId !== userId) throw new ForbiddenException('Only the evaluator can edit this draft');

    Object.assign(assessment, dto);
    await this.dataSource.getRepository(ApplicationAssessment).save(assessment);
    return assessment;
  }

  async updateAssessmentItems(assessmentId: string, items: AssessmentItemUpdateDto[], userId: string) {
    const assessment = await this.dataSource.getRepository(ApplicationAssessment).findOne({ where: { id: assessmentId } });
    if (!assessment) throw new NotFoundException(`Assessment ${assessmentId} not found`);
    if (assessment.status !== AssessmentStatus.DRAFT) throw new BadRequestException('Cannot edit a submitted assessment');
    if (assessment.evaluatorId !== userId) throw new ForbiddenException('Only the evaluator can edit this draft');

    for (const item of items) {
      await this.dataSource.getRepository(ApplicationAssessmentItem).upsert({
        assessmentId,
        competenceId: item.competenceId,
        level: item.level,
        notes: item.notes
      }, ['assessmentId', 'competenceId']);
    }

    return this.getAssessment(assessmentId);
  }

  async submitAssessment(id: string, userId: string) {
    return this.dataSource.transaction(async (manager) => {
      const assessment = await manager.findOne(ApplicationAssessment, {
        where: { id },
        relations: ['items', 'items.competence', 'application', 'application.job']
      });

      if (!assessment) throw new NotFoundException(`Assessment ${id} not found`);
      if (assessment.status !== AssessmentStatus.DRAFT) throw new BadRequestException('Assessment already submitted');
      if (assessment.evaluatorId !== userId) throw new ForbiddenException('Only the evaluator can submit this assessment');

      const assessedItems = assessment.items.filter(it => it.level !== null);
      if (assessedItems.length === 0) throw new BadRequestException('Cannot submit an empty assessment');

      const snapshot = assessment.application?.job?.snapshot || {};
      const requirements = snapshot.competencies || [];
      const reqMap: Record<string, number> = {};
      requirements.forEach((r: any) => { reqMap[r.name] = r.requiredLevel; });

      // cleanup previous assessments (traceability preserved)
      await manager.query(
        `DELETE FROM application_competency_scores WHERE application_id = $1 AND assessment_id IS NOT NULL`,
        [assessment.applicationId]
      );

      for (const item of assessedItems) {
        const requiredLevel = reqMap[item.competence.name] || 1;
        const normalizedScore = Math.min((item.level || 0) / requiredLevel, 1);
        const weightedScore = normalizedScore * 100; 

        await manager.save(ApplicationCompetencyScore, manager.create(ApplicationCompetencyScore, {
          applicationId: assessment.applicationId,
          competenceId: item.competenceId,
          evaluatedLevel: item.level!,
          expectedLevel: requiredLevel,
          gap: (item.level || 0) - requiredLevel,
          ratedBy: userId,
          assessmentId: assessment.id,
          normalizedScore,
          weightedScore
        }));
      }

      assessment.status = AssessmentStatus.SUBMITTED;
      assessment.submittedAt = new Date();
      await manager.save(assessment);

      await this.getScore(assessment.applicationId);

      return this.enrichAssessment(assessment);
    });
  }

  private async verifyReviewerAccess(applicationId: string, userId: string) {
    const user = await this.dataSource.getRepository(User).findOne({ where: { id: userId } });
    if (!user) throw new ForbiddenException('User not found');
    if (['admin', 'hr'].includes(user.role)) return;

    const rows = await this.dataSource.query(`
      SELECT j.hiring_manager FROM applications a
      JOIN job_offers j ON j.id = a.job_id
      WHERE a.id = $1::uuid
    `, [applicationId]);

    if (rows.length > 0 && rows[0].hiring_manager === userId) return;

    throw new ForbiddenException('You do not have permission to evaluate this candidate');
  }

  private enrichAssessment(assessment: any) {
    const items = assessment.items || [];
    const assessed = items.filter((it: any) => it.level !== null);
    
    const summary: AssessmentSummary = {
      totalCompetencies: items.length,
      assessedCount: assessed.length,
      completionRate: items.length > 0 ? Math.round((assessed.length / items.length) * 100) : 0,
      averageScore: assessed.length > 0 
        ? Math.round(assessed.reduce((s: number, i: any) => s + (i.level || 0), 0) / assessed.length * 20) 
        : undefined
    };

    return { ...assessment, summary };
  }
}

