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
    if (app) setImmediate(() => this.snapshotService.rebuildSnapshot(app.candidateId, app.id).catch(console.error));
  }
  async afterUpdate(event: UpdateEvent<ApplicationCompetencyScore>) {
    if (!event.entity && !event.databaseEntity) return;
    const applicationId = event.entity?.applicationId ?? event.databaseEntity?.applicationId;
    if (!applicationId) return;
    const app = await event.manager.findOne(Application, { where: { id: applicationId } });
    if (app) setImmediate(() => this.snapshotService.rebuildSnapshot(app.candidateId, app.id).catch(console.error));
  }
}

@EventSubscriber()
export class CareerEntrySnapshotSubscriber implements EntitySubscriberInterface<CandidateCareerEntry> {
  constructor(dataSource: DataSource, private readonly snapshotService: CandidateSnapshotService) {
    dataSource.subscribers.push(this);
  }
  listenTo() { return CandidateCareerEntry; }
  async afterInsert(event: InsertEvent<CandidateCareerEntry>) {
    setImmediate(() => this.snapshotService.rebuildSnapshot(event.entity.candidateId).catch(console.error));
  }
  async afterUpdate(event: UpdateEvent<CandidateCareerEntry>) {
    const candidateId = event.entity?.candidateId ?? event.databaseEntity?.candidateId;
    if (candidateId) setImmediate(() => this.snapshotService.rebuildSnapshot(candidateId).catch(console.error));
  }
}

@EventSubscriber()
export class ApplicationSnapshotSubscriber implements EntitySubscriberInterface<Application> {
  constructor(dataSource: DataSource, private readonly snapshotService: CandidateSnapshotService) {
    dataSource.subscribers.push(this);
  }
  listenTo() { return Application; }
  async afterInsert(event: InsertEvent<Application>) {
    setImmediate(() => this.snapshotService.rebuildSnapshot(event.entity.candidateId, event.entity.id).catch(console.error));
  }
  async afterUpdate(event: UpdateEvent<Application>) {
    const candidateId = event.entity?.candidateId ?? event.databaseEntity?.candidateId;
    const id = event.entity?.id ?? event.databaseEntity?.id;
    if (candidateId && id) {
      setImmediate(() => this.snapshotService.rebuildSnapshot(candidateId, id as string).catch(console.error));
    }
  }
}
