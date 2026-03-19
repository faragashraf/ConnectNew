import { Component, Input, Output, EventEmitter, OnInit, ViewChild } from '@angular/core';
import { ContextMenu } from 'primeng/contextmenu';
import { MenuItem, TreeDragDropService } from 'primeng/api';
import { TreeNode } from 'src/app/shared/services/helper/auth-objects.service';

@Component({
  selector: 'app-tree-sidebar',
  templateUrl: './generic-tree.component.html',
  styleUrls: ['./generic-tree.component.scss'],
  providers: [TreeDragDropService]
})
export class GenericTreeComponent implements OnInit {
  @Input() title: string = '';
  @Input() collapsed: boolean = false;
  @Input() showCollapseButton: boolean = false;
  @Input() expandedWidth: number = 400;
  @Input() collapsedWidth: number = 274;
  @Input() scrollHeight: number = 30;
  @Input() showTreeContextMenu: boolean = false;
  @Input() enableTreeDragDrop: boolean = false;
  @Input() allExpanded: boolean = false;
  @Input() isDivDisabled: boolean = false;
  @Input() contextMenuItems: MenuItem[] = [];
  @Input() multiExpand: boolean = false;

  private _tree: TreeNode[] = [];

  @Input()
  set tree(nodes: TreeNode[] | undefined) {
    if (!nodes) {
      this._tree = [];
      return;
    }
    this._tree = nodes;
    this.assignDefaultIcons(this._tree, 'pi pi-folder', 'pi pi-file');
  }
  @Input() selectedNode: TreeNode | null = null;
  private previousSelected: TreeNode | null = null;
  get tree(): TreeNode[] {
    return this._tree;
  }

  @Output() sidebarOpenedChange = new EventEmitter<boolean>();
  @Output() onNodeSelect = new EventEmitter<any>();
  @Output() onNodeUnselect = new EventEmitter<any>();
  @Output() onNodeExpand = new EventEmitter<any>();
  @Output() onNodeCollapse = new EventEmitter<any>();
  @Output() onNodeDrop = new EventEmitter<any>();
  @Output() onNodeContextMenuSelect = new EventEmitter<any>();
  @Output() onNodeDragStart = new EventEmitter<any>();
  @Output() onNodeDragEnd = new EventEmitter<any>();
  @Output() contextMenuItemSelected = new EventEmitter<any>();

  @ViewChild('treeContextMenu') treeContextMenu?: ContextMenu;

  constructor() { }

  ngOnInit(): void { }

  private expandAll(nodes: TreeNode[] | undefined): void {
    if (!nodes) return;
    for (const n of nodes) {
      (n as any).expanded = true;
      if (n.children && n.children.length) {
        this.expandAll(n.children as TreeNode[]);
      }
    }
  }

  expandAllNodes(): void {
    this.expandAll(this._tree);
  }

  private assignDefaultIcons(nodes: TreeNode[] | undefined, parentIcon: string, leafIcon: string): void {
    if (!nodes) return;
    for (const n of nodes) {
      const hasChildren = !!(n.children && n.children.length);
      if (!(n as any).icon) {
        (n as any).icon = hasChildren ? parentIcon : leafIcon;
      }
      if (hasChildren) {
        this.assignDefaultIcons(n.children as TreeNode[], parentIcon, leafIcon);
      }
    }
  }

  private collapseAll(nodes: TreeNode[] | undefined): void {
    if (!nodes) return;
    for (const n of nodes) {
      (n as any).expanded = false;
      if (n.children && n.children.length) {
        this.collapseAll(n.children as TreeNode[]);
      }
    }
  }

  collapseAllNodes(): void {
    this.collapseAll(this._tree);
  }

  toggleExpandCollapseAll(): void {
    if (this.allExpanded) {
      this.expandAllNodes();
    } else {
      this.collapseAllNodes();
    }
    this.allExpanded = !this.allExpanded;
  }

  toggleCollapse(): void {
    this.collapsed = !this.collapsed;
    this.toggleExpandCollapseAll()
    this.sidebarOpenedChange.emit(!this.collapsed);
  }

  handleNodeSelect(event: any): void {
    const clickedNode = event && event.node ? event.node : event;
    const prev = this.previousSelected;
    const same = prev && clickedNode && (prev === clickedNode || ((prev as any).key && (clickedNode as any).key && (prev as any).key === (clickedNode as any).key));
    if (same) {
      this.selectedNode = null;
      this.previousSelected = null;
      // emit unselect to consumers
      try {
        this.onNodeUnselect.emit({ originalEvent: event.originalEvent, node: clickedNode });
      } catch (e) {
        this.onNodeUnselect.emit(event);
      }
      return;
    }
    this.previousSelected = clickedNode;
    this.onNodeSelect.emit(event);
  }

  handleNodeUnselect(event: any): void {
    console.log('GenericSidebar: nodeUnselect', event);
    this.previousSelected = null;
    this.onNodeUnselect.emit(event);
  }

  handleNodeExpand(event: any): void {
    if (!this.multiExpand) {
      // Collapse all other nodes then expand the path to the node that was just expanded
      try {
        const node = event && event.node ? event.node : event;
        this.collapseAll(this._tree);
        if (node) {
          this.expandPathToNode(this._tree, node);
        }
      } catch (err) {
        console.error('Error while enforcing single-expanded-node behavior', err);
      }
    }
    this.onNodeExpand.emit(event);
  }

  // Recursively search for the target node and expand ancestors along the path.
  // Returns true if target was found in the subtree.
  private expandPathToNode(nodes: TreeNode[] | undefined, target: TreeNode): boolean {
    if (!nodes || !target) return false;
    for (const n of nodes) {
      // Match by reference first, then by unique key, then by label as fallback
      const same = n === target || ((n as any).key && (target as any).key && (n as any).key === (target as any).key) 
      // || (n.label && target.label && n.label === target.label);
      if (same) {
        (n as any).expanded = true;
        return true;
      }
      if (n.children && n.children.length) {
        const foundInChild = this.expandPathToNode(n.children as TreeNode[], target);
        if (foundInChild) {
          (n as any).expanded = true;
          return true;
        }
      }
    }
    return false;
  }

  handleNodeCollapse(event: any): void {
    console.log('GenericSidebar: nodeCollapse', event);
    this.onNodeCollapse.emit(event);
  }

  handleNodeDrop(event: any): void {
    console.log('GenericSidebar: nodeDrop', event);
    this.onNodeDrop.emit(event);
  }

  handleNodeContextMenuSelect(event: any): void {
    console.log('GenericSidebar: nodeContextMenuSelect', event);
    this.onNodeContextMenuSelect.emit(event);
  }

  handleNodeDragStart(event: any): void {
    console.log('GenericSidebar: nodeDragStart', event);
    this.onNodeDragStart.emit(event);
  }

  handleNodeDragEnd(event: any): void {
    console.log('GenericSidebar: nodeDragEnd', event);
    this.onNodeDragEnd.emit(event);
  }

  onContextMenuItemClick(e: any): void {
    console.log('GenericSidebar: contextMenu item clicked', e);
    this.contextMenuItemSelected.emit(e);
  }
}
