import {
  IsString, IsOptional, IsUUID, MaxLength,
} from 'class-validator';

export class UpdateCompetenceDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  familyId?: string;
}
