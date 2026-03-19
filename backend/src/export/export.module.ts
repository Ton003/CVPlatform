import { Module }           from '@nestjs/common';
import { ExportService }    from './export.service';
import { ExportController } from './export.controller';
import { AuthModule }       from '../auth/auth.module';

@Module({
  imports:     [AuthModule],
  // ✅ No TypeOrmModule needed — ExportService uses @InjectDataSource()
  // which is provided by the global TypeOrmModule.forRoot() in app.module.ts
  providers:   [ExportService],
  controllers: [ExportController],
})
export class ExportModule {}