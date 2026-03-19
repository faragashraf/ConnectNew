import { Component } from '@angular/core';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';
import { MenuItem, TreeDragDropService } from 'primeng/api';
import { Clipboard } from '@angular/cdk/clipboard';
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { PowerBiController } from 'src/app/Modules/enpopower-bi/services/PowerBi.service';
import { firstValueFrom } from 'rxjs';
import { AuthorizationController, SwbPrivilege } from 'src/app/Modules/auth/services/Authorization.service';
import { AuthObjectsService, TreeNode } from 'src/app/shared/services/helper/auth-objects.service';

export interface UaFunction {
  functionIntId: number;
  functionName: string | undefined;
}
// export interface TreeNode<T = any> {
//   label?: string;
//   data?: T;
//   icon?: string;
//   expandedIcon?: any;
//   collapsedIcon?: any;
//   children?: TreeNode<T>[];
//   leaf?: boolean;
//   expanded?: boolean;
//   type?: string;
//   parent?: TreeNode<T>;
//   partialSelected?: boolean;
//   style?: string;
//   styleClass?: string;
//   draggable?: boolean;
//   droppable?: boolean;
//   selectable?: boolean;
//   key?: string;
// }

@Component({
  selector: 'app-side-bar-hierarchy',
  templateUrl: './side-bar-hierarchy.component.html',
  styleUrls: ['./side-bar-hierarchy.component.scss'],
  providers: [TreeDragDropService]
})
export class SideBarHierarchyComponent {
  treeData: TreeNode[] = []
  selectedNode: TreeNode = {} as TreeNode
  items: MenuItem[] = [];

  dialogVisible: boolean = false;
  frm!: FormGroup


  Header: string = ''
  _ngClass: string = ''
  sideBarType: any = ['PARENT', 'MENU', 'ITEM', 'PRIV'];

  sideBarTypeSelected: any = '';
  functions: UaFunction[] = []
  function: UaFunction = {} as UaFunction
  constructor(private spinner: SpinnerService, private msg: MsgsService, private autorization: AuthorizationController,
    private clipboard: Clipboard, private fb: FormBuilder, private powerBiController: PowerBiController, private authObjectsService:AuthObjectsService) { }

  onsideBarTypeSelected(event: any) {
    if (event.value != 'ITEM') {
      this.frm.get('sbRoute')?.patchValue(null)
      this.frm.get('sbRoute')?.clearValidators();
      if (event.value == 'PRIV') {
        this.frm.get('sbRoute')?.patchValue(null)
        this.frm.get('sbRoute')?.clearValidators();
        this.frm.get('functionIntId')?.addValidators([Validators.required]);
        this.frm.get('functionName')?.addValidators([Validators.required]);
      } else {
        this.frm.get('functionIntId')?.patchValue(null)
        this.frm.get('functionName')?.patchValue(null)
        this.frm.get('sbRoute')?.clearValidators();
        this.frm.get('functionIntId')?.clearValidators();
        this.frm.get('functionName')?.clearValidators();
      }
    } else {
      this.frm.get('sbRoute')?.addValidators([Validators.required]);
      this.frm.get('functionIntId')?.addValidators([Validators.required]);
      this.frm.get('functionName')?.addValidators([Validators.required]);
    }
    this.DisableNotRequiredControls(false);
  }
  onChangeFncID() {
    this.function = this.functions.find(f => f.functionIntId == this.frm.get('functionIntId')?.value) as UaFunction
  }
  onFunctionelected(event: any) {
    this.frm.get('functionIntId')?.patchValue(event.value.functionIntId);
  }

  ngOnInit(): void {
    this.GetEnpoStructure()
    this.GetFunctions();
    this.initForm();
  }
  initForm() {
    this.frm = this.fb.group({
      sbId: ['', Validators.required],
      sbSubId: [''],
      itemName: ['', Validators.required],
      sbRoute: [''],
      functionIntId: [''],
      functionName: [''],
      sbType: [null, Validators.required],
      sbApplicationId: ['', Validators.required]
    })
    this.sideBarType = ['PARENT', 'MENU', 'ITEM', 'PRIV'];
  }
  swbPrivilege: SwbPrivilege[] = []
  GetEnpoStructure() {
    this.spinner.show('جاري تحميل البيانات ...');
    this.autorization.getSideBarMenu()
      .subscribe({
        next: (resp) => {
          if (resp.isSuccess) {
            this.swbPrivilege = resp.data
            console.log('this.swbPrivilege', this.swbPrivilege)
            this.treeData = this.transformToTree(this.swbPrivilege)
            console.log('this.treeData', this.treeData)
          }
          else {
            
            let errr = '';
            resp.errors?.forEach(e => errr += e.message + "<br>");
            this.msg.msgError(errr, "هناك خطا ما", true);
          }
          
        },
        error: (error) => {
          console.log(error.message);
          
          this.msg.msgError(error, "هناك خطا ما", true);
        },
        complete: () => {
          console.log(' Complete');
        }
      }
      );

  }

  nodeSelection(event: any) {
    console.log('Selected', event.node)
  }
  nodeUnselection(event: any) {
    console.log('UnSelected', event.node)

  }

  transformToTree(privileges: SwbPrivilege[]): TreeNode<SwbPrivilege>[] {
    // Group by application first
    const appsMap = new Map<string, SwbPrivilege[]>();
    privileges.forEach(priv => {
      const appId = priv.sbApplicationId || 'undefined';
      if (!appsMap.has(appId)) appsMap.set(appId, []);
      appsMap.get(appId)!.push(priv);
    });

    const tree: TreeNode<SwbPrivilege>[] = [];

    appsMap.forEach((appPrivs, appId) => {
      // Create application node
      const appNode: TreeNode<SwbPrivilege> = {
        key: appId,
        label: appId,
        expanded: false,
        children: [],
        data: undefined,
        icon: 'pi pi-th-large'
      };
      // Create map for quick lookup and parent-child relationships
      const nodeMap = new Map<number, TreeNode<SwbPrivilege>>();

      // First pass: Create all nodes
      appPrivs.forEach(priv => {
        const node: TreeNode<SwbPrivilege> = {
          key: `${priv.sbId}`,
          label: `${priv.itemName}`,
          data: priv,
          expanded: false,
          leaf: priv.sbType === 'ITEM' || priv.sbType === 'PRIV',
          type: priv.sbType,
          children: [],
          icon: this.getNodeSymbol(priv.sbType),
          draggable: (priv.sbType === 'ITEM' || priv.sbType === 'MENU' || priv.sbType === 'PRIV') ? true : false,
          droppable: (priv.sbType === 'PARENT' || priv.sbType === 'MENU') ? true : false
        };
        nodeMap.set(priv.sbId, node);
      });

      // Second pass: Build hierarchy
      appPrivs.forEach(priv => {
        const node = nodeMap.get(priv.sbId)!;
        const parentId = priv.sbSubId;

        // Check if parentId is provided (including 0)
        if (parentId !== null && parentId !== undefined) {
          const parent = nodeMap.get(parentId);
          if (parent) {
            parent.children = parent.children || [];
            parent.children.push(node);
          }
        } else {
          // Add to application node if it's a PARENT type or root menu
          if (priv.sbType === 'PARENT') {
            appNode.children!.push(node);
          }
        }
      });

      // Sort application children by SB_ID
      // appNode.children!.sort((a, b) => parseInt(a.key!) - parseInt(b.key!));
      tree.push(appNode);
    });
console.log(tree)
    return tree;
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
  filterText: string = ''
  isFilterMatch(label?: string): boolean {
    return this.filterText && label?.toLowerCase().includes(this.filterText.toLowerCase()) || false;
  }
  ContextMenuSelect(ev: any) {
    this.selectedNode = ev.node
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
        disabled: ev.node.type == 'ITEM' || ev.node.type === 'PRIV'
      },
      {
        label: 'Edit',
        icon: 'pi pi-user-edit',
        command: (event) => this.addEditDelete(ev.node, false, true, false),
        disabled: ev.node.parent == undefined
      },
      {
        label: 'Delete',
        icon: 'pi pi-times',
        command: (event) => this.addEditDelete(ev.node, false, false, true),
        disabled: ev.node.parent == undefined
      }
    ];
  }
  copy(value: any) {
    this.clipboard.copy(value.node.label)
  }
  // Add these properties to track context

  isSubmitting = false;
  IsEdit: boolean = false;
  // Modified method to handle actions
  addEditDelete(value: TreeNode, _add: boolean, _edit?: boolean, _delete?: boolean) {
    if (!_add && !_edit && !_delete) return;

    this.selectedNode = value;
    if (_add) {
      this.prepareItem(value, 'create');
    }
    else if (_edit) {
      this.prepareItem(value, 'EDIT');
    }
    else if (_delete) {
      if (value.data != undefined) {
        if (value.children && value.children?.length > 0) {
          let type = value.type == 'PARENT' ? "المجلد" : value.type == 'MENU' ? 'القائمة' : ''
          this.msg.msgInfo(`${type} يحتوى على مكونات فرعية` + `<span style="color:blue;font-weight: bold;font-size:x-large;">${value.label} </span> <br> يرجى حذفها أولاً أو نقلها لمجلد آخر `, 'تحذير', 'error')
        } else {
          // this.msg.msgConfirm(`${type} يحتوى على مكونات فرعية` + `<span style="color:blue;font-weight: bold;font-size:large;">${value.label} </span>,<br> يرجى حذفها أولاً أو نقلها لمجلد آخر  <span style="color:green;font-weight: bold;font-size:large;">${value.children.length} </span> أيضاً`, 'حذف')
          //   .then(result => {
          //     if (result == true) {
          //       this.UpdateStatement(`DELETE FROM UA_SWB_SIDE_BAR WHERE SB_ID = ${value.key}`);
          //     }
          //   })
          this.excuteGenericStatmentById(9, `${value.key}`);
        }
      }
    }
  }

  private prepareItem(node: TreeNode, action: string) {
    this.initForm();
    if (action === 'EDIT') {
      this.IsEdit = true;
      this.setFormValues(node, false)
      this._ngClass = this.getNodeSymbol(this.frm.get('sbType')?.value)
      this.Header = node.data.sbId + ' - ' + node.data.itemName;
      this.SetValidators(node, false);
    } else {
      this.IsEdit = false;
      this.setFormValues(node, true)
      this.SetValidators(node, true);
    }
    this.dialogVisible = true;
  }
  setFormValues(node: TreeNode<SwbPrivilege>, isNew: boolean) {
    if (isNew) {
      if (node.data == undefined) {
        this.frm.get('sbApplicationId')?.patchValue(node.key);
        this.sideBarType = ['PARENT'];
        this.frm.get('sbId')?.patchValue(this.GetMaxId('PARENT'));
        this.frm.get('sbType')?.patchValue('PARENT');
      } else if (node.data?.sbType == 'PARENT') {
        this.frm.get('sbApplicationId')?.patchValue(node.data.sbApplicationId);
        this.frm.get('sbId')?.patchValue(this.GetMaxId('MENU'));
        this.sideBarType = ['MENU']
        this.frm.get('sbType')?.patchValue('MENU');
        this.frm.get('sbSubId')?.patchValue(node.key);
      } else if (node.data?.sbType == 'MENU') {
        this.frm.get('sbApplicationId')?.patchValue(node.data.sbApplicationId);
        this.frm.get('sbId')?.patchValue(this.GetMaxId('ITEM'));
        this.sideBarType = ['ITEM', 'PRIV'];
        this.frm.get('sbSubId')?.patchValue(node.key);
      }
    } else {
      this.frm.patchValue(node.data as SwbPrivilege)
      this.sideBarTypeSelected = (node.data?.sbType != undefined && node.data?.sbType.length > 0) ? node.data?.sbType : null;
      this.frm.get('functionIntId')?.patchValue(node.data?.functionIntId);
      this.function = this.functions.find(f => f.functionIntId == node.data?.functionIntId) as UaFunction
    }
  }
  SetValidators(node: TreeNode<SwbPrivilege>, isNew: boolean) {
    if (isNew) {
      if (node.data == undefined) {
        this.sideBarType = ['PARENT'];
        this.frm.get('sbSubId')?.clearValidators();
        this.frm.get('sbRoute')?.clearValidators();
        this.frm.get('functionIntId')?.clearValidators();
        this.frm.get('functionName')?.clearValidators();
      } else if (node.data?.sbType == 'PARENT') {
        this.frm.get('sbSubId')?.addValidators([Validators.required]);
        this.frm.get('sbRoute')?.clearValidators();
        this.frm.get('functionIntId')?.clearValidators();
        this.frm.get('functionName')?.clearValidators();
      } else if (node.data?.sbType == 'MENU') {
        this.frm.get('sbRoute')?.addValidators([Validators.required]);
        this.frm.get('functionIntId')?.addValidators([Validators.required]);
        this.frm.get('functionName')?.addValidators([Validators.required]);
        this.frm.get('sbSubId')?.addValidators([Validators.required]);
      }
    } else {
      if (node.data?.sbType == 'PARENT') {
        this.frm.get('sbSubId')?.addValidators([Validators.required]);
        this.frm.get('sbRoute')?.clearValidators();
        this.frm.get('functionIntId')?.clearValidators();
        this.frm.get('functionName')?.clearValidators();
      } else if (node.data?.sbType == 'MENU') {
        this.frm.get('sbSubId')?.addValidators([Validators.required]);
        this.frm.get('sbRoute')?.clearValidators();
        this.frm.get('functionIntId')?.clearValidators();
        this.frm.get('functionName')?.clearValidators();
      }
      else if (node.data?.sbType == 'ITEM' || node.data?.sbType == 'PRIV') {
        this.frm.get('sbSubId')?.addValidators([Validators.required]);
        this.frm.get('sbRoute')?.addValidators([Validators.required]);
        this.frm.get('functionIntId')?.addValidators([Validators.required]);
        this.frm.get('functionName')?.addValidators([Validators.required]);
        this.frm.get('sbSubId')?.addValidators([Validators.required]);
      }
    }

    this.DisableNotRequiredControls(isNew)
    this.frm.get('sbId')?.disable();
    this.frm.get('sbSubId')?.disable();
  }
  DisableNotRequiredControls(isNew: boolean = false) {
    let inputControlsOnly = ['sbId', 'sbSubId', 'itemName', 'sbRoute', 'functionIntId', 'sbApplicationId'];

    Object.values(this.frm.controls).forEach(control => {
      control.updateValueAndValidity({ emitEvent: false });

      const validators = control.validator ? control.validator({} as any) : null;
      const isRequired = validators?.['required'] !== undefined;
      const isEmpty = control.value === null || control.value === '';

      if (!(control instanceof FormControl)) return;

      if (isRequired && !isEmpty && isNew && inputControlsOnly.includes(Object.keys(this.frm.controls).find(key => this.frm.controls[key] === control) || '')) {
        control.disable({ emitEvent: false });
      } else if (!isRequired && !isNew) {
        control.disable({ emitEvent: false });
      } else if (!isRequired && isEmpty && inputControlsOnly.includes(Object.keys(this.frm.controls).find(key => this.frm.controls[key] === control) || '')) {
        control.disable({ emitEvent: false });
      } else if (!isRequired && isEmpty) {
        control.disable({ emitEvent: false });
      } else {
        control.enable({ emitEvent: false });
      }

    });
  }
  GetMaxId(targetMax: string): number {
    let maxtId: number = -1;
    if (targetMax == 'ITEM' || targetMax === 'PRIV') {
      maxtId = this.swbPrivilege
        .filter(item => (item.sbType === 'ITEM' || item.sbType === 'PRIV') && item.sbId != null)
        .reduce((max, item) => Math.max(max, item.sbId), -1);
    }
    else {
      maxtId = this.swbPrivilege
        .filter(item => item.sbType === targetMax && item.sbId != null)
        .reduce((max, item) => Math.max(max, item.sbId), -1);
    }
    return maxtId + 1;
  }
  // Form submission handler
  async submit() {
    if (this.frm.invalid || this.isSubmitting) return;
    this.isSubmitting = true;

    try {
      if (this.IsEdit) {
        if (this.frm.get('functionIntId')?.value != null) {
          this.excuteGenericStatmentById(10, `${this.frm.get('itemName')?.value}|${this.frm.get('sbRoute')?.value}|${this.frm.get('functionIntId')?.value}|${this.frm.get('sbType')?.value}|${this.frm.get('sbId')?.value}`)
            .then(result => {
              if (result) {
                // Update tree node
                this.updateTreeNodeBySbId(this.frm.get('sbId')?.value, this.frm.getRawValue());
              }
            });

        }
        else
          this.excuteGenericStatmentById(11, `${this.frm.get('itemName')?.value}|${this.frm.get('sbRoute')?.value}|${this.frm.get('sbType')?.value}|${this.frm.get('sbId')?.value}`)
            .then(result => {
              if (result) {
                this.updateTreeNodeBySbId(this.frm.get('sbId')?.value, this.frm.getRawValue());
              }
            });
      } else {
        this.excuteGenericStatmentById(12, `${this.frm.get('sbId')?.value}|${this.frm.get('sbSubId')?.value}|${this.frm.get('itemName')?.value}|${this.frm.get('sbRoute')?.value}|${this.frm.get('functionIntId')?.value}|${this.frm.get('sbType')?.value}|${this.frm.get('sbApplicationId')?.value}`);
      }
      this.dialogVisible = false;
      this.refreshTreeData(); // Implement your data refresh logic
    } catch (error) {
      this.handleError(error); // Implement error handling
    } finally {
      this.isSubmitting = false;
    }
  }
  private updateTreeNodeBySbId(sbId: number, newData: Partial<SwbPrivilege>) {
    const updateNode = (nodes: TreeNode<SwbPrivilege>[]) => {
      for (const node of nodes) {
        if (node.data && node.data.sbId === sbId) {
          // Update all relevant properties
          Object.assign(node.data, newData);
          node.label = newData.itemName ?? node.label;
          node.type = newData.sbType ?? node.type;
          this.frm.reset();

          // ...add more if needed
          return true;
        }
        if (node.children && updateNode(node.children)) {
          return true;
        }
      }
      return false;
    };
    updateNode(this.treeData);
  }
  refreshTreeData() {
    throw new Error('Method not implemented.');
  }
  handleError(error: unknown) {
    throw new Error('Method not implemented.');
  }

  async onNodeDrop(event: any) {
    const { dragNode, dropNode } = event;
    console.log('event', event)

    if (!this.validateDrop(dragNode, dropNode)) {
      this.msg.msgError('خطأ في السحب', 'غير مسموح بهذا الإجراء', true);
      event.reject();
      return;
    }
    if ((dragNode?.draggable && dropNode?.droppable) && (dragNode.parent != dropNode)) {

      const result = await this.excuteGenericStatmentById(13, `${dropNode.key}|${dragNode.key}`);
      if (result) {
        event.accept();
      } else {
        event.Cancel();
      }
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
    for (const appNode of this.treeData) {
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

  async excuteGenericStatmentById(number: number, parameters?: string): Promise<boolean> {
    this.spinner.show('جاري تحميل البيانات ...');
    try {
      const resp = await firstValueFrom(this.powerBiController.excuteGenericStatmentById(number, parameters));
      if (resp.isSuccess) {
        this.msg.msgSuccess(resp.data as string);
        
        return true;
      } else {
        
        let errr = '';
        resp.errors?.forEach(e => errr += e.message + "<br>");
        this.msg.msgError(errr, "هناك خطا ما", true);
        return false;
      }
    } catch (error: any) {
      console.log(error.message);
      
      this.msg.msgError(error, "هناك خطا ما", true);
      return false;
    }
  }
  GetFunctions() {
    this.spinner.show('جاري تحميل البيانات ...');
    this.autorization.getAllFunctions()
      .subscribe({
        next: (resp) => {
          if (resp.isSuccess) {
            this.functions = resp.data.map(item => ({
              functionIntId: item.functionIntId,
              functionName: item.functionName
            }));
          }
          else {
            
            let errr = '';
            resp.errors?.forEach(e => errr += e.message + "<br>");
            this.msg.msgError(errr, "هناك خطا ما", true);
          }
          
        },
        error: (error) => {
          console.log(error.message);
          
          this.msg.msgError(error, "هناك خطا ما", true);
        },
        complete: () => {
          console.log(' Complete');
        }
      }
      );
  }
}
