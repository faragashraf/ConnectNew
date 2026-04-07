import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TreeNode } from 'primeng/api';
import { Subscription } from 'rxjs';
import { auditTime } from 'rxjs/operators';
import {
  SubjectStructureNode,
  SubjectStructureTreeNode,
  SubjectStructureValidationResult
} from '../../domain/models/subject-structure.models';
import {
  ControlCenterStepViewModel,
  ControlCenterViewModel
} from '../../domain/models/admin-control-center.view-models';
import { SubjectStructureEngine } from '../../domain/subject-structure/subject-structure.engine';
import { AdminControlCenterFacade } from '../../facades/admin-control-center.facade';

@Component({
  selector: 'app-subject-structure-page',
  templateUrl: './subject-structure-page.component.html',
  styleUrls: ['./subject-structure-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SubjectStructurePageComponent implements OnInit, OnDestroy {
  readonly stepKey = 'subject-structure' as const;

  readonly metadataForm: FormGroup = this.fb.group({
    rootSubjectLabel: ['', [Validators.required, Validators.maxLength(120)]],
    subjectPrefix: ['', [Validators.required, Validators.maxLength(30)]],
    enableSubSubjectHierarchy: [true],
    structureNotes: ['', [Validators.maxLength(1000)]]
  });

  readonly nodeForm: FormGroup = this.fb.group({
    key: ['', [Validators.required, Validators.maxLength(80)]],
    label: ['', [Validators.required, Validators.maxLength(120)]],
    parentId: [null],
    displayOrder: [1, [Validators.required, Validators.min(1)]],
    isActive: [true]
  });

  vm: ControlCenterViewModel | null = null;
  step: ControlCenterStepViewModel | null = null;
  nodes: SubjectStructureNode[] = [];
  treeNodes: TreeNode[] = [];
  validation: SubjectStructureValidationResult = { isValid: false, blockingIssues: [], warnings: [] };

  nodeDialogVisible = false;
  editingNodeId: string | null = null;
  stepMessage = '';
  stepMessageSeverity: 'success' | 'warn' = 'warn';

  private readonly subscriptions = new Subscription();
  private syncingFromStore = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly facade: AdminControlCenterFacade,
    private readonly router: Router,
    private readonly structureEngine: SubjectStructureEngine
  ) {}

  ngOnInit(): void {
    this.facade.initialize(this.stepKey);

    this.subscriptions.add(
      this.facade.vm$.subscribe(vm => {
        this.vm = vm;
        const matchingStep = vm.steps.find(step => step.key === this.stepKey) ?? null;
        this.step = matchingStep;
        if (!matchingStep) {
          return;
        }

        this.patchMetadataFromStep(matchingStep.values);
        this.patchNodesFromStep(matchingStep.values);
        this.evaluateStructure(false);
      })
    );

    this.subscriptions.add(
      this.metadataForm.valueChanges
        .pipe(auditTime(80))
        .subscribe(() => {
          if (this.syncingFromStore) {
            return;
          }

          this.evaluateStructure(true);
        })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  get requiredProgressText(): string {
    if (!this.step) {
      return '0 / 0';
    }

    return `${this.step.requiredCompleted} / ${this.step.requiredTotal}`;
  }

  get parentOptions(): Array<{ label: string; value: string | null }> {
    const options: Array<{ label: string; value: string | null }> = [
      { label: 'بدون أب (Root)', value: null }
    ];

    const excludedIds = this.getExcludedParentIds();
    const rows = [...this.nodes]
      .filter(item => !excludedIds.has(item.id))
      .sort((left, right) => left.displayOrder - right.displayOrder);

    for (const row of rows) {
      options.push({
        label: `${row.label} (${row.key})`,
        value: row.id
      });
    }

    return options;
  }

  get sortedNodes(): SubjectStructureNode[] {
    return [...this.nodes].sort((left, right) => {
      if ((left.parentId ?? '') === (right.parentId ?? '')) {
        return left.displayOrder - right.displayOrder;
      }

      return String(left.parentId ?? '').localeCompare(String(right.parentId ?? ''));
    });
  }

  controlHasError(controlName: string): boolean {
    const control = this.metadataForm.get(controlName);
    if (!control) {
      return false;
    }

    return control.invalid && (control.dirty || control.touched);
  }

  controlErrorMessage(controlName: string): string {
    const control = this.metadataForm.get(controlName);
    if (!control) {
      return 'قيمة غير صحيحة.';
    }

    if (control.hasError('required')) {
      return 'هذا الحقل إلزامي.';
    }

    if (control.hasError('maxlength')) {
      return 'القيمة أطول من الحد المسموح.';
    }

    return 'قيمة غير صحيحة.';
  }

  openAddNodeDialog(): void {
    this.editingNodeId = null;
    this.nodeForm.reset({
      key: '',
      label: '',
      parentId: null,
      displayOrder: this.resolveNextDisplayOrder(null),
      isActive: true
    });
    this.nodeDialogVisible = true;
  }

  openEditNodeDialog(node: SubjectStructureNode): void {
    this.editingNodeId = node.id;
    this.nodeForm.reset({
      key: node.key,
      label: node.label,
      parentId: node.parentId,
      displayOrder: node.displayOrder,
      isActive: node.isActive
    });
    this.nodeDialogVisible = true;
  }

  saveNodeDialog(): void {
    if (this.nodeForm.invalid) {
      this.nodeForm.markAllAsTouched();
      return;
    }

    const formValue = this.nodeForm.getRawValue();
    const nodeId = this.editingNodeId ?? this.buildNodeId();
    const candidateNode: SubjectStructureNode = {
      id: nodeId,
      key: String(formValue.key ?? '').trim(),
      label: String(formValue.label ?? '').trim(),
      parentId: this.normalizeParentId(formValue.parentId),
      displayOrder: Math.max(1, Number(formValue.displayOrder ?? 1)),
      isActive: formValue.isActive !== false
    };

    const baseNodes = this.nodes.filter(item => item.id !== nodeId);
    if (!this.structureEngine.canAssignParent(candidateNode.id, candidateNode.parentId, baseNodes)) {
      this.stepMessageSeverity = 'warn';
      this.stepMessage = 'لا يمكن اختيار هذا الأب لأنه يسبب دورة غير منطقية في الهيكل.';
      return;
    }

    const duplicateKey = baseNodes.some(item => item.key.trim().toLowerCase() === candidateNode.key.trim().toLowerCase());
    if (duplicateKey) {
      this.stepMessageSeverity = 'warn';
      this.stepMessage = 'Field Key/Node Key مكرر. اختر مفتاحًا مختلفًا.';
      return;
    }

    this.nodes = this.structureEngine.normalizeSiblingDisplayOrder([...baseNodes, candidateNode]);
    this.nodeDialogVisible = false;
    this.stepMessage = '';
    this.evaluateStructure(true);
  }

  deleteNode(node: SubjectStructureNode): void {
    const removableIds = new Set<string>([node.id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const row of this.nodes) {
        if (!row.parentId || removableIds.has(row.id)) {
          continue;
        }

        if (removableIds.has(row.parentId)) {
          removableIds.add(row.id);
          changed = true;
        }
      }
    }

    this.nodes = this.structureEngine.normalizeSiblingDisplayOrder(
      this.nodes.filter(item => !removableIds.has(item.id))
    );
    this.evaluateStructure(true);
  }

  moveNodeUp(node: SubjectStructureNode): void {
    this.moveNode(node, -1);
  }

  moveNodeDown(node: SubjectStructureNode): void {
    this.moveNode(node, 1);
  }

  onSaveDraft(): void {
    this.evaluateStructure(true);
    const draftResult = this.facade.saveDraft();
    this.stepMessageSeverity = draftResult.success ? 'success' : 'warn';
    this.stepMessage = draftResult.message;
  }

  onGoNext(): void {
    this.metadataForm.markAllAsTouched();
    this.evaluateStructure(true);

    if (this.metadataForm.invalid || !this.validation.isValid || !this.step?.isCompleted) {
      this.stepMessageSeverity = 'warn';
      this.stepMessage = 'لا يمكن المتابعة قبل حل مشاكل الهيكل واستكمال البيانات الإلزامية.';
      return;
    }

    const nextStep = this.facade.getNextStepKey(this.stepKey);
    if (!nextStep) {
      return;
    }

    this.stepMessage = '';
    this.router.navigate(['/Admin/ControlCenter', nextStep]);
  }

  resolveParentLabel(parentId: string | null): string {
    if (!parentId) {
      return 'Root';
    }

    const parent = this.nodes.find(item => item.id === parentId);
    return parent ? parent.label : 'غير موجود';
  }

  private evaluateStructure(syncToStore: boolean): void {
    this.validation = this.structureEngine.validate(this.nodes);
    this.treeNodes = this.mapTreeToPrimeNodes(this.structureEngine.buildTree(this.nodes));

    if (!syncToStore) {
      return;
    }

    const metadata = this.metadataForm.getRawValue();
    const payload = this.structureEngine.serializeNodesPayload(this.nodes);
    const token = this.validation.isValid ? 'valid' : null;

    this.facade.updateFieldValue(this.stepKey, 'rootSubjectLabel', metadata.rootSubjectLabel);
    this.facade.updateFieldValue(this.stepKey, 'subjectPrefix', metadata.subjectPrefix);
    this.facade.updateFieldValue(this.stepKey, 'enableSubSubjectHierarchy', metadata.enableSubSubjectHierarchy);
    this.facade.updateFieldValue(this.stepKey, 'structureNotes', metadata.structureNotes);
    this.facade.updateFieldValue(this.stepKey, 'structureNodesPayload', payload);
    this.facade.updateFieldValue(this.stepKey, 'structureValidationToken', token);
  }

  private patchMetadataFromStep(values: Record<string, unknown>): void {
    const nextValue = {
      rootSubjectLabel: String(values['rootSubjectLabel'] ?? '').trim(),
      subjectPrefix: String(values['subjectPrefix'] ?? '').trim(),
      enableSubSubjectHierarchy: values['enableSubSubjectHierarchy'] === true,
      structureNotes: String(values['structureNotes'] ?? '').trim()
    };

    this.syncingFromStore = true;
    this.metadataForm.patchValue(nextValue, { emitEvent: false });
    this.syncingFromStore = false;
  }

  private patchNodesFromStep(values: Record<string, unknown>): void {
    const fromPayload = this.structureEngine.parseNodesPayload(values['structureNodesPayload']);
    const currentSerialized = this.structureEngine.serializeNodesPayload(this.nodes);
    const incomingSerialized = this.structureEngine.serializeNodesPayload(fromPayload);
    if (currentSerialized === incomingSerialized) {
      return;
    }

    this.nodes = fromPayload;
  }

  private mapTreeToPrimeNodes(nodes: ReadonlyArray<SubjectStructureTreeNode>): TreeNode[] {
    return nodes.map(node => ({
      key: node.id,
      label: `${node.label} (${node.key})`,
      expanded: true,
      children: this.mapTreeToPrimeNodes(node.children)
    }));
  }

  private resolveNextDisplayOrder(parentId: string | null): number {
    const siblings = this.nodes.filter(item => (item.parentId ?? null) === (parentId ?? null));
    if (siblings.length === 0) {
      return 1;
    }

    return Math.max(...siblings.map(item => item.displayOrder)) + 1;
  }

  private getExcludedParentIds(): Set<string> {
    if (!this.editingNodeId) {
      return new Set<string>();
    }

    const excluded = new Set<string>([this.editingNodeId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const item of this.nodes) {
        if (!item.parentId || excluded.has(item.id)) {
          continue;
        }

        if (excluded.has(item.parentId)) {
          excluded.add(item.id);
          changed = true;
        }
      }
    }

    return excluded;
  }

  private moveNode(node: SubjectStructureNode, direction: -1 | 1): void {
    const siblings = this.nodes
      .filter(item => (item.parentId ?? null) === (node.parentId ?? null))
      .sort((left, right) => left.displayOrder - right.displayOrder);
    const currentIndex = siblings.findIndex(item => item.id === node.id);
    if (currentIndex < 0) {
      return;
    }

    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= siblings.length) {
      return;
    }

    const reordered = [...siblings];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    const updates = reordered.map((item, index) => ({
      ...item,
      displayOrder: index + 1
    }));

    const siblingIds = new Set(updates.map(item => item.id));
    const others = this.nodes.filter(item => !siblingIds.has(item.id));
    this.nodes = this.structureEngine.normalizeSiblingDisplayOrder([...others, ...updates]);
    this.evaluateStructure(true);
  }

  private normalizeParentId(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : null;
  }

  private buildNodeId(): string {
    return `node-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }
}
