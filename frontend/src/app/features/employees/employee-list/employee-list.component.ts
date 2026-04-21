import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { EmployeeService, Employee } from '../../../core/services/employee.service';
import { JobArchitectureService } from '../../../core/services/job-architecture.service';
import { finalize, debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-employee-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './employee-list.component.html',
  styleUrls: ['./employee-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeListComponent implements OnInit {
  employees: Employee[] = [];
  total = 0;
  loading = false;

  filters = {
    buId: '',
    departmentId: '',
    roleId: '',
    search: '',       // FIX: was missing — search input had no bound property
    page: 1,
    limit: 10
  };

  // Add Legacy Hire Modal
  showAddModal = false;
  savingHire = false;
  hiringError = '';
  hireForm = {
    employeeId: '',
    firstName: '',
    lastName: '',
    email: '',
    hireDate: new Date().toISOString().split('T')[0],
    buId: '',
    departmentId: '',
    roleId: '',
    rankId: '',
    managerId: ''
  };

  businessUnits: any[] = [];
  departments: any[] = [];
  roles: any[] = [];

  // FIX: debounced search subject to avoid firing on every keystroke
  private searchSubject = new Subject<string>();

  constructor(
    private readonly employeeService: EmployeeService,
    private readonly jaService: JobArchitectureService,
    private readonly cdr: ChangeDetectorRef,
    private readonly router: Router,
    private readonly toast: ToastService
  ) { }

  ngOnInit(): void {
    this.loadCatalog();
    this.loadEmployees();

    // FIX: subscribe to debounced search so typing triggers a load after 300ms pause
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(() => {
      this.filters.page = 1;
      this.loadEmployees();
    });
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
    this.filters.roleId = '';
    this.roles = [];
    this.filters.page = 1;
    this.loadEmployees();
  }

  onDepartmentChange(): void {
    const department = this.departments.find(d => d.id === this.filters.departmentId);
    this.roles = department?.jobRoles || [];
    this.filters.roleId = '';
    this.filters.page = 1;
    this.loadEmployees();
  }

  // FIX: called on search input change — pushes to debounce subject
  onSearchChange(): void {
    this.searchSubject.next(this.filters.search);
  }

  loadEmployees(): void {
    this.loading = true;
    this.employeeService.list(this.filters)
      .pipe(finalize(() => { this.loading = false; this.cdr.markForCheck(); }))
      .subscribe(res => {
        this.employees = res.data;
        this.total = res.total;
      });
  }

  goToProfile(id: string): void {
    this.router.navigate(['/employees', id]);
  }

  getInitials(e: Employee): string {
    return `${e.firstName[0]}${e.lastName[0]}`.toUpperCase();
  }

  // Pagination
  get totalPages(): number {
    return Math.ceil(this.total / this.filters.limit);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.filters.page = page;
    this.loadEmployees();
  }

  // --- Add Legacy Hire ---
  openAddModal(): void {
    this.showAddModal = true;
    this.hiringError = '';
    this.hireForm = {
      employeeId: `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
      firstName: '',
      lastName: '',
      email: '',
      hireDate: new Date().toISOString().split('T')[0],
      buId: this.filters.buId,
      departmentId: this.filters.departmentId,
      roleId: this.filters.roleId,
      rankId: '',
      managerId: ''
    };
    this.onModalBUChange();
    this.cdr.markForCheck();
  }

  modalDepartments: any[] = [];
  modalRoles: any[] = [];
  modalRanks: any[] = [];

  onModalBUChange(): void {
    const unit = this.businessUnits.find(u => u.id === this.hireForm.buId);
    this.modalDepartments = unit?.departments || [];
    this.hireForm.departmentId = '';
    this.hireForm.roleId = '';
    this.hireForm.rankId = '';
    this.modalRoles = [];
    this.modalRanks = [];
    this.cdr.markForCheck();
  }

  onModalDepartmentChange(): void {
    const dept = this.modalDepartments.find(d => d.id === this.hireForm.departmentId);
    this.modalRoles = (dept?.jobRoles || []).filter((r: any) => r.status === 'ACTIVE');
    this.hireForm.roleId = '';
    this.hireForm.rankId = '';
    this.modalRanks = [];
    this.cdr.markForCheck();
  }

  onModalRoleChange(): void {
    const role = this.modalRoles.find(r => r.id === this.hireForm.roleId);
    this.modalRanks = role?.levels || [];
    this.hireForm.rankId = '';
    this.cdr.markForCheck();
  }

  submitLegacyHire(): void {
    if (!this.hireForm.rankId || !this.hireForm.email || !this.hireForm.firstName) {
      this.hiringError = 'Please fill all required fields.';
      this.cdr.markForCheck();
      return;
    }

    this.savingHire = true;
    this.hiringError = '';
    this.cdr.markForCheck();

    const payload = {
      employeeId: this.hireForm.employeeId,
      firstName: this.hireForm.firstName,
      lastName: this.hireForm.lastName,
      email: this.hireForm.email,
      hireDate: this.hireForm.hireDate,
      jobRoleId: this.hireForm.roleId,
      jobRoleLevelId: this.hireForm.rankId,
      managerId: this.hireForm.managerId || undefined,
      status: 'active'
    };

    this.employeeService.create(payload)
      .pipe(finalize(() => { this.savingHire = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: () => {
          this.showAddModal = false;
          this.filters.page = 1;
          this.loadEmployees();
          this.toast.success('Employee created successfully.');
        },
        error: (err) => {
          this.hiringError = err.error?.message || 'Failed to create employee.';
        }
      });
  }

  // --- Deletion ---
  pendingDeleteId: string | null = null;
  deleting = false;

  requestDelete(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.pendingDeleteId = id;
    this.cdr.markForCheck();
  }

  confirmDelete(): void {
    if (!this.pendingDeleteId) return;
    this.deleting = true;
    this.cdr.markForCheck();

    this.employeeService.delete(this.pendingDeleteId)
      .pipe(finalize(() => { this.deleting = false; this.pendingDeleteId = null; this.cdr.markForCheck(); }))
      .subscribe({
        next: () => {
          this.loadEmployees();
          this.toast.success('Employee deleted.');
        },
        error: () => this.toast.error('Failed to delete employee.')
      });
  }
}