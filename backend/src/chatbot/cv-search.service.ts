import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource }   from '@nestjs/typeorm';
import { DataSource }         from 'typeorm';
import { ExtractedFilters }   from './keyword-extractor.service';

export interface RawCandidate {
  candidateId:  string;
  name:         string;
  email:        string | null;
  location:     string | null;
  currentTitle: string | null;
  yearsExp:     number | null;
  skills:       string[];
  summary:      string | null;
  embedding:    string | null;
}

export interface FullCandidate extends RawCandidate {
  education:  any[];
  experience: any[];
  languages:  any[];
}

@Injectable()
export class CvSearchService {
  private readonly logger = new Logger(CvSearchService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

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

  async findByEmbedding(queryEmbedding: number[], limit = 30): Promise<RawCandidate[]> {
    const vectorStr = `[${queryEmbedding.join(',')}]`;

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
        1 - (cpd.embedding::vector <=> $1::vector) AS similarity
      FROM candidates c
      JOIN cvs cv             ON cv.candidate_id = c.id::text
      JOIN cv_parsed_data cpd ON cpd.cv_id       = cv.id::text
      WHERE cpd.embedding IS NOT NULL
      ORDER BY cpd.embedding::vector <=> $1::vector
      LIMIT $2
    `;

    const results = await this.dataSource.query(query, [vectorStr, limit]);
    this.logger.log(`🔍 findByEmbedding: ${results.length} candidates`);

    return results.map((r: any) => ({
      ...this.mapRaw(r),
      similarity: parseFloat(r.similarity ?? 0),
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

  private mapRaw(r: any): RawCandidate {
    return {
      candidateId:  r.candidateId,
      name:         r.name?.trim() || 'Unknown',
      email:        r.email        ?? null,
      location:     r.location     ?? null,
      currentTitle: r.currentTitle ?? null,
      yearsExp:     r.yearsExp     ?? null,
      skills:       Array.isArray(r.skills) ? r.skills : [],
      summary:      r.summary      ?? null,
      embedding:    r.embedding    ?? null,
    };
  }
}