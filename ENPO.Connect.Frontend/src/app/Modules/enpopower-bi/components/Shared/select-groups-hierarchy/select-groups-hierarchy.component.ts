import { Component, Input } from '@angular/core';
import { MenuItem, TreeNode } from 'primeng/api';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';
import { Clipboard } from '@angular/cdk/clipboard';
import { PowerBiController } from '../../../services/PowerBi.service';
import { GenerateQueryService } from '../../../services/generate-query.service';
import { AuthorizationController } from 'src/app/Modules/auth/services/Authorization.service';
import { SelectGroupsHierarchyService } from '../../../services/select-groups-hierarchy.service';


@Component({
  selector: 'app-select-groups-hierarchy',
  templateUrl: './select-groups-hierarchy.component.html',
  styleUrls: ['./select-groups-hierarchy.component.scss']
})
export class SelectGroupsHierarchyComponent {
  @Input() NameAr: string = '';
  PublicTrue: boolean = false;

  items: MenuItem[] = [];


  constructor(private msg: MsgsService, public selectGroupService: SelectGroupsHierarchyService,
    private clipboard: Clipboard, public generateQueryService: GenerateQueryService) { }

  ngOnInit() {
    this.selectGroupService.getMetaData();
  }


  ContextMenuSelect(ev: any) {
    this.selectGroupService.GroupsSelectedNode = ev.node
    this.items = [
      {
        label: 'Copy Name',
        icon: 'pi pi-copy',
        command: (event) => this.copy(ev)
      },
      {
        label: 'Add Child',
        icon: 'pi pi-pencil',
        command: (event) => this.addEditDelete(ev.node, true, false, false),
        disabled: ev.node.key.split('-')[0] == 'select'
      },
      {
        label: 'Edit',
        icon: 'pi pi-user-edit',
        command: (event) => this.addEditDelete(ev.node, false, true, false),
        disabled: ev.node.key.split('-')[0] == 'static'
      },
      {
        label: 'Delete',
        icon: 'pi pi-times',
        command: (event) => this.addEditDelete(ev.node, false, false, true),
        disabled: ev.node.key.split('-')[0] == 'group' && ev.node.children.length > 0 || ev.node.key.split('-')[0] == 'static',
      }
    ];
  }
  copy(value: any) {
    this.clipboard.copy(value.node.label)
  }
  addEditDelete(value: TreeNode, _add: boolean, _edit?: boolean, _delete?: boolean) {
    if (!_add && !_edit && !_delete) return;

    this.selectGroupService.GroupsSelectedNode = value;
    if (_add) {
      this.selectGroupService.dialogVisible = true;
    }
    else if (_edit) {
      this.selectGroupService.dialogVisible = true;

      if (this.selectGroupService.GroupsSelectedNode?.key?.split('-')[0] == 'group')
        this.selectGroupService.IsEditGroupNode = true
      else if (this.selectGroupService.GroupsSelectedNode?.key?.split('-')[0] == 'select')
        this.selectGroupService.IsEditSelectNode = true

      if (!this.selectGroupService.IsSaveNewSelect) {
        this.selectGroupService.frm.get('NameAr')?.patchValue(value.label)
        this.generateQueryService.generatedQuery = this.generateQueryService.generatedQuery.length == 0 || value.data != undefined ? value.data.selectQuery : '';
        this.generateQueryService.selectedSchema.schemA_NAME = 'GPA_USER';
      }

      this.selectGroupService.PublicTrue = (value.data.isPublic == 'Y' ? true : false)
      this.selectGroupService.ChartTrue = (value.data.isChart == 'Y' ? true : false)
    }
    else if (_delete) {
      if (this.selectGroupService.GroupsSelectedNode?.key?.split('-')[0] == 'select') {
        this.generateQueryService.generatedQuery = value.data != undefined ? value.data.selectQuery : '';
        this.msg.msgConfirm(` سيتم حذف ` + `<span style="color:blue;font-weight: bold;font-size:large;">${value.label} </span>,<br> نهائياً`, 'حذف')
          .then(result => {
            if (result == true) {
              this.selectGroupService.excuteGenericStatmentById(14, `${this.selectGroupService.GroupsSelectedNode.key?.split('-')[1]}`)
                .subscribe((success) => {
                  if (success) {
                    this.selectGroupService.getMetaData();
                    // this.selectGroupService.treeData = this.selectGroupService.deleteTreeNode(this.selectGroupService.treeData, this.selectGroupService.GroupsSelectedNode.key as string)
                  } else {
                    console.log(success)
                  }
                });
            }
          })
      } else if (this.selectGroupService.GroupsSelectedNode?.key?.split('-')[0] == 'group') {
        this.selectGroupService.excuteGenericStatmentById(15, `${this.selectGroupService.GroupsSelectedNode.key?.split('-')[1]}`)
          .subscribe((success) => {
            if (success) {
              this.selectGroupService.getMetaData();
            } else {
              console.log(success)
            }
          });
      }
    }
  }
  nodeSelection(event: any) {
    console.log(event)
    if (!this.selectGroupService.IsSaveNewSelect) {
      this.generateQueryService.generatedQuery = event.node.data != undefined ? event.node.data.selectQuery : '';
      this.generateQueryService.selectedSchema.schemA_NAME = 'GPA_USER';
      // this.selectGroupService.frm.get('NameAr')?.patchValue(event.node.label)
    } else {
    }
  }
  nodeUnselection(event: any) {
    console.log('UnSelected', event.node)
  }
  onNodeDrop(event: any) {
    const { dragNode, dropNode } = event;
    console.log('event', event)

    if (!this.validateDrop(dragNode, dropNode)) {
      this.msg.msgError('خطأ في السحب', 'غير مسموح بهذا الإجراء', true);
      event.reject();
      return;
    }
    if ((dragNode?.draggable && dropNode?.droppable) && (dragNode.parent != dropNode)) {
      event.accept();
      // this.UpdateStatement(`update UA_SWB_SIDE_BAR t set SB_SUB_ID = '${dropNode.key}' where t.SB_ID = ${dragNode.key}`);
    }
  }
  private validateDrop(dragNode: TreeNode, dropNode: TreeNode): boolean {
    const sameParent = this.findRootParent(dragNode) === this.findRootParent(dropNode);
    const validTypes = (dragNode.type !== dropNode.type) || (dragNode.type === dropNode.type && dragNode.type === 'MENU');
    const _validSameParent = dragNode.parent?.key !== dropNode.key;
    const _validAllowedMenu = dragNode.type !== 'PARENT';
    return sameParent && validTypes && _validSameParent && _validAllowedMenu;
  }
  findRootParent(node: TreeNode): TreeNode | '' {
    for (const appNode of this.selectGroupService.treeData) {
      if (appNode === node) return appNode;

      if (appNode.children) {
        for (const roleNode of appNode.children) {
          if (roleNode === node) return appNode;

          // Check if the node exists anywhere in the roleNode's subtree
          if (this.isNodeInSubtree(roleNode, node)) {
            return appNode;
          }
        }
      }
    }
    return ''; // Node not found
  }
  private isNodeInSubtree(parent: TreeNode, target: TreeNode): boolean {
    if (parent === target) return true;
    if (parent.children) {
      for (const child of parent.children) {
        if (this.isNodeInSubtree(child, target)) {
          return true;
        }
      }
    }
    return false;
  }
  filterText: string = ''
  isFilterMatch(label?: string): boolean {
    return this.filterText && label?.toLowerCase().includes(this.filterText.toLowerCase()) || false;
  }
  getNodeSymbol(sbType: string | undefined): string {
    switch (sbType) {
      case 'PARENT': return 'pi pi-folder';  // Folder icon
      case 'MENU': return 'pi pi-bars';     // Menu icon
      case 'ITEM': return 'pi pi-file';     // File icon
      case 'PRIV': return 'pi pi-lock';     // Lock icon
      default: return ''; // Fallback icon
    }
  }
}
