import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { CompetenceCategory } from '../entities/family.entity';

export class UpdateFamilyDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsEnum(CompetenceCategory)
  category?: CompetenceCategory;
}
