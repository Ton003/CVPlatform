import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
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
    getProfile(req: any): Promise<any>;
}
