import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { Competence }      from './entities/competence.entity';
import { CompetenceLevel } from './entities/competence-level.entity';
import { CompetenceFamily } from './entities/family.entity';
import { CreateCompetenceDto } from './dto/create-competence.dto';
import { UpdateCompetenceDto } from './dto/update-competence.dto';
import { UpdateLevelsDto }     from './dto/update-levels.dto';

const LEVEL_COUNT = 5;

@Injectable()
export class CompetencesService {

  constructor(
    @InjectRepository(Competence)
    private readonly competenceRepo: Repository<Competence>,

    @InjectRepository(CompetenceLevel)
    private readonly levelRepo: Repository<CompetenceLevel>,

    @InjectRepository(CompetenceFamily)
    private readonly familyRepo: Repository<CompetenceFamily>,

    private readonly dataSource: DataSource,
  ) {}

  /** Return all competences for a given family */
  findByFamily(familyId: string): Promise<Competence[]> {
    return this.competenceRepo.find({
      where: { familyId },
      order: { name: 'ASC' },
      relations: ['levels'],
    });
  }

  findOne(id: string): Promise<Competence> {
    return this.findOrFail(id);
  }

  async create(dto: CreateCompetenceDto): Promise<Competence> {
    // Validate family exists
    const family = await this.familyRepo.findOne({ where: { id: dto.familyId } });
    if (!family) {
      throw new NotFoundException(`Family ${dto.familyId} not found.`);
    }

    const competence = this.competenceRepo.create({
      name:        dto.name.trim(),
      description: dto.description?.trim() ?? null,
      familyId:    dto.familyId,
    });
    const saved = await this.competenceRepo.save(competence);

    // Auto-create 5 empty levels so the record is always consistent
    const levels = Array.from({ length: LEVEL_COUNT }, (_, i) =>
      this.levelRepo.create({
        competenceId: saved.id,
        level:        i + 1,
        description:  '',
      }),
    );
    await this.levelRepo.save(levels);

    await this.familyRepo.increment({ id: dto.familyId }, 'competenceCount', 1);

    return this.findOrFail(saved.id);
  }

  async update(id: string, dto: UpdateCompetenceDto): Promise<Competence> {
    const competence = await this.findOrFail(id);

    if (dto.name        !== undefined) competence.name        = dto.name.trim();
    if (dto.description !== undefined) competence.description = dto.description?.trim() ?? null;
    if (dto.familyId    !== undefined && dto.familyId !== competence.familyId) {
      const family = await this.familyRepo.findOne({ where: { id: dto.familyId } });
      if (!family) throw new NotFoundException(`Family ${dto.familyId} not found.`);
      
      const oldFamilyId = competence.familyId;
      competence.familyId = dto.familyId;
      
      await this.familyRepo.decrement({ id: oldFamilyId }, 'competenceCount', 1);
      await this.familyRepo.increment({ id: dto.familyId }, 'competenceCount', 1);
    }

    await this.competenceRepo.save(competence);
    return this.findOrFail(id);
  }

  /**
   * Replace all 5 levels for a competence atomically.
   * Expects exactly 5 items; enforced by DTO + service guard.
   */
  async updateLevels(id: string, dto: UpdateLevelsDto): Promise<Competence> {
    await this.findOrFail(id); // throws 404 if competence doesn't exist

    if (dto.levels.length !== LEVEL_COUNT) {
      throw new BadRequestException(`Exactly ${LEVEL_COUNT} levels are required.`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Delete existing levels
      await queryRunner.manager.delete(CompetenceLevel, { competenceId: id });

      // Insert new levels
      const newLevels = dto.levels.map((l) =>
        queryRunner.manager.create(CompetenceLevel, {
          competenceId: id,
          level:        l.level,
          description:  l.description,
        }),
      );
      await queryRunner.manager.save(CompetenceLevel, newLevels);

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    return this.findOrFail(id);
  }

  async remove(id: string): Promise<void> {
    const competence = await this.findOrFail(id);
    await this.competenceRepo.remove(competence);
    await this.familyRepo.decrement({ id: competence.familyId }, 'competenceCount', 1);
  }

  // ── Private ─────────────────────────────────────────────────────────

  private async findOrFail(id: string): Promise<Competence> {
    const c = await this.competenceRepo.findOne({
      where: { id },
      relations: ['levels'],
    });
    if (!c) throw new NotFoundException(`Competence ${id} not found.`);
    // Sort levels in place
    c.levels = (c.levels ?? []).sort((a, b) => a.level - b.level);
    return c;
  }
}
