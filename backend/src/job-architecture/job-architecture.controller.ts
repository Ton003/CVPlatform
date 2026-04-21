import { Controller, Get, Post, Body, Param, Patch, Delete } from '@nestjs/common';
import { JobArchitectureService } from './job-architecture.service';
import { BusinessUnit } from './entities/business-unit.entity';
import { Department } from './entities/department.entity';
import { JobRole } from './entities/job-role.entity';
import { JobRoleLevel } from './entities/job-role-level.entity';

@Controller('job-architecture')
export class JobArchitectureController {
  constructor(private readonly jaService: JobArchitectureService) {}

  @Get('tree')
  getTree(): Promise<BusinessUnit[]> {
    return this.jaService.getTree();
  }

  @Get('roles/:id')
  getJobRole(@Param('id') id: string): Promise<JobRole> {
    return this.jaService.getJobRole(id);
  }

  @Get('levels/:id')
  getJobRoleLevel(@Param('id') id: string): Promise<JobRoleLevel> {
    return this.jaService.getJobRoleLevel(id);
  }

  // --- BUSINESS UNITS ---
  @Post('business-units')
  createBU(@Body() dto: { name: string; description?: string }): Promise<BusinessUnit> {
    return this.jaService.createBusinessUnit(dto.name, dto.description);
  }

  @Patch('business-units/:id')
  updateBU(@Param('id') id: string, @Body() dto: { name?: string; description?: string }): Promise<BusinessUnit> {
    return this.jaService.updateBusinessUnit(id, dto.name, dto.description);
  }

  @Delete('business-units/:id')
  deleteBU(@Param('id') id: string): Promise<void> {
    return this.jaService.deleteBusinessUnit(id);
  }

  // --- DEPARTMENTS ---
  @Post('departments')
  createDepartment(@Body() dto: { businessUnitId: string; name: string; description?: string }): Promise<Department> {
    return this.jaService.createDepartment(dto.businessUnitId, dto.name, dto.description);
  }

  @Patch('departments/:id')
  updateDepartment(@Param('id') id: string, @Body() dto: { name?: string; description?: string }): Promise<Department> {
    return this.jaService.updateDepartment(id, dto.name, dto.description);
  }

  @Delete('departments/:id')
  deleteDepartment(@Param('id') id: string): Promise<void> {
    return this.jaService.deleteDepartment(id);
  }

  // --- ROLES ---

  @Get('job-roles/:id/succession-candidates')
  getSuccessionCandidates(@Param('id') id: string): Promise<any[]> {
    return this.jaService.successionCandidates(id);
  }

  @Post('roles')
  createRole(
    @Body() dto: { 
      departmentId: string; 
      name: string; 
      familyId?: string;
      level?: number;
      sfiaRequirements?: any[];
      successorRoleIds?: string[];
      levelCount?: number;
    }
  ): Promise<JobRole> {
    return this.jaService.createJobRole(dto);
  }

  @Patch('roles/:id')
  updateRole(
    @Param('id') id: string, 
    @Body() dto: { 
      name?: string; 
      status?: string;
      familyId?: string;
      level?: number;
      sfiaRequirements?: any[];
      successorRoleIds?: string[];
    }
  ): Promise<JobRole> {
    return this.jaService.updateJobRole(id, dto);
  }

  @Delete('roles/:id')
  deleteRole(@Param('id') id: string): Promise<void> {
    return this.jaService.deleteJobRole(id);
  }


  // --- ROLE LEVELS ---
  @Patch('levels/:id')
  updateRoleLevel(
    @Param('id') id: string, 
    @Body() dto: { mission?: string; responsibilities?: string[]; description?: string; title?: string }
  ): Promise<JobRoleLevel> {
    return this.jaService.updateJobRoleLevel(id, dto);
  }

  @Patch('levels/:id/competencies')
  updateRoleLevelCompetencies(
    @Param('id') id: string,
    @Body() dto: { requirements: { competenceId: string; requiredLevel: number }[] }
  ): Promise<JobRoleLevel> {
    return this.jaService.updateJobRoleCompetencies(id, dto.requirements);
  }
}
