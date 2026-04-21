import { Module }        from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CompetenceFamily } from './entities/family.entity';
import { Competence }       from './entities/competence.entity';
import { CompetenceLevel }  from './entities/competence-level.entity';

import { FamiliesController }   from './families.controller';
import { CompetencesController } from './competences.controller';
import { FamiliesService }      from './families.service';
import { CompetencesService }   from './competences.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CompetenceFamily, Competence, CompetenceLevel]),
  ],
  controllers: [FamiliesController, CompetencesController],
  providers:   [FamiliesService, CompetencesService],
  exports:     [FamiliesService, CompetencesService],
})
export class CompetenceManagementModule {}
