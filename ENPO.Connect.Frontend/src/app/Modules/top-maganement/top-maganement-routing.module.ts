import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthNewGuardService } from 'src/app/shared/services/helper/auth-new-guard.service';
import { TotalReuestsParentComponent } from '../GenericComponents/ConnectComponents/total-Reuests-Parent/total-Reuests-Parent.component';
import { ModuleChartsComponent } from '../GenericComponents/ConnectComponents/module-charts/module-charts.component';
import { AddEditSubjectComponent } from './components/AddEditSubject/add-edit-subject.component';

const routes: Routes = [
  { path: 'edit/:id', component: AddEditSubjectComponent, data: { configRouteKey: 'TopManagement/AddSubject' } },
  {
    path: 'AddSubject',
    component: AddEditSubjectComponent,
    canActivate: [AuthNewGuardService], data: {
      func: 'AddSubjectFunc'
    }
  },
  {
    path: 'ShowSubjects',
    component: TotalReuestsParentComponent,
    canActivate: [AuthNewGuardService], data: {
      func: 'ViewSubjectFunc'
    }
  },
  {
    path: 'Chart',
    component: ModuleChartsComponent,
    canActivate: [AuthNewGuardService], data: {
      func: 'SubjectDashboardFunc'
    }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TopMaganementRoutingModule { }
