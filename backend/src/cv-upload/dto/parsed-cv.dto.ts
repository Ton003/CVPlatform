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
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  currentTitle: string | null;
  location: string | null;
  skillsTechnical: string[];
  skillsSoft: string[];
  languages: LanguageEntryDto[];
  education: EducationEntryDto[];
  experience: ExperienceEntryDto[];
  yearsExperience: number | null;
  totalExperienceMonths: number | null;
  llmSummary: string;

  // ✅ Detected CV language — used by cv-storage instead of hardcoded 'fr'
  language?: string;
}
