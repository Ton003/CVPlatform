import {
  Controller, Post, Body,
  UseInterceptors, UploadedFile,
  UseGuards, Request, BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage }   from 'multer';
import { CvUploadService } from './cv-upload.service';
import { JwtAuthGuard }    from '../auth/jwt-auth.guard';

@Controller('cv-upload')
@UseGuards(JwtAuthGuard)
export class CvUploadController {
  constructor(private readonly cvUploadService: CvUploadService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits:  { fileSize: 10 * 1024 * 1024 },
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
    @Request() req,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');

    // Read mode + apiKey + gdprConsent from multipart form fields
    const mode        = (req.body?.mode   as 'local' | 'groq') ?? 'local';
    const apiKey      = (req.body?.apiKey as string)            ?? undefined;
    const gdprConsent = req.body?.gdprConsent === 'true';

    if (mode === 'groq' && !apiKey) {
      throw new BadRequestException('Groq API key is required when using AI Mode');
    }

    try {
      return await this.cvUploadService.processUpload(file, req.user.id, { mode, apiKey, gdprConsent });
    } catch (err) {
      throw new InternalServerErrorException(
        err.message ?? 'CV processing failed. Make sure the PDF extractor is running.'
      );
    }
  }
}