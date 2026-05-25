import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Candidate } from './entities/candidates.entity';
import { Cv } from '../cvs/entities/cv.entity';
import * as fs from 'fs';
import * as path from 'path';


@Injectable()
export class CandidatesService {
 private readonly logger = new Logger(CandidatesService.name);

 constructor(
 @InjectRepository(Candidate)
 private readonly candidateRepo: Repository<Candidate>,
 @InjectRepository(Cv)
 private readonly cvRepo: Repository<Cv>,
 @InjectDataSource()
 private readonly dataSource: DataSource,
 ) {}

 /**
 * List candidates with search and pagination, excluding hired/converted staff
 * ABAC: Supports scoping to a manager's jobs.
   */
  async list(
    search?: string,
    page = 1,
    limit = 20,
    scopedJobIds: string[] = [],
  ) {
    const offset = (page - 1) * limit;
    const params: any[] = [];
    let whereClause = "c.status NOT IN ('converted', 'hired')";

    // ABAC scoping: If scopedJobIds is provided (manager), only show candidates in those jobs
    if (scopedJobIds.length > 0) {
      params.push(scopedJobIds);
      whereClause += ` AND c.id IN (
        SELECT candidate_id::uuid FROM applications WHERE job_id = ANY($${params.length}::uuid[])
      )`;
    }

    if (search?.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      whereClause += ` AND (
        LOWER(CONCAT(c.first_name, ' ', c.last_name)) ILIKE $${params.length}
        OR LOWER(c.email) ILIKE $${params.length}
        OR LOWER(c.current_title) ILIKE $${params.length}
      )`;
    }

    const countRows = await this.dataSource.query(
      `
      SELECT COUNT(*) AS total FROM candidates c WHERE ${whereClause}
    `,
      params,
    );

    const total = parseInt(countRows[0].total, 10);
    params.push(limit, offset);

    const rows = await this.dataSource.query(
      `
      SELECT
        c.id::text           AS "candidateId",
        TRIM(CONCAT(c.first_name, ' ', c.last_name)) AS "name",
        c.email,
        c.location,
        c.current_title      AS "currentTitle",
        c.years_experience   AS "yearsExp",
        c.created_at         AS "createdAt"
      FROM candidates c
      WHERE ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
 params,
 );

 return {
 data: rows,
 total,
 page,
 limit,
 totalPages: Math.ceil(total / limit),
 };
 }

 /**
 * Fetch full candidate dossier including latest parsed CV data
 */
 async getProfile(id: string) {
 const rows = await this.dataSource.query(
 `
      SELECT
        c.id::text           AS "candidateId",
        c.first_name         AS "firstName",
        c.last_name          AS "lastName",
        c.email,
        c.location,
        c.current_title      AS "currentTitle",
        c.years_experience   AS "yearsExp",
        c.created_at         AS "createdAt",
        c.competency_snapshot AS "competencySnapshot",
        cpd.skills_technical AS skills,
        cpd.llm_summary      AS summary,
        cpd.education,
        cpd.experience,
        cpd.languages
      FROM candidates c
      LEFT JOIN cvs cv ON cv.candidate_id = c.id::text
      LEFT JOIN cv_parsed_data cpd ON cpd.cv_id = cv.id::text
      WHERE c.id = $1::uuid
      ORDER BY cv.created_at DESC
      LIMIT 1
    `,
      [id],
    );

    if (!rows.length) throw new NotFoundException(`Candidate ${id} not found`);

    const r = rows[0];
    return {
      ...r,
      name: `${r.firstName || ''} ${r.lastName || ''}`.trim() || 'Unknown',
 skills: Array.isArray(r.skills) ? r.skills : [],
 education: Array.isArray(r.education) ? r.education : [],
 experience: Array.isArray(r.experience) ? r.experience : [],
 languages: Array.isArray(r.languages) ? r.languages : [],
 competencySnapshot: r.competencySnapshot || {},
 };
 }

 /**
 * Destructive delete: removes candidate, all CVs, parsed data, and local PDF files
 */
 async delete(id: string) {
 const candidate = await this.candidateRepo.findOne({ where: { id } });
 if (!candidate) throw new NotFoundException(`Candidate ${id} not found`);

    const cvs = await this.cvRepo.find({ where: { candidateId: id } });

    await this.dataSource.transaction(async (manager) => {
      for (const cv of cvs) {
        // 1. Delete parsed data
        await manager.query('DELETE FROM cv_parsed_data WHERE cv_id = $1', [
          cv.id,
        ]);

        // 2. Remove local file
        if (cv.filePath) {
          const fullPath = path.resolve(process.cwd(), cv.filePath);
          if (fs.existsSync(fullPath)) {
            try {
              fs.unlinkSync(fullPath);
            } catch (err) {
              this.logger.error(`File deletion failed: ${fullPath}`, err);
            }
          }
        }

        // 3. Delete CV record
        await manager.remove(cv);
      }

      // 4. Delete candidate record
      await manager.remove(candidate);
    });
  }
}
