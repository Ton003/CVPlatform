import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { IsString, IsOptional, MinLength } from 'class-validator';
import { User } from './entities/user.entity';

export class UpdateProfileDto {
  @IsString()
  @MinLength(1, { message: 'First name is required' })
  @IsOptional()
  firstName?: string;

  @IsString()
  @MinLength(1, { message: 'Last name is required' })
  @IsOptional()
  lastName?: string;

  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters long' })
  @IsOptional()
  password?: string;

  @IsString()
  @MinLength(1, { message: 'Current password is required to verify identity' })
 oldPassword: string;
}

@Injectable()
export class UsersService {
 private readonly logger = new Logger(UsersService.name);

 constructor(
 @InjectRepository(User)
 private readonly usersRepository: Repository<User>,
 @InjectDataSource()
 private readonly dataSource: DataSource,
 ) {}

 /**
 * Normalizes email and finds a user by their unique email address
 */
 async findByEmail(email: string): Promise<User | null> {
 return this.usersRepository.findOne({
 where: { email: email.toLowerCase().trim() },
 });
 }

 /**
 * Finds a user by their UUID
 */
 async findById(id: string): Promise<User | null> {
 return this.usersRepository.findOne({ where: { id } });
 }

 /**
 * Persists a new user to the database.
 * If the role is 'manager', we automatically create a corresponding Employee record.
   */
  async create(data: any): Promise<User> {
    return this.dataSource.transaction(async (manager) => {
      const { departmentId, jobRoleLevelId, ...userData } = data;

      const user = manager.create(User, {
        ...userData,
        email: userData.email?.toLowerCase().trim(),
      });
      const savedUser = await manager.save(user);

      if (savedUser.role === 'manager' || savedUser.role === 'admin') {
        // Use provided level or find a placeholder
        let levelId = jobRoleLevelId;
        let roleId: string | null = null;

        if (!levelId) {
          const levels = await manager.query(
            'SELECT id, "jobRoleId" FROM job_role_levels LIMIT 1',
          );
          levelId = levels[0]?.id;
          roleId = levels[0]?.jobRoleId;
        } else {
          const roles = await manager.query(
            'SELECT "jobRoleId" FROM job_role_levels WHERE id = $1',
            [levelId],
          );
          roleId = roles[0]?.jobRoleId;
        }

        if (levelId && roleId) {
          const empId = `EMP-${Math.floor(1000 + Math.random() * 9000)}`;
          const empRows = await manager.query(
            `
            INSERT INTO employees (
              employee_id, first_name, last_name, email, 
              hire_date, status, is_manager, job_role_id, job_role_level_id, department_id, user_id
            )
            VALUES ($1, $2, $3, $4, CURRENT_DATE, 'active', true, $5, $6, $7, $8)
            RETURNING id
          `,
 [
 empId,
 savedUser.firstName,
 savedUser.lastName,
 savedUser.email,
 roleId,
 levelId,
 departmentId || null,
 savedUser.id,
 ],
 );

 const newEmployeeId = empRows[0].id;
 savedUser.employeeId = newEmployeeId;
 await manager.save(savedUser);
 }
 }

 return savedUser;
 });
 }

 /**
 * Updates an existing user's profile
   */
  async update(id: string, data: Partial<User>): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException(`User with ID ${id} not found`);

 Object.assign(user, {
 ...data,
 email: data.email ? data.email.toLowerCase().trim() : user.email,
 });

 return this.usersRepository.save(user);
 }

 /**
 * Updates current authenticated user profile (name and password)
 */
 async updateProfile(id: string, dto: UpdateProfileDto): Promise<Partial<User>> {
 const user = await this.findById(id);
 if (!user) throw new NotFoundException(`User with ID ${id} not found`);

    // Verify current (old) password
    const isPasswordValid = await bcrypt.compare(dto.oldPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new BadRequestException('Incorrect current password.');
    }

    if (dto.firstName !== undefined) user.firstName = dto.firstName;
    if (dto.lastName !== undefined) user.lastName = dto.lastName;

    if (dto.password) {
      user.passwordHash = await bcrypt.hash(dto.password, 12);
    }

    const savedUser = await this.usersRepository.save(user);

    // If the user's name is updated and they have an associated employee record,
    // we should also update the corresponding employee record!
    await this.dataSource.query(
      `UPDATE employees SET first_name = $1, last_name = $2 WHERE id = $3 OR user_id = $4`,
 [savedUser.firstName, savedUser.lastName, savedUser.employeeId, savedUser.id],
 );

 const { passwordHash, ...safeUser } = savedUser;
 return safeUser;
 }


 /**
 * Checks if an email is already registered
 */
 async emailExists(email: string): Promise<boolean> {
 const count = await this.usersRepository.count({
 where: { email: email.toLowerCase().trim() },
 });
 return count > 0;
 }

 /**
 * Returns all users with management-level roles for selection in workflows
 */
 async findAllManagers(): Promise<User[]> {
 return this.usersRepository.find({
 where: [{ role: 'admin' }, { role: 'hr' }, { role: 'manager' }],
      order: { firstName: 'ASC' },
    });
  }

  /**
   * Used by JwtStrategy to securely derive departmentId from the linked Employee.
   * Returns only the fields needed — avoids loading the full Employee graph on every request.
   */
  async findEmployeeDepartment(
    employeeId: string,
  ): Promise<Array<{ departmentId: string | null }>> {
    return this.dataSource.query(
      `SELECT department_id AS "departmentId" FROM employees WHERE id = $1::uuid LIMIT 1`,
 [employeeId],
 );
 }

 /**
 * Deletes a user (use with caution)
 */
 async remove(id: string): Promise<void> {
 const result = await this.usersRepository.delete(id);
 if (result.affected === 0) {
 throw new NotFoundException(`User with ID ${id} not found`);
    }
  }
}
