import {
  Controller, Get, Post, Body, Param,
  UseGuards, Request,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { SkipThrottle }     from '@nestjs/throttler';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import { JwtAuthGuard }     from '../auth/jwt-auth.guard';
import { CandidateNote }    from './candidate-note.entity';
import { CreateNoteDto }    from './create-note.dto';

@Controller('candidates/:candidateId/notes')
@UseGuards(JwtAuthGuard)
export class NotesController {

  constructor(
    @InjectRepository(CandidateNote)
    private readonly notesRepo: Repository<CandidateNote>,
  ) {}

  // ── GET /candidates/:candidateId/notes ───────────────────────────
  @SkipThrottle()
  @Get()
  async list(@Param('candidateId') candidateId: string) {
    const notes = await this.notesRepo
      .createQueryBuilder('n')
      .leftJoin('n.user', 'u')
      .select([
        'n.id', 'n.note', 'n.rating', 'n.stage', 'n.createdAt',
        'u.id', 'u.first_name', 'u.last_name', 'u.role',
      ])
      .where('n.candidateId = :candidateId', { candidateId })
      .orderBy('n.createdAt', 'DESC')
      .getMany();

    return notes.map(n => ({
      id:        n.id,
      note:      n.note,
      rating:    n.rating,
      stage:     n.stage,
      createdAt: n.createdAt,
      author: {
        id:   n.user.id,
        name: `${n.user.first_name} ${n.user.last_name}`,
        role: n.user.role,
      },
    }));
  }

  // ── POST /candidates/:candidateId/notes ──────────────────────────
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('candidateId') candidateId: string,
    @Body() dto: CreateNoteDto,
    @Request() req: any,
  ) {
    const note = this.notesRepo.create({
      candidateId,
      userId: req.user.id,
      note:   dto.note,
      rating: dto.rating,
      stage:  dto.stage,
    });

    const saved = await this.notesRepo.save(note);

    return {
      id:        saved.id,
      note:      saved.note,
      rating:    saved.rating,
      stage:     saved.stage,
      createdAt: saved.createdAt,
      author: {
        id:   req.user.id,
        name: `${req.user.first_name} ${req.user.last_name}`,
        role: req.user.role,
      },
    };
  }
}