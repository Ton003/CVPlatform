import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);
  private readonly startupTime = new Date();

  getSystemInfo(): { version: string; environment: string; uptime: string } {
    const uptimeSeconds = Math.floor(
      (new Date().getTime() - this.startupTime.getTime()) / 1000,
    );

    return {
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: `${uptimeSeconds}s`,
    };
  }
}
