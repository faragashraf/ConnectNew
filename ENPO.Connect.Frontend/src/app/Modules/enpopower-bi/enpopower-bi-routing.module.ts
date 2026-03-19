import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { QueryBuilderComponent } from './components/query-builder/query-builder.component';
import { SelectGroupsComponent } from './components/select-groups/select-groups.component';

const routes: Routes = [
  {
    path: 'Build',
    component: QueryBuilderComponent
  },{
    path: 'MySelectStatements',
    component: SelectGroupsComponent, data: {
      func: 'PowerBiFunc'
    }
  },

];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ENPOPowerBiRoutingModule { }
