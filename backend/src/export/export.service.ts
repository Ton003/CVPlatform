import { Injectable }       from '@nestjs/common';
import { InjectDataSource }  from '@nestjs/typeorm';
import { DataSource }        from 'typeorm';
const PDFDocument            = require('pdfkit') as typeof import('pdfkit');
import * as ExcelJS          from 'exceljs';

@Injectable()
export class ExportService {

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  private async fetchProfile(candidateId: string) {
    const profileRows = await this.dataSource.query(`
      SELECT
        c.id::text                              AS "candidateId",
        c.first_name                            AS "firstName",
        c.last_name                             AS "lastName",
        c.email,
        c.phone,
        c.location,
        c.current_title                         AS "currentTitle",
        c.years_experience                      AS "yearsExp",
        c.gdpr_consent                          AS "gdprConsent",
        c.created_at                            AS "createdAt",
        cpd.skills_technical                    AS skills,
        cpd.llm_summary                         AS summary,
        cpd.education,
        cpd.experience,
        cpd.languages
      FROM candidates c
      JOIN cvs cv             ON cv.candidate_id = c.id::text
      JOIN cv_parsed_data cpd ON cpd.cv_id       = cv.id::text
      WHERE c.id = $1::uuid
      LIMIT 1
    `, [candidateId]);

    if (!profileRows.length) return null;

    const notesRows = await this.dataSource.query(`
      SELECT n.note, n.rating, n.stage, n.created_at,
             u.first_name, u.last_name, u.role
      FROM   candidate_notes n
      JOIN   users u ON u.id = n.user_id::uuid
      WHERE  n.candidate_id = $1::uuid
      ORDER  BY n.created_at DESC
    `, [candidateId]);

    const afRows = await this.dataSource.query(`
      SELECT * FROM assessfirst_results WHERE candidate_id = $1::uuid LIMIT 1
    `, [candidateId]);

    return {
      profile: profileRows[0],
      notes:   notesRows,
      af:      afRows[0] ?? null,
    };
  }

  async generatePdf(candidateId: string): Promise<Buffer> {
    const data = await this.fetchProfile(candidateId);
    if (!data) throw new Error('Candidate not found');

    const { profile, notes, af } = data;

    return new Promise<Buffer>((resolve, reject) => {
      const doc     = new PDFDocument({
        margin: 48,
        size:   'A4',
        info:   { Title: `CV Report — ${profile.firstName} ${profile.lastName}` },
      });
      const chunks: Buffer[] = [];
      doc.on('data',  (c: Buffer) => chunks.push(c));
      doc.on('end',   () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const PRIMARY   = '#1e40af';
      const SECONDARY = '#0f172a';
      const MUTED     = '#64748b';
      const LIGHT     = '#f1f5f9';
      const ACCENT    = '#3b82f6';
      const pageW     = doc.page.width - 96;

      // ── Header Banner ──────────────────────────────────────────────────
      doc.rect(0, 0, doc.page.width, 120).fill(PRIMARY);

      doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold')
         .text(`${profile.firstName} ${profile.lastName}`, 48, 28);

      doc.fontSize(11).font('Helvetica').fillColor('#bfdbfe')
         .text(profile.currentTitle ?? 'Candidate', 48, 56);

      // ✅ No emojis — plain text labels only
      const meta: string[] = [];
      if (profile.email)            meta.push(`Email: ${profile.email}`);
      if (profile.phone)            meta.push(`Tel: ${profile.phone}`);
      if (profile.location)         meta.push(`Location: ${profile.location}`);
      if (profile.yearsExp != null) meta.push(`Experience: ${profile.yearsExp} yrs`);

      doc.fontSize(9).fillColor('#bfdbfe')
         .text(meta.join('   |   '), 48, 78, { width: pageW });

      doc.fontSize(8).fillColor('#bfdbfe')
         .text(
           `Report generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`,
           48, 104, { width: pageW, align: 'right' }
         );

      doc.y = 136;

      // ── Section heading helper ─────────────────────────────────────────
      const sectionHead = (title: string) => {
        doc.moveDown(0.6);
        doc.rect(48, doc.y, pageW, 24).fill(LIGHT);
        doc.fillColor(PRIMARY).fontSize(10).font('Helvetica-Bold')
           .text(title.toUpperCase(), 56, doc.y + 7, { width: pageW - 16 });
        doc.y += 30;
        doc.fillColor(SECONDARY).font('Helvetica').fontSize(9.5);
      };

      // ── Summary ────────────────────────────────────────────────────────
      if (profile.summary) {
        sectionHead('Professional Summary');
        doc.fillColor(SECONDARY).fontSize(9.5).font('Helvetica')
           .text(profile.summary, 48, doc.y, { width: pageW, lineGap: 3 });
        doc.moveDown(0.5);
      }

      // ── Skills ─────────────────────────────────────────────────────────
      const skills: string[] = Array.isArray(profile.skills) ? profile.skills : [];
      if (skills.length) {
        sectionHead('Technical Skills');
        const colW = 200;
        const cols = 3;
        let col  = 0;
        let rowY = doc.y;
        skills.forEach((sk: string) => {
          const x = 48 + col * colW;
          doc.circle(x + 4, doc.y + 5, 2).fill(ACCENT);
          doc.fillColor(SECONDARY).fontSize(9).font('Helvetica')
             .text(sk, x + 10, doc.y, { width: colW - 16 });
          col++;
          if (col >= cols) {
            col  = 0;
            rowY = doc.y + 14;
            doc.y = rowY;
          }
        });
        if (col !== 0) doc.moveDown(0.8);
        doc.moveDown(0.3);
      }

      // ── Experience ─────────────────────────────────────────────────────
      const experience = Array.isArray(profile.experience) ? profile.experience : [];
      if (experience.length) {
        sectionHead('Work Experience');
        experience.forEach((exp: any) => {
          doc.fillColor(SECONDARY).fontSize(10).font('Helvetica-Bold')
             .text(exp.title ?? 'Position', 48);
          doc.fillColor(MUTED).fontSize(9).font('Helvetica')
             .text(
               `${exp.company ?? ''}${(exp.startDate || exp.start_date)
                 ? '  |  ' + (exp.startDate ?? exp.start_date) + ' - ' + (exp.endDate ?? exp.end_date ?? 'Present')
                 : ''}`,
               48
             );
          if (exp.description) {
            doc.fillColor('#475569').fontSize(9)
               .text(exp.description, 48, doc.y, { width: pageW, lineGap: 2 });
          }
          doc.moveDown(0.6);
        });
      }

      // ── Education ──────────────────────────────────────────────────────
      const education = Array.isArray(profile.education) ? profile.education : [];
      if (education.length) {
        sectionHead('Education');
        education.forEach((edu: any) => {
          doc.fillColor(SECONDARY).fontSize(10).font('Helvetica-Bold')
             .text(edu.degree ?? 'Degree', 48);
          doc.fillColor(MUTED).fontSize(9).font('Helvetica')
             .text(`${edu.institution ?? ''}${edu.field ? '  |  ' + edu.field : ''}`, 48);
          doc.moveDown(0.5);
        });
      }

      // ── Languages ──────────────────────────────────────────────────────
      const languages = Array.isArray(profile.languages) ? profile.languages : [];
      if (languages.length) {
        sectionHead('Languages');
        doc.fillColor(SECONDARY).fontSize(9.5).font('Helvetica')
           .text(
             languages.map((l: any) => `${l.name} (${l.level ?? ''})`).join('   |   '),
             48, doc.y, { width: pageW }
           );
        doc.moveDown(0.5);
      }

      // ── Manager Notes ──────────────────────────────────────────────────
      if (notes.length) {
        sectionHead('Manager Notes');
        notes.forEach((n: any) => {
          const stars = n.rating > 0
            ? '*'.repeat(n.rating) + '-'.repeat(5 - n.rating)
            : '';
          doc.fillColor(SECONDARY).fontSize(9.5).font('Helvetica-Bold')
             .text(
               `${n.first_name} ${n.last_name}  (${n.role})  — ${n.stage}${stars ? '  ' + stars : ''}`,
               48
             );
          doc.fillColor(MUTED).fontSize(8)
             .text(
               new Date(n.created_at).toLocaleDateString('en-GB', {
                 day: '2-digit', month: 'short', year: 'numeric',
               }),
               48
             );
          doc.fillColor('#475569').fontSize(9).font('Helvetica')
             .text(n.note, 48, doc.y, { width: pageW, lineGap: 2 });
          doc.moveDown(0.7);
        });
      }

      // ── AssessFirst ────────────────────────────────────────────────────
      if (af) {
        sectionHead('AssessFirst — SWIPE / DRIVE / BRAIN');

        const afFields: [string, any][] = [
          ['Personal Style',  af.personal_style],
          ['Assessment Date', af.assessment_date],
          ['Culture Fit',     af.culture_fit],
          ['Decision Making', af.decision_making],
          ['Preferred Tasks', af.preferred_tasks],
          ['Learning Style',  af.learning_style],
        ];
        afFields.forEach(([label, val]) => {
          if (!val) return;
          doc.fillColor(SECONDARY).fontSize(9.5).font('Helvetica-Bold')
             .text(`${label}: `, 48, doc.y, { continued: true });
          doc.font('Helvetica').text(val);
        });

        if (Array.isArray(af.traits) && af.traits.length) {
          doc.moveDown(0.3);
          doc.fillColor(SECONDARY).fontSize(9.5).font('Helvetica-Bold')
             .text('Key Traits:', 48);
          doc.font('Helvetica').fillColor('#475569')
             .text(af.traits.join('  |  '), 48, doc.y, { width: pageW });
        }

        if (af.personal_style_desc) {
          doc.moveDown(0.3);
          doc.fillColor(SECONDARY).fontSize(9.5).font('Helvetica-Bold')
             .text('Personality Profile:', 48);
          doc.font('Helvetica').fillColor('#475569')
             .text(af.personal_style_desc, 48, doc.y, { width: pageW, lineGap: 2 });
        }

        if (af.aptitude_desc) {
          doc.moveDown(0.3);
          doc.fillColor(SECONDARY).fontSize(9.5).font('Helvetica-Bold')
             .text('Aptitude Description:', 48);
          doc.font('Helvetica').fillColor('#475569')
             .text(af.aptitude_desc, 48, doc.y, { width: pageW, lineGap: 2 });
        }

        const tops: string[] = Array.isArray(af.top_motivators) ? af.top_motivators : [];
        const lows: string[] = Array.isArray(af.low_motivators) ? af.low_motivators : [];

        if (tops.length) {
          doc.moveDown(0.3);
          doc.fillColor(SECONDARY).fontSize(9.5).font('Helvetica-Bold')
             .text('Top Motivators:', 48);
          doc.font('Helvetica').fillColor('#10b981')
             .text(tops.join('  |  '), 48, doc.y, { width: pageW });
        }

        if (lows.length) {
          doc.moveDown(0.2);
          doc.fillColor(SECONDARY).fontSize(9.5).font('Helvetica-Bold')
             .text('Low Motivators:', 48);
          doc.font('Helvetica').fillColor('#ef4444')
             .text(lows.join('  |  '), 48, doc.y, { width: pageW });
        }
      }

      // ── Footer ─────────────────────────────────────────────────────────
      doc.moveDown(1.5);
      doc.rect(48, doc.y, pageW, 1).fill('#e2e8f0');
      doc.moveDown(0.5);
      doc.fillColor(MUTED).fontSize(8).font('Helvetica')
         .text(
           'This report was generated by the BIAT IT CV Intelligence Platform. Confidential — For internal use only.',
           48, doc.y, { width: pageW, align: 'center' }
         );

      doc.end();
    });
  }

  async generateExcel(candidateId: string): Promise<Buffer> {
    const data = await this.fetchProfile(candidateId);
    if (!data) throw new Error('Candidate not found');

    const { profile, notes, af } = data;
    const wb        = new ExcelJS.Workbook();
    wb.creator      = 'BIAT IT CV Platform';
    wb.lastModifiedBy = 'BIAT IT CV Platform';
    wb.created      = new Date();

    const headerFill: ExcelJS.Fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
    const sectionFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    const headerFont: Partial<ExcelJS.Font>  = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
    const sectionFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FF1E40AF' }, size: 10, name: 'Calibri' };
    const bodyFont: Partial<ExcelJS.Font>    = { size: 10, name: 'Calibri' };

    const addSection = (ws: ExcelJS.Worksheet, title: string, row: number) => {
      const r    = ws.getRow(row);
      r.getCell(1).value = title;
      r.getCell(1).font  = sectionFont;
      r.getCell(1).fill  = sectionFill;
      ws.mergeCells(row, 1, row, 4);
      r.height = 20;
      return row + 1;
    };

    const addRow = (ws: ExcelJS.Worksheet, row: number, label: string, value: any) => {
      const wr = ws.getRow(row);
      wr.getCell(1).value = label;       wr.getCell(1).font = { bold: true, size: 10, name: 'Calibri' };
      wr.getCell(2).value = value ?? '—'; wr.getCell(2).font = bodyFont;
      ws.mergeCells(row, 2, row, 4);
      wr.height = 18;
      return row + 1;
    };

    // ── Sheet 1: Profile ────────────────────────────────────────────────
    const ws1 = wb.addWorksheet('Candidate Profile');
    ws1.columns = [
      { key: 'field', width: 22 },
      { key: 'value', width: 45 },
      { key: 'c',     width: 18 },
      { key: 'd',     width: 18 },
    ];

    const titleRow = ws1.getRow(1);
    titleRow.getCell(1).value = `CV Report — ${profile.firstName} ${profile.lastName}`;
    titleRow.getCell(1).font  = { bold: true, size: 14, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
    titleRow.getCell(1).fill  = headerFill;
    ws1.mergeCells(1, 1, 1, 4);
    titleRow.height = 28;

    let r = 2;
    r = addSection(ws1, 'Personal Information', r);
    r = addRow(ws1, r, 'Full Name',     `${profile.firstName} ${profile.lastName}`);
    r = addRow(ws1, r, 'Email',         profile.email);
    r = addRow(ws1, r, 'Phone',         profile.phone);
    r = addRow(ws1, r, 'Location',      profile.location);
    r = addRow(ws1, r, 'Current Title', profile.currentTitle);
    r = addRow(ws1, r, 'Experience',    profile.yearsExp != null ? `${profile.yearsExp} years` : null);
    r = addRow(ws1, r, 'GDPR Consent',  profile.gdprConsent ? 'Yes' : 'No');
    r++;

    r = addSection(ws1, 'Professional Summary', r);
    const summRow = ws1.getRow(r);
    summRow.getCell(1).value     = profile.summary ?? '—';
    summRow.getCell(1).font      = bodyFont;
    summRow.getCell(1).alignment = { wrapText: true };
    ws1.mergeCells(r, 1, r, 4);
    r += 2;

    r = addSection(ws1, 'Technical Skills', r);
    const skills: string[] = Array.isArray(profile.skills) ? profile.skills : [];
    skills.forEach((sk: string, i: number) => {
      const skRow = ws1.getRow(r + i);
      skRow.getCell(1).value = sk;
      skRow.getCell(1).font  = bodyFont;
      ws1.mergeCells(r + i, 1, r + i, 4);
    });
    r += Math.max(skills.length, 1) + 1;

    r = addSection(ws1, 'Languages', r);
    const langs = Array.isArray(profile.languages) ? profile.languages : [];
    langs.forEach((l: any, i: number) => {
      const lr = ws1.getRow(r + i);
      lr.getCell(1).value = l.name  ?? '—'; lr.getCell(1).font = bodyFont;
      lr.getCell(2).value = l.level ?? '—'; lr.getCell(2).font = bodyFont;
      ws1.mergeCells(r + i, 2, r + i, 4);
    });

    // ── Sheet 2: Experience ─────────────────────────────────────────────
    const ws2 = wb.addWorksheet('Experience');
    ws2.columns = [
      { key: 'title',   header: 'Job Title',    width: 28 },
      { key: 'company', header: 'Company',       width: 25 },
      { key: 'start',   header: 'Start',         width: 14 },
      { key: 'end',     header: 'End',            width: 14 },
      { key: 'desc',    header: 'Description',   width: 50 },
    ];
    const hs2 = ws2.getRow(1);
    hs2.eachCell(cell => { cell.font = headerFont; cell.fill = headerFill; });
    hs2.height = 22;
    (Array.isArray(profile.experience) ? profile.experience : []).forEach((exp: any) => {
      const er = ws2.addRow({
        title:   exp.title   ?? '',
        company: exp.company ?? '',
        start:   exp.startDate ?? exp.start_date ?? '',
        end:     exp.endDate   ?? exp.end_date   ?? 'Present',
        desc:    exp.description ?? '',
      });
      er.getCell('desc').alignment = { wrapText: true };
      er.height = 18;
    });

    // ── Sheet 3: Education ──────────────────────────────────────────────
    const ws3 = wb.addWorksheet('Education');
    ws3.columns = [
      { key: 'degree', header: 'Degree',         width: 30 },
      { key: 'inst',   header: 'Institution',     width: 30 },
      { key: 'field',  header: 'Field of Study',  width: 25 },
    ];
    const hs3 = ws3.getRow(1);
    hs3.eachCell(cell => { cell.font = headerFont; cell.fill = headerFill; });
    hs3.height = 22;
    (Array.isArray(profile.education) ? profile.education : []).forEach((edu: any) => {
      ws3.addRow({ degree: edu.degree ?? '', inst: edu.institution ?? '', field: edu.field ?? '' });
    });

    // ── Sheet 4: Manager Notes ──────────────────────────────────────────
    const ws4 = wb.addWorksheet('Manager Notes');
    ws4.columns = [
      { key: 'author', header: 'Author',      width: 22 },
      { key: 'role',   header: 'Role',         width: 14 },
      { key: 'stage',  header: 'Stage',        width: 14 },
      { key: 'rating', header: 'Rating',       width: 10 },
      { key: 'date',   header: 'Date',         width: 18 },
      { key: 'note',   header: 'Note',         width: 55 },
    ];
    const hs4 = ws4.getRow(1);
    hs4.eachCell(cell => { cell.font = headerFont; cell.fill = headerFill; });
    hs4.height = 22;
    notes.forEach((n: any) => {
      const nr = ws4.addRow({
        author: `${n.first_name} ${n.last_name}`,
        role:   n.role,
        stage:  n.stage,
        rating: n.rating > 0 ? n.rating : '—',
        date:   new Date(n.created_at).toLocaleDateString('en-GB'),
        note:   n.note,
      });
      nr.getCell('note').alignment = { wrapText: true };
      nr.height = 18;
    });

    // ── Sheet 5: AssessFirst ────────────────────────────────────────────
    if (af) {
      const ws5 = wb.addWorksheet('AssessFirst');
      ws5.columns = [
        { key: 'field', width: 24 },
        { key: 'value', width: 60 },
      ];
      const ah = ws5.getRow(1);
      ah.getCell(1).value = 'AssessFirst — SWIPE / DRIVE / BRAIN';
      ah.getCell(1).font  = headerFont;
      ah.getCell(1).fill  = headerFill;
      ws5.mergeCells(1, 1, 1, 2);
      ah.height = 24;

      let ar = 2;
      const addAf = (label: string, val: any) => {
        if (!val) return;
        const rr = ws5.getRow(ar++);
        rr.getCell(1).value = label;
        rr.getCell(1).font  = { bold: true, name: 'Calibri', size: 10 };
        rr.getCell(2).value = Array.isArray(val) ? val.join(', ') : String(val);
        rr.getCell(2).font  = bodyFont;
        rr.getCell(2).alignment = { wrapText: true };
        rr.height = 18;
      };

      addAf('Candidate Name',   af.candidate_name);
      addAf('Assessment Date',  af.assessment_date);
      addAf('Personal Style',   af.personal_style);
      addAf('Key Traits',       af.traits);
      addAf('Areas to Improve', af.improvements);
      addAf('Top Motivators',   af.top_motivators);
      addAf('Low Motivators',   af.low_motivators);
      addAf('Culture Fit',      af.culture_fit);
      addAf('Decision Making',  af.decision_making);
      addAf('Preferred Tasks',  af.preferred_tasks);
      addAf('Learning Style',   af.learning_style);
    }

    return Buffer.from(await wb.xlsx.writeBuffer() as ArrayBuffer);
  }
}