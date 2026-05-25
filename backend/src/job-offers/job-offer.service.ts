import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ChatbotService } from '../chatbot/chatbot.service';
import { CreateJobOfferDto } from './dto/create-job-offer.dto';
import { UpdateJobOfferDto } from './dto/update-job-offer.dto';

@Injectable()
export class JobOffersService {
  private readonly logger = new Logger(JobOffersService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly chatbot: ChatbotService,
  ) {}

  private readonly JOB_OFFER_SELECT = `
    job_offers.id::text           AS "id",
    job_offers.title,
    job_offers.description,
    job_offers.job_role_level_id  AS "jobRoleLevelId",
    l."jobRoleId"                 AS "jobRoleId",
    job_offers.contract_type      AS "contractType",
    job_offers.work_mode          AS "workMode",
    job_offers.salary_min         AS "salaryMin",
    job_offers.salary_max         AS "salaryMax",
    job_offers.currency,
    job_offers.openings_count     AS "openingsCount",
    job_offers.hiring_manager     AS "hiringManagerId",
    r.department_id               AS "departmentId",
    job_offers.deadline,
    job_offers.snapshot,
    job_offers.status,
    job_offers.visibility,
    job_offers.created_at         AS "createdAt"
  `;

  async findAll(status?: string, scopedIds: string[] = []) {
    let where = '1=1';
    const params: (string | string[])[] = [];

    if (status) {
      params.push(status);
      where = `status = $${params.length}`;
    }

    if (scopedIds.length > 0) {
      params.push(scopedIds);
      where += ` AND job_offers.id = ANY($${params.length}::uuid[])`;
    }

    return this.dataSource.query(
      `
      SELECT
        ${this.JOB_OFFER_SELECT},
        (SELECT COUNT(*) FROM applications WHERE job_id = job_offers.id AND stage NOT IN ('rejected', 'hired'))::int AS "pipelineCount",
        (SELECT COUNT(*) FROM applications WHERE job_id = job_offers.id AND stage IN ('rejected', 'hired'))::int AS "resolvedCount",
        (SELECT COUNT(*) FROM applications WHERE job_id = job_offers.id AND stage = 'hired')::int AS "hiredCount"
      FROM job_offers
      LEFT JOIN job_role_levels l ON l.id = job_offers.job_role_level_id
      LEFT JOIN job_roles r ON r.id = l."jobRoleId"
      WHERE ${where}
      ORDER BY job_offers.created_at DESC
    `,
      params,
    );
  }

  async findOne(id: string) {
    const rows = await this.dataSource.query(
      `
      SELECT ${this.JOB_OFFER_SELECT}
      FROM job_offers
      LEFT JOIN job_role_levels l ON l.id = job_offers.job_role_level_id
      LEFT JOIN job_roles r ON r.id = l."jobRoleId"
      WHERE job_offers.id = $1::uuid
    `,
      [id],
    );

    if (!rows.length) throw new NotFoundException(`Job offer ${id} not found`);
    return rows[0];
  }

  async create(dto: CreateJobOfferDto, userId: string | null) {
    const levelRows = await this.dataSource.query(
      `
      SELECT 
        l.id, l.title as "levelTitle", l.mission, l.responsibilities, l.description,
        r.id as "jobRoleId", r.name as "roleName", r.status as "roleStatus",
        d.name as "departmentName",
        bu.name as "buName"
      FROM job_role_levels l
      JOIN job_roles r ON l."jobRoleId" = r.id
      LEFT JOIN departments d ON r.department_id = d.id
      LEFT JOIN business_units bu ON d.business_unit_id = bu.id
      WHERE l.id = $1::uuid
    `,
      [dto.jobRoleLevelId],
    );

    if (!levelRows.length)
      throw new NotFoundException('Selected Job Role Level not found');
    const level = levelRows[0];

    if (level.roleStatus !== 'ACTIVE') {
      throw new BadRequestException(
        `Cannot publish offer for '${level.roleName}'. Role must be 'ACTIVE'.`,
      );
    }

    const compRows = await this.dataSource.query(
      `
      SELECT c.id, c.name, req."requiredLevel"
      FROM job_competency_requirements req
      JOIN competences c ON req."competenceId" = c.id
      WHERE req."jobRoleLevelId" = $1::uuid
    `,
      [dto.jobRoleLevelId],
    );

    const snapshot = {
      roleLevelId: level.id,
      roleName: level.roleName,
      levelTitle: level.levelTitle,
      mission: level.mission,
      responsibilities: level.responsibilities || [],
      orgContext: {
        businessUnit: level.buName,
        department: level.departmentName,
      },
      competencies: compRows.map((c) => ({
        id: c.id,
        name: c.name,
        requiredLevel: c.requiredLevel,
      })),
      snapshottedAt: new Date().toISOString(),
    };

    if (dto.salaryMin && dto.salaryMax && dto.salaryMax < dto.salaryMin) {
      throw new BadRequestException('salaryMax cannot be less than salaryMin');
    }

    const rows = await this.dataSource.query(
      `
      INSERT INTO job_offers (
        job_role_level_id, job_role_id, title, description,
        contract_type, work_mode, salary_min, salary_max, currency,
        openings_count, hiring_manager, deadline, visibility,
        snapshot, status, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15, $16)
      RETURNING id::text AS "id", title, status, created_at AS "createdAt"
    `,
      [
        dto.jobRoleLevelId,
        level.jobRoleId,
        dto.title,
        dto.description,
        dto.contractType ?? null,
        dto.workMode ?? null,
        dto.salaryMin ?? null,
        dto.salaryMax ?? null,
        dto.currency ?? 'TND',
        dto.openingsCount ?? 1,
        dto.hiringManager || null,
        dto.deadline ? new Date(dto.deadline) : null,
        dto.visibility ?? 'both',
        JSON.stringify(snapshot),
        dto.status ?? 'open',
        userId,
      ],
    );

    return rows[0];
  }

  async update(id: string, dto: UpdateJobOfferDto) {
    const offer = await this.findOne(id);
    const sets: string[] = [];
    const values: (string | number | Date | null)[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined) {
        sets.push(`${this.camelToSnake(key)} = $${idx}`);
        values.push(
          key === 'deadline' && value ? new Date(value as string) : value,
        );
        idx++;
      }
    }

    if (sets.length === 0) return offer;

    values.push(id);
    await this.dataSource.query(
      `
      UPDATE job_offers 
      SET ${sets.join(', ')} 
      WHERE id = $${idx}::uuid
    `,
      values,
    );

    return this.findOne(id);
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }
  async remove(id: string) {
    await this.findOne(id);
    await this.dataSource.query(`DELETE FROM job_offers WHERE id = $1::uuid`, [id]);
  }

  async matchCandidates(id: string, apiKey?: string) {
    const offer = await this.findOne(id);
    const snapshot = offer.snapshot || {};

    const query = `
      Find candidates for: ${offer.title}.
      Description: ${offer.description}.
      ${snapshot.mission ? `Mission: ${snapshot.mission}.` : ''}
      ${snapshot.competencies?.length ? `Required: ${snapshot.competencies.map((c: { name: string; requiredLevel: number }) => `${c.name} (Lvl ${c.requiredLevel})`).join(', ')}.` : ''}
    `;

    const result = await this.chatbot.recommend({
      message: query,
      mode: 'groq' as any,
      apiKey,
      history: [],
      lastCandidates: [],
    });

    return { offer, ...result };
  }

  async getCompetencyWeights(jobOfferId: string) {
    const offer = await this.findOne(jobOfferId);
    return this.dataSource.query(
      `
      SELECT competence_id AS "competenceId", weight
      FROM job_competency_weights
      WHERE job_role_level_id = $1::uuid
    `,
      [offer.jobRoleLevelId],
    );
  }

  async setCompetencyWeights(
    jobOfferId: string,
    weights: { competenceId: string; weight: number }[],
    userId: string | null,
  ) {
    const offer = await this.findOne(jobOfferId);
    if (!offer.jobRoleLevelId)
      throw new BadRequestException('Job offer has no associated role level');

    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `DELETE FROM job_competency_weights WHERE job_role_level_id = $1::uuid`,
        [offer.jobRoleLevelId],
      );
      for (const w of weights) {
        await manager.query(
          `
          INSERT INTO job_competency_weights (job_role_level_id, competence_id, weight, set_by)
          VALUES ($1::uuid, $2::uuid, $3, $4::uuid)
        `,
          [offer.jobRoleLevelId, w.competenceId, w.weight, userId],
        );
      }
    });

    return this.getCompetencyWeights(jobOfferId);
  }

  async getRequirements(id: string) {
    return this.dataSource.query(
      `
      SELECT 
        req."competenceId", 
        c.name, 
        f.category,
        req."requiredLevel"
      FROM job_competency_requirements req
      JOIN competences c ON req."competenceId" = c.id
      JOIN competence_families f ON c.family_id = f.id
      JOIN job_offers j ON j.job_role_level_id = req."jobRoleLevelId"
      WHERE j.id = $1::uuid
    `,
      [id],
    );
  }
}
