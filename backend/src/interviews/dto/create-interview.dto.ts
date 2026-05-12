import {
  IsString,
  IsNotEmpty,
  IsISO8601,
  IsIn,
  IsUUID,
  IsOptional,
} from 'class-validator';

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
  @IsIn([
    'Screening',
    'Technical',
    'Culture Fit',
    'Technical Deep Dive',
    'Leadership',
    'Final',
    'Offer Discussion',
    'HR',
  ])
  type:
    | 'Screening'
    | 'Technical'
    | 'Culture Fit'
    | 'Technical Deep Dive'
    | 'Leadership'
    | 'Final'
    | 'Offer Discussion'
    | 'HR';

  @IsString()
  @IsNotEmpty()
  interviewerName: string;

  @IsString()
  @IsOptional()
  meetingUrl?: string;
}
