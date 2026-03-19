import { Component } from '@angular/core';
import { MenuItem, TreeDragDropService, TreeNode } from 'primeng/api';
import { GenerateQueryService } from '../../services/generate-query.service';
import { SelectGroupsHierarchyService } from '../../services/select-groups-hierarchy.service';

@Component({
  selector: 'app-select-groups',
  templateUrl: './select-groups.component.html',
  styleUrls: ['./select-groups.component.scss'],
  providers: [TreeDragDropService]
})
export class SelectGroupsComponent {

  treeData: TreeNode[] = []
  selectedNode: TreeNode = {} as TreeNode
  items: MenuItem[] = [];

  constructor(public generateQueryService: GenerateQueryService, public selectGroupService: SelectGroupsHierarchyService) { }

  ngOnInit() {
  }
 
}
