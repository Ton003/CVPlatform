import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { User } from '../users/entities/user.entity';

export interface AuthResponse {
 message: string;
 access_token: string;
 user: Partial<User>;
}

@Injectable()
export class AuthService {
 private readonly logger = new Logger(AuthService.name);
 private static readonly SALT_ROUNDS = 12;

 constructor(
 private readonly usersService: UsersService,
 private readonly jwtService: JwtService,
 ) {}

 /**
 * Handles user registration and initial token generation
 */
 async signup(dto: SignupDto): Promise<AuthResponse> {
 const email = dto.email.toLowerCase();

 try {
 const passwordHash = await bcrypt.hash(
 dto.password,
 AuthService.SALT_ROUNDS,
 );

 const user = await this.usersService.create({
 ...dto,
 email,
 passwordHash,
 role: dto.role || 'hr',
        isActive: true,
      });

      const token = this.generateToken(user);

      return {
        message: 'Account created successfully',
        access_token: token,
        user: this.sanitizeUser(user),
      };
    } catch (error) {
      if (error.code === '23505' || error.status === 409) {
        throw new ConflictException(
          'An account with this email already exists',
 );
 }
 throw error;
 }
 }

 /**
 * Authenticates user and generates a stateful JWT
 */
 async login(dto: LoginDto): Promise<AuthResponse> {
 const email = dto.email.toLowerCase();
 const user = await this.usersService.findByEmail(email);

 if (!user) {
 this.logger.warn(`Failed login attempt for non-existent user: ${email}`);
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      this.logger.warn(`Blocked login attempt for inactive user: ${email}`);
      throw new UnauthorizedException('Your account has been suspended.');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      this.logger.warn(`Incorrect password attempt for user: ${email}`);
      throw new UnauthorizedException('Invalid email or password');
    }

    const token = this.generateToken(user);

    return {
      message: 'Login successful',
 access_token: token,
 user: this.sanitizeUser(user),
 };
 }

 /**
 * Returns sanitized profile for currently authenticated user
 */
 async getProfile(userId: string): Promise<Partial<User>> {
 const user = await this.usersService.findById(userId);
 if (!user) {
 throw new UnauthorizedException('User not found');
    }
    return this.sanitizeUser(user);
  }

  /**
   * ✅ Private helper for consistent JWT payload generation
   */
  private generateToken(user: User): string {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return this.jwtService.sign(payload);
  }

  /**
   * ✅ Ensures sensitive fields like passwordHash never leave the service layer
   */
  private sanitizeUser(user: User): Partial<User> {
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }
}
