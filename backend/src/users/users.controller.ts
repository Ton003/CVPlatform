import { Controller, Get, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  @Get('managers')
  @ApiOperation({ 
    summary: 'List all management-level users',
    description: 'Returns a list of users with Admin, HR, or Manager roles for assignment workflows.'
  })
  @ApiResponse({ status: 200, description: 'List of managers returned successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  findAllManagers() {
    this.logger.debug('Fetching manager list for assignment workflow');
    return this.usersService.findAllManagers();
  }
}
