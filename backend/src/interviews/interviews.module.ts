import { Module }          from '@nestjs/common';
import { TypeOrmModule }   from '@nestjs/typeorm';
import { Interview }        from './interview.entity';
import { ActivityLog }      from '../applications/activity-log.entity';
import { InterviewsService } from './interviews.service';
import { InterviewsController } from './interviews.controller';
import { AuthModule }       from '../auth/auth.module';
import { Candidate }        from '../candidates/entities/candidates.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Interview, ActivityLog, Candidate]),
    AuthModule,
  ],
  controllers: [InterviewsController],
  providers:   [InterviewsService],
  exports:     [InterviewsService],
})
export class InterviewsModule {}
