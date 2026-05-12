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
  firstName: string;

  @IsString()
  @MinLength(1, { message: 'Last name is required' })
  @MaxLength(100)
  lastName: string;

  // ✅ Fix #6 — admin role removed, only hr and manager allowed on self-signup
  @IsOptional()
  @IsIn(['hr', 'manager'], {
    message: 'Role must be hr or manager',
  })
  role?: 'hr' | 'manager';

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  jobRoleLevelId?: string;
}
