import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Put,
  Param,
  Body,
  Query,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SkipThrottle } from '@nestjs/throttler';
import { ApplicationsService } from './applications.service';
import { VerdictService } from './verdict.service';
import { UserContext } from '../auth/jwt.strategy';
import { PolicyService } from '../auth/policy.service';
import {
  IsString,
  IsUUID,
  IsOptional,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

// Internal DTOs (Organized for better readability within the single-file constraint)
class CreateApplicationDto {
  @IsUUID()
  jobId: string;

  @IsUUID()
  @IsOptional()
  candidateId: string;

  @IsString()
  @IsOptional()
  source?: string;

  @IsString()
  @IsOptional()
  coverNote?: string;

  @IsString()
  @IsOptional()
  stage?: string;
}

class UpdateStageDto {
  @IsString()
  stage: string;
}

class AddNoteDto {
  @IsString()
  note: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(5)
  rating?: number;

  @IsString()
  @IsOptional()
  stage?: string;
}

@ApiTags('Applications')
@ApiBearerAuth()
@Controller('applications')
@UseGuards(JwtAuthGuard)
@SkipThrottle()
export class ApplicationsController {
  private readonly logger = new Logger(ApplicationsController.name);

  constructor(
    private readonly svc: ApplicationsService,
    private readonly verdictSvc: VerdictService,
    private readonly policyService: PolicyService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Submit a new job application' })
  @ApiResponse({ status: 201, description: 'Application created.' })
  async create(
    @Body() dto: CreateApplicationDto,
    @Request() req: { user: UserContext },
  ) {
    // ABAC: Managers can only create applications for jobs they own
    if (this.policyService.isManager(req.user)) {
      await this.policyService.assertJobAccess(req.user, dto.jobId);
    }
    return this.svc.create(dto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Filter and list applications' })
  @ApiQuery({ name: 'jobId', required: false, type: String })
  @ApiQuery({ name: 'stage', required: false, type: String })
  async list(
    @Query('jobId') jobId?: string,
    @Query('stage') stage?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
    @Request() req?: { user: UserContext },
  ) {
    let scopedJobIds: string[] | undefined = undefined;
    if (req?.user && this.policyService.isManager(req.user)) {
      // If jobId is provided, assert access
      if (jobId) {
        await this.policyService.assertJobAccess(req.user, jobId);
        scopedJobIds = [jobId];
      } else {
        // Otherwise, get all managed jobs
        scopedJobIds = await this.policyService.getManagedJobIds(req.user);
      }
    }

    return this.svc.list({
      jobId,
      stage,
      page: Number(page),
      limit: Number(limit),
      scopedJobIds,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get application dossier by ID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req?: { user: UserContext },
  ) {
    if (req?.user) {
      await this.policyService.assertApplicationAccess(req.user, id);
    }
    return this.svc.findOne(id);
  }

  @Patch(':id/stage')
  @ApiOperation({ summary: 'Move application to a new pipeline stage' })
  async updateStage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStageDto,
    @Request() req: { user: UserContext },
  ) {
    // ABAC: Manager must own the job linked to this application
    await this.policyService.assertApplicationAccess(req.user, id);
    return this.svc.updateStage(id, dto.stage, req.user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove an application' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(id);
  }

  @Get(':id/notes')
  @ApiOperation({ summary: 'Get recruiter notes and ratings' })
  async getNotes(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req?: { user: UserContext },
  ) {
    if (req?.user)
      await this.policyService.assertApplicationAccess(req.user, id);
    return this.svc.getNotes(id);
  }

  @Post(':id/notes')
  @ApiOperation({ summary: 'Add a new recruiter note' })
  addNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddNoteDto,
    @Request() req: { user: UserContext },
  ) {
    return this.svc.addNote(id, dto, req.user.id);
  }

  @Get(':id/score')
  @ApiOperation({ summary: 'Get detailed scoring breakdown' })
  async getScore(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: UserContext; headers: any },
  ) {
    if (req?.user)
      await this.policyService.assertApplicationAccess(req.user, id);

    // Extract API key from custom header if provided
    const headerKey = req.headers['x-ai-api-key'];
    return this.svc.getScore(id, headerKey);
  }

  @Get(':id/verdict')
  @ApiOperation({ summary: 'Get AI-generated verdict and summary' })
  async getVerdict(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req?: { user: UserContext },
  ) {
    if (req?.user)
      await this.policyService.assertApplicationAccess(req.user, id);
    return this.verdictSvc.getVerdict(id);
  }

  @Post(':id/verdict/refresh')
  @ApiOperation({ summary: 'Force re-computation of AI verdict' })
  refreshVerdict(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: UserContext },
  ) {
    return this.verdictSvc.refreshVerdict(id, req.user.id);
  }

  @Post(':id/outcome')
  @ApiOperation({ summary: 'Record final hiring decision' })
  recordOutcome(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { outcome: string; rejectionReason?: string },
    @Request() req: { user: UserContext },
  ) {
    return this.svc.recordOutcome(id, dto, req.user.id);
  }

  @Get(':id/tasks')
  @ApiOperation({ summary: 'List associated pipeline tasks' })
  async getTasks(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req?: { user: UserContext },
  ) {
    if (req?.user)
      await this.policyService.assertApplicationAccess(req.user, id);
    return this.svc.getTasks(id);
  }

  @Get(':id/activity')
  @ApiOperation({ summary: 'List application activity log' })
  async getActivity(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req?: { user: UserContext },
  ) {
    if (req?.user)
      await this.policyService.assertApplicationAccess(req.user, id);
    return this.svc.getActivity(id);
  }

  @Post(':id/tasks')
  @ApiOperation({ summary: 'Add a new task to the application' })
  addTask(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { title: string },
  ) {
    return this.svc.addTask(id, dto.title);
  }

  @Get(':id/competencies')
  @ApiOperation({ summary: 'Get evaluated competency scores' })
  async getCompetencies(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req?: { user: UserContext },
  ) {
    if (req?.user)
      await this.policyService.assertApplicationAccess(req.user, id);
    return this.svc.getCompetencies(id);
  }

  @Put(':id/competencies/:compId')
  @ApiOperation({ summary: 'Update a specific competency rating' })
  async updateCompetencyRating(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('compId', ParseUUIDPipe) compId: string,
    @Body('evaluatedLevel') evaluatedLevel: number,
    @Request() req?: { user: UserContext },
  ) {
    if (req?.user)
      await this.policyService.assertApplicationAccess(req.user, id);
    return this.svc.updateCompetencyRating(id, compId, evaluatedLevel);
  }

  @Get(':id/assessments')
  getAssessments(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getAssessments(id);
  }

  @Post(':id/assessments')
  createAssessment(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: UserContext },
  ) {
    return this.svc.createAssessment(id, req.user.id);
  }

  @Get('assessments/:id')
  getAssessment(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getAssessment(id);
  }

  @Patch('assessments/:id/items')
  updateAssessmentItems(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() items: any[],
  ) {
    return this.svc.updateAssessmentItems(id, items);
  }

  @Post('assessments/:id/submit')
  submitAssessment(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.submitAssessment(id);
  }

  @Get(':id/interviews')
  getInterviews(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getInterviews(id);
  }

  @Get(':id/outcome')
  @ApiOperation({ summary: 'Get hiring outcome' })
  async getOutcome(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req?: { user: UserContext },
  ) {
    if (req?.user)
      await this.policyService.assertApplicationAccess(req.user, id);
    return this.svc.getOutcome(id);
  }
}
