import { Component, Input } from '@angular/core';
import { GenerateQueryService } from '../../../services/generate-query.service';
import { Clipboard } from '@angular/cdk/clipboard';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';
import { SelectGroupsHierarchyService } from '../../../services/select-groups-hierarchy.service';
import { TreeNode } from 'primeng/api';
@Component({
  selector: 'app-select-statement',
  templateUrl: './select-statement.component.html',
  styleUrls: ['./select-statement.component.scss']
})
export class SelectStatementComponent {
  treeData: TreeNode[] = []
  // when true the SQL widget will be collapsed/hidden after execution
  isCollapsed: boolean = false;

  constructor(private spinner: SpinnerService, private msg: MsgsService, private clipboard: Clipboard, public selectGroupService: SelectGroupsHierarchyService,
    public generateQueryService: GenerateQueryService) { }

  ngOnInit() {

  }
  copyQuery() {
    this.clipboard.copy(this.generateQueryService.generatedQuery)
  }
  onExecute() {
    // run generate query and collapse the widget
    this.generateQueryService.generateQuery();
    this.isCollapsed = true;
  }
  expand() {
    this.isCollapsed = false;
  }
  Save() {
    this.selectGroupService.IsSaveNewSelect = true;
    this.treeData = (this.selectGroupService.toTreeNodes(this.selectGroupService.preTree));
    this.selectGroupService.dialogVisible = true;
  }

  submitGroup() {
    if (this.selectGroupService.IsEditGroupNode)
      this.selectGroupService.excuteGenericStatmentById(16,`${this.selectGroupService.frm.get('NameAr')?.value}|${this.selectGroupService.PublicTrue ? 'Y' : 'N'}|${this.selectGroupService.GroupsSelectedNode.key?.split('-')[1]}`)
        .subscribe((success) => {
          if (success) {
            this.selectGroupService.getMetaData();
          } else {
            console.log(success)
          }
        });
    else if (this.selectGroupService.IsEditSelectNode)
      this.selectGroupService.excuteGenericStatmentById(17,`${this.selectGroupService.frm.get('NameAr')?.value}|${this.generateQueryService.generatedQuery.replaceAll("'", "''")}|${this.selectGroupService.ChartTrue ? 'Y' : 'N'}|${this.selectGroupService.GroupsSelectedNode.key?.split('-')[1]}`)
        .subscribe((success) => {
          if (success) {
            this.selectGroupService.getMetaData();
          } else {
            console.log(success)
          }
        });

    else if (this.selectGroupService.IsSaveNewSelect)
      this.selectGroupService.excuteGenericStatmentById(18,`${this.selectGroupService.GroupsSelectedNode.key?.split('-')[1]}|${this.selectGroupService.frm.get('NameAr')?.value}|${this.generateQueryService.generatedQuery.replaceAll("'", "''")}`)
        .subscribe((success) => {
          if (success) {
            this.selectGroupService.getMetaData();
          } else {
            console.log(success)
          }
        });
    else
      this.selectGroupService.excuteGenericStatmentById(19,`${this.selectGroupService.GroupsSelectedNode.key?.split('-')[1] == 'root' ? "''" : this.selectGroupService.GroupsSelectedNode.key?.split('-')[1]}|${this.selectGroupService.frm.get('NameAr')?.value}|${this.selectGroupService.PublicTrue ? 'Y' : 'N'}|${this.selectGroupService.UserID}`)
        .subscribe((success) => {
          if (success) {
            this.selectGroupService.getMetaData();
          } else {
            console.log(success)
          }
        });
    // 
  }
  UpdateTree(arg0: string) {
    this.selectGroupService.GroupsSelectedNode.label = this.selectGroupService.frm.get('NameAr')?.value;
    if (arg0 == 'group') {
      this.selectGroupService.GroupsSelectedNode.data.groupName = this.selectGroupService.frm.get('NameAr')?.value;
      this.selectGroupService.GroupsSelectedNode.data.IS_PUBLIC = this.selectGroupService.PublicTrue;
    } else {
      this.selectGroupService.GroupsSelectedNode.data.selectName = this.selectGroupService.frm.get('NameAr')?.value;
      this.selectGroupService.GroupsSelectedNode.data.IS_CHART = this.selectGroupService.ChartTrue;;
      this.selectGroupService.GroupsSelectedNode.data.selectQuery = this.generateQueryService.generatedQuery;
    }
  }
}
