import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private _counter = 0;
  private _toasts = new BehaviorSubject<Toast[]>([]);
  readonly toasts$ = this._toasts.asObservable();

  private show(message: string, type: ToastType, duration = 3500): void {
    const id = ++this._counter;
    const current = this._toasts.value;
    this._toasts.next([...current, { id, message, type }]);
    setTimeout(() => this.dismiss(id), duration);
  }

  success(message: string): void { this.show(message, 'success'); }
  error(message: string): void   { this.show(message, 'error', 5000); }
  info(message: string): void    { this.show(message, 'info'); }

  dismiss(id: number): void {
    this._toasts.next(this._toasts.value.filter(t => t.id !== id));
  }
}
