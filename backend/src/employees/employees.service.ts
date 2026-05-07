import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, Brackets } from 'typeorm';
import { Employee, EmployeeStatus } from './entities/employee.entity';
import { EmployeeCompetency, CompetencySource } from './entities/employee-competency.entity';
import { Application } from '../applications/application.entity';
import { Candidate } from '../candidates/entities/candidates.entity';
import { PromoteCandidateDto, CreateEmployeeDto } from './dto/employee.dto';
import { ApplicationCompetencyScore } from '../applications/application-competency-score.entity';
import { Cv } from '../cvs/entities/cv.entity';
import { CvParsedData } from '../cv-parsed-data/entities/cv-parsed-data.entity';
import { EmployeeHistory, EmployeeHistoryEventType } from './entities/employee-history.entity';

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);

  constructor(
    @InjectRepository(Employee) private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(EmployeeCompetency) private readonly compRepo: Repository<EmployeeCompetency>,
    @InjectRepository(Application) private readonly appRepo: Repository<Application>,
    @InjectRepository(EmployeeHistory) private readonly historyRepo: Repository<EmployeeHistory>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async list(filters: { buId?: string; departmentId?: string; roleId?: string; search?: string; page: number; limit: number }) {
    const qb = this.employeeRepo.createQueryBuilder('e')
      .leftJoinAndSelect('e.jobRole', 'role')
      .leftJoinAndSelect('e.jobRoleLevel', 'level')
      .leftJoinAndSelect('e.manager', 'manager')
      .leftJoinAndSelect('e.department', 'dept')
      .orderBy('e.lastName', 'ASC');

    if (filters.search) {
      qb.andWhere(new Brackets(sqb => {
        sqb.where('e.firstName ILIKE :s OR e.lastName ILIKE :s OR e.email ILIKE :s', { s: `%${filters.search}%` });
      }));
    }

    const [data, total] = await qb.skip((filters.page - 1) * filters.limit).take(filters.limit).getManyAndCount();
    return { data, total, page: filters.page, limit: filters.limit };
  }

  async findOne(id: string) {
    const employee = await this.employeeRepo.findOne({
      where: { id },
      relations: [
        'jobRole',
        'jobRole.levels',
        'jobRoleLevel',
        'jobRoleLevel.competencyRequirements',
        'jobRoleLevel.competencyRequirements.competence',
        'jobRoleLevel.competencyRequirements.competence.family',
        'manager',
        'competencies',
        'competencies.competence',
        'department'
      ]
    });
    if (!employee) throw new NotFoundException(`Employee ${id} not found`);

    // Attach next level if available
    if (employee.jobRole?.levels && employee.jobRoleLevel) {
      const currentLevelNum = employee.jobRoleLevel.levelNumber;
      const sortedLevels = [...employee.jobRole.levels].sort((a, b) => a.levelNumber - b.levelNumber);
      const nextLevel = sortedLevels.find(l => l.levelNumber === currentLevelNum + 1);
      (employee as any).nextJobRoleLevel = nextLevel || null;
    }

    return employee;
  }

  async findAllManagers(departmentId?: string) {
    const qb = this.employeeRepo.createQueryBuilder('e')
      .leftJoinAndSelect('e.jobRole', 'role')
      .where('e.isManager = :isManager', { isManager: true })
      .orderBy('e.lastName', 'ASC');

    if (departmentId) {
      qb.andWhere('e.departmentId = :departmentId', { departmentId });
    }

    const managers = await qb.getMany();

    // Fallback: if no employees are flagged as managers, return all employees
    if (managers.length === 0) {
      return this.employeeRepo.createQueryBuilder('e')
        .leftJoinAndSelect('e.jobRole', 'role')
        .orderBy('e.lastName', 'ASC')
        .getMany();
    }

    return managers;
  }

  async promoteCandidate(dto: PromoteCandidateDto) {
    return this.dataSource.transaction(async (manager) => {
      const app = await manager.findOne(Application, {
        where: { id: dto.applicationId },
        relations: ['candidate', 'job', 'job.jobRole', 'job.jobRoleLevel']
      });

      if (!app) throw new NotFoundException('Application not found');
      const { candidate, job: jobOffer } = app;

      // Resolve jobRoleId: prefer direct value, fallback to jobRoleLevel's parent role
      let resolvedJobRoleId = jobOffer.jobRoleId;
      const resolvedJobRoleLevelId = jobOffer.jobRoleLevelId;

      if (!resolvedJobRoleId && jobOffer.jobRoleLevel) {
        resolvedJobRoleId = jobOffer.jobRoleLevel.jobRoleId;
      }

      if (!resolvedJobRoleId) {
        throw new BadRequestException(
          'Cannot promote: the job offer has no associated Job Role. Please assign a Job Role to the offer first.',
        );
      }

      const employee = manager.create(Employee, {
        employeeId: dto.employeeId || `EMP-${Date.now()}`,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        email: candidate.email,
        hireDate: new Date(dto.hireDate),
        status: EmployeeStatus.PROBATION,
        jobRoleId: resolvedJobRoleId,
        jobRoleLevelId: resolvedJobRoleLevelId!,
        manager: dto.managerId ? { id: dto.managerId } as any : null,
        candidateId: candidate.id,
      });

      const saved = await manager.save(employee);

      // Graduate Candidate
      candidate.status = 'converted';
      await manager.save(candidate);
      app.stage = 'hired';
      await manager.save(app);

      return saved;
    });
  }

  async create(dto: CreateEmployeeDto) {
    const employee = this.employeeRepo.create({
      ...dto,
      hireDate: new Date(dto.hireDate),
    });
    return this.employeeRepo.save(employee);
  }

  async update(id: string, dto: any) {
    const employee = await this.findOne(id);
    Object.assign(employee, dto);
    return this.employeeRepo.save(employee);
  }

  async toggleManager(id: string) {
    const employee = await this.findOne(id);
    employee.isManager = !employee.isManager;
    return this.employeeRepo.save(employee);
  }

  async remove(id: string) {
    const employee = await this.findOne(id);
    return this.employeeRepo.remove(employee);
  }

  async getHistory(employeeId: string) {
    return this.historyRepo.find({ where: { employeeId }, order: { effectiveDate: 'DESC' } });
  }

  async promoteToNextLevel(id: string, effectiveDate?: string, notes?: string) {
    return this.dataSource.transaction(async (manager) => {
      const employee = await this.findOne(id);
      
      const nextLevel = (employee as any).nextJobRoleLevel;
      if (!nextLevel) {
        throw new BadRequestException('Employee is already at the maximum level for this role');
      }

      this.logger.log(`Promoting ${employee.firstName} to level ${nextLevel.title} (${nextLevel.id})`);

      const oldLevelId = employee.jobRoleLevelId;
      const oldDeptId = employee.departmentId;

      // Update Employee using direct update to ensure column is changed
      await manager.update(Employee, id, {
        jobRoleLevelId: nextLevel.id
      });

      // Create History Entry
      const history = manager.create(EmployeeHistory, {
        employeeId: employee.id,
        eventType: EmployeeHistoryEventType.PROMOTION,
        effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
        notes: notes || `Promoted to ${nextLevel.title}`,
        oldRoleLevelId: oldLevelId,
        newRoleLevelId: nextLevel.id,
        oldDepartmentId: oldDeptId,
        newDepartmentId: oldDeptId,
      });
      await manager.save(history);

      // Return updated employee - fetch again from DB to be 100% sure
      const updated = await this.findOne(id);
      return {
        success: true,
        newLevelId: nextLevel.id,
        newLevelTitle: nextLevel.title,
        employee: updated
      };
    });
  }
}
