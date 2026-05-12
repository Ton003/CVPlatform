export interface CourseRecommendation {
  title: string;
  platform: string;
  reason: string;
  url?: string;
}

export interface BookRecommendation {
  title: string;
  author: string;
  reason: string;
}

export interface ProjectRecommendation {
  title: string;
  description: string;
  skills: string[];
}

export interface SkillRecommendation {
  name: string;
  priority: 'high' | 'medium' | 'low';
  action: string;
}

export interface CompetencyGapItem {
  name: string;
  current: number;
  target: number;
  gap: number;
}

export interface DevelopmentRecommendationDto {
  summary: string;
  courses: CourseRecommendation[];
  books: BookRecommendation[];
  projects: ProjectRecommendation[];
  skillsToSharpen: SkillRecommendation[];
  targetLevel: { title: string; levelNumber: number };
  gapsAnalyzed: CompetencyGapItem[];
  generatedAt: string;
}
