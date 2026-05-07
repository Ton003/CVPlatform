import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-employee-gap-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './employee-gap-panel.component.html',
  styleUrls: ['./employee-gap-panel.component.scss']
})
export class EmployeeGapPanelComponent implements OnInit {
  @Input() employeeId!: string;
  @Input() jobOfferId!: string;
  @Input() jobTitle!: string;
  @Input() employeeName!: string;

  @Output() closePanel = new EventEmitter<void>();
  @Output() nominated = new EventEmitter<void>();

  loading = true;
  error = '';
  analysis: any = null;

  nominating = false;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private toast: ToastService
  ) {}

  ngOnInit() {
    this.loadAnalysis();
  }

  loadAnalysis() {
    this.loading = true;
    this.error = '';
    this.http.get<any>(`${environment.apiUrl}/employees/${this.employeeId}/gap-analysis/${this.jobOfferId}`)
      .subscribe({
        next: (res) => {
          this.analysis = res;
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.error = 'Could not load gap analysis.';
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
  }

  nominate() {
    if (this.nominating) return;
    this.nominating = true;
    this.http.post(`${environment.apiUrl}/internal-mobility/nominate/${this.employeeId}/${this.jobOfferId}`, {})
      .subscribe({
        next: () => {
          this.toast.success(`${this.employeeName} nominated successfully.`);
          this.nominating = false;
          this.nominated.emit();
          this.closePanel.emit();
        },
        error: () => {
          this.toast.error('Failed to nominate employee.');
          this.nominating = false;
          this.cdr.detectChanges();
        }
      });
  }

  get readinessClass(): string {
    const map: any = {
      'READY': 'r-ready',
      'NEAR_READY': 'r-near',
      'DEVELOPING': 'r-dev',
      'NOT_READY': 'r-not'
    };
    return map[this.analysis?.readinessLabel] || 'r-not';
  }

  get readinessDisplay(): string {
    const map: any = {
      'READY': 'Ready',
      'NEAR_READY': 'Near Ready',
      'DEVELOPING': 'Developing',
      'NOT_READY': 'Not Ready'
    };
    return map[this.analysis?.readinessLabel] || 'Unknown';
  }
}
