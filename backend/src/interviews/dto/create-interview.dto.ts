import { IsString, IsNotEmpty, IsISO8601, IsIn, IsUUID, IsOptional } from 'class-validator';

export class CreateInterviewDto {
  // Set by the controller from the URL param — not required in the request body
  @IsUUID()
  @IsOptional()
  applicationId?: string;

  @IsISO8601()
  @IsNotEmpty()
  scheduledAt: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['HR', 'Technical', 'Final'])
  type: 'HR' | 'Technical' | 'Final';

  @IsString()
  @IsNotEmpty()
  interviewerName: string;

  @IsString()
  @IsOptional()
  meetingUrl?: string;
}
