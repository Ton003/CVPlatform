import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-backdrop" *ngIf="open" (click)="onCancel()">
      <div class="modal-box" (click)="$event.stopPropagation()">
        <div class="modal-icon" [class.modal-icon--danger]="isDanger">
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round"
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          </svg>
        </div>
        <h3 class="modal-title">{{ title }}</h3>
        <p class="modal-msg">{{ message }}</p>
        <div class="modal-actions">
          <button class="modal-btn modal-btn--ghost" (click)="onCancel()">{{ cancelText }}</button>
          <button class="modal-btn" [class.modal-btn--danger]="isDanger" [class.modal-btn--primary]="!isDanger" (click)="onConfirm()">{{ confirmText }}</button>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./confirm-modal.component.scss'],
})
export class ConfirmModalComponent {
  @Input() open      = false;
  @Input() title     = 'Are you sure?';
  @Input() message   = 'This action cannot be undone.';
  @Input() confirmText = 'Confirm';
  @Input() cancelText  = 'Cancel';
  @Input() isDanger    = true;

  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  onConfirm(): void { this.confirmed.emit(); }
  onCancel(): void  { this.cancelled.emit(); }
}
