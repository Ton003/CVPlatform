import { Controller, Get, Patch, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ScoutAgentService } from './scout-agent.service';
import { InsightStatus } from './entities/scout-insight.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PolicyService } from '../auth/policy.service';
import { UserContext } from '../auth/jwt.strategy';

@Controller('intelligence')
@UseGuards(JwtAuthGuard)
export class IntelligenceController {
  constructor(
    private readonly scoutAgentService: ScoutAgentService,
    private readonly policyService: PolicyService,
  ) {}

  @Get('scout-insights')
  async getScoutInsights(@Req() req: { user: UserContext }) {
    const managedJobIds = await this.policyService.getManagedJobIds(req.user);
    const departmentId = this.policyService.isManager(req.user) ? req.user.departmentId : null;
    const isManager = this.policyService.isManager(req.user);
    return this.scoutAgentService.getScoutInsights(managedJobIds, departmentId, isManager);
  }

  @Patch('scout-insights/:id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: InsightStatus,
  ) {
    return this.scoutAgentService.updateInsightStatus(id, status);
  }

  @Get('scout-insights/:id/action')
  async actionInsight(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    return this.scoutAgentService.actionInsight(id, userId);
  }

  @Get('trigger-agent')
  async triggerAgent() {
    // Manually trigger the agent loop and wait for completion
    await this.scoutAgentService.runAgentLoop();
    return { message: 'Agent loop completed.' };
  }
}
