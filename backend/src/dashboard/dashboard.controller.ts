import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectDataSource }           from '@nestjs/typeorm';
import { DataSource }                 from 'typeorm';
import { SkipThrottle }               from '@nestjs/throttler';
import { JwtAuthGuard }               from '../auth/jwt-auth.guard';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
@SkipThrottle()
export class DashboardController {

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  @Get('stats')
  async getStats() {

    // ── Total candidates ──────────────────────────────────────────
    const [[totals], [thisWeek], stageCounts, recentCandidates, topSkills] =
      await Promise.all([

        // Total + added this week
        this.dataSource.query(`
          SELECT
            COUNT(*)                                            AS total,
            COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS this_week
          FROM candidates
        `),

        // Candidates added in previous week (for trend calculation)
        this.dataSource.query(`
          SELECT COUNT(*) AS prev_week
          FROM candidates
          WHERE created_at >= NOW() - INTERVAL '14 days'
            AND created_at <  NOW() - INTERVAL '7 days'
        `),

        // Stage breakdown from notes (latest note per candidate)
        this.dataSource.query(`
          SELECT stage, COUNT(DISTINCT candidate_id) AS count
          FROM (
            SELECT DISTINCT ON (candidate_id)
              candidate_id, stage
            FROM candidate_notes
            ORDER BY candidate_id, created_at DESC
          ) latest
          GROUP BY stage
        `),

        // 5 most recent candidates
        this.dataSource.query(`
          SELECT
            c.id::text                              AS "candidateId",
            CONCAT(c.first_name, ' ', c.last_name)  AS name,
            c.current_title                         AS "currentTitle",
            c.location,
            c.created_at                            AS "createdAt",
            cpd.skills_technical                    AS skills
          FROM candidates c
          LEFT JOIN cvs cv             ON cv.candidate_id = c.id::text
          LEFT JOIN cv_parsed_data cpd ON cpd.cv_id       = cv.id::text
          ORDER BY c.created_at DESC
          LIMIT 5
        `),

        // Top 8 skills across all candidates
        this.dataSource.query(`
          SELECT skill, COUNT(*) AS count
          FROM candidates c
          LEFT JOIN cvs cv             ON cv.candidate_id = c.id::text
          LEFT JOIN cv_parsed_data cpd ON cpd.cv_id       = cv.id::text,
          jsonb_array_elements_text(cpd.skills_technical) AS skill
          GROUP BY skill
          ORDER BY count DESC
          LIMIT 8
        `),
      ]);

    const total    = parseInt(totals.total,      10);
    const week     = parseInt(totals.this_week,  10);
    const prevWeek = parseInt(thisWeek.prev_week, 10);

    // Trend: +N this week vs last week
    const weekDiff  = week - prevWeek;
    const weekTrend = weekDiff > 0 ? `+${weekDiff} this week`
                    : weekDiff < 0 ? `${weekDiff} this week`
                    : 'same as last week';

    // Stage counts map
    const stages: Record<string, number> = {
      screening: 0, interview: 0, offer: 0, rejected: 0,
    };
    for (const row of stageCounts) {
      stages[row.stage] = parseInt(row.count, 10);
    }

    return {
      totalCandidates: total,
      addedThisWeek:   week,
      weekTrend,
      stages,
      recentCandidates: recentCandidates.map((c: any) => ({
        candidateId:  c.candidateId,
        name:         c.name?.trim() || 'Unknown',
        currentTitle: c.currentTitle ?? null,
        location:     c.location     ?? null,
        createdAt:    c.createdAt,
        skills:       Array.isArray(c.skills) ? c.skills.slice(0, 4) : [],
      })),
      topSkills: topSkills.map((s: any) => ({
        skill: s.skill,
        count: parseInt(s.count, 10),
      })),
    };
  }
}