import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Candidate } from './entities/candidates.entity';
import { CandidateCompetency } from './entities/candidate-competency.entity';
import { Application } from '../applications/application.entity';
import { ApplicationCompetencyScore } from '../applications/application-competency-score.entity';
import { CandidateCareerEntry } from './entities/candidate-career-entry.entity';

@Injectable()
export class CandidateSnapshotService {
  private readonly logger = new Logger(CandidateSnapshotService.name);

  constructor(
    @InjectRepository(Candidate)
    private readonly candidateRepo: Repository<Candidate>,
    @InjectRepository(CandidateCompetency)
    private readonly candidateCompRepo: Repository<CandidateCompetency>,
    @InjectRepository(Application)
    private readonly applicationRepo: Repository<Application>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Rebuilds the competency snapshot for a candidate.
   * Priority: Manual Evaluation > AI Inference.
   */
  async rebuildSnapshot(candidateId: string, activeApplicationId?: string) {
    this.logger.log(`🔄 Rebuilding snapshot for candidate ${candidateId}`);

    const candidate = await this.candidateRepo.findOne({ where: { id: candidateId } });
    if (!candidate) throw new NotFoundException('Candidate not found');

    // 1. Get all manual scores across all applications
    const manualScores = await this.dataSource.query(`
      SELECT 
        acs.competence_id AS "competenceId", 
        acs.evaluated_level AS "evaluatedLevel", 
        acs.updated_at AS "updatedAt", 
        acs.application_id AS "applicationId"
      FROM application_competency_scores acs
      JOIN applications a ON a.id = acs.application_id
      WHERE a.candidate_id = $1
      ORDER BY acs.updated_at DESC
    `, [candidateId]);

    // 2. Get all AI inferred scores from career entries
    const careerEntries = await this.dataSource.query(`
      SELECT sfia_tags
      FROM candidate_career_entries
      WHERE candidate_id = $1
    `, [candidateId]);

    const snapshot: Record<string, any> = {};

    // Process AI tags first (lower priority)
    careerEntries.forEach(entry => {
      const tags = Array.isArray(entry.sfia_tags) ? entry.sfia_tags : [];
      tags.forEach((tag: any) => {
        const compId = tag.competency_id || tag.competencyId;
        const level = tag.inferred_level || tag.inferredLevel;
        if (compId && level) {
          if (!snapshot[compId] || level > snapshot[compId].level) {
            snapshot[compId] = {
              level,
              source: 'AI',
              rated_at: new Date(),
            };
          }
        }
      });
    });

    // Process manual scores (higher priority, overwrites AI)
    // Since manualScores is ordered by updatedAt DESC, the first occurrence for each compId is the latest.
    manualScores.forEach((score: any) => {
      const compId = score.competenceId;
      const level = score.evaluatedLevel;
      
      // If manual score exists, it takes precedence over AI.
      // We only set it if it hasn't been set yet (to keep the LATEST one)
      if (!snapshot[compId] || snapshot[compId].source === 'AI') {
        snapshot[compId] = {
          level,
          source_application_id: score.applicationId,
          rated_at: score.updatedAt,
          source: 'MANUAL'
        };
      }
    });

    // 3. Optional: Compute competency delta for the active application
    if (activeApplicationId) {
      const beforeSnapshot = candidate.competencySnapshot || {};
      const delta: Record<string, any> = {};
      
      Object.keys(snapshot).forEach(compId => {
          const before = beforeSnapshot[compId]?.level || null;
          const after = snapshot[compId].level;
          if (before !== after) {
            delta[compId] = { before, after };
          }
      });

      if (Object.keys(delta).length > 0) {
        await this.applicationRepo.update(activeApplicationId, {
          competencyGap: delta
        });
      }
    }

    // 4. Update candidate snapshot & synchronize table
    await this.dataSource.transaction(async (manager) => {
      // a. Update Candidate JSON (denormalized cache)
      candidate.competencySnapshot = snapshot;
      candidate.snapshotUpdatedAt = new Date();
      await manager.save(candidate);

      // b. Synchronize candidate_competencies table
      // We perform an upset to keep the latest level for each competency
      for (const compId of Object.keys(snapshot)) {
        const item = snapshot[compId];
        await manager.upsert(CandidateCompetency, {
          candidateId: candidateId,
          competenceId: compId,
          level: item.level,
          source: item.source,
          sourceApplicationId: item.source_application_id || null,
          ratedAt: item.rated_at || new Date(),
        }, ['candidateId', 'competenceId']);
      }
    });

    this.logger.log(`✅ Snapshot updated and synchronized for candidate ${candidateId}`);
    return snapshot;
  }
}
