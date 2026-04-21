import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InternalApplication, InternalApplicationStatus } from './entities/internal-application.entity';
import { EmployeeRoleMatch } from './entities/employee-role-match.entity';
import { Employee } from './entities/employee.entity';
import { JobOffer } from '../job-offers/job-offer.entity';
import { UnifiedScoringService } from '../shared/services/unified-scoring.service';

@Injectable()
export class InternalMobilityService {
  private readonly logger = new Logger(InternalMobilityService.name);

  constructor(
    @InjectRepository(InternalApplication)
    private readonly applicationRepo: Repository<InternalApplication>,
    @InjectRepository(EmployeeRoleMatch)
    private readonly matchRepo: Repository<EmployeeRoleMatch>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(JobOffer)
    private readonly offerRepo: Repository<JobOffer>,
    private readonly scoringService: UnifiedScoringService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Submit an internal application for a job.
   */
  async apply(employeeId: string, jobOfferId: string) {
    // 1. Check for existing application
    const existing = await this.applicationRepo.findOne({
      where: { employeeId, jobOfferId }
    });
    if (existing) throw new BadRequestException('You have already applied for this role.');

    // 2. Check if job is open for internal candidates
    const offer = await this.offerRepo.findOne({ where: { id: jobOfferId } });
    if (!offer || (offer.visibility !== 'internal' && offer.visibility !== 'both')) {
      throw new BadRequestException('This job is not open for internal applications.');
    }

    // 3. Create application
    const app = this.applicationRepo.create({
      employeeId,
      jobOfferId,
      status: InternalApplicationStatus.APPLIED
    });

    return this.applicationRepo.save(app);
  }

  /**
   * Manager or HR update of application status.
   */
  async updateStatus(applicationId: string, status: InternalApplicationStatus, notes?: string) {
    const app = await this.applicationRepo.findOne({ where: { id: applicationId } });
    if (!app) throw new NotFoundException('Internal application not found');

    app.status = status;
    if (notes) app.managerNotes = notes;

    return this.applicationRepo.save(app);
  }

  /**
   * Get role recommendations for an employee.
   * Uses cache if available and fresh (< 24h), else calculates.
   */
  async getRecommendations(employeeId: string) {
    const employee = await this.employeeRepo.findOne({ where: { id: employeeId } });
    if (!employee) throw new NotFoundException('Employee not found');

    // 1. Fetch available jobs
    const openJobs = await this.offerRepo.find({
      where: { status: 'open' }
    });

    const recommendations: any[] = [];

    for (const job of openJobs) {
      if (job.visibility === 'external') continue;

      // 2. Check cache
      let match = await this.matchRepo.findOne({
        where: { employeeId, jobOfferId: job.id }
      });

      const isStale = match && (new Date().getTime() - new Date(match.lastCalculatedAt).getTime() > 86400000);

      if (!match || isStale) {
        // 3. Calculate score
        this.logger.log(`🔄 Calculating match for Employee ${employeeId} and Job ${job.id}`);
        const result = await this.scoringService.scoreEmployee(employeeId, job.id);
        
        if (!match) {
          match = this.matchRepo.create({
            employeeId,
            jobOfferId: job.id,
          });
        }

        match.totalScore = result.totalScore;
        match.isComplete = result.isComplete;
        match.breakdown = result.breakdown;
        match.lastCalculatedAt = new Date();
        
        await this.matchRepo.save(match);
      }

      recommendations.push({
        jobId: job.id,
        title: job.title,
        totalScore: match.totalScore,
        breakdown: match.breakdown,
        isComplete: match.isComplete
      });
    }

    // Sort by score descending
    return recommendations.sort((a, b) => b.totalScore - a.totalScore);
  }

  /**
   * Batch refresh of all recommendations (could be called by a cron job).
   */
  async refreshAllRecommendations() {
    this.logger.log('🚀 Starting batch refresh of internal mobility recommendations...');
    const employees = await this.employeeRepo.find({ select: ['id'] });
    for (const emp of employees) {
      await this.getRecommendations(emp.id);
    }
    this.logger.log('✅ Batch refresh complete.');
  }
}
