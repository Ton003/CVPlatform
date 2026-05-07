import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus, Request } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { RecommendDto }   from './dto/recommend.dto';
import { JwtAuthGuard }   from '../auth/jwt-auth.guard';
import { PolicyService } from '../auth/policy.service';
import { UserContext } from '../auth/jwt.strategy';

@Controller('chatbot')
@UseGuards(JwtAuthGuard)
export class ChatbotController {
  constructor(
    private readonly chatbotService: ChatbotService,
    private readonly policyService: PolicyService,
  ) {}

  @Post('recommend')
  @HttpCode(HttpStatus.OK)
  async recommend(@Body() dto: RecommendDto, @Request() req: { user: UserContext }) {
    // ABAC: Managers only search their department/managed jobs pool
    let scopedCandidateIds: string[] | undefined;
    let scopedDepartmentId: string | undefined;

    if (this.policyService.isManager(req.user)) {
      const managedJobIds = await this.policyService.getManagedJobIds(req.user);
      scopedCandidateIds = await this.policyService.getCandidateIdsForJobs(managedJobIds);
      scopedDepartmentId = req.user.departmentId || undefined;
    }

    return this.chatbotService.recommend(dto, scopedCandidateIds, scopedDepartmentId);
  }
}