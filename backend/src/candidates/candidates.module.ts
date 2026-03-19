import { Module }                from '@nestjs/common';
import { CandidatesController } from './candidates.controller';
import { AuthModule }           from '../auth/auth.module';

@Module({
  imports:     [AuthModule],
  controllers: [CandidatesController],
})
export class CandidatesModule {}