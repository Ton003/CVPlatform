import {
  Controller, Get, Post, Patch, Delete, Put,
  Body, Param, Query, ParseUUIDPipe,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { CompetencesService }   from './competences.service';
import { CreateCompetenceDto }  from './dto/create-competence.dto';
import { UpdateCompetenceDto }  from './dto/update-competence.dto';
import { UpdateLevelsDto }      from './dto/update-levels.dto';

@Controller('competences')
export class CompetencesController {
  constructor(private readonly svc: CompetencesService) {}

  /**
   * GET /competences?familyId=<uuid>
   */
  @Get()
  findAll(@Query('familyId') familyId?: string) {
    if (!familyId) return [];
    return this.svc.findByFamily(familyId);
  }

  /** GET /competences/:id */
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOne(id);
  }

  /** POST /competences */
  @Post()
  create(@Body() dto: CreateCompetenceDto) {
    return this.svc.create(dto);
  }

  /** PATCH /competences/:id */
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompetenceDto,
  ) {
    return this.svc.update(id, dto);
  }

  /**
   * PUT /competences/:id/levels
   * Replace all 5 levels atomically.
   */
  @Put(':id/levels')
  updateLevels(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLevelsDto,
  ) {
    return this.svc.updateLevels(id, dto);
  }

  /** DELETE /competences/:id */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(id);
  }
}
