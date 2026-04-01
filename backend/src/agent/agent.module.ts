import { Module }          from '@nestjs/common';
import { HttpModule }      from '@nestjs/axios';
import { TypeOrmModule }   from '@nestjs/typeorm';
import { ConfigModule }    from '@nestjs/config';

import { AgentController }   from './agent.controller';
import { AgentService }      from './agent.service';

import { Candidate }         from '../candidates/entities/candidates.entity';
import { AssessFirstResult } from '../assessfirst/assessfirst-result.entity';
import { CandidateNote }     from '../notes/candidate-note.entity';
import { MailModule }        from '../mail/mail.module';

@Module({
  imports: [
    ConfigModule,
    HttpModule.register({ timeout: 60_000 }),
    TypeOrmModule.forFeature([Candidate, AssessFirstResult, CandidateNote]),
    MailModule,
  ],
  controllers: [AgentController],
  providers:   [AgentService],
})
export class AgentModule {}