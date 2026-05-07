import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScoutInsight } from './entities/scout-insight.entity';
import { ScoutAgentService } from './scout-agent.service';
import { IntelligenceController } from './intelligence.controller';
import { JobOffer } from '../job-offers/job-offer.entity';
import { Employee } from '../employees/entities/employee.entity';
import { Candidate } from '../candidates/entities/candidates.entity';
import { Application } from '../applications/application.entity';
import { ChatbotModule } from '../chatbot/chatbot.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ScoutInsight, JobOffer, Employee, Candidate, Application]),
    ChatbotModule,
    AuthModule,
  ],
  providers: [ScoutAgentService],
  controllers: [IntelligenceController],
  exports: [ScoutAgentService],
})
export class IntelligenceModule {}
