import { Module }              from '@nestjs/common';
import { TypeOrmModule }      from '@nestjs/typeorm';
import { JobOffer }           from './job-offer.entity';
                                    
import { JobOffersController } from './job-offer.controller';
import { JobOffersService }   from './job-offer.service';
import { ChatbotModule }      from '../chatbot/chatbot.module';
import { ApplicationsModule } from '../applications/applications.module';



import { AuthModule }         from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([JobOffer]),
    ChatbotModule,
    ApplicationsModule,
    AuthModule,
  ],
  controllers: [JobOffersController],
  providers:   [JobOffersService],
  exports:     [JobOffersService],
})
export class JobOffersModule {}