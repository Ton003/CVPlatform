import { IsString, IsNotEmpty, IsEnum, MaxLength } from 'class-validator';
import { CompetenceCategory } from '../entities/family.entity';

export class CreateFamilyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsEnum(CompetenceCategory, {
    message: `category must be one of: ${Object.values(CompetenceCategory).join(', ')}`,
  })
  category: CompetenceCategory;
}
