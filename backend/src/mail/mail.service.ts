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

  /** Send an invitation email to the candidate */
  async sendInvite(to: string, candidateName: string): Promise<void> {
    const info = await this.transporter.sendMail({
      from:    this.from,
      to,
      subject: 'You have been invited to apply — BIAT IT',
      html: `
        <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:auto;padding:32px;background:#f8fafc;border-radius:12px">
          <div style="text-align:center;margin-bottom:28px">
            <h1 style="font-size:22px;color:#0f172a;margin:0">BIAT IT</h1>
            <p style="color:#64748b;font-size:13px;margin:4px 0 0">CV Intelligence Platform</p>
          </div>
          <div style="background:#fff;border-radius:8px;padding:28px;border:1px solid #e2e8f0">
            <h2 style="font-size:18px;color:#1e293b;margin:0 0 12px">Hello ${candidateName},</h2>
            <p style="color:#475569;line-height:1.7;margin:0 0 16px">
              We are pleased to invite you to apply for an opportunity with <strong>BIAT IT</strong>.
              Our team has reviewed your profile and believes you could be a great fit.
            </p>
            <p style="color:#475569;line-height:1.7;margin:0 0 24px">
              Please reply to this email or contact your recruiter to proceed with the next steps.
            </p>
            <div style="border-top:1px solid #e2e8f0;padding-top:20px;color:#94a3b8;font-size:12px">
              This email was sent from the BIAT IT CV Intelligence Platform.
            </div>
          </div>
        </div>
      `,
    });
    this.logger.log(`Invite sent to ${to} — ${nodemailer.getTestMessageUrl(info) || info.messageId}`);
  }

  /** Notify candidate of a status update */
  async sendStatusUpdate(to: string, candidateName: string, status: string): Promise<void> {
    const statusLabels: Record<string, { label: string; color: string; message: string }> = {
      screening: {
        label:   'Under Review',
        color:   '#3b82f6',
        message: 'Your application is currently being reviewed by our HR team. We will be in touch shortly.',
      },
      interview: {
        label:   'Interview Stage',
        color:   '#8b5cf6',
        message: 'Congratulations! We would like to invite you to an interview. Our team will contact you to arrange a suitable time.',
      },
      offer: {
        label:   'Offer Extended',
        color:   '#10b981',
        message: 'We are delighted to extend you an offer. Please expect a formal offer letter from our team very soon.',
      },
      rejected: {
        label:   'Application Update',
        color:   '#64748b',
        message: 'Thank you for your interest in joining BIAT IT. After careful consideration, we have decided to move forward with other candidates at this time. We encourage you to apply again in the future.',
      },
    };

    const s = statusLabels[status] ?? { label: status, color: '#64748b', message: 'Your application status has been updated.' };

    const info = await this.transporter.sendMail({
      from:    this.from,
      to,
      subject: `Your application status: ${s.label} — BIAT IT`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:auto;padding:32px;background:#f8fafc;border-radius:12px">
          <div style="text-align:center;margin-bottom:28px">
            <h1 style="font-size:22px;color:#0f172a;margin:0">BIAT IT</h1>
            <p style="color:#64748b;font-size:13px;margin:4px 0 0">CV Intelligence Platform</p>
          </div>
          <div style="background:#fff;border-radius:8px;padding:28px;border:1px solid #e2e8f0">
            <div style="display:inline-block;background:${s.color}18;color:${s.color};border-radius:6px;padding:4px 12px;font-size:12px;font-weight:600;margin-bottom:16px;letter-spacing:0.5px;text-transform:uppercase">${s.label}</div>
            <h2 style="font-size:18px;color:#1e293b;margin:0 0 12px">Hello ${candidateName},</h2>
            <p style="color:#475569;line-height:1.7;margin:0 0 24px">${s.message}</p>
            <div style="border-top:1px solid #e2e8f0;padding-top:20px;color:#94a3b8;font-size:12px">
              This email was sent from the BIAT IT CV Intelligence Platform.
            </div>
          </div>
        </div>
      `,
    });
    this.logger.log(`Status email sent to ${to} — ${nodemailer.getTestMessageUrl(info) || info.messageId}`);
  }
}
