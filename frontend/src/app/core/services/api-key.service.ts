import { Injectable } from '@angular/core';

const KEY = 'groq_api_key';

@Injectable({ providedIn: 'root' })
export class ApiKeyService {
  get(): string {
    return localStorage.getItem(KEY) ?? '';
  }

  set(key: string): void {
    if (key) {
      localStorage.setItem(KEY, key);
    } else {
      localStorage.removeItem(KEY);
    }
  }

  clear(): void {
    localStorage.removeItem(KEY);
  }

  has(): boolean {
    return !!localStorage.getItem(KEY);
  }
}
