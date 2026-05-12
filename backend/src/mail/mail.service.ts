import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    const port = Number(this.configService.get<number>('MAIL_PORT', 587));
    const secure = this.configService.get<string>('MAIL_SECURE') === 'true';

    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('MAIL_HOST'),
      port: port,
      secure: secure,
      auth: {
        user: this.configService.get<string>('MAIL_USER'),
        pass: this.configService.get<string>('MAIL_PASS'),
      },
      tls: {
        // Do not fail on invalid certs
        rejectUnauthorized: false,
      },
    });
  }

  async sendInterviewInvitation(
    to: string,
    candidateName: string,
    jobTitle: string,
    type: string,
    scheduledAt: Date,
    meetingUrl?: string,
  ) {
    const dateStr = scheduledAt.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });

    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #004a99;">BIAT TalentOS</h2>
        </div>
        <p>Dear <strong>${candidateName}</strong>,</p>
        <p>We are pleased to invite you for a <strong>${type} interview</strong> for the position of <strong>${jobTitle}</strong>.</p>
        
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;">📅 <strong>Date:</strong> ${dateStr}</p>
          ${meetingUrl ? `<p style="margin: 5px 0;">🔗 <strong>Meeting Link:</strong> <a href="${meetingUrl}" style="color: #004a99;">Join Video Call</a></p>` : ''}
        </div>
        
        <p>Our team is looking forward to meeting you and discussing your background and experience in more detail.</p>
        <p>If you have any questions or need to reschedule, please reply to this email.</p>
        
        <p style="margin-top: 30px;">Best regards,<br><strong>The BIAT Recruitment Team</strong></p>
        
        <div style="border-top: 1px solid #eee; margin-top: 20px; padding-top: 10px; font-size: 12px; color: #777; text-align: center;">
          <p>© 2026 Banque Internationale Arabe de Tunisie (BIAT). All rights reserved.</p>
        </div>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('MAIL_FROM'),
        to,
        subject: `Interview Invitation: ${jobTitle} - ${type}`,
        html,
      });
      this.logger.log(`✅ Interview invitation sent to ${to}`);
    } catch (error) {
      this.logger.error(`❌ Failed to send email to ${to}`, error);
    }
  }

  async sendApplicationStatusUpdate(
    to: string,
    candidateName: string,
    jobTitle: string,
    newStage: string,
  ) {
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #6d55fa;">BIAT TalentOS</h2>
        </div>
        <p>Hello <strong>${candidateName}</strong>,</p>
        <p>We are writing to update you on your application for the <strong>${jobTitle}</strong> position.</p>
        
        <div style="background-color: #f5f3ff; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6d55fa;">
          <p style="margin: 5px 0;">🚀 <strong>Current Stage:</strong> <span style="text-transform: capitalize;">${newStage}</span></p>
        </div>
        
        <p>Our team is currently reviewing your profile for this next step. We will reach out soon with more details regarding the next steps.</p>
        
        <p style="margin-top: 30px;">Best regards,<br><strong>The BIAT Recruitment Team</strong></p>
        
        <div style="border-top: 1px solid #eee; margin-top: 20px; padding-top: 10px; font-size: 12px; color: #777; text-align: center;">
          <p>© 2026 Banque Internationale Arabe de Tunisie (BIAT). All rights reserved.</p>
        </div>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('MAIL_FROM'),
        to,
        subject: `Application Update: ${jobTitle}`,
        html,
      });
      this.logger.log(`✅ Status update email sent to ${to}`);
    } catch (error) {
      this.logger.error(`❌ Failed to send status update email to ${to}`, error);
    }
  }

  async sendRejectionEmail(to: string, candidateName: string, jobTitle: string) {
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #4b5563;">BIAT TalentOS</h2>
        </div>
        <p>Dear <strong>${candidateName}</strong>,</p>
        <p>Thank you for your interest in the <strong>${jobTitle}</strong> position at BIAT and for the time you invested in the application process.</p>
        
        <p>After careful review of your application and qualifications, we regret to inform you that we have decided to move forward with other candidates at this time.</p>
        
        <p>We were impressed with your background and encourage you to apply for future openings that align with your skills and experience.</p>
        
        <p>We wish you the very best in your job search and professional endeavors.</p>
        
        <p style="margin-top: 30px;">Best regards,<br><strong>The BIAT Recruitment Team</strong></p>
        
        <div style="border-top: 1px solid #eee; margin-top: 20px; padding-top: 10px; font-size: 12px; color: #777; text-align: center;">
          <p>© 2026 Banque Internationale Arabe de Tunisie (BIAT). All rights reserved.</p>
        </div>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('MAIL_FROM'),
        to,
        subject: `Update regarding your application for ${jobTitle}`,
        html,
      });
      this.logger.log(`✅ Rejection email sent to ${to}`);
    } catch (error) {
      this.logger.error(`❌ Failed to send rejection email to ${to}`, error);
    }
  }
}
