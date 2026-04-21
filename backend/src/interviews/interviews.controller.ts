import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, UseGuards, Request,
} from '@nestjs/common';
import { JwtAuthGuard }    from '../auth/jwt-auth.guard';
import { InterviewsService } from './interviews.service';
import { CreateInterviewDto } from './dto/create-interview.dto';
import { UpdateFeedbackDto } from './dto/update-feedback.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class InterviewsController {
  constructor(private readonly svc: InterviewsService) {}

  // ── GET /applications/:id/interviews ─────────────────────────────
  @Get('applications/:applicationId/interviews')
  findByApplication(@Param('applicationId') applicationId: string) {
    return this.svc.findByApplication(applicationId);
  }

  // ── POST /applications/:id/interviews ────────────────────────────
  @Post('applications/:applicationId/interviews')
  create(
    @Param('applicationId') applicationId: string,
    @Body() dto: CreateInterviewDto,
    @Request() req: any,
  ) {
    // Ensure DTO applicationId matches Param applicationId
    dto.applicationId = applicationId;
    return this.svc.create(dto, req.user.id);
  }

  // ── PATCH /interviews/:id ────────────────────────────────────────
  @Patch('interviews/:id')
  updateFeedback(
    @Param('id') id: string,
    @Body() dto: UpdateFeedbackDto,
    @Request() req: any,
  ) {
    return this.svc.updateFeedback(id, dto, req.user.id);
  }

  // ── DELETE /interviews/:id ───────────────────────────────────────
  @Delete('interviews/:id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
