import { Controller, Get, Param, Query, UseGuards, Post, Body, Patch } from '@nestjs/common';
import { UnifiedScoringService } from '../shared/services/unified-scoring.service';
import { InternalMobilityService } from './internal-mobility.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
// Note: assuming ApiTags from swagger but omitted in imports initially, ignoring for now since it was already like that

@UseGuards(JwtAuthGuard)
@Controller('internal-mobility')
export class InternalMobilityController {
  constructor(
    private readonly scoringService: UnifiedScoringService,
    private readonly mobilityService: InternalMobilityService
  ) {}

  /**
   * Submit an internal application for a job.
   */
  @Post('apply')
  async apply(@Body() dto: { employeeId: string; jobOfferId: string }) {
    return this.mobilityService.apply(dto.employeeId, dto.jobOfferId);
  }

  /**
   * Update internal application status (Manager/HR).
   */
  @Patch('status/:id')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: { status: any; notes?: string }
  ) {
    return this.mobilityService.updateStatus(id, dto.status, dto.notes);
  }

  /**
   * Get AI-driven role recommendations for an employee.
   */
  @Get('recommendations/:employeeId')
  async getRecommendations(@Param('employeeId') employeeId: string) {
    return this.mobilityService.getRecommendations(employeeId);
  }

  /**
   * Calculate the match score for an employee against a specific job offer.
   * Ranking the employee as an internal candidate.
   */
  @Get('score/:employeeId/:offerId')
  async getEmployeeMatch(
    @Param('employeeId') employeeId: string,
    @Param('offerId') offerId: string,
  ) {
    return this.scoringService.scoreEmployee(employeeId, offerId);
  }

  /**
   * Perform a gap analysis between an employee and a target Job Role Level.
   * Useful for development plans and promotion readiness checks.
   */
  @Get('gap-analysis/:employeeId/:levelId')
  async getGapAnalysis(
    @Param('employeeId') employeeId: string,
    @Param('levelId') levelId: string,
  ) {
    return this.scoringService.getGapAnalysis(employeeId, levelId);
  }

  /**
   * Unified scoring for a specific Job Offer across all eligible employees.
   */
  @Get('job-offers/:id/internal-candidates')
  async getOfferMatches(
    @Param('id') offerId: string,
    @Query('minScore') minScore?: number,
  ) {
    // Parse minScore or default to 0
    const min = minScore ? parseInt(minScore.toString(), 10) : 0;
    return this.scoringService.getOfferMatches(offerId, min);
  }
}
