import { Module }            from '@nestjs/common';
import { TypeOrmModule }     from '@nestjs/typeorm';
import { Application }       from './application.entity';
import { ApplicationNote }   from './application-note.entity';
import { ActivityLog }       from './activity-log.entity';
import { ApplicationCompetencyScore } from './application-competency-score.entity';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService }    from './applications.service';
import { AuthModule }        from '../auth/auth.module';
import { ApplicationAssessment }      from './entities/application-assessment.entity';
import { ApplicationAssessmentItem }  from './entities/application-assessment-item.entity';
import { CandidatesModule } from '../candidates/candidates.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Application,
      ApplicationNote,
      ActivityLog,
      ApplicationCompetencyScore,
      ApplicationAssessment,
      ApplicationAssessmentItem,
    ]),
    AuthModule,
    CandidatesModule,
  ],
  controllers: [ApplicationsController],
  providers:   [ApplicationsService],
  exports:     [ApplicationsService],
})
export class ApplicationsModule {}
