import { Controller, Get, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';
import { EmployeesService } from './employees/employees.service';

@ApiTags('System')
@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(
    private readonly appService: AppService,
    private readonly employeesService: EmployeesService,
  ) {}

  @Get('/health')
  @ApiOperation({ summary: 'System Health Check' })
  @ApiResponse({ status: 200, description: 'Returns the status of the API.' })
  health(): { status: string; timestamp: string; info: any } {
    this.logger.debug('Health check heartbeat received');

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      info: this.appService.getSystemInfo(),
    };
  }

  @Get('test-managers')
  async testManagers() {
    return this.employeesService.findAllManagers();
  }
}
