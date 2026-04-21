import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─── Create Assessment (Draft) ────────────────────────────────────────────────

export class CreateAssessmentDto {
  /** e.g. "Q2 2026 Annual Review" */
  @IsOptional()
  @IsString()
  cycleLabel?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

// ─── Assessment Item (one competency rating) ──────────────────────────────────

export class AssessmentItemDto {
  @IsUUID()
  competenceId: string;

  /** 1–5 or omit / null to mark as "not yet assessed" */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  level?: number | null;

  @IsOptional()
  @IsString()
  notes?: string;
}

// ─── Update Items Payload ─────────────────────────────────────────────────────

export class UpdateAssessmentItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssessmentItemDto)
  items: AssessmentItemDto[];
}
