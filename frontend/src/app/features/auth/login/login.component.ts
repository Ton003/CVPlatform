import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  loginForm: FormGroup;
  isLoading    = false;
  errorMessage = '';
  showPassword = false;

  constructor(
    private readonly fb:          FormBuilder,
    private readonly authService: AuthService,
    private readonly router:      Router,
    private readonly route:       ActivatedRoute,
  ) {
    this.loginForm = this.fb.group({
      email:    ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
    });
  }

  get email()    { return this.loginForm.get('email')!; }
  get password() { return this.loginForm.get('password')!; }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading    = true;
    this.errorMessage = '';

    this.authService.login(this.loginForm.value)
      .pipe(
        finalize(() => { this.isLoading = false; }) // ✅ always resets spinner
      )
      .subscribe({
        next: () => {
          const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
          this.router.navigateByUrl(returnUrl);
        },
        error: (err) => {
          const raw     = err.error?.message;
          const message = Array.isArray(raw) ? raw[0] : raw;

          if (err.status === 401) {
            this.errorMessage = 'Invalid email or password.';
          } else if (err.status === 0) {
            this.errorMessage = 'Cannot reach the server. Please try again.';
          } else {
            this.errorMessage = message || 'Login failed. Please try again.';
          }
        },
      });
  }
}