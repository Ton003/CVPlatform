import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * ✅ Aggregates high-level system metrics and recent activities
   * ABAC: Supports scoping to a manager's jobs.
   */
  async getStats(scopedJobIds: string[] = []) {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const isScoped = scopedJobIds.length > 0;
    const scopedFilter = isScoped ? 'AND a.job_id = ANY($1::uuid[])' : '';
    const candScopedFilter = isScoped
      ? 'AND id IN (SELECT candidate_id::uuid FROM applications WHERE job_id = ANY($1::uuid[]))'
      : '';
    const params = isScoped ? [scopedJobIds] : [];
    const weekParams = isScoped ? [weekAgo, scopedJobIds] : [weekAgo];
    const weekFilter = isScoped
      ? 'AND created_at >= $1 AND id IN (SELECT candidate_id::uuid FROM applications WHERE job_id = ANY($2::uuid[]))'
      : 'AND created_at >= $1';

    // Run queries in parallel for performance
    const [
      totalRows,
      weekRows,
      stageRows,
      recentRows,
      skillRows,
      interviewRows,
      pendingRows,
    ] = await Promise.all([
      this.dataSource.query(
        `SELECT COUNT(*) AS count FROM candidates WHERE 1=1 ${candScopedFilter}`,
        params,
      ),
      this.dataSource.query(
        `SELECT COUNT(*) AS count FROM candidates WHERE 1=1 ${weekFilter}`,
        weekParams,
      ),
      this.dataSource.query(
        `SELECT stage, COUNT(*) AS count FROM applications a WHERE 1=1 ${scopedFilter} GROUP BY stage`,
        params,
      ),
      this.dataSource.query(
        `
        SELECT id::text AS "id", CONCAT(first_name, ' ', last_name) AS name, 
               current_title AS "currentTitle", created_at AS "createdAt"
        FROM candidates WHERE 1=1 ${candScopedFilter} ORDER BY created_at DESC LIMIT 5
      `,
        params,
      ),
      this.dataSource.query(
        `
        SELECT LOWER(skill) as skill, COUNT(*) as count 
        FROM (
          SELECT jsonb_array_elements_text(cpd.skills_technical) as skill 
          FROM cv_parsed_data cpd
          JOIN cvs cv ON cv.id = cpd.cv_id::uuid
          JOIN candidates c ON c.id = cv.candidate_id::uuid
          WHERE jsonb_typeof(cpd.skills_technical) = 'array'
          ${isScoped ? 'AND c.id IN (SELECT candidate_id FROM applications WHERE job_id = ANY($1::uuid[]))' : ''}
        ) as skills_flat GROUP BY LOWER(skill) ORDER BY count DESC LIMIT 10
      `,
        params,
      ),
      // NEW: Upcoming Interviews
      this.dataSource.query(
        `
        SELECT i.id::text, i.scheduled_at AS "scheduledAt", i.type, i.interviewer_name AS "interviewerName", 
               CONCAT(c.first_name, ' ', c.last_name) AS "candidateName",
               j.title AS "jobTitle"
        FROM interviews i
        JOIN applications a ON i.application_id = a.id
        JOIN candidates c ON a.candidate_id = c.id
        JOIN job_offers j ON a.job_id = j.id
        WHERE i.scheduled_at >= NOW() ${scopedFilter}
        ORDER BY i.scheduled_at ASC LIMIT 5
      `,
        params,
      ),
      // NEW: Pending Screenings
      this.dataSource.query(
        `
        SELECT COUNT(*) AS count FROM applications a 
        WHERE a.stage = 'applied' ${scopedFilter}
      `,
        params,
      ),
    ]);

    const stages: Record<string, number> = {
      applied: 0,
      screening: 0,
      interview: 0,
      assessment: 0,
      offer: 0,
      hired: 0,
      rejected: 0,
    };
    stageRows.forEach((r: any) => {
      if (stages[r.stage] !== undefined) stages[r.stage] = Number(r.count);
    });

    return {
      totalCandidates: Number(totalRows[0].count),
      addedThisWeek: Number(weekRows[0].count),
      pendingScreenings: Number(pendingRows[0].count),
      stages,
      recentCandidates: recentRows,
      topSkills: skillRows.map((r: any) => ({
        skill: r.skill,
        count: Number(r.count),
      })),
      upcomingInterviews: interviewRows,
    };
  }
}
