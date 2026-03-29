import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TotalReuestsParentComponent } from '../GenericComponents/ConnectComponents/total-Reuests-Parent/total-Reuests-Parent.component';
import { AuthNewGuardService } from 'src/app/shared/services/helper/auth-new-guard.service';
import { ModuleChartsComponent } from '../GenericComponents/ConnectComponents/module-charts/module-charts.component';
import { SummerRequestsWorkspaceComponent } from './components/summer-requests-workspace/workspace-screen/summer-requests-workspace.component';
import { SummerRequestsAdminConsoleComponent } from './components/summer-requests-admin-console/summer-requests-admin-console.component';
import { SUMMER_FEATURE_ROUTES } from './components/summer-shared/core/summer-feature.config';

const routes: Routes = [
  {
    path: SUMMER_FEATURE_ROUTES.workspace,
    component: SummerRequestsWorkspaceComponent,
    canActivate: [AuthNewGuardService], data: {
      func: 'AllEnpoUsersFunc',
      configRouteKey: 'EmployeeRequests/SummerRequests'
    }
  },
  {
    path: SUMMER_FEATURE_ROUTES.workspaceEdit,
    component: SummerRequestsWorkspaceComponent,
    canActivate: [AuthNewGuardService], data: {
      func: 'AllEnpoUsersFunc',
      configRouteKey: 'EmployeeRequests/SummerRequests'
    }
  },
  {
    path: SUMMER_FEATURE_ROUTES.adminConsole,
    component: SummerRequestsAdminConsoleComponent,
    canActivate: [AuthNewGuardService], data: {
      func: 'SummerAdminFunc',
      configRouteKey: 'Admin/SummerRequestsManagement'
    }
  }, {
    path: SUMMER_FEATURE_ROUTES.dashboard,
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
export class EmployeeRequestsRoutingModule { }
