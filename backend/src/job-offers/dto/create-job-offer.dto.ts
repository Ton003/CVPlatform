import { IsString, IsNotEmpty, IsOptional, IsInt, IsIn, MaxLength, Min } from 'class-validator';

export class CreateJobOfferDto {
  @IsString()
  @IsNotEmpty()
  jobRoleLevelId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional() @IsString() contractType?: string;
  @IsOptional() @IsString() workMode?: string;
  @IsOptional() @Min(0) salaryMin?: number;
  @IsOptional() @Min(0) salaryMax?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsInt() @Min(1) openingsCount?: number;
  @IsOptional() @IsString() hiringManager?: string;
  @IsOptional() @IsString() deadline?: string;
  @IsOptional() @IsString() visibility?: string;

  @IsOptional()
  @IsIn(['open', 'closed', 'draft'])
  status?: string;
}