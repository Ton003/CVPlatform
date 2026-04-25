import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, Brackets } from 'typeorm';
import { Employee, EmployeeStatus } from './entities/employee.entity';
import { EmployeeCompetency, CompetencySource } from './entities/employee-competency.entity';
import { Application } from '../applications/application.entity';
import { Candidate } from '../candidates/entities/candidates.entity';
import { JobOffer } from '../job-offers/job-offer.entity';
import { PromoteCandidateDto, CreateEmployeeDto } from './dto/employee.dto';
import { ApplicationCompetencyScore } from '../applications/application-competency-score.entity';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(EmployeeCompetency)
    private readonly compRepo: Repository<EmployeeCompetency>,
    @InjectRepository(Application)
    private readonly appRepo: Repository<Application>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async list(filters: { buId?: string; departmentId?: string; roleId?: string; search?: string; page: number; limit: number }) {
    const qb = this.employeeRepo.createQueryBuilder('e')
      .leftJoinAndSelect('e.jobRole', 'role')
      .leftJoinAndSelect('e.jobRoleLevel', 'level')
      .leftJoinAndSelect('e.manager', 'manager')
      .leftJoin('e.department', 'department')
      .leftJoin('department.businessUnit', 'bu');

    if (filters.buId) qb.andWhere('bu.id = :buId', { buId: filters.buId });
    if (filters.departmentId) qb.andWhere('department.id = :deptId', { deptId: filters.departmentId });
    if (filters.roleId) qb.andWhere('role.id = :roleId', { roleId: filters.roleId });
    if (filters.search) {
      qb.andWhere(new Brackets(sqb => {
        sqb.where('e.firstName ILIKE :search', { search: `%${filters.search}%` })
           .orWhere('e.lastName ILIKE :search', { search: `%${filters.search}%` })
           .orWhere('e.email ILIKE :search', { search: `%${filters.search}%` })
           .orWhere('e.employeeId ILIKE :search', { search: `%${filters.search}%` });
      }));
    }

    const [data, total] = await qb
      .skip((filters.page - 1) * filters.limit)
      .take(filters.limit)
      .getManyAndCount();

    return { data, total, page: filters.page, limit: filters.limit };
  }

  async findOne(id: string) {
    const employee = await this.employeeRepo.findOne({
      where: { id },
      relations: ['jobRole', 'jobRoleLevel', 'jobRoleLevel.competencyRequirements', 'jobRoleLevel.competencyRequirements.competence', 'manager', 'competencies', 'competencies.competence', 'candidate', 'department', 'department.businessUnit']
    });
    if (!employee) throw new NotFoundException(`Employee ${id} not found`);

    // Find the next level up in the same job role (for Career Development tab)
    // We look for the closest levelNumber > current to avoid "hardcoded +1" gaps
    const currentLevelNumber = (employee.jobRoleLevel as any)?.levelNumber ?? 0;
    const nextLevelRows = await this.dataSource.query(`
      SELECT id, title, "levelNumber"
      FROM job_role_levels
      WHERE "jobRoleId" = $1 AND "levelNumber" > $2
      ORDER BY "levelNumber" ASC
      LIMIT 1
    `, [employee.jobRoleId, currentLevelNumber]);

    (employee as any).nextJobRoleLevel = nextLevelRows.length ? nextLevelRows[0] : null;

    return employee;
  }

  async promoteCandidate(dto: PromoteCandidateDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Fetch Application with relations
      const app = await this.appRepo.findOne({
        where: { id: dto.applicationId },
        relations: ['candidate', 'job']
      });

      if (!app) throw new NotFoundException(`Application ${dto.applicationId} not found`);
      if (app.stage !== 'offer') {
        throw new BadRequestException(`Cannot promote candidate in '${app.stage}' stage. Must be in 'offer' stage.`);
      }

      const candidate = app.candidate;
      const jobOffer = app.job;

      // 2. Create Employee
      const employee = this.employeeRepo.create({
        employeeId: dto.employeeId,
        candidateId: candidate.id,
        firstName: candidate.first_name,
        lastName: candidate.last_name,
        email: candidate.email,
        hireDate: new Date(dto.hireDate),
        status: EmployeeStatus.PROBATION,
        jobRoleId: jobOffer.jobRoleId!,
        jobRoleLevelId: jobOffer.jobRoleLevelId!,
        departmentId: jobOffer.jobRole?.departmentId || null,
        manager: dto.managerId ? { id: dto.managerId } : null,
        personalDetails: {
          phone: candidate.phone,
          location: candidate.location,
          linkedin: candidate.linkedin_url
        }
      });

      const savedEmployee = (await queryRunner.manager.save(employee)) as Employee;

      // 3. Initialize Competency Matrix
      // We prioritize application-specific evaluations, then fall back to candidate snapshot
      const manualScores = await this.dataSource.manager.find(ApplicationCompetencyScore, {
        where: { applicationId: app.id }
      });
      
      const snapshot = candidate.competencySnapshot || {};
      const jobRequirements = await this.dataSource.query(
        `SELECT "competenceId" FROM job_competency_requirements WHERE "jobRoleLevelId" = $1`,
        [jobOffer.jobRoleLevelId]
      );

      let usedManualScores = false;
      const employeeCompetencies: EmployeeCompetency[] = [];

      for (const req of jobRequirements) {
        const compId = req.competenceId;
        const manual = manualScores.find(s => s.competenceId === compId);
        
        let level = 1;
        let source = CompetencySource.MANUAL;

        if (manual) {
          level = manual.evaluatedLevel;
          source = CompetencySource.MANUAL;
          usedManualScores = true;
        } else if (snapshot[compId]) {
          level = snapshot[compId].level;
          source = CompetencySource.ASSESSMENT_IMPORT;
        }

        employeeCompetencies.push(this.compRepo.create({
          employeeId: savedEmployee.id,
          competenceId: compId,
          currentLevel: level,
          source: source
        }));
      }

      if (employeeCompetencies.length > 0) {
        await queryRunner.manager.save(employeeCompetencies);
      }

      // 4. Update Candidate Status
      candidate.status = 'hired';
      await queryRunner.manager.save(candidate);

      await queryRunner.commitTransaction();

      // ✅ FIX 4: Return competencySource so consumers know whether scores came
      // from human evaluations or AI-parsed CV estimates.
      return {
        ...savedEmployee,
        competencySource: usedManualScores ? 'manual' : 'ai_estimate',
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async create(dto: CreateEmployeeDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Create Employee instance
      const employee = this.employeeRepo.create({
        employeeId: dto.employeeId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        hireDate: new Date(dto.hireDate),
        status: dto.status || EmployeeStatus.PROBATION,
        jobRoleId: dto.jobRoleId,
        jobRoleLevelId: dto.jobRoleLevelId,
        departmentId: dto.departmentId || null,
        manager: dto.managerId ? { id: dto.managerId } : null,
        candidateId: dto.candidateId || null,
      });

      const savedEmployee = (await queryRunner.manager.save(employee)) as Employee;

      // 2. Initialize Competency Matrix from Job Role Requirements
      // Legacy hires start with default proficiency (1) for all required competencies
      const jobRequirements = await this.dataSource.query(
        `SELECT "competenceId" FROM job_competency_requirements WHERE "jobRoleLevelId" = $1`,
        [dto.jobRoleLevelId]
      );

      const employeeCompetencies: EmployeeCompetency[] = [];
      for (const req of jobRequirements) {
        employeeCompetencies.push(this.compRepo.create({
          employeeId: savedEmployee.id,
          competenceId: req.competenceId,
          currentLevel: 0, // Unassessed by default
          source: CompetencySource.MANUAL
        }));
      }

      if (employeeCompetencies.length > 0) {
        await queryRunner.manager.save(employeeCompetencies);
      }

      await queryRunner.commitTransaction();
      return savedEmployee;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async update(id: string, dto: any) {
    const employee = await this.findOne(id);
    
    // Whitelist allowed fields for stability
    const allowed = ['firstName', 'lastName', 'email', 'status', 'personalDetails', 'jobRoleId', 'jobRoleLevelId', 'managerId', 'departmentId'];
    for (const key of allowed) {
      if (dto[key] !== undefined) {
        if (key === 'managerId') {
          employee.manager = dto[key] ? { id: dto[key] } as any : null;
        } else {
          employee[key] = dto[key];
        }
      }
    }
    
    return this.employeeRepo.save(employee);
  }

  async remove(id: string) {
    const employee = await this.findOne(id);
    // Remove dependencies (competencies are cascade deleted)
    return this.employeeRepo.remove(employee);
  }
}
