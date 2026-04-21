import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AssessmentsService } from './assessments.service';
import { CreateAssessmentDto, UpdateAssessmentItemsDto } from './dto/assessment.dto';

/**
 * Routes scoped to a specific employee:
 *   POST  /employees/:employeeId/assessments        → create draft
 *   GET   /employees/:employeeId/assessments        → history list
 *
 * Routes scoped to an assessment:
 *   PATCH /assessments/:id/items                    → save items
 *   POST  /assessments/:id/submit                   → submit → updates employee_competencies
 *   GET   /assessments/:id                          → fetch with summary
 */

@UseGuards(JwtAuthGuard)
@Controller()
export class AssessmentsController {
  constructor(private readonly assessmentsService: AssessmentsService) {}

  // ── Employee-scoped ─────────────────────────────────────────────────────────

  @Post('employees/:employeeId/assessments')
  createDraft(
    @Param('employeeId') employeeId: string,
    @Body() dto: CreateAssessmentDto,
    @Request() req: any,
  ) {
    return this.assessmentsService.createDraft(employeeId, dto, req.user);
  }

  @Get('employees/:employeeId/assessments')
  listHistory(@Param('employeeId') employeeId: string) {
    return this.assessmentsService.listForEmployee(employeeId);
  }

  // ── Assessment-scoped ───────────────────────────────────────────────────────

  @Get('assessments/:id')
  findOne(@Param('id') id: string) {
    return this.assessmentsService.findOne(id);
  }

  @Patch('assessments/:id/items')
  updateItems(
    @Param('id') id: string,
    @Body() dto: UpdateAssessmentItemsDto,
    @Request() req: any,
  ) {
    return this.assessmentsService.updateItems(id, dto, req.user);
  }

  @Post('assessments/:id/submit')
  submit(@Param('id') id: string, @Request() req: any) {
    return this.assessmentsService.submit(id, req.user);
  }
}
