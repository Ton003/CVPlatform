import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  UpdateEvent,
  DataSource,
} from 'typeorm';
import { ApplicationCompetencyScore } from '../../applications/application-competency-score.entity';
import { CandidateCareerEntry } from '../entities/candidate-career-entry.entity';
import { CandidateSnapshotService } from '../candidate-snapshot.service';
import { Application } from '../../applications/application.entity';

@EventSubscriber()
export class ScoreSnapshotSubscriber implements EntitySubscriberInterface<ApplicationCompetencyScore> {
  constructor(dataSource: DataSource, private readonly snapshotService: CandidateSnapshotService) {
    dataSource.subscribers.push(this);
  }
  listenTo() { return ApplicationCompetencyScore; }
  async afterInsert(event: InsertEvent<ApplicationCompetencyScore>) {
    const app = await event.manager.findOne(Application, { where: { id: event.entity.applicationId } });
    if (app) await this.snapshotService.rebuildSnapshot(app.candidateId, app.id);
  }
  async afterUpdate(event: UpdateEvent<ApplicationCompetencyScore>) {
    if (!event.entity) return;
    const app = await event.manager.findOne(Application, { where: { id: event.entity.applicationId } });
    if (app) await this.snapshotService.rebuildSnapshot(app.candidateId, app.id);
  }
}

@EventSubscriber()
export class CareerEntrySnapshotSubscriber implements EntitySubscriberInterface<CandidateCareerEntry> {
  constructor(dataSource: DataSource, private readonly snapshotService: CandidateSnapshotService) {
    dataSource.subscribers.push(this);
  }
  listenTo() { return CandidateCareerEntry; }
  async afterInsert(event: InsertEvent<CandidateCareerEntry>) {
    await this.snapshotService.rebuildSnapshot(event.entity.candidateId);
  }
  async afterUpdate(event: UpdateEvent<CandidateCareerEntry>) {
    if (event.entity) await this.snapshotService.rebuildSnapshot(event.entity.candidateId);
  }
}

@EventSubscriber()
export class ApplicationSnapshotSubscriber implements EntitySubscriberInterface<Application> {
  constructor(dataSource: DataSource, private readonly snapshotService: CandidateSnapshotService) {
    dataSource.subscribers.push(this);
  }
  listenTo() { return Application; }
  async afterInsert(event: InsertEvent<Application>) {
    await this.snapshotService.rebuildSnapshot(event.entity.candidateId, event.entity.id);
  }
  async afterUpdate(event: UpdateEvent<Application>) {
    if (event.entity) await this.snapshotService.rebuildSnapshot(event.entity.candidateId, event.entity.id);
  }
}
