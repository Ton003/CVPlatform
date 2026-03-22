import {
  Controller, Get, Post, Param,
  UseGuards, UseInterceptors, UploadedFile,
  Request, HttpCode, HttpStatus, BadRequestException,
} from '@nestjs/common';
import { SkipThrottle }      from '@nestjs/throttler';
import { FileInterceptor }   from '@nestjs/platform-express/multer';
import { memoryStorage }     from 'multer';
import { InjectRepository }  from '@nestjs/typeorm';
import { Repository }        from 'typeorm';
import { HttpService }       from '@nestjs/axios';
import { ConfigService }     from '@nestjs/config';
import { firstValueFrom }    from 'rxjs';
import FormData = require('form-data');
import { JwtAuthGuard }      from '../auth/jwt-auth.guard';
import { AssessFirstResult } from './assessfirst-result.entity';

@Controller('candidates/:candidateId/assessfirst')
@UseGuards(JwtAuthGuard)
export class AssessFirstController {

  private readonly pythonUrl: string;

  constructor(
    @InjectRepository(AssessFirstResult)
    private readonly repo: Repository<AssessFirstResult>,
    private readonly httpService:   HttpService,
    private readonly configService: ConfigService,
  ) {
    this.pythonUrl = this.configService.getOrThrow<string>('PYTHON_SERVICE_URL');
  }

  // ── GET /candidates/:candidateId/assessfirst ─────────────────────
  @SkipThrottle()
  @Get()
  async get(@Param('candidateId') candidateId: string) {
    const result = await this.repo.findOne({ where: { candidateId } });
    return result ?? null;
  }

  // ── POST /candidates/:candidateId/assessfirst ────────────────────
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
          return cb(new BadRequestException('Only PDF files accepted'), false);
        }
        cb(null, true);
      },
    })
  )
  async upload(
    @Param('candidateId') candidateId: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');

    const form = new FormData();
    form.append('file', file.buffer, {
      filename:    file.originalname,
      contentType: 'application/pdf',
    });

    let extracted: any;
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.pythonUrl}/extract-assessfirst`,
          form,
          { headers: form.getHeaders(), timeout: 30_000 },
        ),
      );
      extracted = response.data;
    } catch (err) {
      throw new BadRequestException(`PDF extraction failed: ${err.message}`);
    }

    let record = await this.repo.findOne({ where: { candidateId } });
    if (!record) {
      record = this.repo.create({ candidateId, uploadedBy: req.user.id });
    } else {
      record.uploadedBy = req.user.id;
    }

    record.candidateName       = extracted.candidate_name      ?? null;
    record.assessmentDate      = extracted.assessment_date      ?? null;
    record.personalStyle       = extracted.personal_style       ?? null;
    record.personalStyleDesc   = extracted.personal_style_desc  ?? null;
    record.traits              = extracted.traits               ?? [];
    record.improvements        = extracted.improvements         ?? [];
    record.talentCloud         = extracted.talent_cloud         ?? {};
    record.dimensionDetails    = extracted.dimension_details    ?? {};
    record.topMotivators       = extracted.top_motivators       ?? [];
    record.lowMotivators       = extracted.low_motivators       ?? [];
    record.preferredActivities = extracted.preferred_activities ?? [];
    record.managementStyle     = extracted.management_style     ?? [];
    record.soughtManagement    = extracted.sought_management    ?? [];
    record.cultureFit          = extracted.culture_fit          ?? null;
    record.cultureDesc         = extracted.culture_desc         ?? null;
    record.decisionMaking      = extracted.decision_making      ?? null;
    record.preferredTasks      = extracted.preferred_tasks      ?? null;
    record.learningStyle       = extracted.learning_style       ?? null;
    record.aptitudeDesc        = extracted.aptitude_desc        ?? null;

    return this.repo.save(record);
  }
}