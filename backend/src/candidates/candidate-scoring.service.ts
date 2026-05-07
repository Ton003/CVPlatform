import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

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
  technical: { score: number; weight: number; role: string; available: boolean };
}

export interface CandidateScoreResult {
  compositeScore: number;
  label:          string;
  breakdown:      ScoreBreakdown;
  roleSuggestions: Array<{ role: string; score: number; matchedSkills: string[] }>;
}

@Injectable()
export class CandidateScoringService {
  private readonly logger = new Logger(CandidateScoringService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async score(candidateId: string): Promise<CandidateScoreResult> {
    const profileRows = await this.dataSource.query(`
      SELECT 
        c.id,
        c.competency_snapshot AS "competencySnapshot",
        cpd.skills_technical AS skills
      FROM candidates c
      LEFT JOIN cvs cv             ON cv.candidate_id = c.id::text
      LEFT JOIN cv_parsed_data cpd ON cpd.cv_id       = cv.id::text
      WHERE c.id = $1::uuid
      ORDER BY cv.created_at DESC
      LIMIT 1
    `, [candidateId]);

    if (!profileRows.length) {
      throw new NotFoundException(`Candidate ${candidateId} not found`);
    }

    const row = profileRows[0];
    const skills: string[] = (row?.skills ?? []).map((s: string) => s.toLowerCase());
    const snapshot: Record<string, any> = row?.competencySnapshot || {};

    // 1. SFIA Competency Score
    let sfiaScore = 0;
    const compEntries = Object.values(snapshot);
    if (compEntries.length > 0) {
      const totalLevels = compEntries.reduce((sum, c) => sum + (c.level || 0), 0);
      sfiaScore = Math.round((totalLevels / (compEntries.length * 5)) * 100);
    }

    // 2. Technical match score
    let technicalScore = 0;
    let bestRoleMatch  = 'General';

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

    // 3. Composite score (60% SFIA, 40% Role)
    const weights = { sfia: 0.60, role: 0.40 };
    const compositeScore = Math.round((sfiaScore * weights.sfia) + (technicalScore * weights.role));

    // 4. Role suggestions
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

    return {
      compositeScore,
      label: this.getScoreLabel(compositeScore),
      breakdown: {
        technical: { 
          score: technicalScore, 
          weight: 40, 
          role: bestRoleMatch, 
          available: skills.length > 0 
        },
      },
      roleSuggestions,
    };
  }

  private getScoreLabel(score: number): string {
    if (score >= 80) return 'Exceptional';
    if (score >= 65) return 'Strong';
    if (score >= 45) return 'Developing';
    return 'Junior / Entry';
  }
}
