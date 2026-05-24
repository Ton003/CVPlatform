import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from './entities/employee.entity';
import { AiService } from '../chatbot/ai.service';
import { JobRoleLevel } from '../job-architecture/entities/job-role-level.entity';
import {
  DevelopmentRecommendationDto,
  CompetencyGapItem,
} from './dto/development-recommendation.dto';

@Injectable()
export class DevelopmentAdvisorService {
  private readonly logger = new Logger(DevelopmentAdvisorService.name);

  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(JobRoleLevel)
    private readonly levelRepo: Repository<JobRoleLevel>,
    private readonly aiService: AiService,
  ) {}

  /**
   * Generate AI-powered development recommendations for an employee.
   * Analyzes the gap between current competencies and the next career level,
   * then asks the LLM for actionable recommendations.
   */
  async generateRecommendations(
    employeeId: string,
    apiKey: string,
  ): Promise<DevelopmentRecommendationDto> {
    // 1. Load employee with all relevant relations
    const employee = await this.employeeRepo.findOne({
      where: { id: employeeId },
      relations: [
        'jobRole',
        'jobRole.levels',
        'jobRoleLevel',
        'jobRoleLevel.competencyRequirements',
        'jobRoleLevel.competencyRequirements.competence',
        'jobRoleLevel.competencyRequirements.competence.family',
        'competencies',
        'competencies.competence',
      ],
    });

    if (!employee) {
      throw new NotFoundException(`Employee ${employeeId} not found`);
    }

    // 2. Find the next level
    const currentLevelNum = employee.jobRoleLevel?.levelNumber ?? 0;
    const sortedLevels = [...(employee.jobRole?.levels ?? [])].sort(
      (a, b) => a.levelNumber - b.levelNumber,
    );
    const nextLevel = sortedLevels.find(
      (l) => l.levelNumber === currentLevelNum + 1,
    );

    if (!nextLevel) {
      // Employee is at maximum level — return a summary-only response
      return {
        summary: `${employee.firstName} ${employee.lastName} is already at the highest defined level (${employee.jobRoleLevel?.title}) for the ${employee.jobRole?.name} role. Consider lateral career moves, specialization tracks, or mentorship opportunities.`,
        courses: [],
        books: [],
        projects: [],
        skillsToSharpen: [],
        targetLevel: {
          title: employee.jobRoleLevel?.title ?? 'Maximum',
          levelNumber: currentLevelNum,
        },
        gapsAnalyzed: [],
        generatedAt: new Date().toISOString(),
      };
    }

    // 3. Load next level competency requirements
    const nextLevelFull = await this.levelRepo.findOne({
      where: { id: nextLevel.id },
      relations: [
        'competencyRequirements',
        'competencyRequirements.competence',
        'competencyRequirements.competence.family',
      ],
    });

    const nextRequirements = nextLevelFull?.competencyRequirements ?? [];

    // 4. Compute gaps
    const proficiencies = employee.competencies ?? [];
    const gaps: CompetencyGapItem[] = [];

    for (const req of nextRequirements) {
      const compId = req.competenceId;
      const proficiency = proficiencies.find((p) => p.competenceId === compId);
      const currentLvl = proficiency?.currentLevel ?? 0;
      const gap = req.requiredLevel - currentLvl;

      if (gap > 0) {
        gaps.push({
          name: req.competence?.name ?? 'Unknown',
          current: currentLvl,
          target: req.requiredLevel,
          gap,
        });
      }
    }

    // 5. Build prompt
    const gapDescription =
      gaps.length > 0
        ? gaps
            .map(
              (g) =>
                `- ${g.name}: currently at level ${g.current}/5, needs level ${g.target}/5 (gap: ${g.gap})`,
            )
            .join('\n')
        : 'No significant gaps detected — employee meets most requirements.';

    const currentSkills = employee.personalDetails?.skills ?? [];
    const skillsList = Array.isArray(currentSkills)
      ? currentSkills.join(', ')
      : typeof currentSkills === 'string'
        ? currentSkills
        : '';

    const prompt = `You are a senior career development advisor for a technology company (BIAT — a major Tunisian bank's IT department).

EMPLOYEE CONTEXT:
- Name: ${employee.firstName} ${employee.lastName}
- Current Role: ${employee.jobRole?.name ?? 'Unknown'}
- Current Level: ${employee.jobRoleLevel?.title ?? 'Unknown'} (Rank ${currentLevelNum})
- Target Level: ${nextLevel.title} (Rank ${nextLevel.levelNumber})
- Current Skills: ${skillsList || 'Not specified'}

COMPETENCY GAPS TO CLOSE (to reach ${nextLevel.title}):
${gapDescription}

TASK: Generate a personalized development plan to help this employee close their competency gaps and reach ${nextLevel.title}. Be specific and actionable.

Return ONLY valid JSON, no markdown:
{
  "summary": "2-3 sentence overview of the development path",
  "courses": [
    { "title": "exact course name", "platform": "Coursera|Udemy|LinkedIn Learning|Pluralsight|edX|YouTube", "reason": "why this helps close a specific gap" }
  ],
  "books": [
    { "title": "exact book title", "author": "author name", "reason": "how it addresses a specific gap" }
  ],
  "projects": [
    { "title": "project name", "description": "1-2 sentence description", "skills": ["skill1", "skill2"] }
  ],
  "skillsToSharpen": [
    { "name": "specific skill", "priority": "high|medium|low", "action": "concrete action to improve (1 sentence)" }
  ]
}

RULES:
- Recommend 3-5 courses, 2-3 books, 2-3 projects, and 3-5 skills
- Courses MUST be real, well-known courses from major platforms
- Books MUST be real published books with correct authors
- Projects should be practical and relevant to the banking/fintech IT sector when possible
- Skills priority should be "high" for the biggest gaps, "medium" for moderate gaps, "low" for minor polish
- Write in English
- Return ONLY valid JSON`;

    this.logger.log(
      `🤖 Generating AI development plan for ${employee.firstName} ${employee.lastName} (${gaps.length} gaps)`,
    );

    // 6. Call LLM
    const rawResponse = await this.aiService.executePrompt(prompt, apiKey, 0.3);

    // 7. Parse response
    let parsed: any;
    try {
      const clean = rawResponse
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/gi, '')
        .trim();
      const start = clean.indexOf('{');
      const end = clean.lastIndexOf('}');
      if (start === -1 || end === -1) throw new Error('No JSON found');
      parsed = JSON.parse(clean.substring(start, end + 1));
    } catch (err) {
      this.logger.warn(`Failed to parse AI response: ${err.message}`);
      parsed = {
        summary:
          'AI generated development recommendations. Please review the competency gaps below and consult with your manager for a personalized development plan.',
        courses: [],
        books: [],
        projects: [],
        skillsToSharpen: gaps.map((g) => ({
          name: g.name,
          priority: g.gap >= 2 ? 'high' : 'medium',
          action: `Improve ${g.name} from level ${g.current} to level ${g.target}`,
        })),
      };
    }

    // 8. Build typed response
    return {
      summary: parsed.summary ?? '',
      courses: Array.isArray(parsed.courses)
        ? parsed.courses.slice(0, 6).map((c: any) => ({
            title: c.title ?? '',
            platform: c.platform ?? 'Online',
            reason: c.reason ?? '',
            url: c.url ?? undefined,
          }))
        : [],
      books: Array.isArray(parsed.books)
        ? parsed.books.slice(0, 4).map((b: any) => ({
            title: b.title ?? '',
            author: b.author ?? '',
            reason: b.reason ?? '',
          }))
        : [],
      projects: Array.isArray(parsed.projects)
        ? parsed.projects.slice(0, 4).map((p: any) => ({
            title: p.title ?? '',
            description: p.description ?? '',
            skills: Array.isArray(p.skills) ? p.skills : [],
          }))
        : [],
      skillsToSharpen: Array.isArray(parsed.skillsToSharpen)
        ? parsed.skillsToSharpen.slice(0, 6).map((s: any) => ({
            name: s.name ?? '',
            priority: ['high', 'medium', 'low'].includes(s.priority)
              ? s.priority
              : 'medium',
            action: s.action ?? '',
          }))
        : [],
      targetLevel: {
        title: nextLevel.title,
        levelNumber: nextLevel.levelNumber,
      },
      gapsAnalyzed: gaps,
      generatedAt: new Date().toISOString(),
    };
  }
}
