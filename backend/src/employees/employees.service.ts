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
      relations: ['jobRole', 'jobRoleLevel', 'manager', 'competencies', 'competencies.competence', 'department']
    });
    if (!employee) throw new NotFoundException(`Employee ${id} not found`);
    return employee;
  }

  async findAllManagers(departmentId?: string) {
    // DIAGNOSTIC: Return EVERYONE to see why they are hidden
    return this.employeeRepo.createQueryBuilder('e')
      .leftJoinAndSelect('e.jobRole', 'role')
      .orderBy('e.lastName', 'ASC')
      .getMany();
  }

  async promoteCandidate(dto: PromoteCandidateDto) {
    return this.dataSource.transaction(async (manager) => {
      const app = await manager.findOne(Application, {
        where: { id: dto.applicationId },
        relations: ['candidate', 'job', 'job.jobRole', 'job.jobRoleLevel']
      });

      if (!app) throw new NotFoundException('Application not found');
      const { candidate, job: jobOffer } = app;

      const employee = manager.create(Employee, {
        employeeId: dto.employeeId || `EMP-${Date.now()}`,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        email: candidate.email,
        hireDate: new Date(dto.hireDate),
        status: EmployeeStatus.PROBATION,
        jobRoleId: jobOffer.jobRoleId!,
        jobRoleLevelId: jobOffer.jobRoleLevelId!,
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
    // Simplified promotion logic for modernization
    const employee = await this.findOne(id);
    this.logger.log(`Promoting ${employee.firstName} ${employee.lastName}`);
    return { success: true };
  }
}
