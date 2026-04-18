import { Component } from '@angular/core';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';
import { AuthorizationController, RoleHierarchy, RoleMasterAddDto, UaFunction } from 'src/app/Modules/auth/services/Authorization.service';
import { MenuItem, TreeDragDropService } from 'primeng/api';
import { Clipboard } from '@angular/cdk/clipboard';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PowerBiController } from 'src/app/Modules/enpopower-bi/services/PowerBi.service';
import { GenerateQueryService } from 'src/app/Modules/enpopower-bi/services/generate-query.service';
import { DynamicSubjectsAdminRoutingController } from 'src/app/shared/services/BackendServices/DynamicSubjectsAdminRouting/DynamicSubjectsAdminRouting.service';
import {
  SubjectRoutingOrgPositionLookupDto,
  SubjectRoutingOrgPositionUpsertRequestDto,
  SubjectRoutingOrgTreeNodeDto,
  SubjectRoutingOrgUnitLookupDto,
  SubjectRoutingOrgUnitWithCountTreeNodeDto,
  SubjectRoutingOrgUnitTypeLookupDto,
  SubjectRoutingOrgUnitTypeUpsertRequestDto,
  SubjectRoutingOrgUnitUpsertRequestDto
} from 'src/app/shared/services/BackendServices/DynamicSubjectsAdminRouting/DynamicSubjectsAdminRouting.dto';
import { forkJoin } from 'rxjs';


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

interface User360RoleInsight {
  roleName: string;
  severity: 'critical' | 'high' | 'normal';
  severityLabel: string;
}

interface User360MatrixColumn {
  functionId: string;
  functionName: string;
}

interface OrgTreeNode {
  key: string;
  label: string;
  type: 'OrgUnitType' | 'OrgUnit' | 'Position';
  data: {
    unitTypeId?: number;
    unitTypeName?: string;
    unitId?: number;
    unitName?: string;
    parentId?: number;
    positionId?: number;
    userId?: string;
    userDisplayNameAr?: string;
    isManager?: boolean;
    isActive?: boolean;
  };
  children: OrgTreeNode[];
  expanded?: boolean;
  draggable?: boolean;
  droppable?: boolean;
}

interface VwOrgTreeNode {
  key: string;
  label: string;
  type: 'OrgUnit' | 'Position';
  data: {
    unitId?: number;
    unitName?: string;
    unitTypeId?: number;
    parentId?: number;
    positionId?: number;
    userId?: string;
    userDisplayNameAr?: string;
    isManager?: boolean;
    isActive?: boolean;
  };
  children: VwOrgTreeNode[];
  expanded?: boolean;
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
    public generateQueryService: GenerateQueryService, private clipboard: Clipboard, private fb: FormBuilder,
    private powerBiController: PowerBiController, private routingController: DynamicSubjectsAdminRoutingController) {
    this.generateQueryService.duration = 0;

  }
  ngOnInit(): void {
    this.GetEnpoStructure()
    this.loadOrgAdminTree();
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
  user360Data: any[] = [];
  user360Columns: string[] = [];
  user360LastLoadedAt = '';
  user360Summary = {
    userId: '',
    userName: '',
    department: '',
    orgUnit: '',
    orgUnitType: '',
    rolesCount: 0,
    functionsCount: 0,
    applicationsCount: 0
  };
  user360RoleNames: string[] = [];
  user360FunctionNames: string[] = [];
  user360ApplicationIds: string[] = [];
  user360OrgTrail: string[] = [];
  user360RoleInsights: User360RoleInsight[] = [];
  user360MatrixColumns: User360MatrixColumn[] = [];
  user360MatrixRows: any[] = [];
  orgTreeData: OrgTreeNode[] = [];
  selectedOrgNode: OrgTreeNode = {} as OrgTreeNode;
  orgItems: MenuItem[] = [];
  orgTreeLoading = false;
  unitTypesLookup: SubjectRoutingOrgUnitTypeLookupDto[] = [];
  orgCrudDialogVisible = false;
  orgCrudMode: 'create' | 'edit' = 'create';
  orgCrudTargetType: 'OrgUnitType' | 'OrgUnit' | 'Position' = 'OrgUnitType';
  orgCrudSource: 'org' | 'vw' = 'org';
  orgCrudHeader = '';
  orgUnitTypeForm: SubjectRoutingOrgUnitTypeUpsertRequestDto & { unitTypeId?: number } = {
    unitTypeId: undefined,
    typeName: '',
    leaderTitle: '',
    isSingleOccupancy: false,
    isActive: true
  };
  orgUnitForm: SubjectRoutingOrgUnitUpsertRequestDto & { unitId?: number } = {
    unitId: undefined,
    unitName: '',
    unitTypeId: 0,
    parentId: undefined,
    isActive: true
  };
  orgPositionForm: SubjectRoutingOrgPositionUpsertRequestDto & { positionId?: number } = {
    positionId: undefined,
    userId: '',
    unitId: 0,
    isManager: false,
    isActive: true,
    startDate: undefined,
    endDate: undefined
  };
  vwOrgUnitsTreeData: VwOrgTreeNode[] = [];
  selectedVwOrgNode: VwOrgTreeNode = {} as VwOrgTreeNode;
  vwOrgUnitsTreeLoading = false;
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

    this.fetchUserRolesLookup(userId, applicationId, rows => {
      this.userRolesData = rows;
      this.userRolesColumns = this.userRolesData.length > 0 ? Object.keys(this.userRolesData[0]) : [];
      this.buildUser360View(rows, userId);
    });
  }

  loadUser360View() {
    const userId = this.userIdSearch?.trim();
    const applicationId = this.getSelectedApplicationId();
    if (!userId) {
      this.msg.msgError('برجاء إدخال رقم المستخدم', 'تنبيه');
      return;
    }
    if (!applicationId) {
      this.msg.msgError('برجاء اختيار عقدة من الشجرة لتحديد رقم التطبيق', 'تنبيه');
      return;
    }

    this.fetchUserRolesLookup(userId, applicationId, rows => {
      this.user360Data = rows;
      this.user360Columns = this.user360Data.length > 0 ? Object.keys(this.user360Data[0]) : [];
      this.userRolesData = rows;
      this.userRolesColumns = this.userRolesData.length > 0 ? Object.keys(this.userRolesData[0]) : [];
      this.buildUser360View(rows, userId);
    });
  }

  private fetchUserRolesLookup(userId: string, applicationId: string, onSuccess: (rows: any[]) => void) {
    this.spinner.show('جاري تحميل البيانات ...');
    const startTime = Date.now();
    this.powerBiController.getGenericDataById(this.userRolesByUserIdStatementId, `${userId}|${applicationId}`)
      .subscribe({
        next: (resp) => {
          if (resp.isSuccess) {
            const rows = (resp.data as any[]) || [];
            const normalizedRows = rows.map(row => ({
              ...row,
              ROLE_NAME_EN: row?.ROLE_NAME_EN || row?.ROLE_NAME_AR || ''
            }));
            onSuccess(normalizedRows);
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

  private buildUser360View(rows: any[], fallbackUserId: string) {
    const firstRow = rows.length > 0 ? rows[0] : null;
    const roleNames = this.uniqueValues(rows.map(row => this.pickValue(row, ['ROLE_NAME_AR', 'ROLE_NAME_EN', 'ROLE_ID'])));
    const functionNames = this.uniqueValues(rows.map(row => this.pickValue(row, ['FUNCTION_NAME', 'FUNCTION_ID', 'FUNCTION_INT_ID'])));
    const applicationIds = this.uniqueValues(rows.map(row => this.pickValue(row, ['APPLICATION_ID', 'APP_ID', 'SB_APPLICATION_ID'])));
    const orgTrail = this.uniqueValues(rows.map(row => this.pickValue(row, ['ORG_UNIT_NAME_AR', 'UNIT_NAME_AR', 'DEPARTMENT_NAME_AR', 'DEPARTMENT'])));

    this.user360Summary = {
      userId: this.pickValue(firstRow, ['USER_ID', 'USERID']) || fallbackUserId,
      userName: this.pickValue(firstRow, ['ARABIC_NAME', 'USER_NAME_AR', 'USER_NAME', 'FULL_NAME_AR', 'FULL_NAME']),
      department: this.pickValue(firstRow, ['DEPARTMENT_NAME_AR', 'DEPARTMENT', 'DEPT_NAME_AR', 'DEPT_NAME']),
      orgUnit: this.pickValue(firstRow, ['ORG_UNIT_NAME_AR', 'UNIT_NAME_AR', 'ORG_NAME_AR', 'ORG_UNIT_NAME']),
      orgUnitType: this.pickValue(firstRow, ['ORG_UNIT_TYPE_AR', 'UNIT_TYPE_AR', 'ORG_TYPE_NAME_AR', 'ORG_UNIT_TYPE']),
      rolesCount: roleNames.length,
      functionsCount: functionNames.length,
      applicationsCount: applicationIds.length
    };

    this.user360RoleNames = roleNames;
    this.user360FunctionNames = functionNames;
    this.user360ApplicationIds = applicationIds;
    this.user360OrgTrail = orgTrail;
    this.user360RoleInsights = roleNames.map(roleName => this.buildRoleInsight(roleName));
    this.buildRoleFunctionMatrix(rows);
    this.user360LastLoadedAt = new Date().toLocaleString('ar-EG');
  }

  private buildRoleInsight(roleName: string): User360RoleInsight {
    const normalized = (roleName || '').toUpperCase();
    if (normalized.includes('SUPER') || normalized.includes('ADMIN') || normalized.includes('ROOT') || normalized.includes('SUPPER') || normalized.includes('مسؤول') || normalized.includes('مدير النظام')) {
      return { roleName, severity: 'critical', severityLabel: 'حرج' };
    }
    if (normalized.includes('MANAGER') || normalized.includes('LEAD') || normalized.includes('HEAD') || normalized.includes('مدير') || normalized.includes('رئيس')) {
      return { roleName, severity: 'high', severityLabel: 'مرتفع' };
    }
    return { roleName, severity: 'normal', severityLabel: 'قياسي' };
  }

  private buildRoleFunctionMatrix(rows: any[]) {
    const roleById = new Map<string, string>();
    const functionById = new Map<string, string>();
    const matrix = new Map<string, Set<string>>();

    rows.forEach(row => {
      const roleId = this.pickValue(row, ['ROLE_ID']);
      const roleName = this.pickValue(row, ['ROLE_NAME_AR', 'ROLE_NAME_EN', 'ROLE_ID']);
      const functionId = this.pickValue(row, ['FUNCTION_INT_ID', 'FUNCTION_ID']);
      const functionName = this.pickValue(row, ['FUNCTION_NAME', 'FUNCTION_ID', 'FUNCTION_INT_ID']);

      if (!roleId || !roleName || !functionId || !functionName) {
        return;
      }

      roleById.set(roleId, roleName);
      functionById.set(functionId, functionName);
      if (!matrix.has(roleId)) {
        matrix.set(roleId, new Set<string>());
      }
      matrix.get(roleId)?.add(functionId);
    });

    if (functionById.size === 0 && roleById.size > 0 && this.roleHierarchy.length > 0) {
      const appId = this.getSelectedApplicationId();
      const roleIds = new Set(Array.from(roleById.keys()));
      this.roleHierarchy
        .filter(item => {
          const roleId = item.roleId || '';
          if (!roleIds.has(roleId)) return false;
          if (!item.functionIntId) return false;
          if (appId && item.applicationId !== appId) return false;
          return true;
        })
        .forEach(item => {
          const roleId = item.roleId as string;
          const functionId = String(item.functionIntId);
          const functionName = item.functionName || item.functionId || functionId;
          const roleName = item.roleNameAr || item.roleNameEn || roleId;
          roleById.set(roleId, roleName);
          functionById.set(functionId, functionName);
          if (!matrix.has(roleId)) {
            matrix.set(roleId, new Set<string>());
          }
          matrix.get(roleId)?.add(functionId);
        });
    }

    const functionIds = Array.from(functionById.keys());
    this.user360MatrixColumns = functionIds.map(functionId => ({
      functionId,
      functionName: functionById.get(functionId) || functionId
    }));
    this.user360MatrixRows = Array.from(roleById.keys()).map(roleId => {
      const rowItem: any = {
        roleId,
        roleName: roleById.get(roleId) || roleId
      };
      functionIds.forEach(functionId => {
        rowItem[`fn_${functionId}`] = matrix.get(roleId)?.has(functionId) ? 1 : 0;
      });
      return rowItem;
    });
  }

  private pickValue(row: any, keys: string[]): string {
    if (!row) return '';
    for (const key of keys) {
      const value = row?.[key];
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        return String(value).trim();
      }
    }
    return '';
  }

  private uniqueValues(values: Array<string | number | null | undefined>): string[] {
    const unique = new Set<string>();
    values.forEach(value => {
      if (value === null || value === undefined) return;
      const normalized = String(value).trim();
      if (!normalized) return;
      unique.add(normalized);
    });
    return Array.from(unique.values());
  }

  loadOrgAdminTree() {
    this.orgTreeLoading = true;
    this.routingController.getOracleUnitTypes().subscribe({
      next: (typesResp) => {
        if (!typesResp.isSuccess) {
          this.showApiErrors(typesResp.errors);
          this.orgTreeLoading = false;
          return;
        }
        this.unitTypesLookup = typesResp.data || [];
        this.routingController.getOracleUnits({ activeOnly: false }).subscribe({
          next: (unitsResp) => {
            if (!unitsResp.isSuccess) {
              this.showApiErrors(unitsResp.errors);
              this.orgTreeLoading = false;
              return;
            }
            this.routingController.getOraclePositions({ activeOnly: false }).subscribe({
              next: (positionsResp) => {
                this.orgTreeLoading = false;
                if (!positionsResp.isSuccess) {
                  this.showApiErrors(positionsResp.errors);
                  return;
                }
                this.orgTreeData = this.buildOrgTree(
                  typesResp.data || [],
                  unitsResp.data || [],
                  positionsResp.data || []
                );
              },
              error: () => {
                this.orgTreeLoading = false;
                this.msg.msgError('تعذر تحميل المناصب', 'خطأ');
              }
            });
          },
          error: () => {
            this.orgTreeLoading = false;
            this.msg.msgError('تعذر تحميل الوحدات التنظيمية', 'خطأ');
          }
        });
      },
      error: () => {
        this.orgTreeLoading = false;
        this.msg.msgError('تعذر تحميل أنواع الوحدات', 'خطأ');
      }
    });
  }

  loadVwOrgUnitsTree() {
    this.vwOrgUnitsTreeLoading = true;
    forkJoin({
      vw: this.routingController.getOracleUnitsWithCountTree(false),
      units: this.routingController.getOracleUnits({ activeOnly: false }),
      positions: this.routingController.getOraclePositions({ activeOnly: false }),
    }).subscribe({
      next: (result) => {
        this.vwOrgUnitsTreeLoading = false;
        if (!result.vw.isSuccess) {
          this.showApiErrors(result.vw.errors);
          return;
        }
        if (!result.units.isSuccess) {
          this.showApiErrors(result.units.errors);
          return;
        }
        if (!result.positions.isSuccess) {
          this.showApiErrors(result.positions.errors);
          return;
        }
        this.vwOrgUnitsTreeData = this.buildVwOrgUnitsTree(
          result.vw.data || [],
          result.units.data || [],
          result.positions.data || []
        );
      },
      error: () => {
        this.vwOrgUnitsTreeLoading = false;
        this.msg.msgError('تعذر تحميل شجرة الوحدات من VW_ORG_UNITS_WITH_COUNT', 'خطأ');
      }
    });
  }

  private buildVwOrgUnitsTree(
    rows: SubjectRoutingOrgUnitWithCountTreeNodeDto[],
    units: SubjectRoutingOrgUnitLookupDto[],
    positions: SubjectRoutingOrgPositionLookupDto[]
  ): VwOrgTreeNode[] {
    const nodeById = new Map<number, VwOrgTreeNode>();
    const roots: VwOrgTreeNode[] = [];
    const unitsById = new Map<number, SubjectRoutingOrgUnitLookupDto>();
    const positionsByUnit = new Map<number, SubjectRoutingOrgPositionLookupDto[]>();

    units.forEach(unit => unitsById.set(Number(unit.unitId), unit));
    positions.forEach(position => {
      const key = Number(position.unitId);
      if (!positionsByUnit.has(key)) {
        positionsByUnit.set(key, []);
      }
      positionsByUnit.get(key)?.push(position);
    });

    rows.forEach(row => {
      const unitId = Number(row.unitId);
      if (!unitId || unitId <= 0) return;
      const unitLookup = unitsById.get(unitId);
      nodeById.set(unitId, {
        key: `vw-unit-${unitId}`,
        label: `${row.unitName} (${unitId})`,
        type: 'OrgUnit',
        data: {
          unitId,
          unitName: row.unitName,
          parentId: row.parentId,
          unitTypeId: unitLookup?.unitTypeId,
          isActive: unitLookup?.isActive ?? true
        },
        children: [],
        expanded: false
      });
    });

    rows.forEach(row => {
      const unitId = Number(row.unitId);
      const node = nodeById.get(unitId);
      if (!node) return;
      const parentId = row.parentId != null ? Number(row.parentId) : 0;
      if (parentId > 0 && nodeById.has(parentId) && parentId !== unitId) {
        nodeById.get(parentId)?.children.push(node);
      } else {
        roots.push(node);
      }
    });

    nodeById.forEach((unitNode, unitId) => {
      const unitPositions = (positionsByUnit.get(unitId) || []).sort((a, b) => a.positionId - b.positionId);
      unitPositions.forEach(position => {
        const positionNode: VwOrgTreeNode = {
          key: `vw-position-${position.positionId}`,
          label: this.buildPositionNodeLabel(position),
          type: 'Position',
          data: {
            positionId: position.positionId,
            unitId: position.unitId,
            userId: position.userId,
            userDisplayNameAr: position.userDisplayNameAr,
            isManager: position.isManager,
            isActive: position.isActive
          },
          children: []
        };

        unitNode.children.push(positionNode);
      });
    });

    return roots;
  }

  private buildPositionNodeLabel(position: SubjectRoutingOrgPositionLookupDto): string {
    const userId = String(position.userId || '').trim();
    const userLabel = position.userDisplayNameAr || userId || 'غير مسند';

    if (userId.length === 0) {
      return `وظيفة (${position.positionId}) - ${userLabel}`;
    }

    return `وظيفة (${position.positionId}) - ${userLabel} (${userId})`;
  }

  private buildOrgTree(
    unitTypes: SubjectRoutingOrgUnitTypeLookupDto[],
    units: SubjectRoutingOrgUnitLookupDto[],
    positions: SubjectRoutingOrgPositionLookupDto[]
  ): OrgTreeNode[] {
    const unitsByType = new Map<number, SubjectRoutingOrgUnitLookupDto[]>();
    units.forEach(unit => {
      const key = Number(unit.unitTypeId);
      if (!unitsByType.has(key)) {
        unitsByType.set(key, []);
      }
      unitsByType.get(key)?.push(unit);
    });

    const positionsByUnit = new Map<number, SubjectRoutingOrgPositionLookupDto[]>();
    positions.forEach(position => {
      const key = Number(position.unitId);
      if (!positionsByUnit.has(key)) {
        positionsByUnit.set(key, []);
      }
      positionsByUnit.get(key)?.push(position);
    });

    const roots: OrgTreeNode[] = [];
    unitTypes.forEach(type => {
      const typeNode: OrgTreeNode = {
        key: `type-${type.unitTypeId}`,
        label: `${type.typeName} (${type.unitTypeId})`,
        type: 'OrgUnitType',
        data: {
          unitTypeId: type.unitTypeId,
          unitTypeName: type.typeName,
          isActive: type.isActive
        },
        children: [],
        expanded: false
      };

      const typeUnits = (unitsByType.get(Number(type.unitTypeId)) || []).sort((a, b) => a.unitId - b.unitId);
      const unitNodeById = new Map<number, OrgTreeNode>();

      typeUnits.forEach(unit => {
        const node: OrgTreeNode = {
          key: `unit-${unit.unitId}`,
          label: `${unit.unitName} (${unit.unitId})`,
          type: 'OrgUnit',
          data: {
            unitId: unit.unitId,
            unitName: unit.unitName,
            unitTypeId: unit.unitTypeId,
            parentId: unit.parentId,
            isActive: unit.isActive
          },
          children: [],
          expanded: false
        };
        unitNodeById.set(Number(unit.unitId), node);
      });

      typeUnits.forEach(unit => {
        const node = unitNodeById.get(Number(unit.unitId));
        if (!node) return;
        if (unit.parentId && unitNodeById.has(Number(unit.parentId))) {
          unitNodeById.get(Number(unit.parentId))?.children.push(node);
        } else {
          typeNode.children.push(node);
        }
      });

      unitNodeById.forEach((unitNode, unitId) => {
        const unitPositions = (positionsByUnit.get(unitId) || []).sort((a, b) => a.positionId - b.positionId);
        unitPositions.forEach(position => {
          unitNode.children.push({
            key: `position-${position.positionId}`,
            label: `${position.userDisplayNameAr || position.userId} (${position.positionId})`,
            type: 'Position',
            data: {
              positionId: position.positionId,
              userId: position.userId,
              userDisplayNameAr: position.userDisplayNameAr,
              unitId: position.unitId,
              isManager: position.isManager,
              isActive: position.isActive
            },
            children: []
          });
        });
      });

      roots.push(typeNode);
    });

    return roots;
  }

  onOrgContextMenuSelect(ev: any) {
    this.selectedOrgNode = ev.node;
    this.orgItems = [
      {
        label: 'إضافة',
        icon: 'pi pi-plus',
        command: () => {
          this.orgCrudSource = 'org';
          this.openOrgCrudDialog('create', ev.node);
        },
        disabled: ev.node?.type === 'Position'
      },
      {
        label: 'تعديل',
        icon: 'pi pi-pencil',
        command: () => {
          this.orgCrudSource = 'org';
          this.openOrgCrudDialog('edit', ev.node);
        }
      },
      {
        label: 'حذف',
        icon: 'pi pi-trash',
        command: () => this.deleteOrgNode(ev.node, 'org')
      }
    ];
  }

  onVwOrgContextMenuSelect(ev: any) {
    this.selectedVwOrgNode = ev.node;
    if (ev.node?.type === 'OrgUnit') {
      this.orgItems = [
        {
          label: 'إضافة وحدة فرعية',
          icon: 'pi pi-sitemap',
          command: () => this.openCreateVwChildUnitDialog(ev.node)
        },
        {
          label: 'إضافة وظيفة',
          icon: 'pi pi-plus',
          command: () => this.openCreateVwPositionDialog(ev.node)
        },
        {
          label: 'تعديل',
          icon: 'pi pi-pencil',
          command: () => this.openVwOrgCrudDialog('edit', ev.node)
        },
        {
          label: 'حذف',
          icon: 'pi pi-trash',
          command: () => this.deleteVwOrgNode(ev.node)
        }
      ];
      return;
    }

    this.orgItems = [
      {
        label: 'تعديل',
        icon: 'pi pi-pencil',
        command: () => this.openVwOrgCrudDialog('edit', ev.node)
      },
      {
        label: 'حذف',
        icon: 'pi pi-trash',
        command: () => this.deleteVwOrgNode(ev.node)
      }
    ];
  }

  openVwOrgCrudDialog(mode: 'create' | 'edit', node: VwOrgTreeNode) {
    const mappedNode = this.mapVwNodeToOrgNode(node);
    if (!mappedNode) {
      return;
    }

    this.orgCrudSource = 'vw';
    this.openOrgCrudDialog(mode, mappedNode);
  }

  openCreateVwChildUnitDialog(node: VwOrgTreeNode) {
    this.orgCrudSource = 'vw';
    this.orgCrudMode = 'create';
    this.orgCrudTargetType = 'OrgUnit';
    this.orgCrudHeader = 'إضافة وحدة فرعية';
    this.orgUnitForm = {
      unitId: undefined,
      unitName: '',
      unitTypeId: node.data.unitTypeId || 0,
      parentId: node.data.unitId,
      isActive: true
    };
    this.orgCrudDialogVisible = true;
  }

  openCreateVwPositionDialog(node: VwOrgTreeNode) {
    this.orgCrudSource = 'vw';
    this.orgCrudMode = 'create';
    this.orgCrudTargetType = 'Position';
    this.orgCrudHeader = 'إضافة وظيفة';
    this.orgPositionForm = {
      positionId: undefined,
      userId: '',
      unitId: node.data.unitId || 0,
      isManager: false,
      isActive: true,
      startDate: undefined,
      endDate: undefined
    };
    this.orgCrudDialogVisible = true;
  }

  openOrgCrudDialog(mode: 'create' | 'edit', node: OrgTreeNode) {
    this.orgCrudMode = mode;
    if (mode === 'create') {
      if (node.type === 'OrgUnitType') {
        this.orgCrudTargetType = 'OrgUnit';
        this.orgCrudHeader = 'إضافة وحدة تنظيمية';
        this.orgUnitForm = { unitId: undefined, unitName: '', unitTypeId: node.data.unitTypeId || 0, parentId: undefined, isActive: true };
      } else if (node.type === 'OrgUnit') {
        this.orgCrudTargetType = 'Position';
        this.orgCrudHeader = 'إضافة منصب للمستخدم';
        this.orgPositionForm = { positionId: undefined, userId: '', unitId: node.data.unitId || 0, isManager: false, isActive: true };
      } else {
        return;
      }
    } else {
      this.orgCrudTargetType = node.type;
      this.orgCrudHeader = node.type === 'OrgUnitType' ? 'تعديل نوع وحدة' : node.type === 'OrgUnit' ? 'تعديل وحدة تنظيمية' : 'تعديل منصب';
      if (node.type === 'OrgUnitType') {
        this.orgUnitTypeForm = {
          unitTypeId: node.data.unitTypeId,
          typeName: node.data.unitTypeName || '',
          leaderTitle: '',
          isSingleOccupancy: false,
          isActive: node.data.isActive !== false
        };
      } else if (node.type === 'OrgUnit') {
        this.orgUnitForm = {
          unitId: node.data.unitId,
          unitName: node.data.unitName || '',
          unitTypeId: node.data.unitTypeId || 0,
          parentId: node.data.parentId,
          isActive: node.data.isActive !== false
        };
      } else {
        this.orgPositionForm = {
          positionId: node.data.positionId,
          userId: node.data.userId || '',
          unitId: node.data.unitId || 0,
          isManager: node.data.isManager === true,
          isActive: node.data.isActive !== false
        };
      }
    }
    this.orgCrudDialogVisible = true;
  }

  saveOrgDialog() {
    if (this.orgCrudTargetType === 'OrgUnitType') {
      const req: SubjectRoutingOrgUnitTypeUpsertRequestDto = {
        typeName: this.orgUnitTypeForm.typeName,
        leaderTitle: this.orgUnitTypeForm.leaderTitle,
        isSingleOccupancy: this.orgUnitTypeForm.isSingleOccupancy,
        isActive: this.orgUnitTypeForm.isActive
      };
      const request$ = this.orgCrudMode === 'create'
        ? this.routingController.createOracleUnitType(req)
        : this.routingController.updateOracleUnitType(Number(this.orgUnitTypeForm.unitTypeId), req);
      this.handleOrgSaveRequest(request$, this.orgCrudSource);
      return;
    }

    if (this.orgCrudTargetType === 'OrgUnit') {
      const req: SubjectRoutingOrgUnitUpsertRequestDto = {
        unitName: this.orgUnitForm.unitName,
        unitTypeId: Number(this.orgUnitForm.unitTypeId),
        parentId: this.orgUnitForm.parentId ? Number(this.orgUnitForm.parentId) : undefined,
        isActive: this.orgUnitForm.isActive
      };
      const request$ = this.orgCrudMode === 'create'
        ? this.routingController.createOracleUnit(req)
        : this.routingController.updateOracleUnit(Number(this.orgUnitForm.unitId), req);
      this.handleOrgSaveRequest(request$, this.orgCrudSource);
      return;
    }

    const req: SubjectRoutingOrgPositionUpsertRequestDto = {
      userId: this.orgPositionForm.userId,
      unitId: Number(this.orgPositionForm.unitId),
      isManager: this.orgPositionForm.isManager,
      isActive: this.orgPositionForm.isActive,
      startDate: this.orgPositionForm.startDate,
      endDate: this.orgPositionForm.endDate
    };
    const request$ = this.orgCrudMode === 'create'
      ? this.routingController.createOraclePosition(req)
      : this.routingController.updateOraclePosition(Number(this.orgPositionForm.positionId), req);
    this.handleOrgSaveRequest(request$, this.orgCrudSource);
  }

  deleteOrgNode(node: OrgTreeNode, source: 'org' | 'vw' = 'org') {
    this.msg.msgConfirm(`هل تريد حذف ${node.label} ؟`, 'حذف').then(result => {
      if (!result) return;
      let request$;
      if (node.type === 'OrgUnitType') {
        request$ = this.routingController.deleteOracleUnitType(Number(node.data.unitTypeId));
      } else if (node.type === 'OrgUnit') {
        request$ = this.routingController.deleteOracleUnit(Number(node.data.unitId));
      } else {
        request$ = this.routingController.deleteOraclePosition(Number(node.data.positionId));
      }
      this.spinner.show('جاري تحميل البيانات ...');
      request$.subscribe({
        next: (resp: any) => {
          if (resp.isSuccess) {
            this.msg.msgSuccess('تم الحذف بنجاح');
            this.reloadOrgTrees(source);
          } else {
            this.showApiErrors(resp.errors);
          }
        },
        error: () => this.msg.msgError('فشل تنفيذ الحذف', 'خطأ')
      });
    });
  }

  deleteVwOrgNode(node: VwOrgTreeNode) {
    const mappedNode = this.mapVwNodeToOrgNode(node);
    if (!mappedNode) {
      return;
    }

    this.deleteOrgNode(mappedNode, 'vw');
  }

  private mapVwNodeToOrgNode(node: VwOrgTreeNode): OrgTreeNode | null {
    return {
      key: node.key,
      label: node.label,
      type: node.type,
      data: {
        unitTypeId: node.data.unitTypeId,
        unitId: node.data.unitId,
        unitName: node.data.unitName,
        parentId: node.data.parentId,
        positionId: node.data.positionId,
        userId: node.data.userId,
        userDisplayNameAr: node.data.userDisplayNameAr,
        isManager: node.data.isManager,
        isActive: node.data.isActive
      },
      children: [],
      expanded: node.expanded
    };
  }

  private reloadOrgTrees(source: 'org' | 'vw') {
    if (source === 'org') {
      this.loadOrgAdminTree();
      this.loadVwOrgUnitsTree();
      return;
    }

    this.loadVwOrgUnitsTree();
    this.loadOrgAdminTree();
  }

  private handleOrgSaveRequest(request$: any, source: 'org' | 'vw') {
    this.spinner.show('جاري تحميل البيانات ...');
    request$.subscribe({
      next: (resp: any) => {
        if (resp.isSuccess) {
          this.orgCrudDialogVisible = false;
          this.msg.msgSuccess('تم الحفظ بنجاح');
          this.reloadOrgTrees(source);
        } else {
          this.showApiErrors(resp.errors);
        }
      },
      error: () => this.msg.msgError('فشل تنفيذ الحفظ', 'خطأ')
    });
  }

  private showApiErrors(errors?: Array<{ message?: string }>) {
    let errr = '';
    errors?.forEach(e => errr += (e.message || '') + '<br>');
    this.msg.msgError(errr || 'حدث خطأ غير متوقع', 'هناك خطا ما', true);
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
