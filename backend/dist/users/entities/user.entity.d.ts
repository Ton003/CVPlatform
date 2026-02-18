export declare class User {
    id: string;
    email: string;
    password_hash: string;
    first_name: string;
    last_name: string;
    role: 'admin' | 'hr' | 'manager';
    department: string;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}
