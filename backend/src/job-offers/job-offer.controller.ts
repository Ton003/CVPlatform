import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Headers,
  ParseUUIDPipe,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { JobOffersService } from './job-offer.service';
import { ApplicationsService } from '../applications/applications.service';
import { CreateJobOfferDto } from './dto/create-job-offer.dto';
import { UpdateJobOfferDto } from './dto/update-job-offer.dto';
import { UserContext } from '../auth/jwt.strategy';
import { PolicyService } from '../auth/policy.service';

@ApiTags('Job Offers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('job-offers')
export class JobOffersController {
  private readonly logger = new Logger(JobOffersController.name);

  constructor(
    private readonly jobOffersService: JobOffersService,
    private readonly applicationsService: ApplicationsService,
    private readonly policyService: PolicyService,
  ) {}

  @Get()
  @SkipThrottle()
  @ApiOperation({ summary: 'List all job offers with optional status filter' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['open', 'closed', 'draft'],
  })
  @ApiResponse({ status: 200, description: 'List of job offers retrieved.' })
  async findAll(
    @Query('status') status?: string,
    @Request() req?: { user: UserContext },
  ) {
    let scopedIds: string[] = [];
    if (req?.user && this.policyService.isManager(req.user)) {
      scopedIds = await this.policyService.getManagedJobIds(req.user);
      // If manager has no jobs, we return empty list
      if (scopedIds.length === 0) return [];
    }
    return this.jobOffersService.findAll(status, scopedIds);
  }

  @Get(':id')
  @SkipThrottle()
  @ApiOperation({ summary: 'Get a single job offer by UUID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Job offer details.' })
  @ApiResponse({ status: 404, description: 'Job offer not found.' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req?: { user: UserContext },
  ) {
    if (req?.user) {
      await this.policyService.assertJobAccess(req.user, id);
    }
    return this.jobOffersService.findOne(id);
  }

  @Post()
  @Roles('admin', 'hr')
  @ApiOperation({ summary: 'Create a new job offer' })
  @ApiResponse({ status: 201, description: 'Job offer created.' })
  create(
    @Body() dto: CreateJobOfferDto,
    @Request() req: { user: UserContext },
  ) {
    return this.jobOffersService.create(dto, req.user.id);
  }

  @Patch(':id')
  @Roles('admin', 'hr')
  @ApiOperation({ summary: 'Update an existing job offer' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Job offer updated.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateJobOfferDto,
  ) {
    return this.jobOffersService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin', 'hr')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a job offer' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Job offer removed.' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    this.logger.warn(`Job offer ${id} is being deleted`);
    return this.jobOffersService.remove(id);
  }

  @Get(':id/matches')
  @SkipThrottle()
  @ApiOperation({ summary: 'Run AI-powered candidate matching for this offer' })
  @ApiHeader({
    name: 'x-api-key',
    description: 'AI API Key for matching',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Unranked matching results returned.',
  })
  matchCandidates(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-api-key') apiKey?: string,
  ) {
    return this.jobOffersService.matchCandidates(id, apiKey);
  }

  @Post(':jobId/applications/from-candidate')
  @ApiOperation({ summary: 'Move a candidate into the pipeline for this job' })
  @ApiResponse({
    status: 201,
    description: 'Application created successfully.',
  })
  createApplicationFromCandidate(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Body('candidateId', ParseUUIDPipe) candidateId: string,
    @Request() req: { user: UserContext },
  ) {
    return this.applicationsService.createApplicationFromExistingCandidate(
      candidateId,
      jobId,
      req.user.id,
    );
  }

  @Put(':id/competency-weights')
  @Roles('admin', 'hr')
  @ApiOperation({ summary: 'Set custom skill weighting for matching engine' })
  @ApiResponse({ status: 200, description: 'Weights updated.' })
  setCompetencyWeights(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() weights: Array<{ competenceId: string; weight: number }>,
    @Request() req: { user: UserContext },
  ) {
    return this.jobOffersService.setCompetencyWeights(id, weights, req.user.id);
  }

  @Get(':id/requirements')
  @ApiOperation({ summary: 'Get competency requirements for this job' })
  async getRequirements(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req?: { user: UserContext },
  ) {
    if (req?.user) await this.policyService.assertJobAccess(req.user, id);
    return this.jobOffersService.getRequirements(id);
  }
}
