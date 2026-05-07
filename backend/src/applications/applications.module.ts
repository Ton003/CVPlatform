import { Module }            from '@nestjs/common';
import { TypeOrmModule }     from '@nestjs/typeorm';
import { Application }       from './application.entity';
import { ApplicationNote }   from './application-note.entity';
import { ActivityLog }       from './activity-log.entity';
import { ApplicationCompetencyScore } from './application-competency-score.entity';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService }    from './applications.service';
import { VerdictService }         from './verdict.service';
import { AuthModule }        from '../auth/auth.module';
import { ApplicationAssessment }      from './entities/application-assessment.entity';
import { ApplicationAssessmentItem }  from './entities/application-assessment-item.entity';
import { Task }                from './entities/task.entity';
import { ApplicationVerdict }  from './entities/application-verdict.entity';
import { ScoringAuditLog }     from './entities/scoring-audit-log.entity';
import { JobCompetencyWeight }  from './entities/job-competency-weight.entity';
import { HiringOutcome }        from './entities/hiring-outcome.entity';
import { VerdictFeedback }      from './entities/verdict-feedback.entity';
import { CandidatesModule } from '../candidates/candidates.module';
import { Interview } from '../interviews/interview.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Application,
      ApplicationNote,
      ActivityLog,
      ApplicationCompetencyScore,
      ApplicationAssessment,
      ApplicationAssessmentItem,
      Task,
      ApplicationVerdict,
      ScoringAuditLog,
      JobCompetencyWeight,
      HiringOutcome,
      VerdictFeedback,
      Interview,
    ]),
    AuthModule,
    CandidatesModule,
  ],
  controllers: [ApplicationsController],
  providers:   [ApplicationsService, VerdictService],
  exports:     [ApplicationsService, VerdictService],
})
export class ApplicationsModule {}
