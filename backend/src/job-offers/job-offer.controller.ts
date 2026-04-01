import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  Query, UseGuards, Req, HttpCode, HttpStatus,
} from '@nestjs/common';
import { SkipThrottle }      from '@nestjs/throttler';
import { JwtAuthGuard }      from '../auth/jwt-auth.guard';
import { JobOffersService }  from './job-offer.service';
import { CreateJobOfferDto } from './dto/create-job-offer.dto';

@Controller('job-offers')
@UseGuards(JwtAuthGuard)
export class JobOffersController {
  constructor(private readonly jobOffersService: JobOffersService) {}

  // ── GET /job-offers?status= ──────────────────────────────────────
  @SkipThrottle()
  @Get()
  findAll(@Query('status') status?: string) {
    return this.jobOffersService.findAll(status);
  }

  // ── GET /job-offers/:id ──────────────────────────────────────────
  @SkipThrottle()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.jobOffersService.findOne(id);
  }

  // ── POST /job-offers ─────────────────────────────────────────────
  @Post()
  create(@Body() dto: CreateJobOfferDto, @Req() req: any) {
    const userId = req.user?.userId ?? null;
    return this.jobOffersService.create(dto, userId);
  }

  // ── DELETE /job-offers/:id ───────────────────────────────────────
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.jobOffersService.remove(id);
  }

  // ── PATCH /job-offers/:id ────────────────────────────────────────
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: import('./dto/update-job-offer.dto').UpdateJobOfferDto,
  ) {
    return this.jobOffersService.update(id, dto);
  }

  // ── GET /job-offers/:id/matches?mode=groq&apiKey=... ─────────────
  // Runs the RAG pipeline on-demand — results are never stored
  @SkipThrottle()
  @Get(':id/matches')
  matchCandidates(
    @Param('id')       id:      string,
    @Query('mode')     mode     = 'groq',
    @Query('apiKey')   apiKey?: string,
  ) {
    return this.jobOffersService.matchCandidates(id, apiKey, mode);
  }
}