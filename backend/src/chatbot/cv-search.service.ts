import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource }   from '@nestjs/typeorm';
import { DataSource }         from 'typeorm';
import { ExtractedFilters }   from './keyword-extractor.service';

export interface RawPerson {
  candidateId:  string;
  personType:   'candidate' | 'employee';
  name:         string;
  email:        string | null;
  location:     string | null;
  currentTitle: string | null;
  yearsExp:     number | null;
  skills:       string[];
  summary:      string | null;
  similarity?:  number;
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
      this.logger.warn('⚠️ pgvector extension check failed. Ensure it is manually enabled.');
    }
  }

  /**
   * ✅ Recall candidates using relational filters (SQL)
   */
  async findByFilters(filters: ExtractedFilters): Promise<RawCandidate[]> {
    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let pIdx = 1;

    if (filters.minYears !== null) {
      conditions.push(`c.years_experience >= $${pIdx++}`);
      params.push(filters.minYears);
    }

    if (filters.location) {
      conditions.push(`LOWER(c.location) ILIKE $${pIdx++}`);
      params.push(`%${filters.location.toLowerCase()}%`);
    }

    if (filters.skills.length > 0) {
      const skillCond = filters.skills.map(s => {
        params.push(s.toLowerCase());
        return `EXISTS (SELECT 1 FROM jsonb_array_elements_text(cpd.skills_technical) AS sk WHERE LOWER(sk) = $${pIdx++})`;
      });
      conditions.push(`(${skillCond.join(' OR ')})`);
    }

    const query = `
      SELECT
        c.id::text           AS "candidateId",
        CONCAT(c.first_name, ' ', c.last_name) AS name,
        c.email, c.location, c.current_title AS "currentTitle",
        c.years_experience   AS "yearsExp",
        cpd.skills_technical AS skills,
        cpd.llm_summary      AS summary
      FROM candidates c
      JOIN cvs cv ON cv.candidate_id = c.id::text
      JOIN cv_parsed_data cpd ON cpd.cv_id = cv.id::text
      WHERE ${conditions.join(' AND ')}
      ORDER BY c.created_at DESC LIMIT 50
    `;

    const results = await this.dataSource.query(query, params);
    return results.map((r: any) => this.mapRaw(r));
  }

  /**
   * ✅ Recall using Vector Similarity (Semantic Search)
   */
  async findByEmbedding(
    queryEmbedding: number[], 
    limit = 30, 
    personType?: string,
    scopedCandidateIds?: string[],
    scopedDepartmentId?: string
  ): Promise<RawCandidate[]> {
    const vectorStr = `[${queryEmbedding.join(',')}]`;
    const params: any[] = [vectorStr, limit];
    let pIdx = 3; // start from 3 because $1=vector, $2=limit

    let candidateScope = '';
    if (scopedCandidateIds && scopedCandidateIds.length > 0) {
      params.push(scopedCandidateIds);
      candidateScope = `AND c.id::text = ANY($${pIdx++}::text[])`;
    }

    let employeeScope = '';
    if (scopedDepartmentId) {
      params.push(scopedDepartmentId);
      employeeScope = `AND dm.id = $${pIdx++}::uuid`;
    }

    const typeFilter = personType && personType !== 'all' ? `WHERE "personType" = '${personType}'` : '';

    const query = `
      WITH unified_pool AS (
        SELECT 
          c.id::text AS "candidateId", 'candidate' AS "personType",
          CONCAT(c.first_name, ' ', c.last_name) AS name,
          c.email, c.location, c.current_title AS "currentTitle",
          c.years_experience AS "yearsExp", cpd.skills_technical AS skills,
          cpd.llm_summary AS summary, cpd.embedding::vector AS embedding,
          NULL AS "buName", NULL AS "departmentName", NULL AS "rankName"
        FROM candidates c
        JOIN cvs cv ON cv.candidate_id = c.id::text
        JOIN cv_parsed_data cpd ON cpd.cv_id = cv.id::text
        WHERE cpd.embedding IS NOT NULL ${candidateScope}
        UNION ALL
        SELECT 
          e.id::text AS "candidateId", 'employee' AS "personType",
          CONCAT(e.first_name, ' ', e.last_name) AS name,
          e.email, NULL AS location, jr.name AS "currentTitle",
          NULL::smallint AS "yearsExp", '[]'::jsonb AS skills,
          e.llm_summary AS summary, e.embedding::vector AS embedding,
          bu.name AS "buName", dm.name AS "departmentName", jrl.title AS "rankName"
        FROM employees e
        JOIN job_roles jr ON jr.id = e.job_role_id
        JOIN job_role_levels jrl ON jrl.id = e.job_role_level_id
        JOIN departments dm ON dm.id = jr.department_id
        JOIN business_units bu ON bu.id = dm.business_unit_id
        WHERE e.embedding IS NOT NULL ${employeeScope}
      )
      SELECT *, 1 - (embedding <=> $1::vector) AS similarity
      FROM unified_pool
      ${typeFilter}
      ORDER BY similarity DESC LIMIT $2
    `;

    const results = await this.dataSource.query(query, params);
    return results.map((r: any) => ({
      ...this.mapRaw(r),
      similarity: parseFloat(r.similarity ?? 0),
      buName: r.buName,
      departmentName: r.departmentName,
      rankName: r.rankName
    }));
  }

  async findFullCandidate(candidateId: string): Promise<FullCandidate> {
    const results = await this.dataSource.query(`
      SELECT
        c.id::text AS "candidateId",
        CONCAT(c.first_name, ' ', c.last_name) AS name,
        c.email, c.location, c.current_title AS "currentTitle",
        c.years_experience AS "yearsExp", cpd.skills_technical AS skills,
        cpd.llm_summary AS summary, cpd.education, cpd.experience, cpd.languages
      FROM candidates c
      JOIN cvs cv ON cv.candidate_id = c.id::text
      JOIN cv_parsed_data cpd ON cpd.cv_id = cv.id::text
      WHERE c.id = $1::uuid LIMIT 1
    `, [candidateId]);

    if (!results.length) throw new Error(`Candidate ${candidateId} not found`);

    const r = results[0];
    return {
      ...this.mapRaw(r),
      education: Array.isArray(r.education) ? r.education : [],
      experience: Array.isArray(r.experience) ? r.experience : [],
      languages: Array.isArray(r.languages) ? r.languages : [],
    };
  }

  private mapRaw(r: any): RawPerson {
    return {
      candidateId: r.candidateId,
      personType: r.personType || 'candidate',
      name: r.name?.trim() || 'Unknown',
      email: r.email || null,
      location: r.location || null,
      currentTitle: r.currentTitle || null,
      yearsExp: r.yearsExp || null,
      skills: Array.isArray(r.skills) ? r.skills : [],
      summary: r.summary || null,
      similarity: r.similarity ? parseFloat(r.similarity) : undefined,
    };
  }
}