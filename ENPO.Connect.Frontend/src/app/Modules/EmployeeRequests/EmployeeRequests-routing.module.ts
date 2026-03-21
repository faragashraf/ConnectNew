import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TotalReuestsParentComponent } from '../GenericComponents/ConnectComponents/total-Reuests-Parent/total-Reuests-Parent.component';
import { AuthNewGuardService } from 'src/app/shared/services/helper/auth-new-guard.service';
import { ModuleChartsComponent } from '../GenericComponents/ConnectComponents/module-charts/module-charts.component';

const routes: Routes = [
  { path: 'edit/:id', redirectTo: '/Admin/SummerRequests/edit/:id', pathMatch: 'full' },
  { path: 'SummerRequests', redirectTo: '/Admin/SummerRequests', pathMatch: 'full' },
  {
    path: 'Summer2026Management',
    component: TotalReuestsParentComponent,
    canActivate: [AuthNewGuardService], data: {
      func: 'ViewSubjectFunc'
    }
  }, {
    path: 'Chart',
    component: ModuleChartsComponent,
    canActivate: [AuthNewGuardService], data: {
      func: 'SubjectDashboardFunc'
    }
  }, {
    path: 'MyRequests',
    component: TotalReuestsParentComponent,
    canActivate: [AuthNewGuardService], data: {
      func: 'AllEnpoUsersFunc'
    }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class EmployeeRequestsRoutingModule { }
