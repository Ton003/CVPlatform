import { Injectable, Logger } from '@nestjs/common';
import { ConfigService }      from '@nestjs/config';
import * as nodemailer        from 'nodemailer';
import { Transporter }        from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter;

  constructor(private cfg: ConfigService) {
    this.initTransporter();
  }

  private async initTransporter() {
    const user = this.cfg.get<string>('MAIL_USER');
    const pass = this.cfg.get<string>('MAIL_PASS');

    if (user && pass) {
      // Production SMTP
      this.transporter = nodemailer.createTransport({
        host:   this.cfg.get<string>('MAIL_HOST')    ?? 'smtp.gmail.com',
        port:   this.cfg.get<number>('MAIL_PORT')    ?? 587,
        secure: this.cfg.get<string>('MAIL_SECURE')  === 'true',
        auth:   { user, pass },
      });
      this.logger.log('Mail transporter ready (SMTP)');
    } else {
      // Development fallback — Ethereal test account (prints preview URL to console)
      try {
        const testAccount = await nodemailer.createTestAccount();
        this.transporter  = nodemailer.createTransport({
          host:   'smtp.ethereal.email',
          port:   587,
          secure: false,
          auth: { user: testAccount.user, pass: testAccount.pass },
        });
        this.logger.warn(`Mail transporter ready (Ethereal test): ${testAccount.user}`);
      } catch (err: any) {
        this.logger.warn(`Failed to create Ethereal test account, falling back to mock transport: ${err.message}`);
        this.transporter = nodemailer.createTransport({
          streamTransport: true,
          newline: 'windows',
        });
      }
    }
  }

  private get from(): string {
    return this.cfg.get<string>('MAIL_FROM') ?? 'BIAT CV Platform <no-reply@biat.com.tn>';
  }

  private wrapHtml(content: string): string {
    return `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <div style="background-color: #f8fafc; padding: 24px; text-align: center; border-bottom: 1px solid #e5e7eb;">
          <h1 style="color: #0f172a; font-size: 24px; margin: 0; font-weight: 700;">BIAT Recruitment</h1>
        </div>
        <div style="padding: 32px 24px; color: #334155; line-height: 1.6; font-size: 16px;">
          ${content}
        </div>
        <div style="background-color: #f8fafc; padding: 20px; text-align: center; color: #64748b; font-size: 12px; border-top: 1px solid #e5e7eb;">
          © ${new Date().getFullYear()} BIAT. All rights reserved.<br/>
          This is an automated message, please do not reply directly to this address.
        </div>
      </div>
    `;
  }

  async sendAssessFirstRequest(to: string, candidateName: string): Promise<void> {
    const html = this.wrapHtml(`
      <p>Dear ${candidateName},</p>
      <p>Thank you for your interest in joining our team at BIAT.</p>
      <p>As part of our recruitment process, we would like you to complete an <strong>AssessFirst</strong> personality and aptitude assessment.</p>
      <p>Please complete your profile and <strong>reply to the recruiter with your generated PDF report</strong> attached.</p>
      <br/>
      <div style="text-align: center; margin: 30px 0;">
        <a href="https://app.assessfirst.com/" style="background-color: #3b82f6; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Go to AssessFirst</a>
      </div>
      <p>We look forward to receiving your assessment results.</p>
      <p>Best regards,<br/><strong>The BIAT Recruitment Team</strong></p>
    `);
    const info = await this.transporter.sendMail({ from: this.from, to, subject: 'Next Step: AssessFirst Assessment Request', html });
    this.logger.log(`AssessFirst Request sent to ${to} — ${nodemailer.getTestMessageUrl(info) || info.messageId}`);
  }

  async sendInterviewInvite(to: string, candidateName: string, date: string, location: string): Promise<void> {
    const formattedDate = new Date(date).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' });
    const html = this.wrapHtml(`
      <p>Dear ${candidateName},</p>
      <p>We were impressed by your profile and would like to invite you to an interview for the position you applied for at BIAT.</p>
      <div style="background-color: #f1f5f9; padding: 20px; border-radius: 6px; margin: 24px 0;">
        <p style="margin: 0 0 10px 0; color: #0f172a;"><strong>📅 Date & Time:</strong><br/>${formattedDate}</p>
        <p style="margin: 0; color: #0f172a;"><strong>📍 Location / Link:</strong><br/>
          <a href="${location}" style="color: #3b82f6;">${location}</a>
        </p>
      </div>
      <p>Please reply directly to the recruiter to confirm your availability. If you need to reschedule, let us know as soon as possible.</p>
      <p>We look forward to speaking with you soon!</p>
      <p>Best regards,<br/><strong>The BIAT Recruitment Team</strong></p>
    `);
    const info = await this.transporter.sendMail({ from: this.from, to, subject: 'Invitation to Interview at BIAT', html });
    this.logger.log(`Interview Invite sent to ${to} — ${nodemailer.getTestMessageUrl(info) || info.messageId}`);
  }

  async sendStatusUpdate(to: string, candidateName: string, status: string): Promise<void> {
    const statusLabels: Record<string, { label: string; color: string }> = {
      screening: { label: 'Under Review', color: '#3b82f6' },
      interview: { label: 'Interview Stage', color: '#8b5cf6' },
      offer:     { label: 'Offer Extended', color: '#10b981' },
      rejected:  { label: 'Application Update', color: '#64748b' },
    };
    const s = statusLabels[status] ?? { label: status, color: '#64748b' };
    
    const html = this.wrapHtml(`
      <p>Dear ${candidateName},</p>
      <p>We are writing to update you on the status of your application at BIAT.</p>
      <p>Your application has been moved to the following stage: <strong style="color: ${s.color};">${s.label}</strong>.</p>
      <p>Our recruitment team will be in touch shortly with any next steps or additional information as required.</p>
      <p>Thank you for your continued interest in building your career with us.</p>
      <p>Best regards,<br/><strong>The BIAT Recruitment Team</strong></p>
    `);

    const info = await this.transporter.sendMail({ from: this.from, to, subject: `Your application status: ${s.label} — BIAT IT`, html });
    this.logger.log(`Status email sent to ${to} — ${nodemailer.getTestMessageUrl(info) || info.messageId}`);
  }
  
  async sendAssessFirstSuccess(to: string, candidateName: string): Promise<void> {
  const html = this.wrapHtml(`
    <p style="color:#1e293b;font-size:16px;margin:0 0 12px">Dear ${candidateName},</p>
    <p style="color:#475569;line-height:1.7;margin:0 0 16px">
      We have successfully received and processed your <strong>AssessFirst PDF report</strong>.
    </p>
    <p style="color:#475569;line-height:1.7;margin:0 0 16px">
      Your profile has been updated automatically by our AI system. You are now moving to the
      <strong style="color:#8b5cf6">Interview Phase</strong>.
    </p>
    <p style="color:#475569;line-height:1.7;margin:0">
      Our team will be in touch shortly to schedule your interview.
    </p>
  `);
  await this.transporter.sendMail({
    from:    this.from,
    to,
    subject: 'AssessFirst Report Received — BIAT IT',
    html,
  });
  this.logger.log(`AssessFirst success email sent to ${to}`);
}

async sendAssessFirstInvalid(to: string, candidateName: string, reason: string): Promise<void> {
  const html = this.wrapHtml(`
    <p style="color:#1e293b;font-size:16px;margin:0 0 12px">Dear ${candidateName},</p>
    <p style="color:#475569;line-height:1.7;margin:0 0 16px">
      We received your email, but our system could not process your attached PDF.
    </p>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:0 0 16px">
      <p style="color:#dc2626;margin:0;font-size:14px">
        <strong>Reason:</strong> ${reason}
      </p>
    </div>
    <p style="color:#475569;line-height:1.7;margin:0">
      Please reply to this email with the correct AssessFirst PDF document attached and we will process it automatically.
    </p>
  `);
  await this.transporter.sendMail({
    from:    this.from,
    to,
    subject: 'Action Required: Issue Processing Your PDF — BIAT IT',
    html,
  });
  this.logger.log(`AssessFirst invalid email sent to ${to}`);
}

}
