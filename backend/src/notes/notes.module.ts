import { Module }           from '@nestjs/common';
import { TypeOrmModule }    from '@nestjs/typeorm';
import { AuthModule }       from '../auth/auth.module';
import { CandidateNote }    from './candidate-note.entity';
import { NotesController }  from './notes.controller';

@Module({
  imports:     [TypeOrmModule.forFeature([CandidateNote]), AuthModule],
  controllers: [NotesController],
})
export class NotesModule {}
