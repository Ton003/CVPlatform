import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { EmployeeService } from '../../../core/services/employee.service';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-org-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './org-chart.component.html',
  styleUrls: ['./org-chart.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrgChartComponent implements OnInit {
  orgData: any[] = [];
  loading = false;
  zoomLevel = 1;
  
  constructor(
    private readonly employeeService: EmployeeService,
    private readonly cdr: ChangeDetectorRef,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.loadOrgChart();
  }

  loadOrgChart(): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.employeeService.getOrgChart()
      .pipe(finalize(() => { this.loading = false; this.cdr.markForCheck(); }))
      .subscribe(data => {
        this.orgData = data;
      });
  }

  repairTree(): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.employeeService.repairOrgChart()
      .subscribe(() => {
        this.loadOrgChart();
      });
  }

  getInitials(firstName: string, lastName: string): string {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }

  goToProfile(id: string): void {
    this.router.navigate(['/employees', id]);
  }

  zoomIn(): void {
    if (this.zoomLevel < 1.5) {
      this.zoomLevel += 0.1;
      this.cdr.markForCheck();
    }
  }

  zoomOut(): void {
    if (this.zoomLevel > 0.5) {
      this.zoomLevel -= 0.1;
      this.cdr.markForCheck();
    }
  }

  resetZoom(): void {
    this.zoomLevel = 1;
    this.cdr.markForCheck();
  }
}
