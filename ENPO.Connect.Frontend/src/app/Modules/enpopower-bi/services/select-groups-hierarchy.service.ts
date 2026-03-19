import { Injectable } from '@angular/core';
import { TreeNode } from 'primeng/api';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';
import { AuthorizationController } from '../../auth/services/Authorization.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { catchError, defer, finalize, map, Observable, of, tap } from 'rxjs';
import { GenerateQueryService } from './generate-query.service';
import { PowerBiController } from './PowerBi.service';

export interface SavedSelect {
  selectId: number;
  selectName: string;
  selectQuery: string;
  isChart: string;
}

export interface SelectGroupNode {
  groupId: number;
  parentGroupId: number | null;
  groupName: string;
  isPublic: string;
  children: SelectGroupNode[];
  savedSelects: SavedSelect[];
}

@Injectable({
  providedIn: 'root'
})
export class SelectGroupsHierarchyService {
  IsSaveNewSelect: boolean = false;
  IsEditGroupNode: boolean = false;
  IsEditSelectNode: boolean = false;
  preTree: any[] = [];
  treeData: TreeNode[] = [];
  dialogVisible: boolean = false;
  UserID = localStorage.getItem('UserId');


  GroupsSelectedNode: TreeNode = {} as TreeNode;

  PublicTrue: boolean = false;
  ChartTrue: boolean = false;

  frm!: FormGroup

  constructor(private spinner: SpinnerService, private msg: MsgsService, private autorization: AuthorizationController
    , private fb: FormBuilder, public generateQueryService: GenerateQueryService, private powerBiController: PowerBiController) {
    this.frm = this.fb.group({
      NameAr: ['', Validators.required],
      PublicTrue: [false],
      ChartTrue: [false],
    })
  }

  getMetaData() {
    this.generateQueryService.selectRequestModel.schema = 'GPA_USER';
    this.generateQueryService.selectRequestModel.selectedEnvironment = 'production';
    this.generateQueryService.selectRequestModel.str = `SELECT G.GROUP_ID, G.PARENT_GROUP_ID, G.GROUP_NAME, G.USER_ID, G.IS_PUBLIC, S.SELECT_ID, S.SELECT_NAME, S.SELECT_QUERY, s.IS_CHART FROM SELECT_GROUPS G LEFT JOIN SAVED_SELECTS S ON G.GROUP_ID = S.GROUP_ID WHERE G.USER_ID = '${this.UserID}'`

    this.spinner.show('جاري تحميل البيانات ...');
    this.powerBiController.selectStatment(this.generateQueryService.selectRequestModel)
      .subscribe({
        next: (resp) => {
          if (resp.isSuccess) {
            console.log('resp.data', resp.data)
            this.preTree = (this.buildGroupTree(resp.data as any[]));
            this.treeData = (this.toTreeNodes(this.preTree));
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

  buildGroupTree(flatData: any[]): SelectGroupNode[] {
    const groupMap = new Map<number, SelectGroupNode>();

    // 1. First pass: Initialize group nodes
    flatData.forEach(row => {
      if (!groupMap.has(row.GROUP_ID)) {
        groupMap.set(row.GROUP_ID, {
          groupId: row.GROUP_ID,
          parentGroupId: row.PARENT_GROUP_ID,
          groupName: row.GROUP_NAME,
          isPublic: row.IS_PUBLIC,
          children: [],
          savedSelects: []
        });
      }

      if (row.SELECT_ID) {
        groupMap.get(row.GROUP_ID)?.savedSelects.push({
          selectId: row.SELECT_ID,
          selectName: row.SELECT_NAME,
          selectQuery: row.SELECT_QUERY,
          isChart: row.IS_CHART
        });
      }
    });

    // 2. Second pass: Build tree relationships
    const tree: SelectGroupNode[] = [];
    groupMap.forEach(node => {
      if (node.parentGroupId && groupMap.has(node.parentGroupId)) {
        groupMap.get(node.parentGroupId)?.children.push(node);
      } else {
        tree.push(node); // root node
      }
    });

    return tree;
  }

  toTreeNodes(nodes: SelectGroupNode[]): TreeNode[] {
    const mapGroups = (groups: SelectGroupNode[]): TreeNode[] => {
      return groups.map(group => ({
        label: group.groupName,
        key: `group-${group.groupId}`,
        isPublic: group.isPublic,
        data: group,
        children: !this.IsSaveNewSelect ? [
          ...group.savedSelects.map(select => ({
            label: select.selectName,
            key: `select-${select.selectId}`,
            data: select,
            icon: 'pi pi-file',
            leaf: true
          })),
          ...mapGroups(group.children)
        ] : [...mapGroups(group.children)],
        expanded: false,
        icon: 'pi pi-folder',
      }));
    };

    const mappedNodes = mapGroups(nodes);

    // Add static root node
    return [{
      label: 'Root',      // Customize label as needed
      key: 'static-root',        // Ensure unique key
      expanded: true,            // Expand by default
      icon: 'pi pi-home',        // Choose appropriate icon
      children: mappedNodes      // Original nodes as children
    }];
  }


  deleteTreeNode(tree: TreeNode[], keyToDelete: string): TreeNode[] {
    const processNodes = (nodes: TreeNode[]): TreeNode[] => {
      return nodes
        // First process children recursively to ensure deep deletion
        .map(node => ({
          ...node,
          children: node.children ? processNodes(node.children) : undefined
        }))
        // Then filter out the target node from current level
        .filter(node => node.key !== keyToDelete);
    };
    return processNodes(tree);
  }

  addTreeNode(
    tree: TreeNode[],
    newNode: TreeNode,
    parentKey: string = 'static-root' // Default to root
  ): TreeNode[] {
    const findAndAdd = (nodes: TreeNode[]): TreeNode[] => {
      return nodes.map(node => {
        if (node.key === parentKey) {
          return {
            ...node,
            children: [...(node.children || []), newNode]
          };
        }
        return {
          ...node,
          children: node.children ? findAndAdd(node.children) : undefined
        };
      });
    };

    return findAndAdd(tree);
  }


  excuteGenericStatmentById(id:number,statement?: string): Observable<boolean> {
    return defer(() => {
      this.spinner.show('جاري تحميل البيانات ...');
      return this.powerBiController.excuteGenericStatmentById(id,statement).pipe(
        tap((resp) => {
          if (resp.isSuccess) {
            this.msg.msgSuccess(resp.data as string);
          } else {
            let errorMessage = '';
            resp.errors?.forEach(e => errorMessage += e.message + "<br>");
            this.msg.msgError(errorMessage, "هناك خطا ما", true);
          }
        }),
        map((resp) => resp.isSuccess),
        catchError((error) => {
          console.log(error.message);
          this.msg.msgError(error, "هناك خطا ما", true);
          return of(false);
        }),
        finalize(() => {
          this.dialogVisible = false;
          this.GroupsSelectedNode = {} as TreeNode;
        })
      );
    });
  }
  generateRequest(str: string) {
    this.generateQueryService.selectRequestModel.schema = 'GPA_USER';
    this.generateQueryService.selectRequestModel.selectedEnvironment = 'production';
    this.generateQueryService.selectRequestModel.str = str
  }
}
