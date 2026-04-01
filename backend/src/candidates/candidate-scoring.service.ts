import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

// ── Role catalog ──────────────────────────────────────────────────────────────
// Moved here from CandidatesController where it did not belong.
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

export interface ScoreBreakdown {
  technical:   { score: number; weight: number; role: string; available: boolean };
  assessfirst: { score: number | null; weight: number; available: boolean };
  manager:     { score: number | null; weight: number; available: boolean; noteCount: number };
}

export interface CandidateScoreResult {
  compositeScore: number;
  label:          string;
  breakdown:      ScoreBreakdown;
  roleSuggestions: Array<{ role: string; score: number; matchedSkills: string[] }>;
}

@Injectable()
export class CandidateScoringService {

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async score(candidateId: string): Promise<CandidateScoreResult> {
    // ── 1. Fetch candidate skills ──────────────────────────────────────
    const profileRows = await this.dataSource.query(`
      SELECT cpd.skills_technical AS skills
      FROM candidates c
      JOIN cvs cv             ON cv.candidate_id = c.id::text
      JOIN cv_parsed_data cpd ON cpd.cv_id       = cv.id::text
      WHERE c.id = $1::uuid
      LIMIT 1
    `, [candidateId]);

    const skills: string[] = (profileRows[0]?.skills ?? []).map((s: string) => s.toLowerCase());

    // ── 2. Manager score — average of note ratings ─────────────────────
    const noteRows = await this.dataSource.query(`
      SELECT rating FROM candidate_notes
      WHERE candidate_id = $1 AND rating > 0
    `, [candidateId]);

    let managerScore: number | null = null;
    if (noteRows.length > 0) {
      const avg = noteRows.reduce((sum: number, n: any) => sum + n.rating, 0) / noteRows.length;
      managerScore = Math.round((avg / 5) * 100);
    }

    // ── 3. AssessFirst score ───────────────────────────────────────────
    // NOTE: Previously this was a "bullet density" count, which is not a real score.
    // The AssessFirst PDF does not expose numeric dimension scores via text extraction,
    // so we no longer fabricate a score from it. It is reported as unavailable until
    // a real numeric data source (e.g. AssessFirst API) is integrated.
    const afRows = await this.dataSource.query(`
      SELECT id FROM assessfirst_results WHERE candidate_id = $1 LIMIT 1
    `, [candidateId]);
    const afScore: number | null = null; // Not computed — no reliable source
    const afAvailable = afRows.length > 0;

    // ── 4. Technical match score — best role overlap from catalog ──────
    let technicalScore = 0;
    let bestRoleMatch  = '';

    for (const [role, roleSkills] of Object.entries(ROLE_CATALOG)) {
      const matched = roleSkills.filter(rs =>
        skills.some(cs => cs.includes(rs) || rs.includes(cs))
      ).length;
      const pct = Math.round((matched / roleSkills.length) * 100);
      if (pct > technicalScore) {
        technicalScore = pct;
        bestRoleMatch  = role;
      }
    }

    // ── 5. Composite score ─────────────────────────────────────────────
    // AssessFirst is excluded from weighting since we have no real score.
    // When a real score source is available, add it back with its weight.
    const weights = { technical: 0.80, manager: 0.20 };

    let weightedSum   = technicalScore * weights.technical;
    let weightedTotal = weights.technical;

    if (managerScore !== null) {
      weightedSum   += managerScore * weights.manager;
      weightedTotal += weights.manager;
    }

    const compositeScore = weightedTotal > 0
      ? Math.round(weightedSum / weightedTotal)
      : technicalScore;

    // ── 6. Role suggestions — top 4 matches above 30% ─────────────────
    const roleSuggestions = Object.entries(ROLE_CATALOG)
      .map(([role, roleSkills]) => {
        const matched = roleSkills.filter(rs =>
          skills.some(cs => cs.includes(rs) || rs.includes(cs))
        );
        return { role, score: Math.round((matched.length / roleSkills.length) * 100), matchedSkills: matched };
      })
      .filter(r => r.score >= 30)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    // ── 7. Score label ─────────────────────────────────────────────────
    const label =
      compositeScore >= 80 ? 'Excellent' :
      compositeScore >= 65 ? 'Strong'    :
      compositeScore >= 50 ? 'Moderate'  : 'Developing';

    return {
      compositeScore,
      label,
      breakdown: {
        technical:   { score: technicalScore, weight: 80, role: bestRoleMatch, available: true },
        assessfirst: { score: afScore,        weight: 0,  available: afAvailable },
        manager:     { score: managerScore,   weight: 20, available: managerScore !== null, noteCount: noteRows.length },
      },
      roleSuggestions,
    };
  }
}
