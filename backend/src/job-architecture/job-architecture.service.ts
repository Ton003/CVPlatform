import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { BusinessUnit } from './entities/business-unit.entity';
import { Department } from './entities/department.entity';
import { JobRole } from './entities/job-role.entity';
import { JobRoleLevel } from './entities/job-role-level.entity';
import { JobCompetencyRequirement } from './entities/job-competency-requirement.entity';

@Injectable()
export class JobArchitectureService {
  constructor(
    @InjectRepository(BusinessUnit) private readonly buRepo: Repository<BusinessUnit>,
    @InjectRepository(Department) private readonly departmentRepo: Repository<Department>,
    @InjectRepository(JobRole) private readonly roleRepo: Repository<JobRole>,
    @InjectRepository(JobRoleLevel) private readonly levelRepo: Repository<JobRoleLevel>,
    @InjectRepository(JobCompetencyRequirement) private readonly reqRepo: Repository<JobCompetencyRequirement>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Fetches the entire job architecture tree (BU -> Department -> Role -> Levels).
   */
  async getTree(): Promise<BusinessUnit[]> {
    return this.buRepo.find({
      relations: ['departments', 'departments.jobRoles', 'departments.jobRoles.levels'],
      order: {
        name: 'ASC',
      },
    });
  }

  /**
   * Fetches a specific job role and its levels
   */
  async getJobRole(id: string): Promise<JobRole> {
    const role = await this.roleRepo.findOne({
      where: { id },
      relations: ['levels'],
    });
    if (!role) throw new NotFoundException(`Job Role ${id} not found`);
    return role;
  }

  /**
   * Fetches a specific job role level with its competency requirements
   */
  async getJobRoleLevel(id: string): Promise<JobRoleLevel> {
    const level = await this.levelRepo.findOne({
      where: { id },
      relations: {
        competencyRequirements: {
          competence: {
            family: true,
          },
        },
      },
    });
    if (!level) throw new NotFoundException(`Job Role Level ${id} not found`);
    return level;
  }

  /**
   * SUCCESSION MATCHING
   * Returns candidates whose snapshot matches the requirements of a JOB LEVEL.
   */
  async successionCandidates(levelId: string): Promise<any[]> {
    const level = await this.getJobRoleLevel(levelId);
    const requirements = level.competencyRequirements || [];
    
    if (requirements.length === 0) return [];

    // Query all candidates with snapshots
    const candidates = await this.dataSource.query(`
      SELECT 
        id, 
        CONCAT(first_name, ' ', last_name) as name, 
        email, 
        current_title as current_title,
        competency_snapshot as snapshot
      FROM candidates
      WHERE competency_snapshot IS NOT NULL
      LIMIT 100
    `);

    const matches = candidates.map(c => {
      const snap = c.snapshot || {};
      let totalReq = 0;
      let matchSum = 0;

      for (const req of requirements) {
        totalReq += req.requiredLevel;
        const candLvl = snap[req.competenceId]?.level || 0;
        // Cap matching at requiredLevel (over-qualification doesn't increase score here)
        matchSum += Math.min(candLvl, req.requiredLevel);
      }

      const matchScore = totalReq > 0 ? Math.round((matchSum / totalReq) * 100) : 0;

      return {
        ...c,
        match_score: matchScore
      };
    });

    // Filter to those with > 60% match for succession readiness
    return matches
      .filter(m => m.match_score >= 60)
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, 10);
  }

  // --- CRUD Operations ---

  async createBusinessUnit(name: string, description?: string): Promise<BusinessUnit> {
    return this.buRepo.save(this.buRepo.create({ name, description }));
  }

  async createDepartment(businessUnitId: string, name: string, description?: string): Promise<Department> {
    const bu = await this.buRepo.findOne({ where: { id: businessUnitId } });
    if (!bu) throw new NotFoundException('Business Unit not found');
    return this.departmentRepo.save(this.departmentRepo.create({ name, description, businessUnitId }));
  }

  /**
   * Creates a role and automatically generates N levels (1-7)
   */
  async createJobRole(
    data: {
      departmentId: string;
      name: string;
      familyId?: string;
      level?: number;
      sfiaRequirements?: any[];
      successorRoleIds?: string[];
      levelCount?: number;
    }
  ): Promise<JobRole> {
    const d = await this.departmentRepo.findOne({ where: { id: data.departmentId } });
    if (!d) throw new NotFoundException('Department not found');

    const role = await this.roleRepo.save(this.roleRepo.create({ 
      name: data.name, 
      departmentId: data.departmentId,
      familyId: data.familyId,
      level: data.level ?? 1,
      sfiaRequirements: data.sfiaRequirements ?? [],
      successorRoleIds: data.successorRoleIds ?? [],
      status: 'DRAFT',
    }));

    // Generate Levels
    const levelCount = data.levelCount ?? 5;
    const levels = Array.from({ length: levelCount }, (_, i) => 
      this.levelRepo.create({
        jobRoleId: role.id,
        levelNumber: i + 1,
        title: `Level ${i + 1}`,
        mission: '',
        responsibilities: [],
      })
    );
    await this.levelRepo.save(levels);

    return this.getJobRole(role.id);
  }

  // UPDATES
  async updateBusinessUnit(id: string, name?: string, description?: string): Promise<BusinessUnit> {
    const bu = await this.buRepo.findOne({ where: { id } });
    if (!bu) throw new NotFoundException('Business Unit not found');
    if (name) bu.name = name;
    if (description !== undefined) bu.description = description;
    return this.buRepo.save(bu);
  }

  async updateDepartment(id: string, name?: string, description?: string): Promise<Department> {
    const dept = await this.departmentRepo.findOne({ where: { id } });
    if (!dept) throw new NotFoundException('Department not found');
    if (name) dept.name = name;
    if (description !== undefined) dept.description = description;
    return this.departmentRepo.save(dept);
  }

  async updateJobRole(
    id: string, 
    data: {
      name?: string; 
      status?: string;
      familyId?: string;
      level?: number;
      sfiaRequirements?: any[];
      successorRoleIds?: string[];
    }
  ): Promise<JobRole> {
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Job Role not found');
    
    if (data.name) role.name = data.name;
    if (data.status !== undefined) role.status = data.status;
    if (data.familyId !== undefined) role.familyId = data.familyId;
    if (data.level !== undefined) role.level = data.level;
    if (data.sfiaRequirements !== undefined) role.sfiaRequirements = data.sfiaRequirements;
    if (data.successorRoleIds !== undefined) role.successorRoleIds = data.successorRoleIds;

    return this.roleRepo.save(role);
  }


  /**
   * Updates level-specific details (mission, responsibilities, etc)
   */
  async updateJobRoleLevel(
    id: string,
    data: { 
      mission?: string; 
      responsibilities?: string[]; 
      description?: string;
      title?: string;
    }
  ): Promise<JobRoleLevel> {
    const level = await this.levelRepo.findOne({ where: { id } });
    if (!level) throw new NotFoundException('Job Role Level not found');

    if (data.mission !== undefined) level.mission = data.mission;
    if (data.responsibilities !== undefined) level.responsibilities = data.responsibilities;
    if (data.description !== undefined) level.description = data.description;
    if (data.title !== undefined) level.title = data.title;

    return this.levelRepo.save(level);
  }

  // DELETES
  async deleteBusinessUnit(id: string): Promise<void> {
    const result = await this.buRepo.delete(id);
    if (result.affected === 0) throw new NotFoundException('Business Unit not found');
  }

  async deleteDepartment(id: string): Promise<void> {
    const result = await this.departmentRepo.delete(id);
    if (result.affected === 0) throw new NotFoundException('Department not found');
  }

  async deleteJobRole(id: string): Promise<void> {
    const result = await this.roleRepo.delete(id);
    if (result.affected === 0) throw new NotFoundException('Job Role not found');
  }

  /**
   * Atomically map multiple competencies to a specific Job Role Level
   */
  async updateJobRoleCompetencies(
    levelId: string,
    requirements: { competenceId: string; requiredLevel: number }[],
  ): Promise<JobRoleLevel> {
    await this.getJobRoleLevel(levelId);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.delete(JobCompetencyRequirement, { jobRoleLevelId: levelId });

      if (requirements.length > 0) {
        const insertEntities = requirements.map((req) => 
          queryRunner.manager.create(JobCompetencyRequirement, {
            jobRoleLevelId: levelId,
            competenceId: req.competenceId,
            requiredLevel: req.requiredLevel,
          }),
        );
        await queryRunner.manager.save(JobCompetencyRequirement, insertEntities);
      }

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    return this.getJobRoleLevel(levelId);
  }
}
