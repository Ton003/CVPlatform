import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeesService } from './employees.service';
import { EmployeesController } from './employees.controller';
import { InternalMobilityController } from './internal-mobility.controller';
import { InternalMobilityService } from './internal-mobility.service';
import { Employee } from './entities/employee.entity';
import { EmployeeCompetency } from './entities/employee-competency.entity';
import { InternalApplication } from './entities/internal-application.entity';
import { EmployeeRoleMatch } from './entities/employee-role-match.entity';
import { Application } from '../applications/application.entity';
import { Candidate } from '../candidates/entities/candidates.entity';
import { JobOffer } from '../job-offers/job-offer.entity';
import { JobRoleLevel } from '../job-architecture/entities/job-role-level.entity';
import { UnifiedScoringService } from '../shared/services/unified-scoring.service';
import { EmployeeAssessment } from './entities/employee-assessment.entity';
import { EmployeeAssessmentItem } from './entities/employee-assessment-item.entity';
import { AssessmentsController } from './assessments.controller';
import { AssessmentsService } from './assessments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Employee,
      EmployeeCompetency,
      InternalApplication,
      EmployeeRoleMatch,
      Application,
      Candidate,
      JobOffer,
      JobRoleLevel,
      EmployeeAssessment,
      EmployeeAssessmentItem
    ]),
  ],
  controllers: [EmployeesController, InternalMobilityController, AssessmentsController],
  providers: [EmployeesService, InternalMobilityService, UnifiedScoringService, AssessmentsService],
  exports: [EmployeesService, InternalMobilityService, UnifiedScoringService, AssessmentsService],
})
export class EmployeesModule {}
