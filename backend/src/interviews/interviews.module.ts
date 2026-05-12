import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Interview } from './interview.entity';
import { ActivityLog } from '../applications/activity-log.entity';
import { InterviewsService } from './interviews.service';
import { InterviewsController } from './interviews.controller';
import { AuthModule } from '../auth/auth.module';
import { Candidate } from '../candidates/entities/candidates.entity';

import { Application } from '../applications/application.entity';
import { ApplicationCompetencyScore } from '../applications/application-competency-score.entity';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Interview,
      ActivityLog,
      Candidate,
      Application,
      ApplicationCompetencyScore,
    ]),
    AuthModule,
    MailModule,
  ],
  controllers: [InterviewsController],
  providers: [InterviewsService],
  exports: [InterviewsService],
})
export class InterviewsModule {}
