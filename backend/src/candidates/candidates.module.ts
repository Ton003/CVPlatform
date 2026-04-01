import { Module }                    from '@nestjs/common';
import { CandidatesController }      from './candidates.controller';
import { CandidateScoringService }   from './candidate-scoring.service';
import { AuthModule }                from '../auth/auth.module';

@Module({
  imports:     [AuthModule],
  controllers: [CandidatesController],
  providers:   [CandidateScoringService],
  exports:     [CandidateScoringService],
})
export class CandidatesModule {}