import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Employee } from '../../employees/entities/employee.entity';
import { Candidate } from '../../candidates/entities/candidates.entity';
import { JobOffer } from '../../job-offers/job-offer.entity';
import { EmployeeCompetency } from '../../employees/entities/employee-competency.entity';
import { JobRoleLevel } from '../../job-architecture/entities/job-role-level.entity';
import { CompetenceCategory } from '../../competence-management/entities/family.entity';

import {
  GapAction,
  GapItem,
  DevelopmentPlan,
} from '../../employees/dto/gap-analysis.dto';

export interface PillarScore {
  score: number | null;
  weight: number;
  available: boolean;
}

export interface UnifiedScoreResult {
  totalScore: number;
  isComplete: boolean;
  breakdown: {
    technical: PillarScore;
    behavioral: PillarScore;
    interview: PillarScore;
    managerial: PillarScore;
  };
  matchedCompetencies?: Array<{
    competenceId: string;
    name: string;
    sfiaCode: string;
    employeeLevel: number;
    requiredLevel: number;
    delta: number;
  }>;
  gapCompetencies?: Array<{
    competenceId: string;
    name: string;
    sfiaCode: string;
    employeeLevel: number | null;
    requiredLevel: number;
    delta: number;
    impact: string;
  }>;
  readinessLabel?: 'READY' | 'NEAR_READY' | 'DEVELOPING' | 'NOT_READY';
  readinessSummary?: string;
  suggestedAction?:
    | 'promotion_ready'
    | 'near_ready'
    | 'requires_training'
    | 'not_suitable';
}

@Injectable()
export class UnifiedScoringService {
  constructor(
    @InjectRepository(JobOffer)
    private readonly offerRepo: Repository<JobOffer>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(Candidate)
    private readonly candidateRepo: Repository<Candidate>,
    @InjectRepository(JobRoleLevel)
    private readonly levelRepo: Repository<JobRoleLevel>,
    private readonly dataSource: DataSource,
  ) {}

  async scoreEmployee(
    employeeId: string,
    offerId: string,
  ): Promise<UnifiedScoreResult> {
    const offer = await this.offerRepo.findOne({
      where: { id: offerId },
      relations: [
        'jobRoleLevel',
        'jobRoleLevel.competencyRequirements',
        'jobRoleLevel.competencyRequirements.competence',
        'jobRoleLevel.competencyRequirements.competence.family',
      ],
    });
    if (!offer) throw new NotFoundException(`Job Offer ${offerId} not found`);

    const employee = await this.employeeRepo.findOne({
      where: { id: employeeId },
      relations: [
        'competencies',
        'competencies.competence',
        'competencies.competence.family',
      ],
    });
    if (!employee)
      throw new NotFoundException(`Employee ${employeeId} not found`);

    return this.calculateMatch(employee, offer);
  }

  async getGapAnalysis(employeeId: string, levelId: string) {
    const employee = await this.employeeRepo.findOne({
      where: { id: employeeId },
      relations: [
        'competencies',
        'competencies.competence',
        'competencies.competence.family',
      ],
    });
    const level = await this.levelRepo.findOne({
      where: { id: levelId },
      relations: [
        'competencyRequirements',
        'competencyRequirements.competence',
        'competencyRequirements.competence.family',
      ],
    });

    if (!employee || !level)
      throw new NotFoundException('Employee or Job Level not found');

    const gaps: GapItem[] = level.competencyRequirements.map((req) => {
      const empComp = employee.competencies.find(
        (c) => c.competenceId === req.competenceId,
      );
      const currentLevel = empComp?.currentLevel || 0;

      let mappedCategory: 'technical' | 'behavioral' | 'managerial' =
        'technical';
      if (req.competence.family.category === CompetenceCategory.BEHAVIORAL)
        mappedCategory = 'behavioral';
      if (req.competence.family.category === CompetenceCategory.MANAGERIAL)
        mappedCategory = 'managerial';

      return {
        competencyId: req.competenceId,
        name: req.competence.name,
        category: mappedCategory,
        currentLevel,
        requiredLevel: req.requiredLevel,
        gap: currentLevel - req.requiredLevel,
      };
    });

    const priorityGaps = gaps
      .filter((g) => g.gap < 0)
      .sort((a, b) => a.gap - b.gap);

    // Provide a suggested action based on total gap score
    const totalGapScore = gaps.reduce(
      (sum, g) => sum + (g.gap < 0 ? g.gap : 0),
      0,
    );
    let suggestedAction = GapAction.NOT_SUITABLE;
    if (totalGapScore === 0) suggestedAction = GapAction.PROMOTION_READY;
    else if (totalGapScore >= -2) suggestedAction = GapAction.NEAR_READY;
    else if (totalGapScore >= -5) suggestedAction = GapAction.REQUIRES_TRAINING;

    return {
      title: `Gap Analysis: ${employee.firstName} vs ${level.title}`,
      gaps,
      priorityGaps,
      suggestedAction,
      summary: {
        totalRequirements: gaps.length,
        metCount: gaps.filter((g) => g.gap >= 0).length,
        gapCount: priorityGaps.length,
      },
    };
  }

  async getOfferMatches(offerId: string, minScore: number = 0) {
    const offer = await this.offerRepo.findOne({
      where: { id: offerId },
      relations: [
        'jobRoleLevel',
        'jobRoleLevel.competencyRequirements',
        'jobRoleLevel.competencyRequirements.competence',
        'jobRoleLevel.competencyRequirements.competence.family',
      ],
    });
    if (!offer) throw new NotFoundException(`Job Offer ${offerId} not found`);

    const employees = await this.employeeRepo.find({
      relations: [
        'competencies',
        'competencies.competence',
        'competencies.competence.family',
        'jobRoleLevel',
      ],
    });

    const results = employees.map((emp) => {
      const score = this.calculateMatch(emp, offer);
      return {
        uuid: emp.id,
        firstName: emp.firstName || (emp as any).first_name || 'Employee',
        lastName: emp.lastName || (emp as any).last_name || '',
        currentRank:
          emp.jobRoleLevel?.title || (emp as any).current_title || 'Staff',
        ...score,
      };
    });

    return results
      .filter((r) => r.totalScore >= minScore)
      .sort((a, b) => b.totalScore - a.totalScore);
  }

  private calculateMatch(
    employee: Employee,
    offer: JobOffer,
  ): UnifiedScoreResult {
    const requirements = offer.jobRoleLevel?.competencyRequirements || [];

    const techScore = this.calculateCompetencyScore(
      employee.competencies,
      requirements,
      CompetenceCategory.TECHNICAL,
    );
    const behavioralScore = this.calculateCompetencyScore(
      employee.competencies,
      requirements,
      CompetenceCategory.BEHAVIORAL,
    );
    const managerialScore = this.calculateCompetencyScore(
      employee.competencies,
      requirements,
      CompetenceCategory.MANAGERIAL,
    );
    const interviewScore = null;

    const baseComposite = this.calculateFinalComposite({
      technical: techScore,
      behavioral: behavioralScore,
      interview: interviewScore,
      managerial: managerialScore,
    });

    const matchedCompetencies: any[] = [];
    const gapCompetencies: any[] = [];

    for (const req of requirements) {
      const empComp = employee.competencies.find(
        (c) => c.competenceId === req.competenceId,
      );
      const evalLevel = empComp?.currentLevel ?? null;
      const reqLevel = req.requiredLevel;
      const delta = evalLevel !== null ? evalLevel - reqLevel : -reqLevel;

      const compInfo = {
        competenceId: req.competenceId,
        name: req.competence?.name || '',
        sfiaCode:
          (req.competence as any)?.code ||
          req.competence?.name?.substring(0, 4).toUpperCase() ||
          '',
        employeeLevel: evalLevel,
        requiredLevel: reqLevel,
        delta,
      };

      if (evalLevel !== null && delta >= 0) {
        matchedCompetencies.push(compInfo);
      } else {
        let impact = 'MEDIUM';
        if (delta <= -2) impact = 'CRITICAL';
        else if (delta === -1) impact = 'HIGH';
        else if (evalLevel === null) impact = 'CRITICAL';

        gapCompetencies.push({ ...compInfo, impact });
      }
    }

    matchedCompetencies.sort((a, b) => b.delta - a.delta);

    const impactOrder: any = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    gapCompetencies.sort(
      (a, b) =>
        impactOrder[a.impact] - impactOrder[b.impact] || a.delta - b.delta,
    );

    let readinessLabel: 'READY' | 'NEAR_READY' | 'DEVELOPING' | 'NOT_READY';
    if (baseComposite.totalScore >= 85) readinessLabel = 'READY';
    else if (baseComposite.totalScore >= 65) readinessLabel = 'NEAR_READY';
    else if (baseComposite.totalScore >= 45) readinessLabel = 'DEVELOPING';
    else readinessLabel = 'NOT_READY';

    const summaryMap = {
      READY: 'Fully meets requirements for promotion.',
      NEAR_READY: 'Close to being ready, minor gaps to close.',
      DEVELOPING:
        'Developing towards this role. Needs more experience and training.',
      NOT_READY: 'Significant gaps detected. Not suitable at this time.',
    };

    const suggestedActionMap: Record<
      string,
      'promotion_ready' | 'near_ready' | 'requires_training' | 'not_suitable'
    > = {
      READY: 'promotion_ready',
      NEAR_READY: 'near_ready',
      DEVELOPING: 'requires_training',
      NOT_READY: 'not_suitable',
    };

    return {
      ...baseComposite,
      matchedCompetencies,
      gapCompetencies,
      readinessLabel,
      readinessSummary: summaryMap[readinessLabel],
      suggestedAction: suggestedActionMap[readinessLabel],
    };
  }

  private calculateCompetencyScore(
    current: EmployeeCompetency[],
    requirements: any[],
    category: CompetenceCategory,
  ): number | null {
    const targetReqs = requirements.filter(
      (r) => r.competence?.family?.category === category,
    );
    if (targetReqs.length === 0) return null;

    let totalPct = 0;
    let matchCount = 0;

    for (const req of targetReqs) {
      const empComp = current.find((c) => c.competenceId === req.competenceId);
      if (empComp) {
        const ratio = Math.min(empComp.currentLevel / req.requiredLevel, 1.0);
        totalPct += ratio * 100;
        matchCount++;
      }
    }

    return targetReqs.length > 0
      ? Math.round(totalPct / targetReqs.length)
      : null;
  }

  private calculateFinalComposite(
    pillars: Record<string, number | null>,
  ): UnifiedScoreResult {
    let sum = 0;
    let count = 0;

    const breakdown: any = {};
    const pillarMap = {
      technical: pillars.technical,
      behavioral: pillars.behavioral,
      interview: pillars.interview,
      managerial: pillars.managerial,
    };

    for (const [key, score] of Object.entries(pillarMap)) {
      breakdown[key] = { score, weight: 0, available: score !== null }; // Weights 0 as they are purged
      if (score !== null) {
        sum += score;
        count++;
      }
    }

    const totalScore = count > 0 ? Math.round(sum / count) : 0;

    return {
      totalScore,
      isComplete: pillars.interview !== null,
      breakdown,
    };
  }
}
