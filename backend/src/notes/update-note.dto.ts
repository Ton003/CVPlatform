import { IsString, IsInt, Min, Max, IsIn, MinLength, MaxLength, IsOptional } from 'class-validator';

export class UpdateNoteDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  note?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsIn(['screening', 'interview', 'offer', 'rejected'])
  stage?: 'screening' | 'interview' | 'offer' | 'rejected';
}
