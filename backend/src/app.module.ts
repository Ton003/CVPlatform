import { Module }                     from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule }              from '@nestjs/typeorm';

import { AuthModule }          from './auth/auth.module';
import { UsersModule }         from './users/users.module';
import { CvUploadModule }      from './cv-upload/cv-upload.module';
import { ChatbotModule }       from './chatbot/chatbot.module';
import { CandidatesModule }    from './candidates/candidates.module';
import { JobOffersModule }     from './job-offers/job-offer.module';
import { ApplicationsModule }  from './applications/applications.module';
import { InterviewsModule }    from './interviews/interviews.module';
import { CompetenceManagementModule }  from './competence-management/competence-management.module';
import { CompetenceFamily }            from './competence-management/entities/family.entity';
import { Competence }                  from './competence-management/entities/competence.entity';
import { CompetenceLevel }             from './competence-management/entities/competence-level.entity';
import { JobRole }                     from './job-architecture/entities/job-role.entity';
import { JobRoleLevel }                from './job-architecture/entities/job-role-level.entity';
import { JobCompetencyRequirement }    from './job-architecture/entities/job-competency-requirement.entity';
import { BusinessUnit }                from './job-architecture/entities/business-unit.entity';
import { Department }                  from './job-architecture/entities/department.entity';
import { JobArchitectureModule }       from './job-architecture/job-architecture.module';
import { EmployeesModule }         from './employees/employees.module';

import { AppController }       from './app.controller';
import { AppService }          from './app.service';

import { User }                    from './users/entities/user.entity';
import { Candidate }               from './candidates/entities/candidates.entity';
import { CandidateCompetency }       from './candidates/entities/candidate-competency.entity';
import { CandidateCareerEntry }     from './candidates/entities/candidate-career-entry.entity';
import { Cv }                      from './cvs/entities/cv.entity';
import { CvParsedData }            from './cv-parsed-data/entities/cv-parsed-data.entity';
import { JobOffer }                from './job-offers/job-offer.entity';
import { Application }             from './applications/application.entity';
import { ApplicationNote }         from './applications/application-note.entity';
import { ActivityLog }             from './applications/activity-log.entity';
import { ApplicationCompetencyScore } from './applications/application-competency-score.entity';
import { Interview }               from './interviews/interview.entity';
import { Employee }               from './employees/entities/employee.entity';
import { EmployeeCompetency }     from './employees/entities/employee-competency.entity';
import { InternalApplication }   from './employees/entities/internal-application.entity';
import { EmployeeRoleMatch }     from './employees/entities/employee-role-match.entity';
import { EmployeeAssessment }    from './employees/entities/employee-assessment.entity';
import { EmployeeAssessmentItem } from './employees/entities/employee-assessment-item.entity';
import { ApplicationAssessment } from './applications/entities/application-assessment.entity';
import { ApplicationAssessmentItem } from './applications/entities/application-assessment-item.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    TypeOrmModule.forRootAsync({
      imports:    [ConfigModule],
      inject:     [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type:        'postgres',
        host:        cfg.get<string>('DB_HOST'),
        port:        cfg.get<number>('DB_PORT', 5432),
        username:    cfg.get<string>('DB_USERNAME'),
        password:    cfg.get<string>('DB_PASSWORD'),
        database:    cfg.get<string>('DB_DATABASE'),
        entities: [
          User, Candidate, CandidateCompetency, CandidateCareerEntry,
          Cv, CvParsedData, JobOffer, Application, ApplicationNote,
          ActivityLog, ApplicationCompetencyScore, Interview,
          CompetenceFamily, Competence, CompetenceLevel,
          JobRole, JobRoleLevel, JobCompetencyRequirement,
          BusinessUnit, Department, 
          EmployeeAssessment, EmployeeAssessmentItem,
          Employee, EmployeeCompetency,
          InternalApplication, EmployeeRoleMatch,
          ApplicationAssessment, ApplicationAssessmentItem
        ],
        synchronize: true,
      }),
    }),
    AuthModule,
    UsersModule,
    CvUploadModule,
    ChatbotModule,
    CandidatesModule,
    JobOffersModule,
    ApplicationsModule,
    InterviewsModule,
    CompetenceManagementModule,
    JobArchitectureModule,
    EmployeesModule,

  ],
  controllers: [AppController],
  providers:   [AppService],
})
export class AppModule {}