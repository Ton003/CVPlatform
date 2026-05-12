import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  InternalApplication,
  InternalApplicationStatus,
} from './entities/internal-application.entity';
import { EmployeeRoleMatch } from './entities/employee-role-match.entity';
import { Employee } from './entities/employee.entity';
import { JobOffer } from '../job-offers/job-offer.entity';
import { Candidate } from '../candidates/entities/candidates.entity';
import { Application } from '../applications/application.entity';
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
    @InjectRepository(Candidate)
    private readonly candidateRepo: Repository<Candidate>,
    @InjectRepository(Application)
    private readonly appRepo: Repository<Application>,
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
      where: { employeeId, jobOfferId },
    });
    if (existing)
      throw new BadRequestException('You have already applied for this role.');

    // 2. Check if job is open for internal candidates
    const offer = await this.offerRepo.findOne({ where: { id: jobOfferId } });
    if (
      !offer ||
      (offer.visibility !== 'internal' && offer.visibility !== 'both')
    ) {
      throw new BadRequestException(
        'This job is not open for internal applications.',
      );
    }

    // 3. Create application
    const app = this.applicationRepo.create({
      employeeId,
      jobOfferId,
      status: InternalApplicationStatus.APPLIED,
    });

    return this.applicationRepo.save(app);
  }

  /**
   * Manager or HR update of application status.
   */
  async updateStatus(
    applicationId: string,
    status: InternalApplicationStatus,
    notes?: string,
  ) {
    const app = await this.applicationRepo.findOne({
      where: { id: applicationId },
    });
    if (!app) throw new NotFoundException('Internal application not found');

    app.status = status;
    if (notes) app.managerNotes = notes;

    return this.applicationRepo.save(app);
  }

  /**
   * Nominate an employee for a job role (Internal Kanban integration)
   */
  async nominateEmployee(
    employeeId: string,
    jobOfferId: string,
    nominatedBy: string,
  ) {
    const employee = await this.employeeRepo.findOne({
      where: { id: employeeId },
      relations: ['jobRole'],
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const job = await this.offerRepo.findOne({ where: { id: jobOfferId } });
    if (!job) throw new NotFoundException('Job offer not found');

    // 1. Mirror employee as a candidate if not already mirrored
    let candidate = await this.candidateRepo.findOne({
      where: { email: employee.email },
    });
    if (!candidate) {
      candidate = this.candidateRepo.create({
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        phone: null,
        currentTitle: employee.jobRole?.name || 'Internal Employee',
        source: 'internal',
        createdBy: nominatedBy,
        gdprConsent: true, // Internal employees have already consented implicitly
        gdprConsentAt: new Date(),
      });
      candidate = await this.candidateRepo.save(candidate);
    } else {
      // Update source if it wasn't already marked internal
      if (candidate.source !== 'internal') {
        candidate.source = 'internal';
        await this.candidateRepo.save(candidate);
      }
    }

    // 2. Create standard Application record for the Kanban board
    let application = await this.appRepo.findOne({
      where: { candidateId: candidate.id, jobId: job.id },
    });
    if (!application) {
      application = this.appRepo.create({
        candidateId: candidate.id,
        jobId: job.id,
        stage: 'applied',
        source: 'internal_nomination',
        coverNote: `Internally nominated by ${nominatedBy}`,
      });
      application = await this.appRepo.save(application);
    }

    // 3. Mark the internal match as APPLIED in InternalApplication to track it there too
    let internalApp = await this.applicationRepo.findOne({
      where: { employeeId, jobOfferId },
    });
    if (!internalApp) {
      internalApp = this.applicationRepo.create({
        employeeId,
        jobOfferId,
        status: InternalApplicationStatus.APPLIED,
        managerNotes: `Nominated by ${nominatedBy}`,
      });
      await this.applicationRepo.save(internalApp);
    }

    return { application, candidate, internalApp };
  }

  /**
   * Get role recommendations for an employee.
   * Uses cache if available and fresh (< 24h), else calculates.
   */
  async getRecommendations(employeeId: string) {
    const employee = await this.employeeRepo.findOne({
      where: { id: employeeId },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    // 1. Fetch available jobs
    const openJobs = await this.offerRepo.find({
      where: { status: 'open' },
    });

    const recommendations: any[] = [];

    for (const job of openJobs) {
      if (job.visibility === 'external') continue;

      // 2. Check cache
      let match = await this.matchRepo.findOne({
        where: { employeeId, jobOfferId: job.id },
      });

      const isStale =
        match &&
        new Date().getTime() - new Date(match.lastCalculatedAt).getTime() >
          86400000;

      if (!match || isStale) {
        // 3. Calculate score
        this.logger.log(
          `🔄 Calculating match for Employee ${employeeId} and Job ${job.id}`,
        );
        const result = await this.scoringService.scoreEmployee(
          employeeId,
          job.id,
        );

        if (!match) {
          match = this.matchRepo.create({
            employeeId,
            jobOfferId: job.id,
          });
        }

        match.totalScore = result.totalScore;
        match.isComplete = result.isComplete;
        match.breakdown = result.breakdown;
        match.readinessLabel = result.readinessLabel ?? 'NOT_READY';
        match.matchedComps = result.matchedCompetencies;
        match.gapComps = result.gapCompetencies;
        match.lastCalculatedAt = new Date();

        await this.matchRepo.save(match);
      }

      recommendations.push({
        jobId: job.id,
        title: job.title,
        totalScore: match.totalScore,
        breakdown: match.breakdown,
        isComplete: match.isComplete,
        readinessLabel: match.readinessLabel,
        matchedComps: match.matchedComps,
        gapComps: match.gapComps,
      });
    }

    // Sort by score descending
    return recommendations.sort((a, b) => b.totalScore - a.totalScore);
  }

  /**
   * Batch refresh of all recommendations (could be called by a cron job).
   */
  async refreshAllRecommendations() {
    this.logger.log(
      '🚀 Starting batch refresh of internal mobility recommendations...',
    );
    const employees = await this.employeeRepo.find({ select: ['id'] });
    for (const emp of employees) {
      await this.getRecommendations(emp.id);
    }
    this.logger.log('✅ Batch refresh complete.');
  }
}
