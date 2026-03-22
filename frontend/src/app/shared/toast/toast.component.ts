import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ToastService, Toast } from '../../core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container">
      <div
        *ngFor="let t of toasts; trackBy: trackById"
        class="toast toast--{{ t.type }}"
        (click)="toast.dismiss(t.id)"
      >
        <svg class="toast-icon" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path *ngIf="t.type === 'success'" stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
          <path *ngIf="t.type === 'error'"   stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          <path *ngIf="t.type === 'info'"    stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span class="toast-msg">{{ t.message }}</span>
        <button class="toast-close">
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </div>
  `,
  styleUrls: ['./toast.component.scss'],
})
export class ToastComponent implements OnInit, OnDestroy {
  toasts: Toast[] = [];
  private sub!: Subscription;

  constructor(readonly toast: ToastService) {}

  ngOnInit(): void {
    this.sub = this.toast.toasts$.subscribe(t => this.toasts = t);
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }

  trackById(_: number, t: Toast): number { return t.id; }
}
