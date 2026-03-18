import { Module }        from '@nestjs/common';
import { ConfigModule }  from '@nestjs/config';
import { MailService }   from './mail.service';
import { MailController } from './mail.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Candidate }     from '../candidates/entities/candidates.entity';
import { AuthModule }    from '../auth/auth.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Candidate]),
    AuthModule,
  ],
  providers:   [MailService],
  controllers: [MailController],
  exports:     [MailService],
})
export class MailModule {}
