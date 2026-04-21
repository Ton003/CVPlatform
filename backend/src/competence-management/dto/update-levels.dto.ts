import {
  IsArray, ValidateNested, IsInt, Min, Max, IsString, IsNotEmpty, ArrayMinSize, ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class LevelItemDto {
  @IsInt()
  @Min(1)
  @Max(5)
  level: number;

  @IsString()
  @IsNotEmpty()
  description: string;
}

export class UpdateLevelsDto {
  @IsArray()
  @ArrayMinSize(5, { message: 'Exactly 5 levels are required.' })
  @ArrayMaxSize(5, { message: 'Exactly 5 levels are required.' })
  @ValidateNested({ each: true })
  @Type(() => LevelItemDto)
  levels: LevelItemDto[];
}
