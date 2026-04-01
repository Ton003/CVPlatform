import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  UseGuards, Request,
  HttpCode, HttpStatus, NotFoundException, ForbiddenException
} from '@nestjs/common';
import { SkipThrottle }     from '@nestjs/throttler';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import { JwtAuthGuard }     from '../auth/jwt-auth.guard';
import { CandidateNote }    from './candidate-note.entity';
import { CreateNoteDto }    from './create-note.dto';
import { UpdateNoteDto }    from './update-note.dto';

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

  // ── PATCH /candidates/:candidateId/notes/:noteId ─────────────────
  @Patch(':noteId')
  async update(
    @Param('candidateId') candidateId: string,
    @Param('noteId') noteId: string,
    @Body() dto: UpdateNoteDto,
    @Request() req: any,
  ) {
    const note = await this.notesRepo.findOne({
      where: { id: noteId, candidateId },
      relations: ['user'],
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    if (note.userId !== req.user.id && req.user.role !== 'admin') {
      throw new ForbiddenException('You can only edit your own notes');
    }

    if (dto.note !== undefined)   note.note = dto.note;
    if (dto.rating !== undefined) note.rating = dto.rating;
    if (dto.stage !== undefined)  note.stage = dto.stage;

    const saved = await this.notesRepo.save(note);
    
    return {
      id:        saved.id,
      note:      saved.note,
      rating:    saved.rating,
      stage:     saved.stage,
      createdAt: saved.createdAt,
      author: {
        id:   saved.user.id,
        name: `${saved.user.first_name} ${saved.user.last_name}`,
        role: saved.user.role,
      },
    };
  }

  // ── DELETE /candidates/:candidateId/notes/:noteId ────────────────
  @Delete(':noteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('candidateId') candidateId: string,
    @Param('noteId') noteId: string,
    @Request() req: any,
  ) {
    const note = await this.notesRepo.findOne({
      where: { id: noteId, candidateId },
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    if (note.userId !== req.user.id && req.user.role !== 'admin') {
      throw new ForbiddenException('You can only delete your own notes');
    }

    await this.notesRepo.remove(note);
  }
}