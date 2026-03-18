import { IsString, IsInt, Min, Max, IsIn, MinLength, MaxLength } from 'class-validator';

export class CreateNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  note: string;

  @IsInt()
  @Min(0)
  @Max(5)
  rating: number;

  @IsIn(['screening', 'interview', 'offer', 'rejected'])
  stage: 'screening' | 'interview' | 'offer' | 'rejected';
}
