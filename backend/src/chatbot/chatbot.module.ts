import { Module }         from '@nestjs/common';
import { HttpModule }     from '@nestjs/axios';
import { ConfigModule }   from '@nestjs/config';
import { CvUploadModule } from '../cv-upload/cv-upload.module';
import { AuthModule } from '../auth/auth.module';

import { ChatbotController }       from './chatbot.controller';
import { ChatbotService }          from './chatbot.service';
import { KeywordExtractorService } from './keyword-extractor.service';
import { CvSearchService }         from './cv-search.service';
import { Phi3IntentService }       from './phi3-intent.service';
import { GroqService }             from './groq.service';

@Module({
  imports: [
    ConfigModule,
    HttpModule.register({ timeout: 180_000 }),
    CvUploadModule,
    AuthModule,
  ],
  controllers: [ChatbotController],
  providers: [
    ChatbotService,
    KeywordExtractorService,
    CvSearchService,
    Phi3IntentService,
    GroqService,
  ],
  exports: [ChatbotService, GroqService], // ✅ allows other modules to use AI logic
})
export class ChatbotModule {}