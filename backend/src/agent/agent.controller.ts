import {
  Controller, Post, Body, UploadedFile,
  UseInterceptors, Logger, HttpCode, HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage }   from 'multer';
import { AgentService }    from './agent.service';

@Controller('agent')
export class AgentController {
  private readonly logger = new Logger(AgentController.name);

  constructor(private readonly agentService: AgentService) {}

  /**
   * POST /api/agent/inbound-assessfirst
   *
   * This endpoint is called by SendGrid Inbound Parse when a candidate
   * replies to an invitation email with their AssessFirst PDF attached.
   *
   * SendGrid sends the email as multipart/form-data with fields:
   *   - from        : sender email e.g. "John Doe <john@gmail.com>"
   *   - to          : recipient
   *   - subject     : email subject
   *   - text        : plain text body
   *   - attachment1 : the PDF file (first attachment)
   */
  @Post('inbound-assessfirst')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('attachment1', {
      storage: memoryStorage(),
      limits:  { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  async inboundAssessFirst(
    @UploadedFile() file: Express.Multer.File,
    @Body('from')  fromField: string,
  ) {
    this.logger.log(`📬 Inbound email from: ${fromField}`);

    // SendGrid sends from field as "Name <email@domain.com>" or just "email@domain.com"
    const emailMatch = fromField?.match(/<(.+?)>/) ?? fromField?.match(/(\S+@\S+)/);
    const senderEmail = emailMatch ? emailMatch[1].toLowerCase().trim() : fromField?.toLowerCase().trim();

    if (!senderEmail) {
      this.logger.warn('No sender email found in webhook payload');
      return { received: true, processed: false, reason: 'No sender email' };
    }

    if (!file) {
      this.logger.warn(`No file attachment from ${senderEmail}`);
      // Still try to notify them if we can find them in DB
      await this.agentService.handleMissingAttachment(senderEmail);
      return { received: true, processed: false, reason: 'No attachment' };
    }

    // Process async — return 200 immediately so SendGrid doesn't retry
    this.agentService.processInboundAssessFirst(senderEmail, file.buffer, file.originalname)
      .catch(err => this.logger.error(`Agent processing error: ${err.message}`));

    return { received: true, processed: true };
  }
}