import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../shared/models/user.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule], // ← RouterLink removed
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {
  currentUser: User | null = null;

  stats = [
    { label: 'Total Candidates', value: '0', icon: '👤', color: '#0f3460' },
    { label: 'Active Job Offers', value: '0', icon: '📋', color: '#1a6b3c' },
    { label: 'Pending Matches', value: '0', icon: '🔗', color: '#7b3f00' },
    { label: 'Interviews Scheduled', value: '0', icon: '📅', color: '#4a0080' },
  ];

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
  }

  logout(): void {
    this.authService.logout();
  }

  getRoleBadgeLabel(role: string): string {
    const labels: Record<string, string> = {
      admin: 'Administrator',
      hr: 'HR Manager',
      manager: 'Manager',
    };
    return labels[role] || role;
  }
}