import { Injectable } from '@nestjs/common';

export interface ExtractedFilters {
  skills:      string[];
  minYears:    number | null;
  location:    string | null;
  title:       string | null;
  limit:       number;
  degree:      string | null;
  institution: string | null;
  language:    string | null;
}

// ── Conflict groups — if a longer skill matches, block the shorter one ─────────
// Order matters: first match in a group wins
const SKILL_CONFLICT_GROUPS: string[][] = [
  ['typescript', 'javascript', 'java'],   // "javascript" blocks "java"
  ['nextjs', 'react native', 'react'],    // "react native" blocks "react"
  ['node.js', 'nodejs'],                  // treat as same
  ['postgresql', 'sql'],                  // "postgresql" blocks generic "sql"
  ['c++', 'c#', 'c'],                     // "c++" and "c#" block bare "c"
  ['machine learning', 'deep learning'],  // don't double-count
];

// Canonical name map — normalize aliases
const SKILL_ALIASES: Record<string, string> = {
  'node.js':       'Node.js',
  'nodejs':        'Node.js',
  'react native':  'React Native',
  'nextjs':        'Next.js',
  'nuxt':          'Nuxt.js',
  'nestjs':        'NestJS',
  'fastapi':       'FastAPI',
  'postgresql':    'PostgreSQL',
  'mongodb':       'MongoDB',
  'graphql':       'GraphQL',
  'javascript':    'JavaScript',
  'typescript':    'TypeScript',
  'python':        'Python',
  'java':          'Java',
  'php':           'PHP',
  'ruby':          'Ruby',
  'rust':          'Rust',
  'go':            'Go',
  'swift':         'Swift',
  'kotlin':        'Kotlin',
  'flutter':       'Flutter',
  'docker':        'Docker',
  'kubernetes':    'Kubernetes',
  'aws':           'AWS',
  'azure':         'Azure',
  'gcp':           'GCP',
  'git':           'Git',
  'linux':         'Linux',
  'sql':           'SQL',
  'mysql':         'MySQL',
  'redis':         'Redis',
  'sqlite':        'SQLite',
  'tensorflow':    'TensorFlow',
  'pytorch':       'PyTorch',
  'html':          'HTML',
  'css':           'CSS',
  'sass':          'Sass',
  'tailwind':      'Tailwind',
  'bootstrap':     'Bootstrap',
  'figma':         'Figma',
  'photoshop':     'Photoshop',
  'devops':        'DevOps',
  'ci/cd':         'CI/CD',
  'jenkins':       'Jenkins',
  'machine learning':   'Machine Learning',
  'deep learning':      'Deep Learning',
  'artificial intelligence': 'AI',
  'nlp':           'NLP',
  'computer vision':    'Computer Vision',
  'react':         'React',
  'angular':       'Angular',
  'vue':           'Vue',
  'svelte':        'Svelte',
  'django':        'Django',
  'laravel':       'Laravel',
  'spring':        'Spring',
  'express':       'Express',
  'c++':           'C++',
  'c#':            'C#',
  'c':             'C',
};

// Sorted longest-first so "javascript" matches before "java", "c++" before "c"
const KNOWN_SKILLS = Object.keys(SKILL_ALIASES).sort((a, b) => b.length - a.length);

const LOCATION_KEYWORDS = [
  'tunis', 'tunisia', 'sfax', 'sousse', 'ariana', 'nabeul', 'monastir',
  'ben arous', 'hammam-lif', 'hammam lif', 'manouba', 'bizerte', 'jendouba',
  'remote', 'paris', 'london', 'france', 'germany', 'usa', 'canada',
];

const DEGREE_KEYWORDS: Record<string, string> = {
  'bachelor':    'bachelor',
  "bachelor's":  'bachelor',
  'licence':     'licence',
  'master':      'master',
  "master's":    'master',
  'mastere':     'master',
  'engineer':    'engineer',
  'ingenieur':   'engineer',
  'engineering': 'engineer',
  'phd':         'phd',
  'doctorate':   'phd',
  'bts':         'bts',
  'bac':         'bac',
};

const INSTITUTION_KEYWORDS = [
  'istic', 'insat', 'fst', 'fsm', 'enit', 'iset', 'esprit', 'supcom',
  'isitcom', 'isu', 'utm', 'uu', 'tunis el manar', 'carthage',
  'university', 'université', 'institut', 'école', 'ecole', 'faculty',
];

const LANGUAGE_KEYWORDS: Record<string, string> = {
  'french':   'French',
  'français': 'French',
  'francais': 'French',
  'english':  'English',
  'anglais':  'English',
  'arabic':   'Arabic',
  'arabe':    'Arabic',
  'german':   'German',
  'allemand': 'German',
  'spanish':  'Spanish',
};

@Injectable()
export class KeywordExtractorService {

  extract(message: string): ExtractedFilters {
    const lower = message.toLowerCase();
    return {
      skills:      this.extractSkills(lower),
      minYears:    this.extractYears(lower),
      location:    this.extractLocation(lower),
      title:       this.extractTitle(lower),
      limit:       this.extractLimit(lower),
      degree:      this.extractDegree(lower),
      institution: this.extractInstitution(lower),
      language:    this.extractLanguage(lower),
    };
  }

  private extractSkills(text: string): string[] {
    const matched: string[] = [];
    const blocked           = new Set<string>();

    for (const skill of KNOWN_SKILLS) {
      if (blocked.has(skill)) continue;

      const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex   = new RegExp(`(?<![a-zA-Z])${escaped}(?![a-zA-Z])`, 'i');

      if (regex.test(text)) {
        const canonical = SKILL_ALIASES[skill] ?? skill;
        if (!matched.includes(canonical)) {
          matched.push(canonical);
        }

        // Block conflicting shorter skills in the same group
        for (const group of SKILL_CONFLICT_GROUPS) {
          if (group.includes(skill)) {
            group.forEach(s => { if (s !== skill) blocked.add(s); });
            break;
          }
        }
      }
    }

    return matched;
  }

  private extractYears(text: string): number | null {
    const match = text.match(/(\d+)\+?\s*years?/i);
    return match ? parseInt(match[1], 10) : null;
  }

  private extractLocation(text: string): string | null {
    // Normalize hyphens/spaces so "hammam-lif" matches "hammam lif"
    const normalized = text.replace(/-/g, ' ');
    for (const loc of LOCATION_KEYWORDS) {
      const locNorm = loc.replace(/-/g, ' ');
      if (normalized.includes(locNorm)) return loc;
    }
    return null;
  }

  private extractTitle(text: string): string | null {
    const titles = [
      'frontend developer', 'backend developer', 'fullstack developer',
      'full stack developer', 'full-stack developer',
      'software engineer', 'data scientist', 'devops engineer',
      'mobile developer', 'ui/ux designer', 'data analyst',
      'machine learning engineer', 'ai engineer', 'web developer',
      'network engineer', 'security engineer', 'system administrator',
      'embedded engineer', 'nlp engineer',
    ];
    for (const title of titles) {
      if (text.includes(title)) return title;
    }
    return null;
  }

  private extractDegree(text: string): string | null {
    for (const [keyword, canonical] of Object.entries(DEGREE_KEYWORDS)) {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`\\b${escaped}\\b`, 'i').test(text)) return canonical;
    }
    return null;
  }

  private extractInstitution(text: string): string | null {
    for (const inst of INSTITUTION_KEYWORDS) {
      if (text.includes(inst)) return inst;
    }
    return null;
  }

  private extractLanguage(text: string): string | null {
    for (const [keyword, canonical] of Object.entries(LANGUAGE_KEYWORDS)) {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`\\b${escaped}\\b`, 'i').test(text)) return canonical;
    }
    return null;
  }

  private extractLimit(text: string): number {
    const match = text.match(/\b(?:top|give\s+me|show\s+me|find|best|show)?\s*(\d+)\s*(?:candidates?|devs?|developers?|engineers?|results?|matches?)?\b/i);
    if (match) {
      const n = parseInt(match[1]);
      if (n >= 1 && n <= 20) return n;
    }
    return 5;
  }
}