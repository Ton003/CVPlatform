import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, ParseUUIDPipe,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { FamiliesService } from './families.service';
import { CompetenceCategory } from './entities/family.entity';
import { CreateFamilyDto } from './dto/create-family.dto';
import { UpdateFamilyDto } from './dto/update-family.dto';

@Controller('families')
export class FamiliesController {
  constructor(private readonly svc: FamiliesService) { }

  /**
   * GET /families
   * GET /families?category=TECHNICAL
   */
  @Get()
  findAll(@Query('category') category?: CompetenceCategory) {
    return this.svc.findAll(category);
  }

  /** GET /families/:id */
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOne(id);
  }

  /** POST /families */
  @Post()
  create(@Body() dto: CreateFamilyDto) {
    return this.svc.create(dto);
  }

  /** PATCH /families/:id */
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFamilyDto,
  ) {
    return this.svc.update(id, dto);
  }

  /** DELETE /families/:id */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(id);
  }
}
