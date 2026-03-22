export interface CandidateMatchDto {
  candidateId:   string;
  name:          string;
  email:         string | null;
  location:      string | null;
  currentTitle:  string | null;
  yearsExp:      number | null;
  skills:        string[];
  summary:       string | null;
  matchScore:    number;
  matchedSkills: string[];
}

export interface CandidateNote {
  name:           string;
  strengths:      string[];
  gaps:           string[];
  fit:            'excellent' | 'good' | 'partial' | 'poor';
  relevantSkills: string[];
  groqScore?:     number;   // optional — not always returned by narrative call
}

export interface RagAnalysisDto {
  answer:           string;
  bestMatch:        string;
  candidateNotes:   CandidateNote[];
  followUpQuestion: string;
  searchAgain:      boolean;
  newQuery:         string;
  rankedOrder:      string[];
}

export interface RecommendationResultDto {
  message:           string;
  total:             number;
  candidates:        CandidateMatchDto[];
  aiRecommendation?: string | null;
  ragAnalysis?:      RagAnalysisDto | null;
  mode?:             'local' | 'groq';
}