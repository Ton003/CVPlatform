export class EducationEntryDto {
  degree:      string | null;
  institution: string | null;
  date:        string | null;
}

export class ExperienceEntryDto {
  title:      string;
  company:    string | null;
  start_date: string | null;
  end_date:   string | null;
}

export class LanguageEntryDto {
  name:  string;
  level: string;
}

export class ParsedCvDto {
  // ── Identity ──────────────────────────────────────────────
  first_name:     string | null;
  last_name:      string | null;
  email:          string | null;
  phone:          string | null;
  linkedin_url:   string | null;
  current_title:  string | null;
  location:       string | null;

  // ── Skills ────────────────────────────────────────────────
  skills_technical: string[];
  skills_soft:      string[];

  // ── Languages ─────────────────────────────────────────────
  languages: LanguageEntryDto[];

  // ── Education ─────────────────────────────────────────────
  education: EducationEntryDto[];

  // ── Experience ────────────────────────────────────────────
  experience: ExperienceEntryDto[];

  // ── Computed ──────────────────────────────────────────────
  years_experience:        number | null;
  total_experience_months: number | null;

  // ── LLM ───────────────────────────────────────────────────
  llm_summary: string;

  // ✅ Detected CV language — used by cv-storage instead of hardcoded 'fr'
  language?: string;
}