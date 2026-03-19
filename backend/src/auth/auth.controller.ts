// auth/auth.controller.ts
import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  // ✅ Signup gets a slightly looser limit — 10 per minute
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  // ✅ Login is stricter — 5 attempts per minute
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @SkipThrottle() // authenticated endpoint, no need to throttle
  async getProfile(@Request() req: any) {
    return this.authService.getProfile(req.user.id);
  }
}