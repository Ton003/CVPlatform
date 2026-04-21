import {
  IsString, IsNotEmpty, IsOptional, IsUUID, MaxLength,
} from 'class-validator';

export class CreateCompetenceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsUUID()
  familyId: string;
}
