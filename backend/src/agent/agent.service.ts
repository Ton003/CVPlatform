import { Injectable, Logger }  from '@nestjs/common';
import { InjectRepository }    from '@nestjs/typeorm';
import { Repository }          from 'typeorm';
import { HttpService }         from '@nestjs/axios';
import { ConfigService }       from '@nestjs/config';
import { firstValueFrom }      from 'rxjs';
import FormData = require('form-data');

import { Candidate }         from '../candidates/entities/candidates.entity';
import { AssessFirstResult } from '../assessfirst/assessfirst-result.entity';
import { CandidateNote }     from '../notes/candidate-note.entity';
import { MailService }       from '../mail/mail.service';

@Injectable()
export class AgentService {
  private readonly logger     = new Logger(AgentService.name);
  private readonly pythonUrl: string;

  constructor(
    @InjectRepository(Candidate)
    private readonly candidateRepo:    Repository<Candidate>,

    @InjectRepository(AssessFirstResult)
    private readonly assessFirstRepo:  Repository<AssessFirstResult>,

    @InjectRepository(CandidateNote)
    private readonly notesRepo:        Repository<CandidateNote>,

    private readonly httpService:      HttpService,
    private readonly configService:    ConfigService,
    private readonly mailService:      MailService,
  ) {
    this.pythonUrl = this.configService.getOrThrow<string>('PYTHON_SERVICE_URL');
  }

  // ══════════════════════════════════════════════════════════════════
  // MAIN AGENT FLOW
  // ══════════════════════════════════════════════════════════════════

  async processInboundAssessFirst(
    senderEmail: string,
    fileBuffer:  Buffer,
    filename:    string,
  ): Promise<void> {

    this.logger.log(`🤖 [AGENT] Starting pipeline for ${senderEmail}`);

    // ── Step 1: Find candidate by email ────────────────────────────
    const candidate = await this.candidateRepo.findOne({
      where: { email: senderEmail },
    });

    if (!candidate) {
      this.logger.warn(`🤖 [AGENT] No candidate found for email: ${senderEmail}`);
      // Can't do much without a candidate record — silently drop
      return;
    }

    const candidateName = `${candidate.first_name} ${candidate.last_name}`.trim();
    this.logger.log(`🤖 [AGENT] Found candidate: ${candidateName} (${candidate.id})`);

    try {
      // ── Step 2: Send PDF to Python for AssessFirst extraction ─────
      this.logger.log(`🤖 [AGENT] Sending PDF to Python extractor...`);

      const form = new FormData();
      form.append('file', fileBuffer, {
        filename:    filename || 'assessfirst.pdf',
        contentType: 'application/pdf',
      });

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.pythonUrl}/extract-assessfirst`,
          form,
          { headers: form.getHeaders(), timeout: 60_000 },
        ),
      );

      const extracted = response.data;
      this.logger.log(`🤖 [AGENT] Python extraction successful`);

      // ── Step 3: Save AssessFirst result to database ───────────────
      this.logger.log(`🤖 [AGENT] Saving AssessFirst result...`);

      let afRecord = await this.assessFirstRepo.findOne({
        where: { candidateId: candidate.id },
      });

      if (!afRecord) {
        afRecord = this.assessFirstRepo.create({
          candidateId: candidate.id,
          uploadedBy:  candidate.id, // self-uploaded via email reply
        });
      }

      // Map all extracted fields
      afRecord.candidateName       = extracted.candidate_name      ?? null;
      afRecord.assessmentDate      = extracted.assessment_date      ?? null;
      afRecord.personalStyle       = extracted.personal_style       ?? null;
      afRecord.personalStyleDesc   = extracted.personal_style_desc  ?? null;
      afRecord.traits              = extracted.traits               ?? [];
      afRecord.improvements        = extracted.improvements         ?? [];
      afRecord.talentCloud         = extracted.talent_cloud         ?? {};
      afRecord.dimensionDetails    = extracted.dimension_details    ?? {};
      afRecord.topMotivators       = extracted.top_motivators       ?? [];
      afRecord.lowMotivators       = extracted.low_motivators       ?? [];
      afRecord.preferredActivities = extracted.preferred_activities ?? [];
      afRecord.managementStyle     = extracted.management_style     ?? [];
      afRecord.soughtManagement    = extracted.sought_management    ?? [];
      afRecord.cultureFit          = extracted.culture_fit          ?? null;
      afRecord.cultureDesc         = extracted.culture_desc         ?? null;
      afRecord.decisionMaking      = extracted.decision_making      ?? null;
      afRecord.preferredTasks      = extracted.preferred_tasks      ?? null;
      afRecord.learningStyle       = extracted.learning_style       ?? null;
      afRecord.aptitudeDesc        = extracted.aptitude_desc        ?? null;

      await this.assessFirstRepo.save(afRecord);
      this.logger.log(`🤖 [AGENT] AssessFirst saved — id: ${afRecord.id}`);

      // ── Step 4: Move candidate to interview stage ─────────────────
      // Update candidate status to reflect they're progressing
      candidate.status = 'active';
      await this.candidateRepo.save(candidate);

      // ── Step 5: Log AI agent timeline note ───────────────────────
      this.logger.log(`🤖 [AGENT] Logging timeline note...`);

      const personalStyle = extracted.personal_style ?? 'N/A';
      const cultureFit    = extracted.culture_fit    ?? 'N/A';
      const topMotivators = (extracted.top_motivators ?? []).slice(0, 3).join(', ') || 'N/A';
      const traits        = (extracted.traits         ?? []).slice(0, 5).join(', ') || 'N/A';

      const noteText = [
        `🤖 [AI Agent] AssessFirst PDF processed automatically via email reply.`,
        ``,
        `📊 Assessment Summary:`,
        `• Personal Style: ${personalStyle}`,
        `• Culture Fit: ${cultureFit}`,
        `• Key Traits: ${traits}`,
        `• Top Motivators: ${topMotivators}`,
        ``,
        `✅ Candidate has been automatically moved to Interview stage.`,
        `Profile updated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
      ].join('\n');

      const note = this.notesRepo.create({
        candidateId: candidate.id,
        userId:      null,           // AI agent has no user ID
        note:        noteText,
        rating:      0,
        stage:       'interview',    // automatically advance to interview
      });

      await this.notesRepo.save(note);
      this.logger.log(`🤖 [AGENT] Timeline note saved`);

      // ── Step 6: Send success email to candidate ───────────────────
      this.logger.log(`🤖 [AGENT] Sending success email to ${senderEmail}`);
      await this.mailService.sendAssessFirstSuccess(senderEmail, candidateName);

      this.logger.log(`🤖 [AGENT] ✅ Pipeline complete for ${candidateName}`);

    } catch (err: unknown) {
  this.logger.error(`🤖 [AGENT] ❌ Pipeline failed for ${candidateName}`);

  let reason = 'Unknown error';

  if (err instanceof Error) {
    reason = err.message;
  }

  const apiDetail =
    typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    typeof (err as any).response?.data?.detail === 'string'
      ? (err as any).response.data.detail
      : null;

  reason = apiDetail ?? reason;

  // Log failure note
  const failNote = this.notesRepo.create({
    candidateId: candidate.id,
    userId: null,
    note: `🤖 [AI Agent] ❌ Failed to process AssessFirst PDF sent via email reply.\n\nReason: ${reason}\n\nCandidate has been notified to resend.`,
    rating: 0,
    stage: 'screening',
  });

  await this.notesRepo.save(failNote);

  await this.mailService.sendAssessFirstInvalid(
    senderEmail,
    `${candidate.first_name} ${candidate.last_name}`.trim(),
    reason,
  );
}
  }

  // ══════════════════════════════════════════════════════════════════
  // HANDLE EMAIL WITH NO ATTACHMENT
  // ══════════════════════════════════════════════════════════════════

  async handleMissingAttachment(senderEmail: string): Promise<void> {
    const candidate = await this.candidateRepo.findOne({
      where: { email: senderEmail },
    });

    if (!candidate) return;

    const candidateName = `${candidate.first_name} ${candidate.last_name}`.trim();

    await this.mailService.sendAssessFirstInvalid(
      senderEmail,
      candidateName,
      'No PDF attachment was found in your email. Please reply again with your AssessFirst PDF attached.',
    );

    this.logger.log(`🤖 [AGENT] Notified ${senderEmail} about missing attachment`);
  }
}