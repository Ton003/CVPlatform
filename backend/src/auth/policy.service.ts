import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { UserContext } from './jwt.strategy';

@Injectable()
export class PolicyService {
  private readonly logger = new Logger(PolicyService.name);

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  isHrOrAdmin(user: UserContext): boolean {
    return user.role === 'admin' || user.role === 'hr';
  }

  isManager(user: UserContext): boolean {
    return user.role === 'manager';
  }

  /**
   * Guards manager-only code paths. Throws 403 if the manager has no
   * departmentId in their JWT (i.e., no linked Employee record with a dept).
   */
  assertManagerHasDepartment(user: UserContext): void {
    if (!this.isManager(user)) return; // HR/admin – no check needed
    if (!user.departmentId || !user.employeeId) {
      this.logger.warn(
        `Manager ${user.id} attempted access without a linked Employee/department. Blocked.`,
      );
      throw new ForbiddenException(
        'Your manager account is not linked to a department. Contact an administrator.',
      );
    }
  }

  /**
   * Managers can only access jobs where job.hiring_manager = their employeeId.
   */
  async assertJobAccess(user: UserContext, jobId: string): Promise<void> {
    if (this.isHrOrAdmin(user)) return;
    this.assertManagerHasDepartment(user);

    const rows = await this.ds.query(
      `SELECT id FROM job_offers WHERE id = $1::uuid AND hiring_manager = $2::uuid`,
      [jobId, user.employeeId],
    );

    if (!rows.length) {
      throw new ForbiddenException(
        `You are not the hiring manager for job ${jobId}`,
      );
    }
  }

  /**
   * Managers can only access applications linked to a job they own.
   */
  async assertApplicationAccess(
    user: UserContext,
    applicationId: string,
  ): Promise<void> {
    if (this.isHrOrAdmin(user)) return;
    this.assertManagerHasDepartment(user);

    const rows = await this.ds.query(
      `SELECT a.id
       FROM applications a
       JOIN job_offers j ON j.id = a.job_id
       WHERE a.id = $1::uuid AND j.hiring_manager = $2::uuid`,
      [applicationId, user.employeeId],
    );

    if (!rows.length) {
      // Return 404 to avoid leaking resource existence to an unauthorised caller
      throw new ForbiddenException(
        `Application ${applicationId} not found or not accessible`,
      );
    }
  }

  /**
   * Managers can only access employees in their own department.
   */
  async assertEmployeeAccess(
    user: UserContext,
    employeeId: string,
  ): Promise<void> {
    if (this.isHrOrAdmin(user)) return;
    this.assertManagerHasDepartment(user);

    const rows = await this.ds.query(
      `SELECT id FROM employees WHERE id = $1::uuid AND department_id = $2::uuid`,
      [employeeId, user.departmentId],
    );

    if (!rows.length) {
      throw new ForbiddenException(
        `Employee ${employeeId} is not in your department`,
      );
    }
  }

  /**
   * Returns the list of job_offer UUIDs the calling manager owns.
   * Returns empty array for HR/admin (= no filter = see everything).
   */
  async getManagedJobIds(user: UserContext): Promise<string[]> {
    if (this.isHrOrAdmin(user)) return [];

    // Managers can ONLY see jobs they are explicitly assigned to as hiring_manager.
    // Reverted from seeing all "Open" jobs as requested.
    if (!user.employeeId) return [];

    const rows = await this.ds.query(
      `SELECT id::text FROM job_offers WHERE hiring_manager = $1::uuid`,
      [user.employeeId],
    );
    return rows.map((r: any) => r.id);
  }

  /**
   * Returns all candidate UUIDs who have applied to the given job IDs.
   * Used to scope AI search results for managers.
   */
  async getCandidateIdsForJobs(jobIds: string[]): Promise<string[]> {
    if (!jobIds.length) return [];
    const rows = await this.ds.query(
      `SELECT DISTINCT candidate_id::text FROM applications WHERE job_id = ANY($1::uuid[])`,
      [jobIds],
    );
    return rows.map((r: any) => r.candidate_id);
  }
}
