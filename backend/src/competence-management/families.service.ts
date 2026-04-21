import {
  Injectable, NotFoundException, ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';

import { CompetenceFamily, CompetenceCategory } from './entities/family.entity';
import { CreateFamilyDto }  from './dto/create-family.dto';
import { UpdateFamilyDto }  from './dto/update-family.dto';

@Injectable()
export class FamiliesService {

  constructor(
    @InjectRepository(CompetenceFamily)
    private readonly familyRepo: Repository<CompetenceFamily>,
  ) {}

  /** Return all families; optionally filter by category */
  async findAll(category?: CompetenceCategory): Promise<any[]> {
    const qb = this.familyRepo.createQueryBuilder('family')
      .orderBy('family.name', 'ASC');

    if (category) {
      qb.where('family.category = :category', { category });
    }

    return qb.getMany();
  }

  findOne(id: string): Promise<CompetenceFamily> {
    return this.findOrFail(id);
  }

  async create(dto: CreateFamilyDto): Promise<CompetenceFamily> {
    const existing = await this.familyRepo.findOne({
      where: { name: dto.name.trim(), category: dto.category },
    });
    if (existing) {
      throw new ConflictException(
        `A family named "${dto.name}" already exists in ${dto.category}.`,
      );
    }

    const family = this.familyRepo.create({
      name:     dto.name.trim(),
      category: dto.category,
    });
    return this.familyRepo.save(family);
  }

  async update(id: string, dto: UpdateFamilyDto): Promise<CompetenceFamily> {
    const family = await this.findOrFail(id);
    if (dto.name     !== undefined) family.name     = dto.name.trim();
    if (dto.category !== undefined) family.category = dto.category;
    return this.familyRepo.save(family);
  }

  async remove(id: string): Promise<void> {
    const family = await this.findOrFail(id);
    await this.familyRepo.remove(family);
  }

  // ── Private ─────────────────────────────────────────────────────────

  private async findOrFail(id: string): Promise<CompetenceFamily> {
    const f = await this.familyRepo.findOne({ where: { id } });
    if (!f) throw new NotFoundException(`Family ${id} not found.`);
    return f;
  }
}
