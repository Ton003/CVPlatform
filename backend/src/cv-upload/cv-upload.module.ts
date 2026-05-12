import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { CvUploadController } from './cv-upload.controller';
import { CvUploadService } from './cv-upload.service';
import { PdfExtractorService } from './pdf-extractor.service';
import { CvStorageService } from './cv-storage.service';
import { RegexExtractorService } from './regex-extractor.service';
import { AiCvParserService } from './ai-cv-parser.service';

import { Candidate } from '../candidates/entities/candidates.entity';
import { CandidateCareerEntry } from '../candidates/entities/candidate-career-entry.entity';
import { Cv } from '../cvs/entities/cv.entity';
import { CvParsedData } from '../cv-parsed-data/entities/cv-parsed-data.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Cv,
      CvParsedData,
      Candidate,
      CandidateCareerEntry,
    ]),
    HttpModule,
  ],
  controllers: [CvUploadController],
  providers: [
    CvUploadService,
    PdfExtractorService,
    AiCvParserService,
    CvStorageService,
    RegexExtractorService,
  ],
  exports: [CvUploadService, PdfExtractorService, AiCvParserService],
})
export class CvUploadModule {}
