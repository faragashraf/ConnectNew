import { Component, EventEmitter, Output } from '@angular/core';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';
import { AuthorizationController, EnpoTeamStructure, VwUserTeamRegistration } from '../../../auth/services/Authorization.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

export interface TreeNode {
  label?: string;
  icon?: string;
  expandedIcon?: any;
  collapsedIcon?: any;
  children: TreeNode[];
  expanded?: boolean;
  cat?: string;
  partialSelected?: boolean;
  style?: string;
  styleClass?: string;
  draggable?: boolean;
  droppable?: boolean;
  selectable?: boolean;
  key?: string;
  route?: string,
  ParentId: number,
  unique_possision: boolean,
  unique_possision_reserved: boolean,
  id: string
}
@Component({
  selector: 'app-team-tree',
  templateUrl: './team-tree.component.html',
  styleUrls: ['./team-tree.component.scss']
})
export class TeamTreeComponent {
  @Output() dataEvent = new EventEmitter<any>();

  teamTree: TreeNode[] = []
  selectedNode: TreeNode = {} as TreeNode

  constructor(private spinner: SpinnerService, private msg: MsgsService, private autorization: AuthorizationController,
    private sanitizer: DomSanitizer
  ) { }
  ngOnInit(): void { 
    this.GetEnpoStructure()

  }

  enpoTeamStructure: EnpoTeamStructure[] = []
  GetEnpoStructure() {
    this.spinner.show('جاري تحميل البيانات ...');
    this.autorization.getEnpoStructure()
      .subscribe({
        next: (resp) => {
          if (resp.isSuccess) {
            this.enpoTeamStructure = resp.data
            console.log('this.enpoTeamStructure', this.enpoTeamStructure);
            this.GetTeamsUsers()
            this.buildTree(this.enpoTeamStructure)
            console.log('enpoTeamStructure', this.teamTree);
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
          console.log('checkResetedPassword Complete');
        }
      }
      );

  }
  UserTeamRegistrations: VwUserTeamRegistration[] = []
  GetTeamsUsers() {
    this.teamTree = []
    this.spinner.show('جاري تحميل البيانات ...');
    this.autorization.getUsersTreeObject()
      .subscribe({
        next: (resp) => {
          if (resp.isSuccess) {
            this.UserTeamRegistrations = resp.data
            this.UserTeamRegistrations.forEach(user => {
              let _user = this.searchTreeById(this.teamTree, user.regCat?.toString())
              if (_user != undefined) {
                if (_user.unique_possision && user.regCat?.toString() == _user.key) {
                  _user.label = user.arabicName + ' - ' + _user.label
                  _user.id = user.userUserId as string,
                    _user.unique_possision_reserved = true
                } else {
                  let node: TreeNode = {
                    key: user.userUserId,
                    id: user.userUserId as string,
                    label: user.userUserId + ' - ' + user.arabicName as string,
                    unique_possision: true,
                    unique_possision_reserved: false,
                    ParentId: user.parentId as number,
                    cat: user.regCat.toString(),
                    icon: 'pi pi-user',
                    children: [],
                    selectable: true
                  }
                  _user.children.push(node)
                }
              }
            })
            console.log('this.UserTeamRegistrations', this.UserTeamRegistrations);
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
          console.log('checkResetedPassword Complete');
        }
      }
      );

  }
  nodeSelection(event: any) {
    if (event.node.cat.length > 0) {
      this.dataEvent.emit(event.node.cat);
      let _user = this.searchTreeById(this.teamTree, event.node.cat?.toString())

      if (_user != undefined && _user.unique_possision_reserved) {
        const tittle = this.enpoTeamStructure.find(f => _user != undefined && f.id.toString() == _user.key);
        const usr = this.UserTeamRegistrations.find(f => _user != undefined && f.userUserId == _user.id as string);
        this.msg.msgInfo('تحذير', 'وظيفة <span style="color:blue">' + tittle?.nameAr + '</span> يشغلها ' + (usr?.regGender == 'Male' ? 'السيد / <span style="color:green">' : 'السيدة / <span style="color:green">') + usr?.arabicName + '</span>', true)
      }

    }
  }
  nodeUnselection(event: any) {
    // this.setIds(event.node.label)
  }

  buildTree(data: EnpoTeamStructure[]) {
    const map = new Map<number, TreeNode>();
    // Create all nodes
    data.forEach(item => {
      const node = this.createTreeNode(item)
      map.set(Number(node.key), node);
    });

    // Assign children to parents
    data.forEach(item => {
      const node = map.get(Number(item.id))!;
      const parentId = item.parentId;

      if (parentId !== 0) {
        const parent = map.get(parentId as number);
        // if (node?.unique_possision)
        parent?.children.push(node);
      } else {
        this.teamTree.push(node);
      }
    });
    console.log('this.teamTree', this.teamTree);
  }
  createTreeNode(item: EnpoTeamStructure): TreeNode {
    return {
      key: item.id?.toString(),
      id: item.id?.toString(),
      label: item.id?.toString() + ' - ' + item.nameAr as string,
      ParentId: item.parentId as number,
      unique_possision: item.isSinglePosition as boolean,
      unique_possision_reserved: false,
      cat: item.id?.toString(),
      icon: 'pi pi-user',
      children: [],
      selectable: true
    };

  }
  searchTreeById(nodes: TreeNode[], id: string): TreeNode | undefined {
    for (const node of nodes) {
      if (node.key === id) {
        return node; // Found the node
      }
      if (node.children.length > 0) {
        const found = this.searchTreeById(node.children, id);
        if (found) {
          return found;
        }
      }
    }
    return undefined; // Not found
  }





  currentFilter = '';
  highlightFilter(label: string): SafeHtml {
    if (!this.currentFilter) return label;

    const regex = new RegExp(this.escapeRegExp(this.currentFilter), 'gi');
    return this.sanitizer.bypassSecurityTrustHtml(
      label.replace(regex, match => `<span class="filter-highlight">${match}</span>`)
    );
  }

  private escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
