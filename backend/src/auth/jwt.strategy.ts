import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { Request } from 'express';

export interface JwtPayload {
  sub: string;      // User UUID
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

/**
 * Attached to req.user on every authenticated request.
 * departmentId and employeeId are DB-derived — never read from the JWT claims directly.
 * This means even if a tampered JWT carried a fake departmentId, it would be ignored.
 */
export interface UserContext {
  id:           string;   // user UUID — auth identity
  email:        string;
  role:         'admin' | 'hr' | 'manager';
  firstName:    string;
  lastName:     string;
  employeeId:   string | null; // employee UUID — used as hiring_manager FK
  departmentId: string | null; // derived from Employee.departmentId at login
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      // ✅ Allow both Cookies and Bearer tokens for flexibility
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.biat_access_token || null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /**
   * Validates the JWT, then enriches UserContext from the database.
   * departmentId comes from the Employee record — signed into req.user by Passport,
   * not read from the JWT payload — so it cannot be tampered with by the client.
   */
  async validate(payload: JwtPayload): Promise<UserContext> {
    const user = await this.usersService.findById(payload.sub);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account not found or suspended');
    }

    // Derive departmentId and employeeId from the linked Employee record
    let departmentId: string | null = null;
    let employeeId: string | null = user.employeeId ?? null;

    if (employeeId) {
      // Single targeted query — not a full ORM relation load
      const [emp] = await this.usersService.findEmployeeDepartment(employeeId);
      departmentId = emp?.departmentId ?? null;
    }

    // Soft block: managers MUST have a department to see data, but we allow login
    // to prevent redirection loops. Scoped APIs will still enforce the block via PolicyService.
    /*
    if (user.role === 'manager' && (!employeeId || !departmentId)) {
      throw new UnauthorizedException(
        'Your manager account is not linked to a department. Contact an administrator.',
      );
    }
    */

    return {
      id:           user.id,
      email:        user.email,
      role:         user.role,
      firstName:    user.firstName,
      lastName:     user.lastName,
      employeeId,
      departmentId,
    };
  }
}