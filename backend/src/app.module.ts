import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

// Infrastructure Modules
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';

// Domain Feature Modules
import { CvUploadModule } from './cv-upload/cv-upload.module';
import { ChatbotModule } from './chatbot/chatbot.module';
import { CandidatesModule } from './candidates/candidates.module';
import { JobOffersModule } from './job-offers/job-offer.module';
import { ApplicationsModule } from './applications/applications.module';
import { InterviewsModule } from './interviews/interviews.module';
import { CompetenceManagementModule } from './competence-management/competence-management.module';
import { JobArchitectureModule } from './job-architecture/job-architecture.module';
import { EmployeesModule } from './employees/employees.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { NotificationsModule } from './notifications/notifications.module';

import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    // 1. Configuration & Scheduling
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),

    // 2. Database Persistence
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => {
        return {
          type: 'postgres',
          host: cfg.get<string>('DB_HOST'),
          port: cfg.get<number>('DB_PORT', 5432),
          username: cfg.get<string>('DB_USERNAME'),
          password: cfg.get<string>('DB_PASSWORD'),
          database: cfg.get<string>('DB_DATABASE'),

          // ✅ STRATEGY: Automate entity discovery to eliminate manual imports
          autoLoadEntities: true,

          // ✅ SAFETY: Keep synchronize for dev, should be false in prod
          synchronize: cfg.get<string>('NODE_ENV') !== 'production',

          // ✅ PERFORMANCE: Logging and optimization
          logging:
            cfg.get<string>('NODE_ENV') === 'development'
              ? ['error', 'warn']
              : ['error'],
          ssl:
            cfg.get<string>('DB_SSL') === 'true'
              ? { rejectUnauthorized: false }
              : false,
        };
      },
    }),

    // 3. Application Feature Registry
    AuthModule,
    UsersModule,
    CvUploadModule,
    ChatbotModule,
    CandidatesModule,
    JobOffersModule,
    ApplicationsModule,
    InterviewsModule,
    CompetenceManagementModule,
    JobArchitectureModule,
    EmployeesModule,
    DashboardModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
