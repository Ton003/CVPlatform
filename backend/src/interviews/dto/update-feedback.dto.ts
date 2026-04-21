import { IsString, IsOptional, IsInt, Min, Max, IsIn } from 'class-validator';

export class UpdateFeedbackDto {
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  technicalScore?: number;

  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  communicationScore?: number;

  @IsString()
  @IsOptional()
  comments?: string;

  @IsString()
  @IsOptional()
  @IsIn(['pass', 'fail', 'maybe'])
  decision?: 'pass' | 'fail' | 'maybe';

  @IsString()
  @IsOptional()
  @IsIn(['scheduled', 'completed', 'cancelled'])
  status?: 'scheduled' | 'completed' | 'cancelled';
}
