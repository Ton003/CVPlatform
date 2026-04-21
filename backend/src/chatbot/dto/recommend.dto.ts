import {
  IsString,
  IsOptional,
  IsIn,
  IsArray,
  ValidateNested,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ConversationMessageDto {
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @IsString()
  content: string;
}

// Lightweight candidate snapshot sent back by frontend for context
export class LastCandidateDto {
  @IsString()
  candidateId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  email?: string | null;       // ← email so Groq can answer "give me his email"

  @IsOptional()
  @IsString()
  currentTitle?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsNumber()
  yearsExp?: number;

  @IsOptional()
  @IsArray()
  skills?: string[];

  @IsOptional()
  @IsNumber()
  matchScore?: number;
}

export class RecommendDto {
  @IsString()
  message: string;

  @IsOptional()
  @IsIn(['local', 'groq'])
  mode?: 'local' | 'groq';

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConversationMessageDto)
  history?: ConversationMessageDto[];

  // Last candidates shown to recruiter — sent back for RAG context on follow-ups
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LastCandidateDto)
  lastCandidates?: LastCandidateDto[];

  @IsOptional()
  @IsIn(['all', 'candidate', 'employee'])
  personType?: 'all' | 'candidate' | 'employee';
}

// Aliases for compatibility
export type ConversationMessage = ConversationMessageDto;
export type LastCandidate       = LastCandidateDto;