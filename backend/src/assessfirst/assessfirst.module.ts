import { Module }                from '@nestjs/common';
import { TypeOrmModule }         from '@nestjs/typeorm';
import { HttpModule }            from '@nestjs/axios';
import { ConfigModule }          from '@nestjs/config'; // ✅ needed for ConfigService
import { AuthModule }            from '../auth/auth.module';
import { AssessFirstResult }     from './assessfirst-result.entity';
import { AssessFirstController } from './assessfirst.controller';

@Module({
  imports: [
    ConfigModule, // ✅ added
    TypeOrmModule.forFeature([AssessFirstResult]),
    HttpModule.register({ timeout: 30_000 }),
    // ✅ MulterModule removed — FileInterceptor with memoryStorage handles it inline
    AuthModule,
  ],
  controllers: [AssessFirstController],
})
export class AssessFirstModule {}