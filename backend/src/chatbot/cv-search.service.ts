import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource }   from '@nestjs/typeorm';
import { DataSource }         from 'typeorm';
import { ExtractedFilters }   from './keyword-extractor.service';

export interface RawPerson {
  candidateId:  string; // Primary identifier for search
  personType:   'candidate' | 'employee';
  name:         string;
  email:        string | null;
  location:     string | null;
  currentTitle: string | null;
  yearsExp:     number | null;
  skills:       string[];
  summary:      string | null;
  similarity?:  number;
  // Metadata for employees
  buName?:      string;
  departmentName?: string;
  rankName?:    string;
}

export type RawCandidate = RawPerson;

export interface FullCandidate extends RawPerson {
  education:  any[];
  experience: any[];
  languages:  any[];
}

@Injectable()
export class CvSearchService implements OnModuleInit {
  private readonly logger = new Logger(CvSearchService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    try {
      await this.dataSource.query('CREATE EXTENSION IF NOT EXISTS vector;');
      this.logger.log('✅ pgvector extension is ready');
    } catch (err) {
      this.logger.warn('⚠️ Could not automatically create pgvector extension. Make sure it is installed and enabled on your database.');
    }
  }

  async findByFilters(filters: ExtractedFilters): Promise<RawCandidate[]> {
    const conditions: string[] = ['1=1'];
    const params: any[]        = [];
    let   paramIndex           = 1;

    if (filters.minYears !== null) {
      conditions.push(`c.years_experience >= $${paramIndex++}`);
      params.push(filters.minYears);
    }

    if (filters.location) {
      conditions.push(`LOWER(c.location) ILIKE $${paramIndex++}`);
      params.push(`%${filters.location.toLowerCase()}%`);
    }

    if (filters.skills.length > 0) {
      const skillConditions = filters.skills.map(skill => {
        params.push(skill.toLowerCase());
        return `EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(cpd.skills_technical) AS s
          WHERE LOWER(s) = $${paramIndex++}
        )`;
      });
      conditions.push(`(${skillConditions.join(' OR ')})`);
    }

    if (filters.language) {
      params.push(`%${filters.language.toLowerCase()}%`);
      conditions.push(`EXISTS (
        SELECT 1 FROM jsonb_array_elements(cpd.languages) AS lang
        WHERE LOWER(lang->>'name') ILIKE $${paramIndex++}
      )`);
    }

    if (filters.degree) {
      params.push(`%${filters.degree.toLowerCase()}%`);
      conditions.push(`EXISTS (
        SELECT 1 FROM jsonb_array_elements(cpd.education) AS edu
        WHERE LOWER(edu->>'degree') ILIKE $${paramIndex++}
      )`);
    }

    if (filters.institution) {
      params.push(`%${filters.institution.toLowerCase()}%`);
      conditions.push(`EXISTS (
        SELECT 1 FROM jsonb_array_elements(cpd.education) AS edu
        WHERE LOWER(edu->>'institution') ILIKE $${paramIndex++}
      )`);
    }

    const query = `
      SELECT
        c.id::text                             AS "candidateId",
        CONCAT(c.first_name, ' ', c.last_name) AS name,
        c.email,
        c.location,
        c.current_title                        AS "currentTitle",
        c.years_experience                     AS "yearsExp",
        cpd.skills_technical                   AS skills,
        cpd.llm_summary                        AS summary,
        cpd.embedding
      FROM candidates c
      JOIN cvs cv             ON cv.candidate_id = c.id::text
      JOIN cv_parsed_data cpd ON cpd.cv_id       = cv.id::text
      WHERE ${conditions.join(' AND ')}
      ORDER BY c.created_at DESC
      LIMIT 50
    `;

    const results = await this.dataSource.query(query, params);
    this.logger.log(
      `🔍 findByFilters: ${results.length} candidates — ` +
      `skills:[${filters.skills.join(',')}] loc:${filters.location} lang:${filters.language}`
    );

    return results.map((r: any) => this.mapRaw(r));
  }

  async findByEmbedding(queryEmbedding: number[], limit = 30, personType?: string): Promise<RawCandidate[]> {
    const vectorStr = `[${queryEmbedding.join(',')}]`;

    let typeFilter = '';
    if (personType && personType !== 'all') {
      typeFilter = `WHERE personType = '${personType}'`;
    }

    const query = `
      WITH unified_pool AS (
        -- Candidates
        SELECT 
          c.id::text AS "candidateId",
          'candidate' AS "personType",
          CONCAT(c.first_name, ' ', c.last_name) AS name,
          c.email,
          c.location,
          c.current_title AS "currentTitle",
          c.years_experience AS "yearsExp",
          cpd.skills_technical AS skills,
          cpd.llm_summary AS summary,
          cpd.embedding::vector AS embedding,
          NULL::text AS "buName",
          NULL::text AS "departmentName",
          NULL::text AS "rankName"
        FROM candidates c
        JOIN cvs cv ON cv.candidate_id = c.id::text
        JOIN cv_parsed_data cpd ON cpd.cv_id = cv.id::text
        WHERE cpd.embedding IS NOT NULL

        UNION ALL

        -- Employees
        SELECT 
          e.id::text AS "candidateId",
          'employee' AS "personType",
          CONCAT(e.first_name, ' ', e.last_name) AS name,
          e.email,
          NULL AS location,
          jr.name AS "currentTitle",
          NULL::smallint AS "yearsExp",
          '[]'::jsonb AS skills,
          e.llm_summary AS summary,
          e.embedding::vector AS embedding,
          bu.name AS "buName",
          dm.name AS "departmentName",
          jrl.title AS "rankName"
        FROM employees e
        JOIN job_roles jr ON jr.id = e.job_role_id
        JOIN job_role_levels jrl ON jrl.id = e.job_role_level_id
        JOIN departments dm ON dm.id = jr.department_id
        JOIN business_units bu ON bu.id = dm.business_unit_id
        WHERE e.embedding IS NOT NULL
      )
      SELECT *, 1 - (embedding <=> $1::vector) AS similarity
      FROM unified_pool
      ${typeFilter}
      ORDER BY embedding <=> $1::vector
      LIMIT $2
    `;

    const results = await this.dataSource.query(query, [vectorStr, limit]);
    this.logger.log(`🔍 findByEmbedding: ${results.length} unified candidates`);

    return results.map((r: any) => ({
      ...this.mapRaw(r),
      similarity: parseFloat(r.similarity ?? 0),
      personType: r.personType || 'candidate',
      buName: r.buName,
      departmentName: r.departmentName,
      rankName: r.rankName
    }));
  }

  async findFullCandidate(candidateId: string): Promise<FullCandidate> {
    const query = `
      SELECT
        c.id::text                             AS "candidateId",
        CONCAT(c.first_name, ' ', c.last_name) AS name,
        c.email,
        c.location,
        c.current_title                        AS "currentTitle",
        c.years_experience                     AS "yearsExp",
        cpd.skills_technical                   AS skills,
        cpd.llm_summary                        AS summary,
        cpd.embedding,
        cpd.education,
        cpd.experience,
        cpd.languages
      FROM candidates c
      JOIN cvs cv             ON cv.candidate_id = c.id::text
      JOIN cv_parsed_data cpd ON cpd.cv_id       = cv.id::text
      WHERE c.id = $1::uuid
      LIMIT 1
    `;

    const results = await this.dataSource.query(query, [candidateId]);

    if (!results.length) {
      this.logger.warn(`⚠️  findFullCandidate: no result for id=${candidateId}`);
      throw new Error(`Candidate ${candidateId} not found`);
    }

    const r = results[0];
    return {
      ...this.mapRaw(r),
      education:  Array.isArray(r.education)  ? r.education  : [],
      experience: Array.isArray(r.experience) ? r.experience : [],
      languages:  Array.isArray(r.languages)  ? r.languages  : [],
    };
  }

  async findUnifiedMatch(queryEmbedding: number[], filters: any = {}, limit = 30): Promise<RawPerson[]> {
    const vectorStr = `[${queryEmbedding.join(',')}]`;
    const params: any[] = [vectorStr, limit];
    let paramIndex = 3;

    let metadataFilter = '1=1';
    if (filters.buName) {
      metadataFilter += ` AND bu.name ILIKE $${paramIndex++}`;
      params.push(`%${filters.buName}%`);
    }

    const query = `
      WITH unified_pool AS (
        -- Candidates
        SELECT 
          c.id::text AS uuid,
          'candidate'::text AS "personType",
          CONCAT(c.first_name, ' ', c.last_name) AS name,
          c.email,
          c.location,
          c.current_title AS "currentTitle",
          c.years_experience AS "yearsExp",
          cpd.skills_technical AS skills,
          cpd.llm_summary AS summary,
          cpd.embedding::vector AS embedding,
          NULL::text AS "buName",
          NULL::text AS "departmentName",
          NULL::text AS "rankName"
        FROM candidates c
        JOIN cvs cv ON cv.candidate_id = c.id::text
        JOIN cv_parsed_data cpd ON cpd.cv_id = cv.id::text
        WHERE cpd.embedding IS NOT NULL

        UNION ALL

        -- Employees
        SELECT 
          e.id::text AS uuid,
          'employee'::text AS "personType",
          CONCAT(e.first_name, ' ', e.last_name) AS name,
          e.email,
          NULL AS location, -- Employees don't have location in entity yet
          jr.name AS "currentTitle",
          NULL::smallint AS "yearsExp", -- Employees use hireDate/experience differently
          NULL::jsonb AS skills,
          e.llm_summary AS summary,
          e.embedding::vector AS embedding,
          bu.name AS "buName",
          dm.name AS "departmentName",
          jrl.title AS "rankName"
        FROM employees e
        JOIN job_roles jr ON jr.id = e.job_role_id
        JOIN job_role_levels jrl ON jrl.id = e.job_role_level_id
        JOIN departments dm ON dm.id = jr.department_id
        JOIN business_units bu ON bu.id = dm.business_unit_id
        WHERE e.embedding IS NOT NULL AND ${metadataFilter}
      )
      SELECT *, 1 - (embedding <=> $1::vector) AS similarity
      FROM unified_pool
      ORDER BY embedding <=> $1::vector
      LIMIT $2;
    `;

    const results = await this.dataSource.query(query, params);
    return results.map((r: any) => ({
      candidateId:  r.uuid,
      uuid:         r.uuid,
      personType:   r.personType,
      name:         r.name,
      email:        r.email,
      location:     r.location,
      currentTitle: r.currentTitle,
      yearsExp:     r.yearsExp,
      skills:       r.skills || [],
      summary:      r.summary,
      similarity:   parseFloat(r.similarity ?? 0),
      buName:       r.buName,
      departmentName: r.departmentName,
      rankName:     r.rankName
    }));
  }

  private mapRaw(r: any): any {
    return {
      candidateId:  r.candidateId || r.uuid,
      uuid:         r.candidateId || r.uuid,
      personType:   r.personType || 'candidate',
      name:         r.name?.trim() || 'Unknown',
      email:        r.email        ?? null,
      location:     r.location     ?? null,
      currentTitle: r.currentTitle ?? null,
      yearsExp:     r.yearsExp     ?? null,
      skills:       Array.isArray(r.skills) ? r.skills : [],
      summary:      r.summary      ?? null,
      similarity:   r.similarity ? parseFloat(r.similarity) : undefined
    };
  }
}