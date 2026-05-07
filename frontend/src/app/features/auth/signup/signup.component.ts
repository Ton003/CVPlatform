// signup.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs'; // ✅ add this
import { AuthService } from '../../../core/services/auth.service';
import { JobArchitectureService, BusinessUnit, Department, JobRole, JobRoleLevel } from '../../../core/services/job-architecture.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.scss'],
})
export class SignupComponent {
  signupForm: FormGroup;
  isLoading = false;
  errorMessage = '';
  showPassword = false;

  // Architecture Data
  departments: Department[] = [];
  roles: JobRole[] = [];
  levels: JobRoleLevel[] = [];

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly jaService: JobArchitectureService,
    private readonly router: Router,
  ) {
    this.signupForm = this.fb.group({
      firstName:      ['', [Validators.required, Validators.maxLength(100)]],
      lastName:       ['', [Validators.required, Validators.maxLength(100)]],
      email:          ['', [Validators.required, Validators.email]],
      password:       ['', [Validators.required, Validators.minLength(8)]],
      role:           ['hr'],
      departmentId:   [''],
      jobRoleLevelId: [''],
    });

    this.loadArchitecture();
  }

  get firstName() { return this.signupForm.get('firstName')!; }
  get lastName()  { return this.signupForm.get('lastName')!; }
  get email()      { return this.signupForm.get('email')!; }
  get password()   { return this.signupForm.get('password')!; }
  get selectedRole() { return this.signupForm.get('role')?.value; }

  private loadArchitecture(): void {
    this.jaService.getTree().subscribe(tree => {
      this.departments = tree.flatMap(bu => bu.departments || []);
    });
  }

  onDepartmentChange(): void {
    const deptId = this.signupForm.get('departmentId')?.value;
    const dept = this.departments.find(d => d.id === deptId);
    this.roles = dept?.jobRoles || [];
    this.levels = [];
    this.signupForm.patchValue({ jobRoleLevelId: '' });
  }

  onRoleChange(): void {
    const roleId = this.signupForm.get('roleId')?.value; // Wait, I didn't add roleId to form yet. I'll just use the selection to filter levels.
  }

  onRoleSelection(roleId: string): void {
    const role = this.roles.find(r => r.id === roleId);
    this.levels = role?.levels || [];
  }

  onSubmit(): void {
    if (this.signupForm.invalid) {
      this.signupForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.signup(this.signupForm.value).pipe(
      finalize(() => this.isLoading = false) // ✅ ALWAYS runs, success or error
    ).subscribe({
      next: () => {
        this.router.navigate(['/dashboard']);
      },
      // signup.component.ts — sanitize the error message before displaying
    error: (err) => {
      const raw = err.error?.message;
  // NestJS sometimes returns message as array (from class-validator)
      const message = Array.isArray(raw) ? raw[0] : raw;
  
      if (err.status === 409) {
    this.errorMessage = 'An account with this email already exists.';
     } else if (err.status === 400) {
    this.errorMessage = message || 'Please check your input.';
  } else if (err.status === 0) {
    this.errorMessage = 'Cannot reach the server. Please try again.';
  } else {
    this.errorMessage = message || 'Signup failed. Please try again.';
  }
},
    });
  }
}