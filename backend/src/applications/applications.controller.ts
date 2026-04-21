import {
  Controller, Get, Post, Patch, Delete, Put,
  Param, Body, Query, Request,
  UseGuards, HttpCode, HttpStatus,
  NotFoundException, BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard }       from '../auth/jwt-auth.guard';
import { SkipThrottle }         from '@nestjs/throttler';
import { ApplicationsService } from './applications.service';
import { UseInterceptors, UploadedFile} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express/multer';
import { memoryStorage }   from 'multer';
import { IsString, IsOptional, IsUUID, IsInt, Min, Max } from 'class-validator';
import { AssessmentUpdateDto, AssessmentItemUpdateDto } from '../shared/dto/assessment.dto';

class CreateApplicationDto {
  @IsUUID()
  jobId!: string;

  @IsUUID()
  candidateId!: string;

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
  stage!: string;
}

class AddNoteDto {
  @IsString()
  note!: string;

  @IsInt()
  @Min(0)
  @Max(5)
  @IsOptional()
  rating?: number;

  @IsString()
  @IsOptional()
  stage?: string;
}

@Controller('applications')
@UseGuards(JwtAuthGuard)
@SkipThrottle()
export class ApplicationsController {

  constructor(private readonly svc: ApplicationsService) {}

  // ── POST /applications ───────────────────────────────────────────
  @Post()
  create(@Body() dto: CreateApplicationDto, @Request() req: any) {
    return this.svc.create(dto, req.user.id);
  }

  // ── GET /applications?jobId=&stage=&page=&limit= ─────────────────
  @Get()
  list(
    @Query('jobId')  jobId?:  string,
    @Query('stage')  stage?:  string,
    @Query('page')   page  = '1',
    @Query('limit')  limit = '50',
  ) {
    return this.svc.list({ jobId, stage, page: +page, limit: +limit });
  }

  // ── GET /applications/:id ────────────────────────────────────────
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  // ── PATCH /applications/:id/stage ───────────────────────────────
  @Patch(':id/stage')
  updateStage(
    @Param('id') id: string,
    @Body() dto: UpdateStageDto,
    @Request() req: any,
  ) {
    return this.svc.updateStage(id, dto.stage, req.user.id);
  }

  // ── DELETE /applications/:id ─────────────────────────────────────
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }

  // ── GET /applications/:id/notes ──────────────────────────────────
  @Get(':id/notes')
  getNotes(@Param('id') id: string) {
    return this.svc.getNotes(id);
  }

  // ── POST /applications/:id/notes ─────────────────────────────────
  @Post(':id/notes')
  addNote(
    @Param('id') id: string,
    @Body() dto: AddNoteDto,
    @Request() req: any,
  ) {
    return this.svc.addNote(id, dto, req.user.id);
  }
  
  // ── DELETE /applications/:id/notes/:noteId ────────────────────────
  @Delete(':id/notes/:noteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeNote(
    @Param('id') id: string,
    @Param('noteId') noteId: string,
    @Request() req: any,
  ) {
    return this.svc.removeNote(id, noteId, req.user.id);
  }

  // ── GET /applications/:id/activity ───────────────────────────────
  @Get(':id/activity')
  getActivity(@Param('id') id: string) {
    return this.svc.getActivity(id);
  }

  @Get(':id/score')
  getScore(@Param('id') id: string) {
    return this.svc.getScore(id);
  }

// ── Competency Ratings ───────────────────────────────────────────
@Get(':id/competencies')
getCompetencyScores(@Param('id') id: string) {
  return this.svc.getCompetencyScores(id);
}

@Patch(':id/competencies/:compId')
rateCompetency(
  @Param('id') id: string,
  @Param('compId') compId: string,
  @Body() dto: { evaluatedLevel: number },
  @Request() req: any,
) {
  return this.svc.updateCompetencyScore(id, compId, dto.evaluatedLevel, req.user.id);
}

@Put(':id/competencies/:compId')
updateRating(
  @Param('id') id: string,
  @Param('compId') compId: string,
  @Body() dto: { evaluatedLevel: number },
  @Request() req: any,
) {
  return this.svc.updateCompetencyScore(id, compId, dto.evaluatedLevel, req.user.id);
}
}
