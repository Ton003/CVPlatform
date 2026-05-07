import {
  Controller,
  Post,
  Body,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Request,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { CvUploadService } from './cv-upload.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('CV Processing')
@Controller('cv-upload')
@UseGuards(JwtAuthGuard)
export class CvUploadController {
  private readonly logger = new Logger(CvUploadController.name);

  constructor(private readonly cvUploadService: CvUploadService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload and parse a CV (PDF only)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        mode: { type: 'string', enum: ['local', 'groq'], default: 'local' },
        apiKey: { type: 'string' },
        gdprConsent: { type: 'string', example: 'true' },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 201, description: 'CV uploaded and parsing initiated.' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (_req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
          return cb(new BadRequestException('Only PDF files are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  async uploadCv(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { mode?: 'local' | 'groq'; apiKey?: string; gdprConsent?: string },
    @Request() req: { user: { id: string } },
  ) {
    if (!file) throw new BadRequestException('No file uploaded');

    const mode = body.mode ?? 'local';
    const apiKey = body.apiKey;
    const gdprConsent = body.gdprConsent === 'true';

    if (mode === 'groq' && !apiKey) {
      throw new BadRequestException('Groq API Key is mandatory for AI-Enhanced Mode');
    }

    try {
      this.logger.log(`Starting CV upload process for user ${req.user.id} in ${mode} mode`);
      
      return await this.cvUploadService.processUpload(file, req.user.id, { 
        mode, 
        apiKey, 
        gdprConsent 
      });
    } catch (err) {
      this.logger.error(`CV Processing error: ${err.message}`, err.stack);
      throw new InternalServerErrorException(
        `CV processing failed: ${err.message || 'Check if PDF extraction microservice is healthy'}`
      );
    }
  }
}