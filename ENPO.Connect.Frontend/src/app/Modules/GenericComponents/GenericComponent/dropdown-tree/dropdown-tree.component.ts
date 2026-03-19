import { Component, Input, Output, EventEmitter, ViewChild } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { CdCategoryMandDto } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.dto';;
import { GenericFormsService } from '../../GenericForms.service';
import { TreeNode } from 'primeng/api';
import { OverlayPanel } from 'primeng/overlaypanel';


@Component({
  selector: 'app-dropdown-tree',
  templateUrl: './dropdown-tree.component.html',
  styleUrls: ['./dropdown-tree.component.scss']
})
export class DropdownTreeComponent {
  @ViewChild('op') overlayPanel!: OverlayPanel;
  @Input() parentForm!: FormGroup;
  @Input() control: any;
  @Input() cdCategoryMandDto: CdCategoryMandDto = {} as CdCategoryMandDto;
  @Input() isDivDisabled: boolean = false;
  @Input() isCurrentUser: boolean = false;
  @Input() showTreeButton: boolean = false;
  @Input() tree: any[] = [];
  @Input() treeTitle: string = '';
  @Input() controlFullName: string = '';
  @Output() genericEvent = new EventEmitter<{ selected?: any, parent?: any, topParent?: any, controlFullName: string, eventType: string, event?: any }>();

  selectedNode: TreeNode = {} as TreeNode;
  constructor(public genericFormService: GenericFormsService) { }

  onChange(event: any) {
    const isClear = event && (event.value === null || event.value === undefined);

    if (isClear) {
      // ensure the underlying control/form is cleared too
      if (this.control && typeof this.control.setValue === 'function') {
        this.control.setValue(null);
      } else if (this.parentForm && this.controlFullName) {
        const ctrl = this.parentForm.get ? this.parentForm.get(this.controlFullName) : null;
        if (ctrl && typeof ctrl.setValue === 'function') {
          ctrl.setValue(null);
        }
      }

      this.selectedNode = {} as TreeNode;
      return;
    }

    this.genericEvent.emit({ event, controlFullName: this.controlFullName, eventType: 'change' });
  }

  nodeSelection(event: any) {
    // Determine selected key from common event shapes
    const selectedKey = event && (event.node?.key ?? event.key ?? event.value ?? event.id ?? null);

    // If `control` is a FormControl-like object, set its value
    if (this.control && typeof this.control.setValue === 'function') {
      this.control.setValue(selectedKey);
    } else if (this.parentForm && this.controlFullName) {
      // Fallback: try to find control by name in the parent form
      const ctrl = this.parentForm.get ? this.parentForm.get(this.controlFullName) : null;
      if (ctrl && typeof ctrl.setValue === 'function') {
        ctrl.setValue(selectedKey);
      }
    }

    // store selected node reference for helper methods
    this.selectedNode = event && (event.node ?? event) as TreeNode;

    this.genericEvent.emit({ selected: this.getParent(), parent: this.getTopParent(), topParent: this.getParent(), controlFullName: this.controlFullName, eventType: 'treeSelect' });
    this.overlayPanel.hide();
  }

  nodeUnselection(event: any) {
    this.genericEvent.emit({ selected: this.getParent(), parent: this.getTopParent(), topParent: this.getParent(), controlFullName: this.controlFullName, eventType: 'treeUnselect' });
  }

  // Return the direct parent of the provided node (or the component's `selectedNode` when omitted).
  // Returns `null` if the node is at the root level or not found.
  private getParent(node?: TreeNode | null): TreeNode | null {
    const target = node ?? this.selectedNode;
    if (!target) return null;

    const find = (nodes: any[] | undefined, parent: TreeNode | null): TreeNode | null => {
      if (!nodes) return null;
      for (const n of nodes) {
        // direct reference match
        if (n === target) return parent;

        // key/id comparison fallback
        const nKey = (n as any)?.key ?? (n as any)?.id;
        const tKey = (target as any)?.key ?? (target as any)?.id;
        if (tKey != null && nKey != null && nKey === tKey) return parent;

        if (n.children) {
          const res = find(n.children, n as TreeNode);
          if (res) return res;
        }
      }
      return null;
    };

    return find(this.tree, null);
  }

  // Return the top-most ancestor (root) of the provided node (or the component's `selectedNode` when omitted).
  // If the node is already a root node, it is returned.
  private getTopParent(node?: TreeNode | null): TreeNode | null {
    const target = node ?? this.selectedNode;
    if (!target) return null;

    let current: TreeNode | null = target;
    let parent = this.getParent(current);
    while (parent) {
      current = parent;
      parent = this.getParent(current);
    }

    return current;
  }
}
