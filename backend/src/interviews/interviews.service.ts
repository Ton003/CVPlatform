import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource }             from 'typeorm';
import { Interview }                          from './interview.entity';
import { CreateInterviewDto }                 from './dto/create-interview.dto';
import { UpdateFeedbackDto }                 from './dto/update-feedback.dto';
import { ActivityLog }                        from '../applications/activity-log.entity';
import { Candidate }                          from '../candidates/entities/candidates.entity';

@Injectable()
export class InterviewsService {
  constructor(
    @InjectRepository(Interview)
    private readonly interviewRepo: Repository<Interview>,

    @InjectRepository(ActivityLog)
    private readonly logRepo:       Repository<ActivityLog>,

    @InjectRepository(Candidate)
    private readonly candidateRepo: Repository<Candidate>,


    @InjectDataSource()
    private readonly dataSource:    DataSource,
  ) {}

  async create(dto: CreateInterviewDto, userId: string) {
    const interview = this.interviewRepo.create({
      applicationId:   dto.applicationId,
      scheduledAt:     new Date(dto.scheduledAt),
      type:            dto.type,
      interviewerName: dto.interviewerName,
      meetingUrl:      dto.meetingUrl,
      status:          'scheduled',
    });
    const saved = await this.interviewRepo.save(interview);

    // Log activity
    await this.logRepo.save(this.logRepo.create({
      applicationId: dto.applicationId,
      userId,
      action:      'interview_scheduled',
      description: `${dto.type} interview scheduled with ${dto.interviewerName}`,
      metadata:    { type: dto.type, scheduledAt: dto.scheduledAt },
    }));


    return saved;
  }

  async findByApplication(applicationId: string) {
    return this.interviewRepo.find({
      where: { applicationId },
      order: { scheduledAt: 'DESC' },
    });
  }

  async updateFeedback(id: string, dto: UpdateFeedbackDto, userId: string) {
    const interview = await this.interviewRepo.findOne({
      where: { id },
    });
    if (!interview) throw new NotFoundException(`Interview ${id} not found`);

    if (dto.technicalScore !== undefined)     interview.technicalScore = dto.technicalScore;
    if (dto.communicationScore !== undefined) interview.communicationScore = dto.communicationScore;
    if (dto.comments !== undefined)           interview.comments = dto.comments;
    if (dto.decision !== undefined)           interview.decision = dto.decision;
    if (dto.status !== undefined)             interview.status   = dto.status;

    const saved = await this.interviewRepo.save(interview);

    // Log activity if completed
    if (dto.status === 'completed') {
      await this.logRepo.save(this.logRepo.create({
        applicationId: interview.applicationId,
        userId,
        action:      'interview_completed',
        description: `${interview.type} interview completed (Decision: ${dto.decision ?? 'N/A'})`,
        metadata: {
          type:      interview.type,
          decision:  dto.decision,
          techScore: dto.technicalScore,
          commScore: dto.communicationScore,
        },
      }));
    }

    return saved;
  }

  async remove(id: string) {
    const interview = await this.interviewRepo.findOne({ where: { id } });
    if (!interview) throw new NotFoundException(`Interview ${id} not found`);
    await this.interviewRepo.remove(interview);
  }
}
