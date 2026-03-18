import { IsString, IsNotEmpty, IsOptional, IsArray, IsInt, IsIn, MaxLength, Min } from 'class-validator';

export class CreateJobOfferDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
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
  @IsIn(['open', 'closed'])
  status?: string;
}