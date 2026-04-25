// Shared chat interfaces — used by both chatbot.component.ts and chat-state.service.ts
// Keeping them here avoids the service importing from a component

export interface CandidateMatch {
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
  groqScore?:     number;
}

export interface RagAnalysis {
  answer:           string;
  bestMatch:        string;
  candidateNotes:   CandidateNote[];
  followUpQuestion: string;
  searchAgain:      boolean;
  newQuery:         string;
  rankedOrder:      string[];
}

export interface SearchResult {
  message:           string;
  total:             number;
  candidates:        CandidateMatch[];
  aiRecommendation?: string | null;
  ragAnalysis?:      RagAnalysis | null;
  mode?:             'local' | 'groq';
}

export interface ChatMessage {
  role:      'user' | 'assistant';
  content:   string;
  result?:   SearchResult;
  loading?:  boolean;
  timestamp: Date;
}

export interface ConversationMessage {
  role:    'user' | 'assistant' | 'system';
  content: string;
}

export interface LastCandidate {
  candidateId:  string;
  name:         string;
  email:        string | null;
  currentTitle: string | null;
  location:     string | null;
  yearsExp:     number | null;
  skills:       string[];
  matchScore:   number;
}