import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectDataSource }              from '@nestjs/typeorm';
import { DataSource }                    from 'typeorm';
import { ChatbotService }                from '../chatbot/chatbot.service';
import { ApplicationsService }           from '../applications/applications.service';
import { CreateJobOfferDto }             from './dto/create-job-offer.dto';
import { UpdateJobOfferDto }             from './dto/update-job-offer.dto';

@Injectable()
export class JobOffersService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly chatbot:    ChatbotService,
    private readonly applicationsService: ApplicationsService,
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
    job_offers.hiring_manager     AS "hiringManager",
    job_offers.deadline,
    job_offers.snapshot,
    job_offers.status,
    job_offers.visibility,
    job_offers.created_at         AS "createdAt"
  `;




  private isUuid(val: any): boolean {
    if (typeof val !== 'string') return false;
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return regex.test(val);
  }

  // ── List all offers ──────────────────────────────────────────────
  async findAll(status?: string) {
    let where = '1=1';
    const params: any[] = [];

    if (status) {
      params.push(status);
      where = `status = $${params.length}`;
    }

    const rows = await this.dataSource.query(`
      SELECT
        ${this.JOB_OFFER_SELECT},
        (SELECT COUNT(*) FROM applications WHERE job_id = job_offers.id)::int AS "pipelineCount"
      FROM job_offers
      LEFT JOIN job_role_levels l ON l.id = job_offers.job_role_level_id
      WHERE ${where}
      ORDER BY job_offers.created_at DESC
    `, params);

    return rows;
  }

  // ── Get one offer ────────────────────────────────────────────────
  async findOne(id: string) {
    const rows = await this.dataSource.query(`
      SELECT
        ${this.JOB_OFFER_SELECT}
      FROM job_offers
      LEFT JOIN job_role_levels l ON l.id = job_offers.job_role_level_id
      WHERE job_offers.id = $1::uuid
    `, [id]);

    if (!rows.length) throw new NotFoundException(`Job offer ${id} not found`);
    return rows[0];
  }

  // ── Create ───────────────────────────────────────────────────────
  async create(dto: CreateJobOfferDto, userId: string | null) {
    // 1. Fetch Job Role Level and Validate Role Lifecycle
    const levelRows = await this.dataSource.query(`
      SELECT 
        l.id, l.title as "levelTitle", l.mission, l.responsibilities, l.description,
        r.name as "roleName", r.status as "roleStatus",
        d.name as "departmentName",
        bu.name as "buName"
      FROM job_role_levels l
      JOIN job_roles r ON l."jobRoleId" = r.id
      LEFT JOIN departments d ON r.department_id = d.id
      LEFT JOIN business_units bu ON d.business_unit_id = bu.id
      WHERE l.id = $1::uuid
    `, [dto.jobRoleLevelId]);

    if (!levelRows.length) throw new NotFoundException('Selected Job Role Level not found');
    const level = levelRows[0];

    if (level.roleStatus !== 'ACTIVE') {
      throw new BadRequestException(`Cannot publish offer for '${level.roleName}'. The role status is '${level.roleStatus}', but must be 'ACTIVE'. Please activate the role in Job Architecture first.`);
    }

    // 2. Fetch Competencies for Snapshot (from the Level)
    const compRows = await this.dataSource.query(`
      SELECT c.name, req."requiredLevel"
      FROM job_competency_requirements req
      JOIN competences c ON req."competenceId" = c.id
      WHERE req."jobRoleLevelId" = $1::uuid
    `, [dto.jobRoleLevelId]);

    // 3. Construct Immutable Snapshot
    const snapshot = {
      roleLevelId: level.id,
      roleName: level.roleName,
      levelTitle: level.levelTitle,
      mission: level.mission,
      responsibilities: level.responsibilities || [],
      orgContext: {
        businessUnit: level.buName,
        department: level.departmentName
      },
      competencies: compRows.map(c => ({
        name: c.name,
        requiredLevel: c.requiredLevel
      })),
      snapshottedAt: new Date().toISOString()
    };



    if (dto.salaryMin !== undefined && dto.salaryMax !== undefined && dto.salaryMin !== null && dto.salaryMax !== null && dto.salaryMax < dto.salaryMin) {
      throw new BadRequestException('salaryMax cannot be less than salaryMin');
    }

    // 4. Insert Job Offer
    const rows = await this.dataSource.query(`
      INSERT INTO job_offers (
        job_role_level_id, title, description,
        contract_type, work_mode, salary_min, salary_max, currency,
        openings_count, hiring_manager, deadline, visibility,
        snapshot, status, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15)
      RETURNING id::text AS "id", title, description, snapshot, status, created_at AS "createdAt", 0::int AS "pipelineCount"
    `, [
      dto.jobRoleLevelId,
      dto.title,
      dto.description,
      dto.contractType   ?? null,
      dto.workMode       ?? null,
      dto.salaryMin      ?? null,
      dto.salaryMax      ?? null,
      dto.currency       ?? 'TND',
      dto.openingsCount  ?? 1,
      this.isUuid(dto.hiringManager) ? dto.hiringManager : null,
      dto.deadline ? new Date(dto.deadline) : null,
      dto.visibility     ?? 'both',
      JSON.stringify(snapshot),
      dto.status         ?? 'open',
      userId,
    ]);

    return rows[0];
  }

  // ── Update ───────────────────────────────────────────────────────
  async update(id: string, dto: UpdateJobOfferDto) {
    const offer = await this.findOne(id);

    const salaryMin = dto.salaryMin !== undefined ? dto.salaryMin : offer.salaryMin;
    const salaryMax = dto.salaryMax !== undefined ? dto.salaryMax : offer.salaryMax;
    if (salaryMin !== null && salaryMax !== null && salaryMax < salaryMin) {
      throw new BadRequestException('salaryMax cannot be less than salaryMin');
    }

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (dto.jobRoleLevelId !== undefined) {
      updates.push(`job_role_level_id = $${paramIndex++}::uuid`);
      params.push(dto.jobRoleLevelId);
    }
    if (dto.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      params.push(dto.title);
    }
    if (dto.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(dto.description);
    }
    if (dto.contractType !== undefined) {
      updates.push(`contract_type = $${paramIndex++}`);
      params.push(dto.contractType);
    }
    if (dto.workMode !== undefined) {
      updates.push(`work_mode = $${paramIndex++}`);
      params.push(dto.workMode);
    }
    if (dto.salaryMin !== undefined) {
      updates.push(`salary_min = $${paramIndex++}`);
      params.push(dto.salaryMin);
    }
    if (dto.salaryMax !== undefined) {
      updates.push(`salary_max = $${paramIndex++}`);
      params.push(dto.salaryMax);
    }
    if (dto.currency !== undefined) {
      updates.push(`currency = $${paramIndex++}`);
      params.push(dto.currency);
    }
    if (dto.openingsCount !== undefined) {
      updates.push(`openings_count = $${paramIndex++}`);
      params.push(dto.openingsCount);
    }
    if (dto.hiringManager !== undefined) {
      updates.push(`hiring_manager = $${paramIndex++}`);
      params.push(this.isUuid(dto.hiringManager) ? dto.hiringManager : null);
    }
    if (dto.deadline !== undefined) {
      updates.push(`deadline = $${paramIndex++}`);
      params.push(dto.deadline ? new Date(dto.deadline) : null);
    }
    if (dto.visibility !== undefined) {
      updates.push(`visibility = $${paramIndex++}`);
      params.push(dto.visibility);
    }
    if (dto.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(dto.status);
    }


    if (updates.length === 0) return offer;

    params.push(id);
    const rows = await this.dataSource.query(`
      UPDATE job_offers
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}::uuid
      RETURNING id::text AS "id", title, description, snapshot, status, created_at AS "createdAt",
                (SELECT COUNT(*) FROM applications WHERE job_id = job_offers.id)::int AS "pipelineCount"
    `, params);

    return rows[0];
  }

  // ── Delete ───────────────────────────────────────────────────────
  async remove(id: string) {
    const rows = await this.dataSource.query(
      `SELECT id FROM job_offers WHERE id = $1::uuid`, [id],
    );
    if (!rows.length) throw new NotFoundException(`Job offer ${id} not found`);

    await this.dataSource.transaction(async (manager) => {
      const apps = await manager.query(
        `SELECT id FROM applications WHERE job_id = $1::uuid`, [id],
      );

      if (apps.length > 0) {
        for (const app of apps) {
          await manager.query(`DELETE FROM interviews WHERE application_id = $1::uuid`, [app.id]);
          await manager.query(`DELETE FROM application_notes WHERE application_id = $1::uuid`, [app.id]);
          await manager.query(`DELETE FROM activity_log WHERE application_id = $1::uuid`, [app.id]);
          await manager.query(`DELETE FROM tasks WHERE application_id = $1::uuid`, [app.id]);
        }
        await manager.query(`DELETE FROM applications WHERE job_id = $1::uuid`, [id]);
      }

      await manager.query(`DELETE FROM job_offers WHERE id = $1::uuid`, [id]);
    });
  }

  // ── Match candidates via RAG pipeline ───────────────────────────
  async matchCandidates(id: string, apiKey?: string, mode = 'groq') {
    const offer = await this.findOne(id);

    const snapshot = offer.snapshot || {};
    const skillsPart = snapshot.competencies?.length
      ? `Required competencies: ${snapshot.competencies.map((c: any) => `${c.name} (Level ${c.requiredLevel})`).join(', ')}.`
      : '';
    const missionPart = snapshot.mission ? `Role mission: ${snapshot.mission}.` : '';

    const query = [
      `Find candidates for the following job offer: ${offer.title}.`,
      offer.description, missionPart, skillsPart
    ].filter(Boolean).join(' ');

    const result = await this.chatbot.recommend({
      message: query, mode: mode as any, apiKey,
      history: [], lastCandidates: [],
    });

    return { offer, ...result };
  }

  // ── Comparison ───────────────────────────────────────────────────
  async getComparison(id: string) {
    const offer = await this.findOne(id);
    const applications = await this.dataSource.query(`
      SELECT
        a.id::text AS "applicationId",
        c.first_name || ' ' || c.last_name AS "name",
        a.stage,
        a.candidate_id AS "candidateId"
      FROM applications a
      JOIN candidates c ON a.candidate_id = c.id
      WHERE a.job_id = $1::uuid
    `, [id]);

    const enriched = await Promise.all(applications.map(async (app: any) => {
      try {
        const scoreData = await this.applicationsService.getScore(app.applicationId);
        return {
          ...app,
          totalScore:    scoreData.totalScore,
          isComplete:    scoreData.isComplete,
          breakdown:     scoreData.breakdown,
          matchedSkills: scoreData.matchedSkills || [],
          missingSkills: scoreData.missingSkills || [],
        };
      } catch {
        return {
          ...app,
          totalScore:    0,
          isComplete:    false,
          breakdown:     { technical: { score: 0, weight: 100, available: true }, interview: { score: 0, weight: 0, available: false }, managerial: { score: 0, weight: 0, available: false } },
          matchedSkills: [],
          missingSkills: [],
        };
      }
    }));

    return { offer, applications: enriched };
  }

  async createApplicationFromExistingCandidate(
    candidateId: string,
    jobId: string,
    userId: string | null,
  ) {
    return this.applicationsService.create(
      { jobId, candidateId, source: 'manual' },
      userId ?? 'system',
    );
  }

  // ── Get all SFIA competency requirements for a job offer ─────────
  async getJobRequirements(jobOfferId: string) {
    const offerRows = await this.dataSource.query(
      `SELECT job_role_level_id AS "jobRoleLevelId" FROM job_offers WHERE id = $1::uuid`,
      [jobOfferId],
    );
    if (!offerRows.length) throw new NotFoundException(`Job offer ${jobOfferId} not found`);

    const { jobRoleLevelId } = offerRows[0];
    if (!jobRoleLevelId) return [];

    const rows = await this.dataSource.query(`
      SELECT
        c.id            AS "competenceId",
        c.name,
        c.description,
        f.category,
        f.name          AS "familyName",
        jcr."requiredLevel"
      FROM job_competency_requirements jcr
      JOIN competences c       ON c.id = jcr."competenceId"
      JOIN competence_families f ON f.id = c.family_id
      WHERE jcr."jobRoleLevelId" = $1::uuid
      ORDER BY f.category, c.name
    `, [jobRoleLevelId]);

    return rows;
  }
}