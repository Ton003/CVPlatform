import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async signup(dto: SignupDto) {
    const exists = await this.usersService.emailExists(dto.email.toLowerCase());
    if (exists) {
      throw new ConflictException('An account with this email already exists');
    }

    const SALT_ROUNDS = 12;
    const password_hash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const user = await this.usersService.create({
      email: dto.email.toLowerCase(),
      password_hash,
      first_name: dto.first_name,
      last_name: dto.last_name,
      role: dto.role || 'hr',
      department: dto.department,
      is_active: true,
    });

    const token = this.generateToken(user.id, user.email, user.role);

    return {
      message: 'Account created successfully',
      access_token: token,
      user: this.sanitizeUser(user),
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email.toLowerCase());

    // ✅ Fix #1 — generic message, never reveal which field failed
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.is_active) {
      throw new UnauthorizedException('Your account has been suspended. Contact your administrator.');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.password_hash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const token = this.generateToken(user.id, user.email, user.role);

    return {
      message: 'Login successful',
      access_token: token,
      user: this.sanitizeUser(user),
    };
  }

  async getProfile(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');
    return this.sanitizeUser(user);
  }

  // ✅ Fix #2 — no options object, JwtModule config handles secret + expiry
  private generateToken(userId: string, email: string, role: string): string {
    const payload = { sub: userId, email, role };
    return this.jwtService.sign(payload);
  }

  private sanitizeUser(user: any) {
    const { password_hash, ...safeUser } = user;
    return safeUser;
  }
}