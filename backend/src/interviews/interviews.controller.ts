import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InterviewsService } from './interviews.service';
import { CreateInterviewDto } from './dto/create-interview.dto';
import { UpdateFeedbackDto } from './dto/update-feedback.dto';
import { UserContext } from '../auth/jwt.strategy';

@ApiTags('Interviews')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard)
export class InterviewsController {
  constructor(private readonly svc: InterviewsService) {}

  @Get('applications/:applicationId/interviews')
  @ApiOperation({ summary: 'List all interviews for a specific application' })
  @ApiParam({ name: 'applicationId', format: 'uuid' })
  findByApplication(@Param('applicationId', ParseUUIDPipe) applicationId: string) {
    return this.svc.findByApplication(applicationId);
  }

  @Post('applications/:applicationId/interviews')
  @ApiOperation({ summary: 'Schedule a new interview for an application' })
  @ApiParam({ name: 'applicationId', format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Interview scheduled.' })
  create(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Body() dto: CreateInterviewDto,
    @Request() req: { user: UserContext },
  ) {
    dto.applicationId = applicationId;
    return this.svc.create(dto, req.user.id);
  }

  @Patch('interviews/:id')
  @ApiOperation({ summary: 'Update interview feedback and scores' })
  @ApiParam({ name: 'id', format: 'uuid' })
  updateFeedback(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFeedbackDto,
    @Request() req: { user: UserContext },
  ) {
    return this.svc.updateFeedback(id, dto, req.user.id);
  }

  @Delete('interviews/:id')
  @ApiOperation({ summary: 'Cancel/Delete an interview' })
  @ApiParam({ name: 'id', format: 'uuid' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(id);
  }
}
