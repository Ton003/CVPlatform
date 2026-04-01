import { IsString, IsOptional, IsArray, IsInt, Min, IsIn } from 'class-validator';

export class UpdateJobOfferDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredSkills?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  minYears?: number;

  @IsOptional()
  @IsIn(['open', 'closed', 'draft'])
  status?: 'open' | 'closed' | 'draft';
}
