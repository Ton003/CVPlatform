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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Upload and parse a CV (AI-Enhanced)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        apiKey: { type: 'string', description: 'AI API Key for parsing' },
        gdprConsent: { type: 'string', example: 'true' },
      },
      required: ['file', 'apiKey'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'CV uploaded and parsing initiated.',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (_req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
          return cb(
            new BadRequestException('Only PDF files are allowed'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadCv(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { apiKey?: string; gdprConsent?: string },
    @Request() req: { user: { id: string } },
  ) {
    if (!file) throw new BadRequestException('No file uploaded');

    const apiKey = body.apiKey;
    const gdprConsent = body.gdprConsent === 'true';

    if (!apiKey) {
      throw new BadRequestException('AI API Key is mandatory for parsing');
    }

    try {
      this.logger.log(
        `Starting CV upload process for user ${req.user.id} using AI API`,
      );

      return await this.cvUploadService.processUpload(file, req.user.id, {
        apiKey,
        gdprConsent,
      });
    } catch (err) {
      this.logger.error(`CV Processing error: ${err.message}`, err.stack);
      throw new InternalServerErrorException(
        `CV processing failed: ${err.message || 'Check if AI API service is healthy'}`,
      );
    }
  }
}
