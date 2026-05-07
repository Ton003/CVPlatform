import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DashboardService } from './dashboard.service';
import { PolicyService } from '../auth/policy.service';
import { UserContext } from '../auth/jwt.strategy';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly policyService: PolicyService,
  ) {}

  @Get('stats')
  async getStats(@Request() req: { user: UserContext }) {
    const managedJobIds = await this.policyService.getManagedJobIds(req.user);
    return this.dashboardService.getStats(managedJobIds);
  }
}
