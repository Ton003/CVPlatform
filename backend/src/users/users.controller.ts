import { Controller, Get, Patch, Body, Request, UseGuards, Logger } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UsersService, UpdateProfileDto } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserContext } from '../auth/jwt.strategy';

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
    description:
      'Returns a list of users with Admin, HR, or Manager roles for assignment workflows.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of managers returned successfully.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  findAllManagers() {
    this.logger.debug('Fetching manager list for assignment workflow');
    return this.usersService.findAllManagers();
  }

  @Patch('profile')
  @ApiOperation({
    summary: 'Update current authenticated user profile',
    description: 'Allows changing first name, last name, and password.',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async updateProfile(
    @Request() req: { user: UserContext },
    @Body() dto: UpdateProfileDto,
  ) {
    this.logger.debug(`Profile update requested for user: ${req.user.id}`);
    return this.usersService.updateProfile(req.user.id, dto);
  }
}

