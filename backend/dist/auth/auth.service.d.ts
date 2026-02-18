import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
export declare class AuthService {
    private readonly usersService;
    private readonly jwtService;
    private readonly configService;
    constructor(usersService: UsersService, jwtService: JwtService, configService: ConfigService);
    signup(dto: SignupDto): Promise<{
        message: string;
        access_token: string;
        user: any;
    }>;
    login(dto: LoginDto): Promise<{
        message: string;
        access_token: string;
        user: any;
    }>;
    getProfile(userId: string): Promise<any>;
    private generateToken;
    private sanitizeUser;
}
