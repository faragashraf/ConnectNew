import { Component, OnInit, Output, EventEmitter, Input } from '@angular/core';
import { TreeNode } from 'src/app/shared/services/helper/auth-objects.service';

export interface SidebarItem {
  title: string;
  route?: string;
  roleCondition?: string;
  children?: SidebarItem[];
}


@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements OnInit {

  @Input() title: string = '';
  @Input() collapsed: boolean = false;
  @Input() tree: TreeNode[] = [];

  @Output() menuItemSelected = new EventEmitter<any>();
  @Output() sidebarOpenedChange = new EventEmitter<boolean>();

  // Track the currently selected tree node for styling
  selectedNode: TreeNode | null = null;

  constructor() { }

  ngOnInit(): void {

  }

  toggleCollapse(): void {
    this.collapsed = !this.collapsed;
    this.sidebarOpenedChange.emit(!this.collapsed);
  }

  onSidebarVisibleChange(visible: boolean): void {
    this.sidebarOpenedChange.emit(visible);
  }

  onMenuItemClick(item: any): void {
    this.menuItemSelected.emit(item);
  }

  // Select a node (used by the template) and emit its underlying data
  selectNode(node: TreeNode): void {
    this.selectedNode = node;
    this.menuItemSelected.emit(node?.data);
  }

  isSelected(node: TreeNode): boolean {
    return this.selectedNode === node;
  }

}
