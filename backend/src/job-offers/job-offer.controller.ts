import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  Query, UseGuards, Req, HttpCode, HttpStatus, Headers, ParseUUIDPipe
} from '@nestjs/common';
import { SkipThrottle }      from '@nestjs/throttler';
import { JwtAuthGuard }      from '../auth/jwt-auth.guard';
import { JobOffersService }  from './job-offer.service';
import { ApplicationsService } from '../applications/applications.service';
import { CreateJobOfferDto } from './dto/create-job-offer.dto';
import { UpdateJobOfferDto } from './dto/update-job-offer.dto';

@Controller('job-offers')
@UseGuards(JwtAuthGuard)
export class JobOffersController {
  constructor(
    private readonly jobOffersService: JobOffersService,
    private readonly applicationsService: ApplicationsService,
  ) {}

  // ── GET /job-offers?status= ──────────────────────────────────────
  @SkipThrottle()
  @Get()
  findAll(@Query('status') status?: string) {
    return this.jobOffersService.findAll(status);
  }

  // ── GET /job-offers/:id ──────────────────────────────────────────
  @SkipThrottle()
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.jobOffersService.findOne(id);
  }

  // ── POST /job-offers ─────────────────────────────────────────────
  @Post()
  create(@Body() dto: CreateJobOfferDto, @Req() req: any) {
    const userId = req.user?.id ?? null;
    return this.jobOffersService.create(dto, userId);
  }

  // ── DELETE /job-offers/:id ───────────────────────────────────────
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.jobOffersService.remove(id);
  }

  // ── PATCH /job-offers/:id ────────────────────────────────────────
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateJobOfferDto,
  ) {
    return this.jobOffersService.update(id, dto);
  }

  // ── GET /job-offers/:id/matches?mode=groq&apiKey=... ─────────────
  // Runs the RAG pipeline on-demand — results are never stored
  @SkipThrottle()
  @Get(':id/matches')
  matchCandidates(
    @Param('id', ParseUUIDPipe)       id:      string,
    @Query('mode')     mode     = 'groq',
    @Headers('x-api-key') apiKey?: string,
  ) {
    return this.jobOffersService.matchCandidates(id, apiKey, mode);
  }

  @SkipThrottle()
  @Get(':id/comparison')
  getComparison(@Param('id', ParseUUIDPipe) id: string) {
    return this.jobOffersService.getComparison(id);
  }

  // ── POST /job-offers/:jobId/applications/from-candidate ──────────
  @Post(':jobId/applications/from-candidate')
  createApplicationFromCandidate(
    @Param('jobId') jobId: string,
    @Body('candidateId') candidateId: string,
    @Req() req: any,
  ) {
    const userId = req.user?.id ?? null;
    return this.applicationsService.createApplicationFromExistingCandidate(candidateId, jobId, userId);
  }

  // ── GET /job-offers/:id/requirements ─────────────────────────────
  @SkipThrottle()
  @Get(':id/requirements')
  getJobRequirements(@Param('id', ParseUUIDPipe) id: string) {
    return this.jobOffersService.getJobRequirements(id);
  }
}