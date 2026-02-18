import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsIn,
} from 'class-validator';

export class SignupDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(50)
  password: string;

  @IsString()
  @MaxLength(100)
  first_name: string;

  @IsString()
  @MaxLength(100)
  last_name: string;

  @IsOptional()
  @IsIn(['admin', 'hr', 'manager'], {
    message: 'Role must be admin, hr, or manager',
  })
  role?: 'admin' | 'hr' | 'manager';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  department?: string;
}