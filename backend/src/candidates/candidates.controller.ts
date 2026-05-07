import {
  Controller,
  Get,
  Delete,
  Param,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CandidatesService } from './candidates.service';
import { CandidateScoringService } from './candidate-scoring.service';
import { PolicyService } from '../auth/policy.service';
import { UserContext } from '../auth/jwt.strategy';
import { Request } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Candidates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('candidates')
export class CandidatesController {
  private readonly logger = new Logger(CandidatesController.name);

  constructor(
    private readonly candidatesService: CandidatesService,
    private readonly scoringService: CandidateScoringService,
    private readonly policyService: PolicyService,
  ) {}

  @Get()
  @SkipThrottle()
  @ApiOperation({ summary: 'List and filter candidates' })
  @ApiResponse({ status: 200, description: 'Paginated list of candidates.' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async list(
    @Query('search') search?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Request() req?: { user: UserContext },
  ) {
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(50, Math.max(1, Number(limit)));
    
    // ABAC: Get managed job IDs if the user is a manager
    const managedJobIds = req?.user ? await this.policyService.getManagedJobIds(req.user) : [];
    
    return this.candidatesService.list(search, pageNum, limitNum, managedJobIds);
  }

  @Get(':id')
  @SkipThrottle()
  @ApiOperation({ summary: 'Get detailed candidate profile' })
  @ApiResponse({ status: 200, description: 'Candidate profile data.' })
  @ApiResponse({ status: 404, description: 'Candidate not found.' })
  async getProfile(@Param('id') id: string) {
    return this.candidatesService.getProfile(id);
  }

  @Get(':id/score')
  @SkipThrottle()
  @ApiOperation({ summary: 'Get AI-calculated candidate suitability score' })
  @ApiResponse({ status: 200, description: 'Composite score and role matches.' })
  async getScore(@Param('id') id: string) {
    return this.scoringService.score(id);
  }

  @Delete(':id')
  @Roles('admin', 'hr')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete candidate and all associated CV data' })
  @ApiResponse({ status: 204, description: 'Candidate deleted successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions.' })
  async deleteCandidate(@Param('id') id: string) {
    this.logger.warn(`Candidate deletion requested for ID: ${id}`);
    await this.candidatesService.delete(id);
  }
}