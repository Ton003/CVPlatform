import {
  Controller, Get, Delete, Param, UseGuards, Query,
  NotFoundException, HttpCode, HttpStatus,
} from '@nestjs/common';
import { SkipThrottle }     from '@nestjs/throttler';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource }       from 'typeorm';
import { JwtAuthGuard }     from '../auth/jwt-auth.guard';

@Controller('candidates')
@UseGuards(JwtAuthGuard)
export class CandidatesController {

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  // ── GET /candidates?search=&page=&limit= ─────────────────────────
  @SkipThrottle()
  @Get()
  async list(
    @Query('search') search?: string,
    @Query('page')   page   = '1',
    @Query('limit')  limit  = '20',
  ) {
    const pageNum  = Math.max(1, parseInt(page,  10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const offset   = (pageNum - 1) * limitNum;

    const params: any[] = [];
    let whereClause = '1=1';

    if (search?.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      whereClause = `
        LOWER(CONCAT(c.first_name, ' ', c.last_name)) ILIKE $${params.length}
        OR LOWER(c.email) ILIKE $${params.length}
        OR LOWER(c.current_title) ILIKE $${params.length}
      `;
    }

    const countRows = await this.dataSource.query(`
      SELECT COUNT(*) AS total
      FROM candidates c
      WHERE ${whereClause}
    `, params);

    const total = parseInt(countRows[0].total, 10);

    params.push(limitNum, offset);
    const rows = await this.dataSource.query(`
      SELECT
        c.id::text                              AS "candidateId",
        CONCAT(c.first_name, ' ', c.last_name) AS name,
        c.email,
        c.location,
        c.current_title                         AS "currentTitle",
        c.years_experience                      AS "yearsExp",
        c.created_at                            AS "createdAt"
      FROM candidates c
      WHERE ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT $${params.length - 1}
      OFFSET $${params.length}
    `, params);

    return {
      data:       rows,
      total,
      page:       pageNum,
      limit:      limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  }

  // ── GET /candidates/:id ──────────────────────────────────────────
  @SkipThrottle()
  @Get(':id')
  async getProfile(@Param('id') id: string) {
    const rows = await this.dataSource.query(`
      SELECT
        c.id::text                             AS "candidateId",
        CONCAT(c.first_name, ' ', c.last_name) AS name,
        c.email,
        c.location,
        c.current_title                        AS "currentTitle",
        c.years_experience                     AS "yearsExp",
        c.created_at                           AS "createdAt",
        cpd.skills_technical                   AS skills,
        cpd.llm_summary                        AS summary,
        cpd.education,
        cpd.experience,
        cpd.languages
      FROM candidates c
      JOIN cvs cv             ON cv.candidate_id = c.id::text
      JOIN cv_parsed_data cpd ON cpd.cv_id       = cv.id::text
      WHERE c.id = $1::uuid
      LIMIT 1
    `, [id]);

    if (!rows.length) throw new NotFoundException(`Candidate ${id} not found`);

    const r = rows[0];
    return {
      candidateId:  r.candidateId,
      name:         r.name?.trim() || 'Unknown',
      email:        r.email        ?? null,
      location:     r.location     ?? null,
      currentTitle: r.currentTitle ?? null,
      yearsExp:     r.yearsExp     ?? null,
      createdAt:    r.createdAt    ?? null,
      summary:      r.summary      ?? null,
      skills:       Array.isArray(r.skills)     ? r.skills     : [],
      education:    Array.isArray(r.education)  ? r.education  : [],
      experience:   Array.isArray(r.experience) ? r.experience : [],
      languages:    Array.isArray(r.languages)  ? r.languages  : [],
    };
  }

  // ── DELETE /candidates/:id ───────────────────────────────────────
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCandidate(@Param('id') id: string) {
    const rows = await this.dataSource.query(
      `SELECT id FROM candidates WHERE id = $1::uuid`,
      [id],
    );
    if (!rows.length) throw new NotFoundException(`Candidate ${id} not found`);

    await this.dataSource.query(
      `DELETE FROM candidates WHERE id = $1::uuid`,
      [id],
    );
  }
}