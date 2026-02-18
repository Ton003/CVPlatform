export declare class SignupDto {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    role?: 'admin' | 'hr' | 'manager';
    department?: string;
}
