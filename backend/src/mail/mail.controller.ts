import {
  Controller, Post, Body, Param,
  UseGuards,
  BadRequestException, NotFoundException,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { InjectRepository }  from '@nestjs/typeorm';
import { Repository }        from 'typeorm';
import { JwtAuthGuard }      from '../auth/jwt-auth.guard';
import { MailService }       from './mail.service';
import { Candidate }         from '../candidates/entities/candidates.entity';

class SendEmailDto {
  type!: 'invite' | 'status';
  status?: string;
}

@Controller('candidates/:candidateId/send-email')
@UseGuards(JwtAuthGuard)
export class MailController {

  constructor(
    private readonly mailService: MailService,
    @InjectRepository(Candidate)
    private readonly candidateRepo: Repository<Candidate>,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async send(
    @Param('candidateId') candidateId: string, // ✅ no ParseUUIDPipe
    @Body() dto: SendEmailDto,
  ) {
    // ✅ Use raw query with ::uuid cast instead of TypeORM findOne
    // (consistent with the rest of the codebase)
    const rows = await this.candidateRepo.query(
      `SELECT id, email, first_name, last_name FROM candidates WHERE id = $1::uuid LIMIT 1`,
      [candidateId],
    );

    if (!rows.length)    throw new NotFoundException('Candidate not found');
    if (!rows[0].email)  throw new BadRequestException('Candidate has no email address');

    const candidate = rows[0];
    const name = `${candidate.first_name} ${candidate.last_name}`.trim();

    if (dto.type === 'invite') {
      await this.mailService.sendInvite(candidate.email, name);
    } else if (dto.type === 'status') {
      if (!dto.status) throw new BadRequestException('status field is required for type=status');
      await this.mailService.sendStatusUpdate(candidate.email, name, dto.status);
    } else {
      throw new BadRequestException('Invalid email type. Use "invite" or "status"');
    }

    return { success: true, message: `Email sent to ${candidate.email}` };
  }
}