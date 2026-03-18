import { Injectable } from '@nestjs/common';

// Common aliases → canonical name
const SKILL_ALIASES: Record<string, string> = {
  // JavaScript ecosystem
  'js':                 'JavaScript',
  'javascript':         'JavaScript',
  'java script':        'JavaScript',  // ← spaced version
  'ts':                 'TypeScript',
  'typescript':         'TypeScript',
  'type script':        'TypeScript',
  'reactjs':            'React',
  'react.js':           'React',
  'react':              'React',
  'nextjs':             'Next.js',
  'next.js':            'Next.js',
  'next js':            'Next.js',
  'vuejs':              'Vue.js',
  'vue':                'Vue.js',
  'vue js':             'Vue.js',
  'nodejs':             'Node.js',
  'node':               'Node.js',
  'node.js':            'Node.js',
  'node js':            'Node.js',
  'expressjs':          'Express',
  'express.js':         'Express',
  'express js':         'Express',
  'express':            'Express',
  'nestjs':             'NestJS',
  'nest js':            'NestJS',

  // Databases
  'postgres':           'PostgreSQL',
  'postgresql':         'PostgreSQL',
  'post gres':          'PostgreSQL',
  'mongo':              'MongoDB',
  'mongodb':            'MongoDB',
  'mongo db':           'MongoDB',
  'mysql':              'MySQL',
  'my sql':             'MySQL',
  'redis':              'Redis',
  'sqlite':             'SQLite',
  'sql lite':           'SQLite',

  // AI/ML
  'ml':                 'Machine Learning',
  'machine learning':   'Machine Learning',
  'dl':                 'Deep Learning',
  'deep learning':      'Deep Learning',
  'ai':                 'Artificial Intelligence',
  'artificial intelligence': 'Artificial Intelligence',
  'tensorflow':         'TensorFlow',
  'tensor flow':        'TensorFlow',
  'pytorch':            'PyTorch',
  'py torch':           'PyTorch',

  // Web
  'css3':               'CSS',
  'css 3':              'CSS',
  'html5':              'HTML',
  'html 5':             'HTML',
  'tailwind':           'Tailwind CSS',
  'tailwindcss':        'Tailwind CSS',
  'tailwind css':       'Tailwind CSS',
  'bootstrap':          'Bootstrap',

  // Languages
  'py':                 'Python',
  'python':             'Python',
  'java':               'Java',
  'c++':                'C++',
  'cpp':                'C++',
  'c#':                 'C#',
  'csharp':             'C#',
  'c sharp':            'C#',
  'php':                'PHP',
  'dart':               'Dart',
  'kotlin':             'Kotlin',
  'swift':              'Swift',
  'ruby':               'Ruby',
  'rust':               'Rust',
  'go':                 'Go',
  'golang':             'Go',

  // DevOps / Cloud
  'docker':             'Docker',
  'kubernetes':         'Kubernetes',
  'k8s':                'Kubernetes',
  'aws':                'AWS',
  'amazon web services':'AWS',
  'gcp':                'GCP',
  'google cloud':       'GCP',
  'azure':              'Azure',
  'microsoft azure':    'Azure',
  'git':                'Git',
  'github':             'GitHub',
  'git hub':            'GitHub',
  'gitlab':             'GitLab',
  'git lab':            'GitLab',
  'jenkins':            'Jenkins',
  'devops':             'DevOps',
  'dev ops':            'DevOps',
  'ci/cd':              'CI/CD',
  'cicd':               'CI/CD',
  'linux':              'Linux',
  'ubuntu':             'Ubuntu',
  'debian':             'Debian',

  // APIs / protocols
  'rest':               'REST API',
  'restful':            'REST API',
  'rest api':           'REST API',
  'graphql':            'GraphQL',
  'graph ql':           'GraphQL',
  'sql':                'SQL',

  // Mobile
  'flutter':            'Flutter',
  'react native':       'React Native',

  // Tools
  'figma':              'Figma',
  'photoshop':          'Photoshop',
  'plsql':              'PL/SQL',
  'pl/sql':             'PL/SQL',
  'pl sql':             'PL/SQL',
  'oracle':             'Oracle',
};

// Garbage values to throw away
const GARBAGE = new Set([
  '', '-', '•', '*', '/', '|', ',', '.', 'and', 'or', 'the',
  'of', 'in', 'a', 'an', 'to', 'for', 'with', 'on', 'at',
]);

@Injectable()
export class SkillNormalizerService {

  normalize(rawSkills: string[]): string[] {
    const seen  = new Set<string>();
    const clean: string[] = [];

    for (const raw of rawSkills) {
      const trimmed = raw.trim();

      // Drop garbage
      if (!trimmed || GARBAGE.has(trimmed.toLowerCase())) continue;

      // Drop if too long (not a skill, probably a sentence)
      if (trimmed.split(' ').length > 4) continue;

      // Normalize: lowercase + collapse multiple spaces
      const normalized = trimmed.toLowerCase().replace(/\s+/g, ' ');

      // Also try with spaces removed for spaced variants: "Java Script" → "javascript"
      const noSpaces = normalized.replace(/\s+/g, '');

      // Resolve alias — try full string first, then no-spaces version
      const canonical =
        SKILL_ALIASES[normalized] ??
        SKILL_ALIASES[noSpaces]   ??
        this.toTitleCase(trimmed);

      // Deduplicate case-insensitively
      const dedupeKey = canonical.toLowerCase();
      if (seen.has(dedupeKey)) continue;

      seen.add(dedupeKey);
      clean.push(canonical);
    }

    return clean;
  }

  private toTitleCase(str: string): string {
    return str
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }
}