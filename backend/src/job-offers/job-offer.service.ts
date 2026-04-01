import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource }              from '@nestjs/typeorm';
import { DataSource }                    from 'typeorm';
import { ChatbotService }                from '../chatbot/chatbot.service';
import { CreateJobOfferDto }             from './dto/create-job-offer.dto';

@Injectable()
export class JobOffersService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly chatbot:    ChatbotService,
  ) {}

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
        id::text           AS "id",
        title,
        description,
        location,
        required_skills    AS "requiredSkills",
        min_years          AS "minYears",
        status,
        created_at         AS "createdAt"
      FROM job_offers
      WHERE ${where}
      ORDER BY created_at DESC
    `, params);

    return rows;
  }

  // ── Get one offer ────────────────────────────────────────────────
  async findOne(id: string) {
    const rows = await this.dataSource.query(`
      SELECT
        id::text           AS "id",
        title,
        description,
        location,
        required_skills    AS "requiredSkills",
        min_years          AS "minYears",
        status,
        created_at         AS "createdAt"
      FROM job_offers
      WHERE id = $1::uuid
    `, [id]);

    if (!rows.length) throw new NotFoundException(`Job offer ${id} not found`);
    return rows[0];
  }

  // ── Create ───────────────────────────────────────────────────────
  async create(dto: CreateJobOfferDto, userId: string | null) {
    const rows = await this.dataSource.query(`
      INSERT INTO job_offers (title, description, location, required_skills, min_years, status, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id::text AS "id", title, description, location,
                required_skills AS "requiredSkills", min_years AS "minYears",
                status, created_at AS "createdAt"
    `, [
      dto.title,
      dto.description,
      dto.location   ?? null,
      JSON.stringify(dto.requiredSkills ?? []),
      dto.minYears   ?? null,
      dto.status     ?? 'open',
      userId,
    ]);

    return rows[0];
  }

  // ── Update ───────────────────────────────────────────────────────
  async update(id: string, dto: import('./dto/update-job-offer.dto').UpdateJobOfferDto) {
    // Check if it exists
    const offer = await this.findOne(id);

    // Build SET clause dynamically based on provided fields
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (dto.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      params.push(dto.title);
    }
    if (dto.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(dto.description);
    }
    if (dto.location !== undefined) {
      updates.push(`location = $${paramIndex++}`);
      params.push(dto.location);
    }
    if (dto.requiredSkills !== undefined) {
      updates.push(`required_skills = $${paramIndex++}`);
      params.push(JSON.stringify(dto.requiredSkills));
    }
    if (dto.minYears !== undefined) {
      updates.push(`min_years = $${paramIndex++}`);
      params.push(dto.minYears);
    }
    if (dto.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(dto.status);
    }

    if (updates.length === 0) {
      return offer; // Nothing to update
    }

    params.push(id); // For the WHERE clause
    const setClause = updates.join(', ');

    const rows = await this.dataSource.query(`
      UPDATE job_offers
      SET ${setClause}
      WHERE id = $${paramIndex}::uuid
      RETURNING id::text AS "id", title, description, location,
                required_skills AS "requiredSkills", min_years AS "minYears",
                status, created_at AS "createdAt"
    `, params);

    return rows[0];
  }

  // ── Delete ───────────────────────────────────────────────────────
  async remove(id: string) {
    const rows = await this.dataSource.query(
      `SELECT id FROM job_offers WHERE id = $1::uuid`, [id],
    );
    if (!rows.length) throw new NotFoundException(`Job offer ${id} not found`);

    await this.dataSource.query(
      `DELETE FROM job_offers WHERE id = $1::uuid`, [id],
    );
  }

  // ── Match candidates via RAG pipeline ───────────────────────────
  // Runs on-demand — results are never stored (always fresh)
  async matchCandidates(id: string, apiKey?: string, mode = 'groq') {
    const offer = await this.findOne(id);

    // Build a rich query string from the job offer fields
    const skillsPart = offer.requiredSkills?.length
      ? `Required skills: ${(offer.requiredSkills as string[]).join(', ')}.`
      : '';
    const yearsPart = offer.minYears
      ? `Minimum ${offer.minYears} years of experience.`
      : '';
    const locationPart = offer.location
      ? `Location: ${offer.location}.`
      : '';

    const query = [
      `Find candidates for the following job offer: ${offer.title}.`,
      offer.description,
      skillsPart,
      yearsPart,
      locationPart,
    ].filter(Boolean).join(' ');

    const result = await this.chatbot.recommend({
      message:        query,
      mode:           mode as any,
      apiKey:         apiKey,
      history:        [],
      lastCandidates: [],
    });

    return {
      offer,
      ...result,
    };
  }
}