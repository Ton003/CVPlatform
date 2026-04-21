import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BusinessUnit } from './entities/business-unit.entity';
import { Department } from './entities/department.entity';
import { JobRole } from './entities/job-role.entity';
import { JobCompetencyRequirement } from './entities/job-competency-requirement.entity';

import { JobRoleLevel } from './entities/job-role-level.entity';

import { JobArchitectureService } from './job-architecture.service';
import { JobArchitectureController } from './job-architecture.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BusinessUnit,
      Department,
      JobRole,
      JobRoleLevel,
      JobCompetencyRequirement,
    ]),
  ],
  controllers: [JobArchitectureController],
  providers: [JobArchitectureService],
  exports: [JobArchitectureService],
})
export class JobArchitectureModule {}
