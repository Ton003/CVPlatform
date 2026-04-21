import { Module }        from '@nestjs/common';
import { HttpModule }    from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule }  from '@nestjs/config';

import { CvUploadController }     from './cv-upload.controller';
import { CvUploadService }        from './cv-upload.service';
import { PdfExtractorService }    from './pdf-extractor.service';
import { GroqCvParserService }    from './groq-cv-parser.service';
import { CvStorageService }        from './cv-storage.service';
import { RegexExtractorService }   from './regex-extractor.service';
import { LlmExtractionService }   from './llm-extraction.service';
import { LlmParserService }        from './llm-parser.service';

import { Candidate }    from '../candidates/entities/candidates.entity';
import { CandidateCareerEntry } from '../candidates/entities/candidate-career-entry.entity';
import { Cv }           from '../cvs/entities/cv.entity';
import { CvParsedData } from '../cv-parsed-data/entities/cv-parsed-data.entity';

@Module({
  imports: [
    ConfigModule,
    HttpModule.register({ timeout: 180_000, maxRedirects: 3 }),
    TypeOrmModule.forFeature([Candidate, Cv, CvParsedData, CandidateCareerEntry]),
  ],
  controllers: [CvUploadController],
  providers: [
    CvUploadService,
    PdfExtractorService,
    GroqCvParserService,
    CvStorageService,
    RegexExtractorService,
    LlmExtractionService,
    LlmParserService,
  ],
  exports: [CvUploadService, PdfExtractorService],
})
export class CvUploadModule {}