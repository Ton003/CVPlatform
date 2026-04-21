import {
  Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, signal, computed,
} from '@angular/core';
import { CommonModule }    from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import {
  CompetencyService,
  CompetenceCategory,
  CompetenceFamily,
  Competence,
  CompetenceLevel,
} from '../../core/services/competency.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmModalComponent } from '../../shared/confirm-modal/confirm-modal.component';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CategoryMeta {
  value: CompetenceCategory;
  label: string;
  color: string;
  gradient: string;
  icon: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const CATEGORIES: CategoryMeta[] = [
  {
    value:    'TECHNICAL',
    label:    'Technical',
    color:    '#3b82f6',
    gradient: 'linear-gradient(135deg, #3b82f6, #6366f1)',
    icon:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
               </svg>`,
  },
  {
    value:    'BEHAVIORAL',
    label:    'Behavioral',
    color:    '#10b981',
    gradient: 'linear-gradient(135deg, #10b981, #059669)',
    icon:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
               </svg>`,
  },
  {
    value:    'MANAGERIAL',
    label:    'Managerial',
    color:    '#f59e0b',
    gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
    icon:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>
               </svg>`,
  },
];

const LEVEL_LABELS = ['Aware', 'Basic', 'Intermediate', 'Advanced', 'Expert'];

@Component({
  selector: 'app-competencies',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ConfirmModalComponent],
  templateUrl: './competencies.component.html',
  styleUrls:   ['./competencies.component.scss'],
})
export class CompetenciesComponent implements OnInit {

  // ── Data ────────────────────────────────────────────────────────────
  readonly categories = CATEGORIES;
  readonly levelLabels = LEVEL_LABELS;

  activeCategory: CompetenceCategory = 'TECHNICAL';

  families:       CompetenceFamily[] = [];
  selectedFamily: CompetenceFamily | null = null;
  competences:    Competence[] = [];

  familySearch  = '';
  expandedIds   = new Set<string>();

  // ── Loading flags ────────────────────────────────────────────────────
  loadingFamilies   = false;
  loadingCompetences = false;

  // ── Family admin ─────────────────────────────────────────────────────
  showFamilyForm    = false;
  editingFamily:    CompetenceFamily | null = null;
  familyForm!:      FormGroup;
  savingFamily      = false;

  deleteFamilyModal = false;
  pendingDeleteFamilyId = '';
  deletingFamilyId  = '';

  // ── Competence admin ─────────────────────────────────────────────────
  showCompetenceForm    = false;
  editingCompetence:    Competence | null = null;
  competenceForm!:      FormGroup;
  savingCompetence      = false;

  deleteCompetenceModal = false;
  pendingDeleteCompetenceId = '';
  deletingCompetenceId  = '';

  // ── Levels editing ───────────────────────────────────────────────────
  editingLevelsFor: Competence | null = null;
  levelsForm!: FormGroup;
  savingLevels = false;

  // ─── Computed ─────────────────────────────────────────────────────────────
  get activeMeta(): CategoryMeta {
    return this.categories.find(c => c.value === this.activeCategory)!;
  }

  get filteredFamilies(): CompetenceFamily[] {
    const q = this.familySearch.trim().toLowerCase();
    return q
      ? this.families.filter(f => f.name.toLowerCase().includes(q))
      : this.families;
  }

  get totalFamilies(): number {
    return this.families.length;
  }

  get totalCompetences(): number {
    return this.families.reduce((sum, f) => sum + (f.competenceCount || 0), 0);
  }

  constructor(
    private readonly svc:  CompetencyService,
    private readonly toast: ToastService,
    private readonly fb:   FormBuilder,
    private readonly cdr:  ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.initForms();
    this.selectCategory('TECHNICAL');
  }

  // ─── Category ────────────────────────────────────────────────────────────
  selectCategory(cat: CompetenceCategory): void {
    this.activeCategory   = cat;
    this.selectedFamily   = null;
    this.competences      = [];
    this.familySearch     = '';
    this.expandedIds.clear();
    this.loadFamilies(cat);
  }

  // ─── Families ────────────────────────────────────────────────────────────
  loadFamilies(category: CompetenceCategory): void {
    this.loadingFamilies = true;
    this.families        = [];
    this.cdr.markForCheck();

    this.svc.getFamilies(category).subscribe({
      next: (data) => {
        this.families        = data;
        this.loadingFamilies = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.toast.error('Failed to load families.');
        this.loadingFamilies = false;
        this.cdr.markForCheck();
      },
    });
  }

  selectFamily(family: CompetenceFamily): void {
    this.selectedFamily = family;
    this.expandedIds.clear();
    this.loadCompetences(family.id);
  }

  loadCompetences(familyId: string): void {
    this.loadingCompetences = true;
    this.competences        = [];
    this.cdr.markForCheck();

    this.svc.getCompetences(familyId).subscribe({
      next: (data) => {
        this.competences        = data.map(c => ({
          ...c,
          levels: (c.levels ?? []).sort((a, b) => a.level - b.level),
        }));
        this.loadingCompetences = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.toast.error('Failed to load competences.');
        this.loadingCompetences = false;
        this.cdr.markForCheck();
      },
    });
  }

  toggleExpand(id: string): void {
    if (this.expandedIds.has(id)) this.expandedIds.delete(id);
    else                          this.expandedIds.add(id);
    this.cdr.markForCheck();
  }

  isExpanded(id: string): boolean {
    return this.expandedIds.has(id);
  }

  // ─── Family CRUD ─────────────────────────────────────────────────────────
  openAddFamilyForm(): void {
    this.editingFamily  = null;
    this.familyForm.reset({ name: '', category: this.activeCategory });
    this.showFamilyForm = true;
    this.cdr.markForCheck();
  }

  openEditFamilyForm(family: CompetenceFamily, event: Event): void {
    event.stopPropagation();
    this.editingFamily = family;
    this.familyForm.reset({ name: family.name, category: family.category });
    this.showFamilyForm = true;
    this.cdr.markForCheck();
  }

  closeFamilyForm(): void {
    this.showFamilyForm = false;
    this.editingFamily  = null;
    this.cdr.markForCheck();
  }

  submitFamilyForm(): void {
    if (this.familyForm.invalid) return;
    const { name, category } = this.familyForm.value;
    const wasEditing = !!this.editingFamily;

    this.savingFamily = true;
    this.cdr.markForCheck();

    const obs$ = this.editingFamily
      ? this.svc.updateFamily(this.editingFamily.id, { name, category })
      : this.svc.createFamily(name, category);

    obs$.subscribe({
      next: () => {
        this.savingFamily   = false;
        this.showFamilyForm = false;
        this.editingFamily  = null;
        this.toast.success(wasEditing ? 'Family updated.' : 'Family created.');
        if (category !== this.activeCategory) {
          this.selectCategory(category);
        } else {
          this.loadFamilies(this.activeCategory);
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.savingFamily = false;
        this.toast.error(err.error?.message || 'Failed to save family.');
        this.cdr.markForCheck();
      },
    });
  }

  requestDeleteFamily(family: CompetenceFamily, event: Event): void {
    event.stopPropagation();
    this.pendingDeleteFamilyId = family.id;
    this.deleteFamilyModal     = true;
    this.cdr.markForCheck();
  }

  confirmDeleteFamily(): void {
    const id             = this.pendingDeleteFamilyId;
    this.deletingFamilyId = id;
    this.deleteFamilyModal = false;
    this.cdr.markForCheck();

    this.svc.deleteFamily(id).subscribe({
      next: () => {
        if (this.selectedFamily?.id === id) {
          this.selectedFamily = null;
          this.competences    = [];
        }
        this.families        = this.families.filter(f => f.id !== id);
        this.deletingFamilyId = '';
        this.toast.success('Family deleted.');
        this.cdr.markForCheck();
      },
      error: () => {
        this.deletingFamilyId = '';
        this.toast.error('Failed to delete family.');
        this.cdr.markForCheck();
      },
    });
  }

  cancelDeleteFamily(): void {
    this.deleteFamilyModal     = false;
    this.pendingDeleteFamilyId = '';
    this.cdr.markForCheck();
  }

  // ─── Competence CRUD ─────────────────────────────────────────────────────
  openAddCompetenceForm(): void {
    if (!this.selectedFamily) return;
    this.editingCompetence  = null;
    this.competenceForm.reset({ name: '', description: '' });
    this.showCompetenceForm = true;
    this.cdr.markForCheck();
  }

  openEditCompetenceForm(c: Competence, event: Event): void {
    event.stopPropagation();
    this.editingCompetence = c;
    this.competenceForm.reset({ name: c.name, description: c.description ?? '' });
    this.showCompetenceForm = true;
    this.cdr.markForCheck();
  }

  closeCompetenceForm(): void {
    this.showCompetenceForm = false;
    this.editingCompetence  = null;
    this.cdr.markForCheck();
  }

  submitCompetenceForm(): void {
    if (this.competenceForm.invalid || !this.selectedFamily) return;
    const { name, description } = this.competenceForm.value;
    const wasEditing = !!this.editingCompetence;

    this.savingCompetence = true;
    this.cdr.markForCheck();

    const obs$ = this.editingCompetence
      ? this.svc.updateCompetence(this.editingCompetence.id, { name, description })
      : this.svc.createCompetence(name, description, this.selectedFamily.id);

    obs$.subscribe({
      next: () => {
        this.savingCompetence   = false;
        this.showCompetenceForm = false;
        this.editingCompetence  = null;
        this.toast.success(wasEditing ? 'Competence updated.' : 'Competence created.');
        this.loadCompetences(this.selectedFamily!.id);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.savingCompetence = false;
        this.toast.error(err.error?.message || 'Failed to save competence.');
        this.cdr.markForCheck();
      },
    });
  }

  requestDeleteCompetence(c: Competence, event: Event): void {
    event.stopPropagation();
    this.pendingDeleteCompetenceId = c.id;
    this.deleteCompetenceModal     = true;
    this.cdr.markForCheck();
  }

  confirmDeleteCompetence(): void {
    const id                    = this.pendingDeleteCompetenceId;
    this.deletingCompetenceId   = id;
    this.deleteCompetenceModal  = false;
    this.cdr.markForCheck();

    this.svc.deleteCompetence(id).subscribe({
      next: () => {
        this.competences        = this.competences.filter(c => c.id !== id);
        this.deletingCompetenceId = '';
        this.expandedIds.delete(id);
        this.toast.success('Competence deleted.');
        this.cdr.markForCheck();
      },
      error: () => {
        this.deletingCompetenceId = '';
        this.toast.error('Failed to delete competence.');
        this.cdr.markForCheck();
      },
    });
  }

  cancelDeleteCompetence(): void {
    this.deleteCompetenceModal     = false;
    this.pendingDeleteCompetenceId = '';
    this.cdr.markForCheck();
  }

  // ─── Levels editing ──────────────────────────────────────────────────────
  openLevelsEditor(c: Competence, event: Event): void {
    event.stopPropagation();
    this.editingLevelsFor = c;

    // Ensure 5 sorted levels, bootstrapping empties if needed
    const existing = [...(c.levels ?? [])].sort((a, b) => a.level - b.level);
    const controls = Array.from({ length: 5 }, (_, i) => {
      const found = existing.find(l => l.level === i + 1);
      return this.fb.group({
        level:       [i + 1],
        description: [found?.description ?? '', Validators.required],
      });
    });

    this.levelsForm = this.fb.group({ levels: this.fb.array(controls) });
    this.cdr.markForCheck();
  }

  closeLevelsEditor(): void {
    this.editingLevelsFor = null;
    this.cdr.markForCheck();
  }

  get levelsArray(): FormArray {
    return this.levelsForm.get('levels') as FormArray;
  }

  submitLevels(): void {
    if (!this.editingLevelsFor || this.levelsForm.invalid) return;

    this.savingLevels = true;
    this.cdr.markForCheck();

    this.svc.updateCompetenceLevels(this.editingLevelsFor.id, this.levelsForm.value.levels).subscribe({
      next: (updated) => {
        this.competences = this.competences.map(c =>
          c.id === updated.id
            ? { ...updated, levels: (updated.levels ?? []).sort((a, b) => a.level - b.level) }
            : c,
        );
        this.savingLevels     = false;
        this.editingLevelsFor = null;
        this.toast.success('Levels saved.');
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.savingLevels = false;
        this.toast.error(err.error?.message || 'Failed to save levels.');
        this.cdr.markForCheck();
      },
    });
  }

  // ─── Helpers ────────────────────────────────────────────────────────────
  getLevelColor(level: number): string {
    const colors = ['#94a3b8', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
    return colors[level - 1] ?? '#94a3b8';
  }

  trackById(_: number, item: { id: string }): string { return item.id; }
  trackByValue(_: number, item: CategoryMeta): string { return item.value; }
  trackByIndex(i: number): number { return i; }

  // ─── Private ────────────────────────────────────────────────────────────
  private initForms(): void {
    this.familyForm = this.fb.group({
      name:     ['', [Validators.required, Validators.maxLength(200)]],
      category: [this.activeCategory],
    });
    this.competenceForm = this.fb.group({
      name:        ['', [Validators.required, Validators.maxLength(200)]],
      description: [''],
    });
    this.levelsForm = this.fb.group({ levels: this.fb.array([]) });
  }
}