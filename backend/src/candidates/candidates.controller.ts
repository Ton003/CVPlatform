import {
  Controller, Get, Delete, Param, UseGuards, Query,
  NotFoundException, HttpCode, HttpStatus,
} from '@nestjs/common';
import { SkipThrottle }     from '@nestjs/throttler';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource }       from 'typeorm';
import { JwtAuthGuard }     from '../auth/jwt-auth.guard';

// ── Role catalog for suggestions ──────────────────────────────────
const ROLE_CATALOG: Record<string, string[]> = {
  'Frontend Developer':        ['javascript', 'typescript', 'react', 'angular', 'vue', 'html', 'css', 'tailwind', 'bootstrap'],
  'Backend Developer':         ['node', 'nodejs', 'nestjs', 'express', 'java', 'spring', 'python', 'django', 'flask', 'fastapi', 'php', 'laravel', 'sql', 'postgresql', 'mysql', 'mongodb', 'rest api', 'docker'],
  'Full Stack Developer':      ['javascript', 'typescript', 'react', 'angular', 'node', 'nodejs', 'sql', 'postgresql', 'docker', 'html', 'css'],
  'DevOps Engineer':           ['docker', 'kubernetes', 'jenkins', 'ci/cd', 'linux', 'ansible', 'terraform', 'aws', 'azure', 'gcp', 'gitlab', 'bash'],
  'Data Scientist':            ['python', 'machine learning', 'deep learning', 'pandas', 'numpy', 'tensorflow', 'pytorch', 'scikit', 'sql', 'nlp', 'data preprocessing'],
  'Machine Learning Engineer': ['python', 'tensorflow', 'pytorch', 'scikit', 'nlp', 'machine learning', 'deep learning', 'model training', 'data preprocessing', 'pandas'],
  'Mobile Developer':          ['flutter', 'dart', 'react native', 'android', 'ios', 'kotlin', 'swift', 'java'],
  'Network Engineer':          ['cisco', 'tcp/ip', 'ospf', 'vlan', 'networking', 'linux', 'firewall', 'vpn', 'ccna', 'routing'],
  'UI/UX Designer':            ['figma', 'photoshop', 'illustrator', 'adobe xd', 'ui', 'ux', 'prototyping', 'wireframing', 'css'],
  'System Administrator':      ['linux', 'ubuntu', 'windows server', 'bash', 'networking', 'docker', 'vmware', 'active directory'],
};

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

  // ── GET /candidates/:id/score ────────────────────────────────────
  @SkipThrottle()
  @Get(':id/score')
  async getScore(@Param('id') id: string) {

    // 1. Fetch candidate skills
    const profileRows = await this.dataSource.query(`
      SELECT cpd.skills_technical AS skills
      FROM candidates c
      JOIN cvs cv             ON cv.candidate_id = c.id::text
      JOIN cv_parsed_data cpd ON cpd.cv_id       = cv.id::text
      WHERE c.id = $1::uuid
      LIMIT 1
    `, [id]);

    if (!profileRows.length) throw new NotFoundException(`Candidate ${id} not found`);
    const skills: string[] = (profileRows[0].skills ?? []).map((s: string) => s.toLowerCase());

    // 2. Manager score — average of note ratings (only rated notes)
    const noteRows = await this.dataSource.query(`
      SELECT rating FROM candidate_notes
      WHERE candidate_id = $1 AND rating > 0
    `, [id]);

    let managerScore: number | null = null;
    if (noteRows.length > 0) {
      const avg = noteRows.reduce((sum: number, n: any) => sum + n.rating, 0) / noteRows.length;
      managerScore = Math.round((avg / 5) * 100);
    }

    // 3. AssessFirst score — based on dimension detail coverage
    const afRows = await this.dataSource.query(`
      SELECT dimension_details FROM assessfirst_results
      WHERE candidate_id = $1
      LIMIT 1
    `, [id]);

    let afScore: number | null = null;
    if (afRows.length > 0 && afRows[0].dimension_details) {
      const details = afRows[0].dimension_details as Record<string, Record<string, string[]>>;
      let totalBullets = 0;
      let totalPossible = 0;
      for (const dim of Object.values(details)) {
        for (const bullets of Object.values(dim)) {
          totalPossible += 3; // expect ~3 bullets per sub-skill
          totalBullets  += Math.min(bullets.length, 3);
        }
      }
      afScore = totalPossible > 0 ? Math.round((totalBullets / totalPossible) * 100) : null;
    }

    // 4. Technical match score — best role overlap from catalog
    let technicalScore: number | null = null;
    let bestRoleMatch  = '';
    let bestRoleScore  = 0;

    for (const [role, roleSkills] of Object.entries(ROLE_CATALOG)) {
      const matched = roleSkills.filter(rs =>
        skills.some(cs => cs.includes(rs) || rs.includes(cs))
      ).length;
      const pct = Math.round((matched / roleSkills.length) * 100);
      if (pct > bestRoleScore) {
        bestRoleScore = pct;
        bestRoleMatch = role;
      }
    }
    technicalScore = bestRoleScore;

    // 5. Composite score — weighted average of available components
    const weights: Record<string, number> = {
      technical: 0.45,
      assessfirst: 0.35,
      manager: 0.20,
    };

    let weightedSum   = 0;
    let weightedTotal = 0;

    weightedSum   += (technicalScore ?? 0) * weights.technical;
    weightedTotal += weights.technical;

    if (afScore !== null) {
      weightedSum   += afScore * weights.assessfirst;
      weightedTotal += weights.assessfirst;
    }

    if (managerScore !== null) {
      weightedSum   += managerScore * weights.manager;
      weightedTotal += weights.manager;
    }

    const compositeScore = weightedTotal > 0
      ? Math.round(weightedSum / weightedTotal)
      : technicalScore ?? 0;

    // 6. Role suggestions — top 3 matches above 30%
    const roleSuggestions = Object.entries(ROLE_CATALOG)
      .map(([role, roleSkills]) => {
        const matched = roleSkills.filter(rs =>
          skills.some(cs => cs.includes(rs) || rs.includes(cs))
        );
        return {
          role,
          score:         Math.round((matched.length / roleSkills.length) * 100),
          matchedSkills: matched,
        };
      })
      .filter(r => r.score >= 30)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    // 7. Score label
    const label =
      compositeScore >= 80 ? 'Excellent' :
      compositeScore >= 65 ? 'Strong'    :
      compositeScore >= 50 ? 'Moderate'  : 'Developing';

    return {
      compositeScore,
      label,
      breakdown: {
        technical:   { score: technicalScore,  weight: 45, role: bestRoleMatch, available: true },
        assessfirst: { score: afScore,          weight: 35, available: afScore !== null },
        manager:     { score: managerScore,     weight: 20, available: managerScore !== null, noteCount: noteRows.length },
      },
      roleSuggestions,
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