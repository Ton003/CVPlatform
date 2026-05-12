export class EducationEntryDto {
  degree: string | null;
  institution: string | null;
  date: string | null;
}

export class ExperienceEntryDto {
  title: string;
  company: string | null;
  startDate: string | null;
  endDate: string | null;
  description: string | null;
  inferredTags?: any[]; // optional, added during processing
}

export class LanguageEntryDto {
  name: string;
  level: string;
}

export class ParsedCvDto {
  // ── Identity ──────────────────────────────────────────────
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  currentTitle: string | null;
  location: string | null;

  // ── Skills ────────────────────────────────────────────────
  skillsTechnical: string[];
  skillsSoft: string[];

  // ── Languages ─────────────────────────────────────────────
  languages: LanguageEntryDto[];

  // ── Education ─────────────────────────────────────────────
  education: EducationEntryDto[];

  // ── Experience ────────────────────────────────────────────
  experience: ExperienceEntryDto[];

  // ── Computed ──────────────────────────────────────────────
  yearsExperience: number | null;
  totalExperienceMonths: number | null;

  // ── LLM ───────────────────────────────────────────────────
  llmSummary: string;

  // ✅ Detected CV language — used by cv-storage instead of hardcoded 'fr'
  language?: string;
}
