import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Interview } from './interview.entity';
import { CreateInterviewDto } from './dto/create-interview.dto';
import { UpdateFeedbackDto } from './dto/update-feedback.dto';
import { ActivityLog } from '../applications/activity-log.entity';
import { Application } from '../applications/application.entity';
import { ApplicationCompetencyScore } from '../applications/application-competency-score.entity';
import { MailService } from '../mail/mail.service';

@Injectable()
export class InterviewsService {
 private readonly logger = new Logger(InterviewsService.name);

 constructor(
 @InjectRepository(Interview)
 private readonly interviewRepo: Repository<Interview>,

 @InjectRepository(ActivityLog)
 private readonly logRepo: Repository<ActivityLog>,

 @InjectRepository(Application)
 private readonly appRepo: Repository<Application>,

 @InjectRepository(ApplicationCompetencyScore)
 private readonly compScoreRepo: Repository<ApplicationCompetencyScore>,

 private readonly mailService: MailService,
 ) {}

 /**
 * Schedule a new interview and log the activity
 */
 async create(dto: CreateInterviewDto, userId: string): Promise<Interview> {
 const interview = this.interviewRepo.create({
 applicationId: dto.applicationId,
 scheduledAt: new Date(dto.scheduledAt),
 type: dto.type,
 interviewerName: dto.interviewerName,
 meetingUrl: dto.meetingUrl,
 status: 'scheduled',
    });

    const saved = await this.interviewRepo.save(interview);

    await this.logRepo.save(
      this.logRepo.create({
        applicationId: dto.applicationId,
        userId,
        action: 'interview_scheduled',
        description: `${dto.type} interview scheduled with ${dto.interviewerName}`,
        metadata: { type: dto.type, scheduledAt: dto.scheduledAt },
      }),
    );

    if (dto.applicationId) {
      try {
        const app = await this.appRepo.findOne({
          where: { id: dto.applicationId },
          relations: ['candidate', 'job'],
        });

        if (app && app.candidate && app.candidate.email && app.job) {
          await this.mailService.sendInterviewInvitation(
            app.candidate.email,
            `${app.candidate.firstName} ${app.candidate.lastName}`.trim(),
            app.job.title,
            dto.type,
            interview.scheduledAt,
            dto.meetingUrl,
          );
        }
      } catch (err) {
        this.logger.error(
          `Failed to send interview invitation email for application ${dto.applicationId}`,
 err,
 );
 }
 }

 return saved;
 }

 /**
 * Fetch all interviews associated with an application
 */
 async findByApplication(applicationId: string): Promise<Interview[]> {
 return this.interviewRepo.find({
 where: { applicationId },
 order: { scheduledAt: 'DESC' },
 });
 }

 /**
 * Update feedback, scores, and status of an interview
 */
 async updateFeedback(
 id: string,
 dto: UpdateFeedbackDto,
 userId: string,
 ): Promise<Interview> {
 const interview = await this.interviewRepo.findOne({ where: { id } });
 if (!interview) throw new NotFoundException(`Interview ${id} not found`);

    const { competencies, ...feedbackData } = dto;

    // Save Competency Scores if provided
    if (competencies) {
      for (const [compId, level] of Object.entries(competencies)) {
        await this.compScoreRepo.upsert(
          {
            applicationId: interview.applicationId,
            competenceId: compId,
            evaluatedLevel: level,
            ratedBy: userId,
          },
          ['applicationId', 'competenceId'],
        );
      }
    }

    // Dynamic partial update
    Object.assign(interview, feedbackData);
    const saved = await this.interviewRepo.save(interview);

    // Audit trail for completed interviews
    if (dto.status === 'completed') {
      await this.logRepo.save(
        this.logRepo.create({
          applicationId: interview.applicationId,
          userId,
          action: 'interview_completed',
          description: `${interview.type} interview feedback recorded (Decision: ${dto.decision ?? 'N/A'})`,
 metadata: {
 decision: dto.decision,
 scores: { tech: dto.technicalScore, comm: dto.communicationScore },
 },
 }),
 );
 }

 return saved;
 }

 /**
 * Remove an interview record
 */
 async remove(id: string): Promise<void> {
 const interview = await this.interviewRepo.findOne({ where: { id } });
 if (!interview) throw new NotFoundException(`Interview ${id} not found`);
    await this.interviewRepo.remove(interview);
  }
}
