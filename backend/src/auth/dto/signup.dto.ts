// auth/dto/signup.dto.ts
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
  @MinLength(1, { message: 'First name is required' })
  @MaxLength(100)
  first_name: string;

  @IsString()
  @MinLength(1, { message: 'Last name is required' })
  @MaxLength(100)
  last_name: string;

  // ✅ Fix #6 — admin role removed, only hr and manager allowed on self-signup
  @IsOptional()
  @IsIn(['hr', 'manager'], {
    message: 'Role must be hr or manager',
  })
  role?: 'hr' | 'manager';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  department?: string;
}