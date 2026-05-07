import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository, InjectDataSource }    from '@nestjs/typeorm';
import { Repository, DataSource }                from 'typeorm';

import { ApplicationVerdict, VerdictRecommendation, VerdictConfidence,
         VerdictStrength, VerdictGap, RiskFlag, VerdictScoreBreakdown,
         GapImpact } from './entities/application-verdict.entity';
import { ScoringAuditLog }     from './entities/scoring-audit-log.entity';
import { JobCompetencyWeight }  from './entities/job-competency-weight.entity';
import { VerdictFeedback }      from './entities/verdict-feedback.entity';

@Injectable()
export class VerdictService {
  private readonly logger = new Logger(VerdictService.name);

  constructor(
    @InjectRepository(ApplicationVerdict)
    private readonly verdictRepo: Repository<ApplicationVerdict>,

    @InjectRepository(ScoringAuditLog)
    private readonly auditRepo: Repository<ScoringAuditLog>,

    @InjectRepository(JobCompetencyWeight)
    private readonly weightRepo: Repository<JobCompetencyWeight>,

    @InjectRepository(VerdictFeedback)
    private readonly feedbackRepo: Repository<VerdictFeedback>,

    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  // ── Public API ───────────────────────────────────────────────────

  /** Get cached verdict, or compute if stale/missing. */
  async getVerdict(applicationId: string): Promise<ApplicationVerdict> {
    const existing = await this.verdictRepo.findOne({ where: { applicationId } });

    // Return cached if fresh enough — upstream score triggers a refresh automatically
    if (existing) return existing;

    return this.computeAndSave(applicationId, null, 'auto');
  }

  /** Force-recompute and persist a fresh verdict. */
  async refreshVerdict(applicationId: string, triggeredBy: string): Promise<ApplicationVerdict> {
    return this.computeAndSave(applicationId, triggeredBy, 'manual_refresh');
  }

  /** Submit recruiter feedback on the verdict quality. */
  async submitFeedback(
    applicationId: string,
    reviewerId: string,
    dto: { agreed: boolean; overrideReason?: string; qualityRating?: number },
  ) {
    const verdict = await this.verdictRepo.findOne({ where: { applicationId } });
    if (!verdict) throw new NotFoundException('No verdict exists for this application yet.');

    const feedback = this.feedbackRepo.create({
      verdictId:      verdict.id,
      reviewerId,
      agreed:         dto.agreed,
      overrideReason: dto.overrideReason ?? null,
      qualityRating:  dto.qualityRating  ?? null,
    });
    return this.feedbackRepo.save(feedback);
  }

  /** Get scoring audit trail for an application. */
  async getAuditLog(applicationId: string) {
    return this.auditRepo.find({
      where: { applicationId },
      order: { computedAt: 'DESC' },
    });
  }

  // ── Core Computation ─────────────────────────────────────────────

  private async computeAndSave(
    applicationId: string,
    triggeredBy: string | null,
    trigger: string,
  ): Promise<ApplicationVerdict> {
    // ── 1. Load all required data ──────────────────────────────────
    const appRows = await this.dataSource.query(`
      SELECT
        a.candidate_id       AS "candidateId",
        a.job_id             AS "jobId",
        a.match_score        AS "existingScore",
        j.job_role_level_id  AS "jobRoleLevelId",
        c.years_experience   AS "yearsExp",
        cpd.skills_technical AS skills,
        cpd.llm_summary      AS summary
      FROM applications a
      LEFT JOIN candidates c       ON c.id::text = a.candidate_id::text
      LEFT JOIN job_offers j       ON j.id::text = a.job_id::text
      LEFT JOIN (
        SELECT DISTINCT ON (candidate_id) *
        FROM cvs WHERE parsing_status = 'done'
        ORDER BY candidate_id, created_at DESC
      ) cv ON cv.candidate_id = c.id::text
      LEFT JOIN cv_parsed_data cpd ON cpd.cv_id = cv.id::text
      WHERE a.id = $1::uuid
      LIMIT 1
    `, [applicationId]);

    if (!appRows.length) throw new NotFoundException(`Application ${applicationId} not found`);
    const app = appRows[0];

    // ── 2. Load competency requirements + candidate ratings ────────
    const compRows = await this.dataSource.query(`
      SELECT
        c.id         AS "competenceId",
        c.name       AS "name",
        f.category   AS "category",
        jcr."requiredLevel",
        COALESCE(
          (SELECT w.weight FROM job_competency_weights w
           WHERE w.job_role_level_id = jcr."jobRoleLevelId" AND w.competence_id = c.id
           LIMIT 1),
          1.0
        ) AS "weight",
        acs.evaluated_level AS "evaluatedLevel"
      FROM job_competency_requirements jcr
      JOIN competences c          ON c.id = jcr."competenceId"
      JOIN competence_families f  ON f.id = c.family_id
      LEFT JOIN application_competency_scores acs
        ON acs.competence_id = c.id AND acs.application_id = $2::uuid
      WHERE jcr."jobRoleLevelId" = $1::uuid
    `, [app.jobRoleLevelId, applicationId]);

    // ── 3. Load completed interview scores ─────────────────────────
    const interviewRows = await this.dataSource.query(`
      SELECT technical_score, communication_score
      FROM interviews
      WHERE application_id = $1::uuid AND status = 'completed'
    `, [applicationId]);

    // ── 4. Calculate component scores ─────────────────────────────
    const totalComps  = compRows.length;
    const ratedComps  = compRows.filter((r: any) => r.evaluatedLevel !== null);
    const ratedCount  = ratedComps.length;

    // Weighted competency score
    let competencyScore: number | null = null;
    if (ratedCount > 0) {
      let weightedSum   = 0;
      let weightedTotal = 0;
      for (const comp of compRows) {
        const w = parseFloat(comp.weight ?? 1.0);
        weightedTotal += w;
        if (comp.evaluatedLevel !== null) {
          const ratio = Math.min(comp.evaluatedLevel / comp.requiredLevel, 1.0);
          weightedSum += ratio * 100 * w;
        }
      }
      competencyScore = Math.round(weightedSum / weightedTotal);
    }

    // Interview score
    let interviewScore: number | null = null;
    if (interviewRows.length > 0) {
      let total = 0;
      interviewRows.forEach((r: any) => {
        total += ((r.technical_score || 0) + (r.communication_score || 0)) / 2;
      });
      interviewScore = Math.round((total / interviewRows.length / 5) * 100);
    }

    // Experience score (vs job minimum — default 3 years if not specified)
    const yearsExp       = app.yearsExp ?? 0;
    const minYears       = 3; // TODO: pull from job_role_level when added
    const experienceScore = Math.min(Math.round((yearsExp / minYears) * 100), 100);

    // ── 5. Weighted final score ────────────────────────────────────
    let w_comp = 0, w_int = 0, w_exp = 0;

    if (competencyScore !== null && interviewScore !== null) {
      w_comp = 0.65; w_int = 0.25; w_exp = 0.10;
    } else if (competencyScore !== null) {
      w_comp = 0.80; w_int = 0.00; w_exp = 0.20;
    } else if (interviewScore !== null) {
      w_comp = 0.00; w_int = 0.70; w_exp = 0.30;
    } else {
      w_comp = 0.00; w_int = 0.00; w_exp = 1.00;
    }

    const finalScore = Math.round(
      (competencyScore ?? 0) * w_comp +
      (interviewScore  ?? 0) * w_int  +
      experienceScore        * w_exp,
    );

    const scoreBreakdown: VerdictScoreBreakdown = {
      competency: competencyScore,
      interview:  interviewScore,
      experience: experienceScore,
      final:      finalScore,
      weights:    { competency: w_comp, interview: w_int, experience: w_exp },
    };

    // ── 6. Confidence ──────────────────────────────────────────────
    const coverageRatio = totalComps > 0 ? ratedCount / totalComps : 0;
    const confidence: VerdictConfidence =
      coverageRatio >= 0.75 ? 'HIGH'   :
      coverageRatio >= 0.40 ? 'MEDIUM' : 'LOW';

    // ── 7. Strengths & Gaps ────────────────────────────────────────
    const strengths: VerdictStrength[] = [];
    const gaps:      VerdictGap[]      = [];

    for (const comp of compRows) {
      const evalLevel: number | null = comp.evaluatedLevel;
      const reqLevel:  number        = comp.requiredLevel;
      const delta = evalLevel !== null ? evalLevel - reqLevel : -(reqLevel);
      const sfiaCode = comp.name.slice(0, 4).toUpperCase();
      const sfiaName = comp.name;

      if (evalLevel !== null && delta >= 0) {
        strengths.push({
          competenceId:   comp.competenceId,
          sfiaCode,
          sfiaName,
          evaluatedLevel: evalLevel,
          requiredLevel:  reqLevel,
          delta,
          reason: delta > 0
            ? `${sfiaName}: Evaluated at L${evalLevel}, exceeds the L${reqLevel} requirement by ${delta} level${delta > 1 ? 's' : ''}.`
            : `${sfiaName}: Exact match at L${evalLevel} — meets the job requirement precisely.`,
        });
      } else {
        const impact: GapImpact =
          delta <= -2 ? 'CRITICAL' :
          delta === -1 ? 'HIGH'    :
          evalLevel === null ? 'CRITICAL' : 'MEDIUM';

        gaps.push({
          competenceId:   comp.competenceId,
          sfiaCode,
          sfiaName,
          evaluatedLevel: evalLevel,
          requiredLevel:  reqLevel,
          delta,
          impact,
          reason: evalLevel === null
            ? `${sfiaName}: Not yet evaluated — required at L${reqLevel}. Unresolved gap.`
            : `${sfiaName}: Evaluated at L${evalLevel}, ${Math.abs(delta)} level${Math.abs(delta) > 1 ? 's' : ''} below the required L${reqLevel}.`,
        });
      }
    }

    // Sort: strengths by delta DESC, gaps by impact severity then delta ASC
    const impactOrder: Record<GapImpact, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    strengths.sort((a, b) => b.delta - a.delta);
    gaps.sort((a, b) => impactOrder[a.impact] - impactOrder[b.impact] || a.delta - b.delta);

    // ── 8. Risk Flags ─────────────────────────────────────────────
    const riskFlags: RiskFlag[] = [];

    if (ratedCount === 0 && totalComps > 0) {
      riskFlags.push({ code: 'NO_COMPETENCY_RATINGS', severity: 'HIGH', message: 'No competencies have been evaluated. Complete the evaluation tab for a reliable verdict.' });
    } else if (ratedCount < totalComps) {
      riskFlags.push({ code: 'INCOMPLETE_EVAL', severity: 'MEDIUM', message: `${totalComps - ratedCount} of ${totalComps} competencies are still unrated.` });
    }

    if (gaps.some(g => g.impact === 'CRITICAL')) {
      riskFlags.push({ code: 'CRITICAL_GAP', severity: 'HIGH', message: 'One or more critical competency gaps detected. These are core requirements for this role.' });
    }

    if (interviewRows.length === 0) {
      riskFlags.push({ code: 'NO_INTERVIEWS', severity: 'LOW', message: 'No completed interviews on record. Schedule an interview to strengthen the verdict.' });
    }

    if (!app.skills || app.skills.length === 0) {
      riskFlags.push({ code: 'CV_PARSE_INCOMPLETE', severity: 'MEDIUM', message: 'CV skills could not be extracted. Some scoring signals may be missing.' });
    }

    // ── 9. Recommendation ─────────────────────────────────────────
    let recommendation: VerdictRecommendation;

    if (coverageRatio < 0.40 && totalComps > 0) {
      recommendation = 'INSUFFICIENT_DATA';
    } else if (gaps.some(g => g.impact === 'CRITICAL') && finalScore < 60) {
      recommendation = 'REJECT';
    } else if (finalScore >= 78) {
      recommendation = 'ADVANCE';
    } else if (finalScore >= 60) {
      recommendation = 'INTERVIEW';
    } else if (finalScore >= 45) {
      recommendation = 'HOLD';
    } else {
      recommendation = 'REJECT';
    }

    // ── 10. Persist verdict (upsert) ──────────────────────────────
    const verdictData = {
      applicationId,
      matchScore:         finalScore,
      confidence,
      recommendation,
      strengths:          strengths.slice(0, 3),
      gaps:               gaps.slice(0, 3),
      riskFlags,
      scoreBreakdown,
      ratedCompetencies:  ratedCount,
      totalCompetencies:  totalComps,
    };

    await this.verdictRepo.upsert(verdictData, ['applicationId']);
    const saved = await this.verdictRepo.findOne({ where: { applicationId } });

    // ── 11. Write audit log ────────────────────────────────────────
    setImmediate(async () => {
      try {
        await this.auditRepo.save(this.auditRepo.create({
          applicationId,
          trigger,
          triggeredBy,
          inputsSnapshot: {
            totalComps, ratedCount, interviewCount: interviewRows.length,
            yearsExp, coverageRatio,
          },
          resultSnapshot: verdictData,
        }));
      } catch (e) {
        this.logger.warn('Failed to write scoring audit log', e);
      }
    });

    return saved!;
  }
}
