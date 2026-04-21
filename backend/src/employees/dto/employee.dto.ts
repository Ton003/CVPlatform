import { IsString, IsEmail, IsOptional, IsEnum, IsDateString, IsUUID } from 'class-validator';
import { EmployeeStatus } from '../entities/employee.entity';

export class CreateEmployeeDto {
  @IsString()
  employeeId: string;

  @IsOptional()
  @IsUUID()
  candidateId?: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsEmail()
  email: string;

  @IsDateString()
  hireDate: string;

  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @IsUUID()
  jobRoleId: string;

  @IsUUID()
  jobRoleLevelId: string;

  @IsOptional()
  @IsUUID()
  managerId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}

export class PromoteCandidateDto {
  @IsUUID()
  applicationId: string;

  @IsString()
  employeeId: string;

  @IsDateString()
  hireDate: string;

  @IsOptional()
  @IsUUID()
  managerId?: string;
}
