import { Module }                     from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule }              from '@nestjs/typeorm';

import { AuthModule }          from './auth/auth.module';
import { UsersModule }         from './users/users.module';
import { CvUploadModule }      from './cv-upload/cv-upload.module';
import { ChatbotModule }       from './chatbot/chatbot.module';
import { CandidatesModule }    from './candidates/candidates.module';
import { NotesModule }         from './notes/notes.module';
import { AssessFirstModule }   from './assessfirst/assessfirst.module';
import { MailModule }          from './mail/mail.module';
import { ExportModule }        from './export/export.module';
import { DashboardModule }     from './dashboard/dashboard.module';
import { JobOffersModule }     from './job-offers/job-offer.module';

import { User }                from './users/entities/user.entity';
import { Candidate }           from './candidates/entities/candidates.entity';
import { Cv }                  from './cvs/entities/cv.entity';
import { CvParsedData }        from './cv-parsed-data/entities/cv-parsed-data.entity';
import { CandidateNote }       from './notes/candidate-note.entity';
import { AssessFirstResult }   from './assessfirst/assessfirst-result.entity';
import { JobOffer }            from './job-offers/job-offer.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    TypeOrmModule.forRootAsync({
      imports:    [ConfigModule],
      inject:     [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type:        'postgres',
        host:        cfg.get<string>('DB_HOST'),
        port:        cfg.get<number>('DB_PORT'),
        username:    cfg.get<string>('DB_USERNAME'),
        password:    cfg.get<string>('DB_PASSWORD'),
        database:    cfg.get<string>('DB_DATABASE'),
        entities:    [User, Candidate, Cv, CvParsedData, CandidateNote, AssessFirstResult, JobOffer],
        synchronize: true,
        logging:     false,
      }),
    }),
    AuthModule,
    UsersModule,
    CvUploadModule,
    ChatbotModule,
    CandidatesModule,
    NotesModule,
    AssessFirstModule,
    MailModule,
    ExportModule,
    DashboardModule,
    JobOffersModule,
  ],
})
export class AppModule {}