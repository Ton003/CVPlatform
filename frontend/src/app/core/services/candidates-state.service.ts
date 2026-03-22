import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CandidatesStateService {
  searchQuery  = '';
  currentPage  = 1;
  scrollY      = 0;

  clear(): void {
    this.searchQuery = '';
    this.currentPage = 1;
    this.scrollY     = 0;
  }
}