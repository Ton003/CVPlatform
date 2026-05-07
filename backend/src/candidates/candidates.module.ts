import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Candidate } from './entities/candidates.entity';
import { CandidateCompetency } from './entities/candidate-competency.entity';
import { Cv } from '../cvs/entities/cv.entity';
import { CandidatesController } from './candidates.controller';
import { CandidatesService }    from './candidates.service';
import { CandidateScoringService } from './candidate-scoring.service';
import { CandidateSnapshotService } from './candidate-snapshot.service';
import { CandidateCareerEntry } from './entities/candidate-career-entry.entity';
import { Application } from '../applications/application.entity';
import { CvUploadModule } from '../cv-upload/cv-upload.module';
import {
  ScoreSnapshotSubscriber,
  CareerEntrySnapshotSubscriber,
  ApplicationSnapshotSubscriber,
} from './subscribers/candidate-snapshot.subscriber';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Candidate, CandidateCompetency, Cv, 
      CandidateCareerEntry, Application
    ]),
    AuthModule,
    CvUploadModule,
  ],
  controllers: [CandidatesController],
  providers:   [
    CandidatesService,
    CandidateScoringService, 
    CandidateSnapshotService, 
    ScoreSnapshotSubscriber, 
    CareerEntrySnapshotSubscriber, 
    ApplicationSnapshotSubscriber
  ],
  exports:     [TypeOrmModule, CandidatesService, CandidateScoringService, CandidateSnapshotService],
})
export class CandidatesModule {}