import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GapAnalysisReport } from '../services/internal-mobility.service';

@Component({
  selector: 'app-gap-analysis-heatmap',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="gap-analysis-container" *ngIf="report">
      <div class="summary-cards">
        <div class="summary-card">
          <span class="label">Matched Requirements</span>
          <span class="value success">{{report.summary.metCount}} / {{report.summary.totalRequirements}}</span>
        </div>
        <div class="summary-card">
          <span class="label">Priority Skill Gaps</span>
          <span class="value warning">{{report.summary.gapCount}}</span>
        </div>
      </div>

      <div class="heatmap-table">
        <div class="header-row">
          <div class="col">Competency</div>
          <div class="col center">Current Level</div>
          <div class="col center">Required Level</div>
          <div class="col center">Status</div>
        </div>
        
        <div class="data-row" *ngFor="let item of report.gaps">
          <div class="col name">
            <span class="category-tag" [attr.data-category]="item.category">{{item.category}}</span>
            {{item.name}}
          </div>
          <div class="col center">
            <div class="level-badge">{{item.currentLevel}}</div>
          </div>
          <div class="col center">
             <div class="level-badge target">{{item.requiredLevel}}</div>
          </div>
          <div class="col center status-col">
            <span class="status-indicator" [class.met]="item.gap >= 0" [class.gap]="item.gap < 0">
              <span *ngIf="item.gap >= 0">Role Match</span>
              <span *ngIf="item.gap < 0">{{item.gap}} Level Gap</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .gap-analysis-container {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      font-family: var(--font-body);
    }
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    }
    .summary-card {
      background: var(--bg-surface);
      padding: 1.25rem;
      border-radius: var(--radius-lg);
      border: 1px solid var(--border-subtle);
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .label { font-size: 0.75rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    .value { font-size: 1.75rem; font-weight: 800; font-family: var(--font-display); }
    .value.success { color: var(--success); }
    .value.warning { color: var(--warning); }

    .heatmap-table {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      overflow: hidden;
    }
    .header-row {
      display: grid;
      grid-template-columns: 2fr 120px 120px 150px;
      background: var(--bg-raised);
      padding: 0.875rem 1.25rem;
      font-weight: 700;
      color: var(--text-muted);
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      border-bottom: 1px solid var(--border-subtle);
    }
    .data-row {
      display: grid;
      grid-template-columns: 2fr 120px 120px 150px;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--border-subtle);
      align-items: center;
      transition: background 0.15s;
    }
    .data-row:last-child { border-bottom: none; }
    .data-row:hover { background: var(--bg-raised); }
    
    .col.name { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; font-weight: 600; color: var(--text-primary); font-size: 0.875rem; }
    
    .category-tag {
      font-size: 0.65rem;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      font-weight: 800;
      letter-spacing: 0.05em;
    }
    .category-tag[data-category="TECHNICAL"] { background: rgba(56, 189, 248, 0.1); color: #38bdf8; }
    .category-tag[data-category="BEHAVIORAL"] { background: rgba(34, 197, 94, 0.1); color: var(--success); }
    .category-tag[data-category="MANAGERIAL"] { background: rgba(168, 85, 247, 0.1); color: #a855f7; }
    .category-tag[data-category="CORE"] { background: rgba(245, 158, 11, 0.1); color: var(--warning); }

    .center { display: flex; justify-content: center; align-items: center; }
    
    .level-badge {
      font-weight: 700;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-raised);
      color: var(--text-secondary);
      border: 1px solid var(--border-default);
      border-radius: 50%;
      font-size: 0.95rem;
    }
    .level-badge.target { background: var(--bg-surface); border: 2px solid var(--border-subtle); color: var(--text-primary); }

    .status-indicator {
      font-size: 0.72rem;
      font-weight: 800;
      padding: 0.35rem 0.875rem;
      border-radius: 99px;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }
    .status-indicator.met { background: rgba(34, 197, 94, 0.12); color: var(--success); border: 1px solid rgba(34, 197, 94, 0.2); }
    .status-indicator.gap { background: var(--danger-dim); color: var(--danger); border: 1px solid rgba(244, 63, 94, 0.2); }
  `]
})
export class GapAnalysisHeatmapComponent {
  @Input() report: GapAnalysisReport | null = null;
}
