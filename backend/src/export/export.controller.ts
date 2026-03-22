import {
  Controller, Get, Param, Res,
  UseGuards, NotFoundException,
} from '@nestjs/common';
import type { Response }   from 'express';
import { JwtAuthGuard }    from '../auth/jwt-auth.guard';
import { ExportService }   from './export.service';

@Controller('candidates/:id/export')
@UseGuards(JwtAuthGuard)
export class ExportController {

  constructor(private readonly exportService: ExportService) {}

  @Get('pdf')
  async exportPdf(
    @Param('id') id: string, // ✅ no ParseUUIDPipe
    @Res() res: Response,
  ) {
    let buffer: Buffer;
    try {
      buffer = await this.exportService.generatePdf(id);
    } catch {
      throw new NotFoundException('Candidate not found or insufficient data');
    }
    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="candidate-report-${id}.pdf"`,
      'Content-Length':      buffer.length,
    });
    res.end(buffer);
  }

  @Get('xlsx')
  async exportExcel(
    @Param('id') id: string, // ✅ no ParseUUIDPipe
    @Res() res: Response,
  ) {
    let buffer: Buffer;
    try {
      buffer = await this.exportService.generateExcel(id);
    } catch {
      throw new NotFoundException('Candidate not found or insufficient data');
    }
    res.set({
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="candidate-report-${id}.xlsx"`,
      'Content-Length':      buffer.length,
    });
    res.end(buffer);
  }
}