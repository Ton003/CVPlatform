import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, TreeRepository } from 'typeorm';

import { Employee } from './entities/employee.entity';
import { EmployeeCompetency, CompetencySource } from './entities/employee-competency.entity';
import { EmployeeAssessment, AssessmentStatus } from './entities/employee-assessment.entity';
import { EmployeeAssessmentItem } from './entities/employee-assessment-item.entity';
import { CreateAssessmentDto, UpdateAssessmentItemsDto } from './dto/assessment.dto';

/** Shape of the JWT-validated user injected by JwtAuthGuard */
export interface RequestUser {
  id: string;
  email: string;
  role: 'admin' | 'hr' | 'manager';
}

@Injectable()
export class AssessmentsService {
  constructor(
    @InjectRepository(EmployeeAssessment)
    private readonly assessRepo: Repository<EmployeeAssessment>,

    @InjectRepository(EmployeeAssessmentItem)
    private readonly itemRepo: Repository<EmployeeAssessmentItem>,

    @InjectRepository(EmployeeCompetency)
    private readonly compRepo: Repository<EmployeeCompetency>,

    @InjectRepository(Employee)
    private readonly employeeRepo: TreeRepository<Employee>,

    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  // ─── Permission Check ────────────────────────────────────────────────────────

  /**
   * Verifies whether the requesting user is allowed to evaluate the given employee.
   *
   * Rules:
   *  - admin  → always allowed
   *  - hr     → always allowed
   *  - manager → ONLY if the employee is a descendant of the manager's own Employee record
   *  - others → denied
   */
  async canEvaluate(evaluatorUser: RequestUser, employeeId: string): Promise<void> {
    if (evaluatorUser.role === 'admin' || evaluatorUser.role === 'hr') return;

    if (evaluatorUser.role === 'manager') {
      // Find the Employee record that maps to this user account
      const managerEmployee = await this.employeeRepo.findOne({
        where: { userId: evaluatorUser.id },
      });

      if (!managerEmployee) {
        throw new ForbiddenException(
          'Manager account is not linked to an Employee record.',
        );
      }

      // Get all descendants (subtree) of the manager
      const descendants = await this.employeeRepo.findDescendants(managerEmployee);
      const isSubordinate = descendants.some((d) => d.id === employeeId);

      if (!isSubordinate) {
        throw new ForbiddenException(
          'Managers can only evaluate employees within their own reporting tree.',
        );
      }
      return;
    }

    throw new ForbiddenException('You do not have permission to submit assessments.');
  }

  // ─── 1. Create Draft ─────────────────────────────────────────────────────────

  async createDraft(
    employeeId: string,
    dto: CreateAssessmentDto,
    evaluatorUser: RequestUser,
  ): Promise<EmployeeAssessment> {
    await this.canEvaluate(evaluatorUser, employeeId);

    const employee = await this.employeeRepo.findOne({ where: { id: employeeId } });
    if (!employee) throw new NotFoundException(`Employee ${employeeId} not found`);

    const assessment = this.assessRepo.create({
      employeeId,
      evaluatorId: evaluatorUser.id,
      status: AssessmentStatus.DRAFT,
      cycleLabel: dto.cycleLabel ?? null,
      notes: dto.notes ?? null,
    });

    return this.assessRepo.save(assessment);
  }

  // ─── 2. Update Items (DRAFT only, no employee_competencies touched) ───────────

  async updateItems(
    assessmentId: string,
    dto: UpdateAssessmentItemsDto,
    evaluatorUser: RequestUser,
  ): Promise<EmployeeAssessment> {
    const assessment = await this.assessRepo.findOne({
      where: { id: assessmentId },
      relations: ['items'],
    });

    if (!assessment) throw new NotFoundException(`Assessment ${assessmentId} not found`);
    if (assessment.status === AssessmentStatus.SUBMITTED) {
      throw new ConflictException('Cannot edit a submitted assessment.');
    }

    // Permission check using the employee linked to this assessment
    await this.canEvaluate(evaluatorUser, assessment.employeeId);

    // UPSERT each item — create if missing, update if present
    for (const incoming of dto.items) {
      const level = incoming.level ?? null;
      const existing = assessment.items?.find(
        (i) => i.competenceId === incoming.competenceId,
      );

      if (existing) {
        existing.level = level;
        existing.notes = incoming.notes ?? existing.notes;
        await this.itemRepo.save(existing);
      } else {
        const newItem = this.itemRepo.create({
          assessmentId,
          competenceId: incoming.competenceId,
          level,
          notes: incoming.notes ?? null,
        });
        await this.itemRepo.save(newItem);
      }
    }

    return this.assessRepo.findOne({
      where: { id: assessmentId },
      relations: ['items', 'items.competence'],
    }) as Promise<EmployeeAssessment>;
  }

  // ─── 3. Submit Assessment ────────────────────────────────────────────────────

  async submit(assessmentId: string, evaluatorUser: RequestUser): Promise<EmployeeAssessment> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Load the assessment with all items
      const assessment = await queryRunner.manager.findOne(EmployeeAssessment, {
        where: { id: assessmentId },
        relations: ['items', 'employee', 'employee.jobRoleLevel', 'employee.jobRoleLevel.competencyRequirements'],
      });

      if (!assessment) throw new NotFoundException(`Assessment ${assessmentId} not found`);
      if (assessment.status === AssessmentStatus.SUBMITTED) {
        throw new ConflictException('This assessment has already been submitted.');
      }

      await this.canEvaluate(evaluatorUser, assessment.employeeId);

      // Load job role requirements to compute targets and gaps
      const requirements: { competenceId: string; requiredLevel: number }[] =
        await queryRunner.manager.query(
          `SELECT "competenceId", "requiredLevel"
           FROM job_competency_requirements
           WHERE "jobRoleLevelId" = $1`,
          [assessment.employee.jobRoleLevelId],
        );

      const reqMap = new Map(requirements.map((r) => [r.competenceId, r.requiredLevel]));
      const now = new Date();

      // Update employee_competencies for each assessed item ONLY
      for (const item of assessment.items) {
        const currentLevel = item.level ?? 0;
        const targetLevel = reqMap.get(item.competenceId) ?? null;

        const gap =
          targetLevel !== null && targetLevel > 0 ? targetLevel - currentLevel : null;
        const gapPercentage =
          gap !== null && targetLevel ? gap / targetLevel : null;

        // Find existing competency row or prepare a new one
        let empComp = await queryRunner.manager.findOne(EmployeeCompetency, {
          where: {
            employeeId: assessment.employeeId,
            competenceId: item.competenceId,
          },
        });

        if (empComp) {
          empComp.currentLevel     = currentLevel;
          empComp.targetLevel      = targetLevel;
          empComp.gap              = gap;
          empComp.gapPercentage    = gapPercentage;
          empComp.lastEvaluatedAt  = now;
          empComp.source           = CompetencySource.PERFORMANCE_REVIEW;
          empComp.lastAssessmentId = assessmentId;
        } else {
          // Competency not yet in employee matrix — create it
          empComp = queryRunner.manager.create(EmployeeCompetency, {
            employeeId:      assessment.employeeId,
            competenceId:    item.competenceId,
            currentLevel,
            targetLevel,
            gap,
            gapPercentage,
            lastEvaluatedAt: now,
            source:          CompetencySource.PERFORMANCE_REVIEW,
            lastAssessmentId: assessmentId,
            isRequired:      reqMap.has(item.competenceId),
          });
        }

        await queryRunner.manager.save(EmployeeCompetency, empComp);
      }

      // Mark the assessment as submitted
      assessment.status      = AssessmentStatus.SUBMITTED;
      assessment.submittedAt = now;
      await queryRunner.manager.save(EmployeeAssessment, assessment);

      await queryRunner.commitTransaction();

      return this.assessRepo.findOne({
        where: { id: assessmentId },
        relations: ['items', 'items.competence'],
      }) as Promise<EmployeeAssessment>;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // ─── 4. Get Assessment with Summary ─────────────────────────────────────────

  async findOne(assessmentId: string): Promise<any> {
    const assessment = await this.assessRepo.findOne({
      where: { id: assessmentId },
      relations: ['items', 'items.competence', 'items.competence.family'],
    });

    if (!assessment) throw new NotFoundException(`Assessment ${assessmentId} not found`);

    return this.withSummary(assessment);
  }

  // ─── 5. List History for Employee ────────────────────────────────────────────

  async listForEmployee(employeeId: string): Promise<any[]> {
    const assessments = await this.assessRepo.find({
      where: { employeeId },
      order: { createdAt: 'DESC' },
      // Intentionally NOT loading items (performance)
      select: ['id', 'cycleLabel', 'status', 'submittedAt', 'evaluatorId', 'createdAt'],
    });

    return assessments;
  }

  // ─── Helper: Compute Summary ─────────────────────────────────────────────────

  private withSummary(assessment: EmployeeAssessment): any {
    const items = assessment.items ?? [];
    const assessedItems = items.filter((i) => i.level !== null);
    const totalCompetencies = items.length;
    const assessedCount = assessedItems.length;
    const averageScore =
      assessedCount > 0
        ? Math.round(
            assessedItems.reduce((s, i) => s + (i.level ?? 0), 0) / assessedCount * 10,
          ) / 10
        : null;
    const completionRate =
      totalCompetencies > 0
        ? Math.round((assessedCount / totalCompetencies) * 100)
        : 0;

    return {
      ...assessment,
      summary: { totalCompetencies, assessedCount, averageScore, completionRate },
    };
  }
}
