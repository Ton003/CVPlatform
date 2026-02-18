import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async signup(dto: SignupDto) {
    // 1. Check if email already exists
    const exists = await this.usersService.emailExists(dto.email.toLowerCase());
    if (exists) {
      throw new ConflictException('An account with this email already exists');
    }

    // 2. Hash password with bcrypt (12 rounds as specified in your schema)
    const SALT_ROUNDS = 12;
    const password_hash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    // 3. Create user in database
    const user = await this.usersService.create({
      email: dto.email.toLowerCase(),
      password_hash,
      first_name: dto.first_name,
      last_name: dto.last_name,
      role: dto.role || 'hr',
      department: dto.department,
      is_active: true,
    });

    // 4. Generate and return JWT token immediately (no need to login again)
    const token = this.generateToken(user.id, user.email, user.role);

    return {
      message: 'Account created successfully',
      access_token: token,
      user: this.sanitizeUser(user),
    };
  }

  async login(dto: LoginDto) {
    // 1. Find user by email
    const user = await this.usersService.findByEmail(dto.email.toLowerCase());

    if (!user) {
      throw new UnauthorizedException('email already exists');
    }

    // 2. Check if account is active
    if (!user.is_active) {
      throw new UnauthorizedException('Your account has been suspended. Contact your administrator.');
    }

    // 3. Compare password with stored hash
    const passwordValid = await bcrypt.compare(dto.password, user.password_hash);

    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // 4. Generate JWT token
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

  private generateToken(userId: string, email: string, role: string): string {
    const payload = { sub: userId, email, role };
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET')!,
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') as any,
    });
  }

  // Never return password_hash to the client
  private sanitizeUser(user: any) {
    const { password_hash, ...safeUser } = user;
    return safeUser;
  }
}