import { Controller, Get, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('managers')
  findAllManagers() {
    return this.usersService.findAllManagers();
  }
}
