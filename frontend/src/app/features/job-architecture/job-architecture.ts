import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { 
  JobArchitectureService, 
  BusinessUnit, 
  Department, 
  JobRole, 
  JobRoleLevel,
  JobCompetencyRequirement 
} from '../../core/services/job-architecture.service';
import { ToastService } from '../../core/services/toast.service';
import { CompetencyService } from '../../core/services/competency.service'; // global library
import { CompetenceFamily, CompetenceCategory } from '../../core/services/competency.service';
import { finalize } from 'rxjs';

interface TreeNode {
  id: string;
  name: string;
  type: 'bu' | 'department' | 'role';
  expanded?: boolean;
  children?: TreeNode[];
  parentId?: string;
  originalObject: any;
}

@Component({
  selector: 'app-job-architecture',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './job-architecture.html',
  styleUrls: ['./job-architecture.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class JobArchitecture implements OnInit {
  nodes: TreeNode[] = [];
  loadingTree = false;

  // Selected State
  selectedRole: JobRole | null = null;
  selectedRoleDetails: JobRole | null = null;
  selectedRank: JobRoleLevel | null = null;
  loadingRole = false;
  loadingRank = false;

  // Modals
  showAddModal = false;
  addNodeType: 'bu' | 'department' | 'role' = 'bu';
  addNodeParentId: string | null = null;
  addForm: FormGroup;
  savingNode = false;

  // Edit/Delete state
  editingNode: TreeNode | null = null;
  nodeToDelete: TreeNode | null = null;
  showDeleteModal = false;
  deletingNode = false;

  // Assign Competency Modal
  showAssignModal = false;
  libFamilies: CompetenceFamily[] = [];
  libCompetences: any[] = [];
  assignSearch = '';
  assignSelectedFamilyId: string | null = null;
  assignSelectedCompetence: any | null = null;
  assignRequiredLevel: number = 0;
  savingAssign = false;
  showRankSettings = false;
  constructor(
    private readonly jaService: JobArchitectureService,
    private readonly compService: CompetencyService,
    private readonly cdr: ChangeDetectorRef,
    private readonly toast: ToastService,
    private readonly fb: FormBuilder,
  ) {
    this.addForm = this.fb.group({
      name: ['', [Validators.required]],
      description: [''],
      rankCount: [5, [Validators.min(1), Validators.max(7)]],
      status: ['DRAFT']
    });
  }

  ngOnInit(): void {
    this.loadTree();
  }

  loadTree(): void {
    this.loadingTree = true;
    this.cdr.markForCheck();
    this.jaService.getTree().subscribe({
      next: (bus) => {
        this.nodes = bus.map(bu => this.mapBuToNode(bu));
        this.loadingTree = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.toast.error('Failed to load architecture tree.');
        this.loadingTree = false;
        this.cdr.markForCheck();
      }
    });
  }

  private mapBuToNode(bu: BusinessUnit): TreeNode {
    return {
      id: bu.id,
      name: bu.name,
      type: 'bu',
      expanded: true,
      originalObject: bu,
      children: (bu.departments || []).map(d => ({
        id: d.id,
        name: d.name,
        type: 'department',
        parentId: bu.id,
        expanded: true,
        originalObject: d,
        children: (d.jobRoles || []).map(r => ({
          id: r.id,
          name: r.name,
          type: 'role',
          parentId: d.id,
          originalObject: r,
        }))
      }))
    };
  }

  toggleNode(node: TreeNode, event: Event): void {
    event.stopPropagation();
    node.expanded = !node.expanded;
    this.cdr.markForCheck();
  }

  selectNode(node: TreeNode): void {
    if (node.type === 'role') {
      this.selectedRole = node.originalObject;
      this.loadRoleDetails(node.id);
    } else {
      this.selectedRole = null;
      this.selectedRank = null;
    }
    this.cdr.markForCheck();
  }

  loadRoleDetails(id: string): void {
    this.loadingRole = true;
    this.cdr.markForCheck();
    this.jaService.getJobRole(id).subscribe({
      next: (role) => {
        this.selectedRoleDetails = role;
        if (role.levels && role.levels.length > 0) {
          // Sort levels correctly
          role.levels.sort((a, b) => a.levelNumber - b.levelNumber);
          // Select first rank by default
          this.selectRankTab(role.levels[0]);
        }
        this.loadingRole = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.toast.error('Failed to load role details.');
        this.loadingRole = false;
        this.cdr.markForCheck();
      }
    });
  }

  selectRankTab(rank: JobRoleLevel): void {
    this.loadingRank = true;
    this.selectedRank = rank;
    this.cdr.markForCheck();

    this.jaService.getJobRoleRank(rank.id).subscribe({
      next: (fullRank) => {
        this.selectedRank = fullRank;
        this.loadingRank = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingRank = false;
        this.cdr.markForCheck();
      }
    });
  }

  // --- NODE CRUD ---

  openAddNode(type: 'bu' | 'department' | 'role', parentId: string | null = null, event?: Event): void {
    if (event) event.stopPropagation();
    this.addNodeType = type;
    this.addNodeParentId = parentId;
    this.editingNode = null;
    this.addForm.reset({ rankCount: 5, status: 'DRAFT' });
    this.showAddModal = true;
    this.cdr.markForCheck();
  }

  openEditNode(node: TreeNode, event: Event): void {
    event.stopPropagation();
    this.editingNode = node;
    this.addNodeType = node.type;
    
    this.addForm.patchValue({
      name: node.name,
      description: node.originalObject.description || '',
      status: node.originalObject.status || 'DRAFT'
    });
    
    this.showAddModal = true;
    this.cdr.markForCheck();
  }

  closeAddModal(): void {
    this.showAddModal = false;
    this.editingNode = null;
  }

  submitAddNode(): void {
    if (this.addForm.invalid) return;
    this.savingNode = true;
    this.cdr.markForCheck();

    const { name, description, rankCount, status } = this.addForm.value;
    let req: any;

    if (this.editingNode) {
      const id = this.editingNode.id;
      if (this.addNodeType === 'bu') req = this.jaService.updateBusinessUnit(id, name, description);
      else if (this.addNodeType === 'department') req = this.jaService.updateDepartment(id, name, description);
      else if (this.addNodeType === 'role') req = this.jaService.updateJobRole(id, name, status);
    } else {
      if (this.addNodeType === 'bu') req = this.jaService.createBusinessUnit(name, description);
      else if (this.addNodeType === 'department') req = this.jaService.createDepartment(this.addNodeParentId!, name, description);
      else if (this.addNodeType === 'role') req = this.jaService.createJobRole(this.addNodeParentId!, name, rankCount);
    }

    req?.subscribe({
      next: () => {
        this.toast.success('Success');
        this.savingNode = false;
        this.showAddModal = false;
        this.loadTree();
      },
      error: () => {
        this.toast.error('Operation failed.');
        this.savingNode = false;
        this.cdr.markForCheck();
      }
    });
  }

  // --- LEVEL DETAILS UPDATE ---

  saveRankDetails(): void {
  if (!this.selectedRank) return;
  this.loadingRank = true;
  this.cdr.markForCheck();
 
  const { mission, description, title } = this.selectedRank;
  const payload = { mission, description, title };
 
  this.jaService.updateJobRoleRank(this.selectedRank.id, payload).subscribe({
    next: (updated) => {
      this.selectedRank = updated;
      this.toast.success('Rank updated.');
      this.loadingRank = false;
      this.showRankSettings = false;
      this.cdr.markForCheck();
    },
    error: () => {
      this.toast.error('Failed to update rank details.');
      this.loadingRank = false;
      this.cdr.markForCheck();
    }
  });
}

  addResponsibility(): void {
    if (!this.selectedRank) return;
    if (!this.selectedRank.responsibilities) this.selectedRank.responsibilities = [];
    this.selectedRank.responsibilities.push('');
  }

  removeResponsibility(index: number): void {
    if (!this.selectedRank?.responsibilities) return;
    this.selectedRank.responsibilities.splice(index, 1);
  }

  trackByFn(index: number): number { return index; }

  // --- COMPETENCY ASSIGNMENT ---

  openAssignModal(): void {
    if (!this.selectedRank) return;
    this.showAssignModal = true;
    this.assignSelectedFamilyId = null;
    this.assignSelectedCompetence = null;
    this.assignRequiredLevel = 0;
    this.loadLibFamilies();
    this.cdr.markForCheck();
  }

  closeAssignModal(): void { this.showAssignModal = false; }

  loadLibFamilies(): void {
    this.compService.getFamilies().subscribe({
      next: (fams) => {
        this.libFamilies = fams;
        this.cdr.markForCheck();
      }
    });
  }
  openRankSettings(): void {
  this.showRankSettings = true;
  this.cdr.markForCheck();
}
 
closeRankSettings(): void {
  this.showRankSettings = false;
  this.cdr.markForCheck();
}
 
getTotalCompetencies(): number {
  if (!this.selectedRoleDetails?.levels) return 0;
  return this.selectedRoleDetails.levels.reduce(
    (sum, rnk) => sum + (rnk.competencyRequirements?.length || 0), 0
  );
}
 
removeCompetency(req: JobCompetencyRequirement): void {
  if (!this.selectedRank) return;
  const updatedReqs = (this.selectedRank.competencyRequirements || [])
    .filter(r => r.id !== req.id)
    .map(r => ({ competenceId: r.competenceId, requiredLevel: r.requiredLevel }));
 
  this.jaService.updateRoleRankCompetencies(this.selectedRank.id, updatedReqs).subscribe({
    next: (rank) => {
      this.selectedRank = rank;
      this.toast.success('Competency removed.');
      this.cdr.markForCheck();
    },
    error: () => this.toast.error('Failed to remove competency.')
  });
}
  selectLibFamily(familyId: string): void {
    this.assignSelectedFamilyId = familyId;
    this.assignSelectedCompetence = null;
    this.assignRequiredLevel = 0;
    this.compService.getCompetences(familyId).subscribe({
      next: (comps) => {
        this.libCompetences = comps;
        this.cdr.markForCheck();
      }
    });
  }

  selectLibCompetence(comp: any): void {
    this.assignSelectedCompetence = comp;
    this.assignRequiredLevel = 0;
    this.cdr.markForCheck();
  }

  selectLevel(level: number): void {
    this.assignRequiredLevel = level;
    this.cdr.markForCheck();
  }

  getFilteredFamilies(): CompetenceFamily[] {
    if (!this.assignSearch) return this.libFamilies;
    const s = this.assignSearch.toLowerCase();
    return this.libFamilies.filter(f => f.name.toLowerCase().includes(s));
  }

  submitAssignment(): void {
    if (!this.selectedRank || !this.assignSelectedCompetence || !this.assignRequiredLevel) return;
    this.savingAssign = true;
    this.cdr.markForCheck();

    const existingReqs = this.selectedRank.competencyRequirements || [];
    let updatedReqs = [...existingReqs];
    const existingIdx = updatedReqs.findIndex(r => r.competenceId === this.assignSelectedCompetence.id);
    
    if (existingIdx >= 0) {
      updatedReqs[existingIdx].requiredLevel = this.assignRequiredLevel;
    } else {
      updatedReqs.push({
        id: '',
        jobRoleLevelId: this.selectedRank.id,
        competenceId: this.assignSelectedCompetence.id,
        requiredLevel: this.assignRequiredLevel,
      });
    }

    const payload = updatedReqs.map(r => ({ competenceId: r.competenceId, requiredLevel: r.requiredLevel }));

    this.jaService.updateRoleRankCompetencies(this.selectedRank.id, payload).subscribe({
      next: (rank) => {
        this.selectedRank = rank;
        this.toast.success('Assigned.');
        this.savingAssign = false;
        this.showAssignModal = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.toast.error('Assignment failed.');
        this.savingAssign = false;
        this.cdr.markForCheck();
      }
    });
  }

  // --- DELETE LOGIC ---

  requestDelete(node: TreeNode, event: Event): void {
    event.stopPropagation();
    this.nodeToDelete = node;
    this.showDeleteModal = true;
    this.cdr.markForCheck();
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.nodeToDelete = null;
  }

  confirmDelete(): void {
    if (!this.nodeToDelete) return;
    this.deletingNode = true;
    this.cdr.markForCheck();

    const id = this.nodeToDelete.id;
    let req: any;

    if (this.nodeToDelete.type === 'bu') req = this.jaService.deleteBusinessUnit(id);
    else if (this.nodeToDelete.type === 'department') req = this.jaService.deleteDepartment(id);
    else if (this.nodeToDelete.type === 'role') req = this.jaService.deleteJobRole(id);

    req.subscribe({
      next: () => {
        this.toast.success('Deleted.');
        if (this.selectedRole?.id === id) {
          this.selectedRole = null;
          this.selectedRank = null;
        }
        this.deletingNode = false;
        this.showDeleteModal = false;
        this.loadTree();
      },
      error: () => {
        this.toast.error('Deletion failed.');
        this.deletingNode = false;
        this.cdr.markForCheck();
      }
    });
  }
}
