import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Query,
  Delete,
  UseGuards,
  ParseUUIDPipe,
  Request,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import { PromoteCandidateDto, CreateEmployeeDto } from './dto/employee.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UnifiedScoringService } from '../shared/services/unified-scoring.service';
import { PolicyService } from '../auth/policy.service';
import { UserContext } from '../auth/jwt.strategy';
import { DevelopmentAdvisorService } from './development-advisor.service';

@ApiTags('Employees')
@ApiBearerAuth()
@Controller('employees')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmployeesController {
  constructor(
    private readonly employeesService: EmployeesService,
    private readonly unifiedScoringService: UnifiedScoringService,
    private readonly policyService: PolicyService,
    private readonly devAdvisorService: DevelopmentAdvisorService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List and filter employees' })
  @ApiQuery({ name: 'buId', required: false, type: String })
  @ApiQuery({ name: 'departmentId', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  list(
    @Query('buId') buId?: string,
    @Query('departmentId') departmentId?: string,
    @Query('roleId') roleId?: string,
    @Query('search') search?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Request() req?: { user: UserContext },
  ) {
    // ABAC: If user is a manager, restrict to their subordinates.
    let targetDeptId = departmentId;
    let targetManagerId: string | undefined = undefined;
    if (req?.user && this.policyService.isManager(req.user)) {
      if (!req.user.employeeId) {
        // Manager has no employee link -> return empty results
        return {
          data: [],
          total: 0,
          page: Number(page),
          limit: Number(limit),
          totalPages: 0,
        };
      }
      targetManagerId = req.user.employeeId;
    }

    return this.employeesService.list({
      buId,
      departmentId: targetDeptId,
      roleId,
      search,
      page: Number(page),
      limit: Number(limit),
      managerId: targetManagerId,
    });
  }

  @Get('managers')
  @ApiOperation({ summary: 'Find all active managers' })
  findAllManagers(@Query('departmentId') departmentId?: string) {
    return this.employeesService.findAllManagers(departmentId);
  }

  @Get('talent-matrix')
  @ApiOperation({ summary: 'Get 9-Box talent matrix data' })
  getTalentMatrix(
    @Query('buId') buId?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.employeesService.getTalentMatrixData({ buId, departmentId });
  }

  @Get('org-chart')
  @ApiOperation({ summary: 'Get organizational structure tree' })
  getOrgChart() {
    return this.employeesService.getOrgChart();
  }

  @Post('org-chart/repair')
  @ApiOperation({ summary: 'Repair/Rebuild organizational tree structure' })
  repairTree() {
    return this.employeesService.repairOrgChart();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get detailed employee profile' })
  @ApiParam({ name: 'id', format: 'uuid' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeesService.findOne(id);
  }

  @Get(':id/gap-analysis/:jobOfferId')
  @ApiOperation({ summary: 'Analyze competency gap for internal mobility' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'jobOfferId', format: 'uuid' })
  getGapAnalysis(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('jobOfferId', ParseUUIDPipe) jobOfferId: string,
  ) {
    return this.unifiedScoringService.scoreEmployee(id, jobOfferId);
  }

  @Post('promote')
  @Roles('admin', 'hr')
  @ApiOperation({ summary: 'Promote a candidate to an employee' })
  @ApiResponse({ status: 201, description: 'Candidate promoted successfully.' })
  promote(@Body() dto: PromoteCandidateDto) {
    return this.employeesService.promoteCandidate(dto);
  }

  @Patch(':id/toggle-manager')
  @Roles('admin', 'hr')
  @ApiOperation({ summary: 'Toggle manager status for an employee' })
  @ApiParam({ name: 'id', format: 'uuid' })
  toggleManager(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeesService.toggleManager(id);
  }

  @Post()
  @Roles('admin', 'hr')
  @ApiOperation({ summary: 'Manually create an employee' })
  create(@Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(dto);
  }

  @Patch(':id')
  @Roles('admin', 'hr')
  @ApiOperation({ summary: 'Update employee information' })
  @ApiParam({ name: 'id', format: 'uuid' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: any) {
    return this.employeesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin', 'hr')
  @ApiOperation({ summary: 'Remove an employee record' })
  @ApiParam({ name: 'id', format: 'uuid' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeesService.remove(id);
  }

  @Post(':id/promote-level')
  @Roles('admin', 'hr')
  @ApiOperation({ summary: 'Promote employee to next career level' })
  @ApiParam({ name: 'id', format: 'uuid' })
  promoteToNextLevel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { effectiveDate?: string; notes?: string },
  ) {
    return this.employeesService.promoteToNextLevel(
      id,
      body.effectiveDate,
      body.notes,
    );
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Get career history for an employee' })
  @ApiParam({ name: 'id', format: 'uuid' })
  getHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeesService.getHistory(id);
  }

  @Get(':id/management-stats')
  @ApiOperation({ summary: 'Get management statistics for a leader' })
  @ApiParam({ name: 'id', format: 'uuid' })
  getManagementStats(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeesService.getManagementStats(id);
  }

  @Get(':id/potential-successors')
  @ApiOperation({ summary: 'Find potential successors for an employee' })
  @ApiParam({ name: 'id', format: 'uuid' })
  getPotentialSuccessors(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeesService.getPotentialSuccessors(id);
  }

  @Post(':id/ai-development-plan')
  @ApiOperation({ summary: 'Generate AI-powered development recommendations' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Development plan generated.' })
  async generateAiDevelopmentPlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { apiKey: string },
  ) {
    if (!body.apiKey) {
      throw new BadRequestException(
        'AI API Key is required to generate a development plan.',
      );
    }
    return this.devAdvisorService.generateRecommendations(id, body.apiKey);
  }
}
