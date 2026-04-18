import { Component } from '@angular/core';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';
import { AuthorizationController, RoleHierarchy, RoleMasterAddDto, UaFunction } from 'src/app/Modules/auth/services/Authorization.service';
import { MenuItem, TreeDragDropService } from 'primeng/api';
import { Clipboard } from '@angular/cdk/clipboard';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PowerBiController } from 'src/app/Modules/enpopower-bi/services/PowerBi.service';
import { GenerateQueryService } from 'src/app/Modules/enpopower-bi/services/generate-query.service';


interface TreeNode {
  label: string;
  data?: {
    applicationId?: string;
    roleId?: string;
    roleNameEn?: string;
    roleNameAr?: string;
    functionIntId?: number;
    functionName?: string;
  };
  children?: TreeNode[];
  expanded?: boolean;
  type: string;
  draggable: boolean;
  droppable: boolean;
  parent?: TreeNode
}

@Component({
  selector: 'app-role-hierarchy',
  templateUrl: './role-hierarchy.component.html',
  styleUrls: ['./role-hierarchy.component.scss'],
  providers: [TreeDragDropService]
})
export class RoleHierarchyComponent {
  private readonly userRolesByUserIdStatementId = 68;
  treeData: TreeNode[] = []
  selectedNode: TreeNode = {} as TreeNode
  items: MenuItem[] = [];

  header: string = '';
  _label: string = '';
  dialogVisible: boolean = false;
  dialogAssignUserVisible: boolean = false;
  frm!: FormGroup

  userName: string = '';
  showValidateButton: boolean = false;
  private readonly refreshActionIds = new Set([4, 5, 6, 7, 8, 25]);
  constructor(private spinner: SpinnerService, private msg: MsgsService, private autorization: AuthorizationController,
    public generateQueryService: GenerateQueryService, private clipboard: Clipboard, private fb: FormBuilder, private powerBiController: PowerBiController) {
    this.generateQueryService.duration = 0;

  }
  ngOnInit(): void {
    this.GetEnpoStructure()
    this.frm = this.fb.group({
      NameAr: ['', Validators.required],
    })
  }
  roleHierarchy: RoleHierarchy[] = []
  onPageChange(event: any) {
    const page = event.page + 1; // Page index starts at 0
    const pageSize = event.rows;
    // Call your API here with `page` and `pageSize`
  }
  GetEnpoStructure() {
    this.spinner.show('جاري تحميل البيانات ...');
    this.autorization.getRoleHierarchy()
      .subscribe({
        next: (resp) => {
          if (resp.isSuccess) {
            this.roleHierarchy = resp.data
            this.treeData = this.transformToTree(this.roleHierarchy)
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
  itemData: any[] = [];
  item_columns: string[] = [];
  userIdSearch = '';
  userRolesData: any[] = [];
  userRolesColumns: string[] = [];
  nodeSelection(event: any) {
    this.selectedNode = event.node;
    this.itemData = [];
    this.item_columns = [];
    if (event.node.type == "Role") {
      this.spinner.show('جاري تحميل البيانات ...');
      const startTime = Date.now();
      this.powerBiController.getGenericDataById(23, event.node.data.roleId)
        .subscribe({
          next: (resp) => {
            if (resp.isSuccess) {
              
              this.itemData = resp.data as any[]
              if (this.itemData.length > 0) {
                this.item_columns = Object.keys((resp.data as any[])[0]);
              }
              this.generateQueryService.duration = (Date.now() - startTime) / 1000;
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
  nodeUnselection(event: any) {
    console.log('UnSelected', event.node)

  }
  onselectItemEvent(event: any) {
    console.log(event)
  }
  searchUserRolesByUserId() {
    const userId = this.userIdSearch?.trim();
    const applicationId = this.getSelectedApplicationId();
    this.userRolesData = [];
    this.userRolesColumns = [];

    if (!userId) {
      this.msg.msgError('برجاء إدخال رقم المستخدم', 'تنبيه');
      return;
    }
    if (!applicationId) {
      this.msg.msgError('برجاء اختيار عقدة من الشجرة لتحديد رقم التطبيق', 'تنبيه');
      return;
    }

    this.spinner.show('جاري تحميل البيانات ...');
    const startTime = Date.now();
    this.powerBiController.getGenericDataById(this.userRolesByUserIdStatementId, `${userId}|${applicationId}`)
      .subscribe({
        next: (resp) => {
          if (resp.isSuccess) {
            const rows = (resp.data as any[]) || [];
            this.userRolesData = rows.map(row => ({
              ...row,
              ROLE_NAME_EN: row?.ROLE_NAME_EN || row?.ROLE_NAME_AR || ''
            }));
            if (this.userRolesData.length > 0) {
              this.userRolesColumns = Object.keys(this.userRolesData[0]);
            }
            this.generateQueryService.duration = (Date.now() - startTime) / 1000;
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
      });
  }
  transformToTree(data: RoleHierarchy[]): TreeNode[] {
    const treeMap = new Map<string, TreeNode>();

    // Group by application
    data.forEach(item => {
      const appId = item.applicationId || 'unknown';
      const roleId = item.roleId || 'unknown';

      // Create application node if not exists
      if (!treeMap.has(appId)) {
        treeMap.set(appId, {
          label: `Application: ${appId}`,
          data: { applicationId: appId },
          children: [],
          expanded: false,
          type: 'Application',
          draggable: true,
          droppable: true,
        });
      }

      const applicationNode = treeMap.get(appId)!;

      // Find or create role node
      let roleNode = applicationNode.children?.find(n =>
        n.data?.roleId === roleId
      );
      applicationNode.label = applicationNode.label
      if (!roleNode) {
        roleNode = {
          label: `${item.roleId} / ${item.roleNameAr}`,
          data: {
            applicationId: appId,
            roleId: roleId,
            roleNameEn: item.roleNameEn,
            roleNameAr: item.roleNameAr
          },
          children: [],
          expanded: false,
          type: 'Role',
          draggable: true,
          droppable: true,
        };
        applicationNode.children!.push(roleNode);
      }

      if (item.functionName != null) {
        // Add function node
        const functionNode: TreeNode = {
          label: `${item.functionName} / ${item.functionIntId}`,
          data: {
            applicationId: appId,
            functionIntId: item.functionIntId,
            functionName: item.functionName
          },
          type: 'Function',
          draggable: true,
          droppable: false,
        };
        roleNode.children!.push(functionNode);
      }
    });

    return Array.from(treeMap.values());
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
        disabled: ev.node.type == 'Function'
      },
      {
        label: 'Edit',
        icon: 'pi pi-user-edit',
        command: (event) => this.addEditDelete(ev.node, false, true, false),
        disabled: ev.node.type == 'Application'
      },
      {
        label: 'Delete',
        icon: 'pi pi-times',
        command: (event) => this.addEditDelete(ev.node, false, false, true),
        disabled: ev.node.type == 'Application'
      }, {
        label: 'Assign To User',
        icon: 'pi pi-user-plus',
        command: (event) => this.assign(ev.node),
        disabled: ev.node.type != 'Role'
      }
    ];
  }
  assign(value: TreeNode): void {
    this.selectedNode = value;
    console.log(this.selectedNode)
    this.prepareAssignRole(value.data?.roleId as string, 'Validate');
  }
  copy(value: any) {
    this.clipboard.copy(value.node.label)
  }
  // Add these properties to track context
  currentAction: string = '';
  currentParentId: string | null = null;
  isSubmitting = false;
  isValidated = false;

  // Modified method to handle actions
  addEditDelete(value: TreeNode, _add: boolean, _edit?: boolean, _delete?: boolean) {
    if (!_add && !_edit && !_delete) return;

    this.selectedNode = value;
    if (value.type === 'Application') {
      if (_add) {
        this.prepareRole(value.data?.applicationId as string, 'createRole');
      }
    } else if (value.type === 'Role') {
      if (_add) {
        this.prepareFunction(value.data?.roleId as string, 'insertFunction');
      } else if (_edit) {
        this.prepareRole(value.data?.roleId as string, 'UpdateRole');
        this.frm.get('NameAr')?.patchValue(value.data?.roleNameAr)
      } else if (_delete) {
        this.msg.msgConfirm(`هل تريد حذف الرول ` + `<span style="color:blue;font-weight: bold;font-size:large;">${value.data?.roleNameAr} </span>`, 'حذف')
          .then(result => {
            if (result == true) {
              this.excuteGenericStatmentById(4, value.data?.roleId);
            }
          })
      }
    } else if (value.type === 'Function') {
      if (_edit) {
        this.prepareFunction(value.data?.functionIntId, 'UpdateFunction');
        this.frm.get('NameAr')?.patchValue(value.data?.functionName)
      }
      if (_delete) {
        this.msg.msgConfirm(`سيؤدي حذف الوظيفة ` + `<span style="color:blue;font-weight: bold;font-size:large;">${value.data?.functionName} </span>,<br> إلى حذف انتمائها إلى الرول <span style="color:green;font-weight: bold;font-size:large;">${value.parent?.data?.roleNameAr} </span> أيضاً`, 'حذف')
          .then(result => {
            if (result == true) {
              this.excuteGenericStatmentById(5, `${value.data?.functionIntId}|${value.parent?.data?.roleId}|${value.data?.functionIntId}`);
            }
          })
      }
    }
  }

  private prepareRole(applicationId: string, action: string) {
    this.resetDialogState();
    this.currentAction = action;
    this.currentParentId = applicationId;
    this.header = "برجاء ادخال اسم الصلاحية";
    this._label = "اسم الصلاحية";
    this.showValidateButton = false;
    this.dialogVisible = true;
  }

  private prepareFunction(roleId: any, action: string) {
    this.resetDialogState();
    this.currentAction = action;
    this.currentParentId = roleId;
    this.header = "برجاء ادخال اسم الوظيفة";
    this._label = "اسم الوظيفة";
    this.showValidateButton = false;
    this.dialogVisible = true;
  }
  private prepareAssignRole(applicationId: string, action: string) {
    this.resetDialogState();
    this.currentAction = action;
    this.currentParentId = applicationId;
    this.header = "إضافة صلاحية باسم " + this.selectedNode.label;
    this._label = "اسم المستخدم";
    this.userName = '';
    this.showValidateButton = true;
    this.dialogVisible = true;
  }
  private resetDialogState() {
    this.frm?.reset();
    this.userName = '';
    this.isValidated = false;
  }
  // Form submission handler
  async submit() {
    if (this.frm.invalid || this.isSubmitting) return;
    this.isSubmitting = true;

    try {
      const name = this.frm.value.NameAr;

      if (this.currentAction === 'createRole' && this.currentParentId) {
        await this.createRole(this.currentParentId, name);
      }
      else if (this.currentAction === 'insertFunction' && this.currentParentId) {
        await this.insertFunctionNewToRole(this.currentParentId, name);
      } else if (this.currentAction === 'UpdateRole' && this.currentParentId) {
        const roleNameEn = this.selectedNode.data?.roleNameEn || this.frm.get('NameAr')?.value;
        await this.excuteGenericStatmentById(6, `${this.frm.get('NameAr')?.value}|${roleNameEn}|${localStorage.getItem('UserId')}|${this.currentParentId}`);
      } else if (this.currentAction === 'UpdateFunction' && this.currentParentId) {
        await this.excuteGenericStatmentById(7, `${this.frm.get('NameAr')?.value}|${localStorage.getItem('UserId')}|${this.currentParentId}`);
      } else if (this.currentAction === 'Validate' && this.currentParentId) {
        await this.excuteGenericStatmentById(25, `${this.frm.get('NameAr')?.value}|${this.selectedNode.data?.roleId}|${localStorage.getItem('UserId')}|${localStorage.getItem('UserId')}`);
      }
      this.dialogVisible = false;
    } catch (error) {
      this.handleError(error);
    } finally {
      this.isSubmitting = false;
    }
  }
  ValidateUser() {
    this.spinner.show('جاري تحميل البيانات ...');
    this.powerBiController.getGenericDataById(26, `${this.frm.get('NameAr')?.value}|${this.selectedNode.data?.roleId}`)
      .subscribe({
        next: (resp) => {
          
          if (resp.isSuccess) {
            let _user = resp.data as any[]
            if (resp.data?.length == 0) {
              this.dialogVisible = false;
              this.msg.msgError('لم يتم العثور على المستخدم <br> يرجى التحقق من اسم المستخدم', 'تحذير', true);
              return;
            }
            if (_user[0].ROLE_ID && _user[0].ROLE_ID.length > 0) {
              this.dialogVisible = false;
              this.msg.msgError(`صلاحية ${this.selectedNode.data?.roleNameAr} لدى المستخدم بالفعل`, `تحذير`);
              return;
            }
            this.userName = _user[0].ARABIC_NAME;
            this.isValidated = true;
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
          // this.dialogVisible = false;
        }
      }
      );
  }
  refreshTreeData() {
    this.GetEnpoStructure();
  }
  handleError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error ?? '');
    this.msg.msgError(message, "هناك خطا ما", true);
  }

  roleMasterAddDto: RoleMasterAddDto = {} as RoleMasterAddDto
  async createRole(roleId: string, name: string) {
    this.roleMasterAddDto.applicationId = roleId
    this.roleMasterAddDto.roleId = ''
    this.roleMasterAddDto.roleId = ''
    this.roleMasterAddDto.roleNameAr = name
    this.roleMasterAddDto.roleNameEn = name

    this.msg.msgConfirm(`سيتم انشاء رول باسم ` + `<span style="color:blue;font-weight: bold;font-size:large;">${this.roleMasterAddDto.roleNameAr} </span>,<br> تحت تطبيق <span style="color:green;font-weight: bold;font-size:large;">${this.selectedNode?.data?.applicationId} </span> `, 'انشاء')
      .then(async result => {
        if (result == true) {
          this.spinner.show('جاري تحميل البيانات ...');
          await this.autorization.createRole(this.roleMasterAddDto)
            .subscribe({
              next: (resp) => {
                if (resp.isSuccess) {
                  this.msg.msgSuccess(resp.data as string)
                  this.refreshTreeData();
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
      })

  }
  uaFunction: UaFunction = {} as UaFunction
  async insertFunctionNewToRole(roleId: string, name: string) {
    this.uaFunction.functionName = name

    this.msg.msgConfirm(`سيتم انشاء وظيفة باسم ` + `<span style="color:blue;font-weight: bold;font-size:large;">${this.uaFunction.functionName} </span>,<br> تحت رول <span style="color:green;font-weight: bold;font-size:large;">${this.selectedNode?.data?.roleNameAr} </span> `, 'انشاء')
      .then(async result => {
        if (result == true) {
          this.spinner.show('جاري تحميل البيانات ...');
          await this.autorization.insertFunctionNewToRole(roleId, this.uaFunction)
            .subscribe({
              next: (resp) => {
                if (resp.isSuccess) {
                  this.msg.msgSuccess(resp.data as string)
                  this.refreshTreeData();
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
      })
  }

  onNodeDrop(event: any) {
    const { dragNode, dropNode, dropIndex } = event;
    console.log('event', event)

    if (!this.validateDrop(dragNode, dropNode)) {
      this.msg.msgError('خطأ في السحب', 'غير مسموح بهذا الإجراء', true);
      event.reject();
      return;
    }
    if ((dragNode?.draggable && dropNode?.droppable) && (dragNode.parent != dropNode)) {
      event.accept();
      this.excuteGenericStatmentById(8, `${dropNode.data?.roleId}|${localStorage.getItem('UserId')}|${dragNode.data?.functionIntId}`);
      // draggedNode.draggable = false
    }
  }
  private validateDrop(dragNode: TreeNode, dropNode: TreeNode): boolean {
    const sameParent = this.findRootParent(dragNode) === this.findRootParent(dropNode);
    const validTypes = dragNode.type === 'Function' && dropNode.type === 'Role';

    return sameParent && validTypes;
  }
  findRootParent(node: TreeNode): any | '' {
    for (const appNode of this.treeData) {
      // Check if the node is the Application node itself
      if (appNode === node) return appNode;

      // Traverse Role children of the Application
      if (appNode.children) {
        for (const roleNode of appNode.children) {
          if (roleNode === node) return appNode; // Return the parent Application

          // Traverse Function children of the Role
          if (roleNode.children && roleNode.children.some(child => child === node)) {
            return appNode; // Return the parent Application
          }
        }
      }
    }
    return ''; // Node not found
  }
  getSelectedApplicationId(): string {
    if (!this.selectedNode) return '';
    if (this.selectedNode.data?.applicationId) {
      return this.selectedNode.data.applicationId;
    }
    const rootParent = this.findRootParent(this.selectedNode);
    return rootParent?.data?.applicationId || '';
  }


  excuteGenericStatmentById(number: number, parameters?: string) {
    this.spinner.show('جاري تحميل البيانات ...');
    this.powerBiController.excuteGenericStatmentById(number, parameters)
      .subscribe({
        next: (resp) => {
          if (resp.isSuccess) {
            if (number === 6 || number === 7) {
              this.selectedNode.label = this.frm.get('NameAr')?.value
            }
            this.msg.msgSuccess(resp.data as string)
            this.frm.reset();
            this.isValidated = false;
            if (this.refreshActionIds.has(number)) {
              this.refreshTreeData();
            }
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
  deleteRow(event: any, targetList: 'roleUsers' | 'userRoles' = 'roleUsers') {
    this.powerBiController.excuteGenericStatmentById(24, `${event.USER_ID}|${event.ROLE_ID}`)
      .subscribe({
        next: (resp) => {
          if (resp.isSuccess) {
            console.log('resp', resp)
            if (targetList === 'userRoles') {
              const _index = this.userRolesData.findIndex(e => e.ROLE_ID == event.ROLE_ID && e.USER_ID == event.USER_ID)
              if (_index > -1) this.userRolesData.splice(_index, 1);
            } else {
              const _index = this.itemData.findIndex(e => e.ROLE_ID == event.ROLE_ID && e.USER_ID == event.USER_ID)
              if (_index > -1) this.itemData.splice(_index, 1);
            }
            this.msg.msgSuccess('تم الحذف بنجاح');

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
