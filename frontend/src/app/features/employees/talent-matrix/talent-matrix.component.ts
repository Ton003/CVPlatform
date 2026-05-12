import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { EmployeeService } from '../../../core/services/employee.service';
import { JobArchitectureService } from '../../../core/services/job-architecture.service';
import { AuthService } from '../../../core/services/auth.service';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-talent-matrix',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './talent-matrix.component.html',
  styleUrls: ['./talent-matrix.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TalentMatrixComponent implements OnInit {
  matrix: Record<string, any[]> = {};
  loading = false;
  viewMode: 'matrix' | 'unrated' = 'matrix';
  
  filters = {
    buId: '',
    departmentId: ''
  };

  businessUnits: any[] = [];
  departments: any[] = [];

  readonly boxes = [
    { id: 'rough_diamond', title: 'Rough Diamond', description: 'High Potential, Low Performance', gridArea: '1 / 1' },
    { id: 'future_star', title: 'Future Star', description: 'High Potential, Mod Performance', gridArea: '1 / 2' },
    { id: 'star', title: 'Star', description: 'High Potential, High Performance', gridArea: '1 / 3' },
    { id: 'inconsistent_player', title: 'Inconsistent Player', description: 'Mod Potential, Low Performance', gridArea: '2 / 1' },
    { id: 'key_player', title: 'Key Player', description: 'Mod Potential, Mod Performance', gridArea: '2 / 2' },
    { id: 'high_professional', title: 'High Professional', description: 'Mod Potential, High Performance', gridArea: '2 / 3' },
    { id: 'talent_risk', title: 'Talent Risk', description: 'Low Potential, Low Performance', gridArea: '3 / 1' },
    { id: 'average_performer', title: 'Average Performer', description: 'Low Potential, Mod Performance', gridArea: '3 / 2' },
    { id: 'solid_professional', title: 'Solid Professional', description: 'Low Potential, High Performance', gridArea: '3 / 3' }
  ];

  constructor(
    private readonly employeeService: EmployeeService,
    private readonly jaService: JobArchitectureService,
    private readonly authService: AuthService,
    private readonly cdr: ChangeDetectorRef,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    if (this.authService.getCurrentUser()?.role === 'manager') {
      this.router.navigate(['/employees']);
      return;
    }
    this.loadCatalog();
    this.loadMatrix();
  }

  loadCatalog(): void {
    this.jaService.getTree().subscribe(units => {
      this.businessUnits = units;
      this.cdr.markForCheck();
    });
  }

  onBUChange(): void {
    const unit = this.businessUnits.find(u => u.id === this.filters.buId);
    this.departments = unit?.departments || [];
    this.filters.departmentId = '';
    this.loadMatrix();
  }

  loadMatrix(): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.employeeService.getTalentMatrix(this.filters)
      .pipe(finalize(() => { this.loading = false; this.cdr.markForCheck(); }))
      .subscribe(res => {
        this.matrix = res;
      });
  }

  getInitials(firstName: string, lastName: string): string {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }

  goToProfile(id: string): void {
    this.router.navigate(['/employees', id]);
  }

  getBoxEmployees(boxId: string): any[] {
    return this.matrix[boxId] || [];
  }

  getUnratedCount(): number {
    return (this.matrix['unrated'] || []).length;
  }
}
