import { Module }              from '@nestjs/common';
import { TypeOrmModule }      from '@nestjs/typeorm';
import { JobOffer }           from './job-offer.entity';
                                    
import { JobOffersController } from './job-offer.controller';
import { JobOffersService }   from './job-offer.service';
import { ChatbotModule }      from '../chatbot/chatbot.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([JobOffer]),
    ChatbotModule,   // gives us ChatbotService for RAG matching
  ],
  controllers: [JobOffersController],
  providers:   [JobOffersService],
})
export class JobOffersModule {}