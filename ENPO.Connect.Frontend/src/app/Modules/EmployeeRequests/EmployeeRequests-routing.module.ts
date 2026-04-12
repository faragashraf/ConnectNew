import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TotalReuestsParentComponent } from '../GenericComponents/ConnectComponents/total-Reuests-Parent/total-Reuests-Parent.component';
import { AuthNewGuardService } from 'src/app/shared/services/helper/auth-new-guard.service';
import { ModuleChartsComponent } from '../GenericComponents/ConnectComponents/module-charts/module-charts.component';
import { SummerRequestsWorkspaceComponent } from './components/summer-requests-workspace/workspace-screen/summer-requests-workspace.component';
import { SummerRequestsAdminConsoleComponent } from './components/summer-requests-admin-console/summer-requests-admin-console.component';
import { SummerUnitFreezeListPageComponent } from './components/summer-unit-freeze-list-page/summer-unit-freeze-list-page.component';
import { SummerUnitFreezeCreatePageComponent } from './components/summer-unit-freeze-create-page/summer-unit-freeze-create-page.component';
import { SummerUnitFreezeDetailsPageComponent } from './components/summer-unit-freeze-details-page/summer-unit-freeze-details-page.component';
import { SummerWaveBookingsPrintPageComponent } from './components/summer-wave-bookings-print-page/summer-wave-bookings-print-page.component';
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
      configRouteKey: 'EmployeeRequests/SummerRequests',
      summerEditHost: 'employee'
    }
  },
  {
    path: SUMMER_FEATURE_ROUTES.adminConsoleEdit,
    component: SummerRequestsWorkspaceComponent,
    canActivate: [AuthNewGuardService], data: {
      func: 'SummerAdminFunc',
      configRouteKey: 'Admin/SummerRequestsManagement',
      summerEditHost: 'admin'
    }
  },
  {
    path: SUMMER_FEATURE_ROUTES.adminConsole,
    component: SummerRequestsAdminConsoleComponent,
    canActivate: [AuthNewGuardService], data: {
      func: 'SummerAdminFunc',
      configRouteKey: 'Admin/SummerRequestsManagement'
    }
  },
  {
    path: SUMMER_FEATURE_ROUTES.waveBookingsPrint,
    component: SummerWaveBookingsPrintPageComponent,
    canActivate: [AuthNewGuardService], data: {
      func: 'SummerAdminFunc',
      configRouteKey: 'Admin/SummerRequestsManagement'
    }
  },
  {
    path: SUMMER_FEATURE_ROUTES.unitFreezeList,
    component: SummerUnitFreezeListPageComponent,
    canActivate: [AuthNewGuardService], data: {
      func: 'SummerAdminFunc',
      configRouteKey: 'Admin/SummerRequestsManagement'
    }
  },
  {
    path: SUMMER_FEATURE_ROUTES.unitFreezeCreate,
    component: SummerUnitFreezeCreatePageComponent,
    canActivate: [AuthNewGuardService], data: {
      func: 'SummerAdminFunc',
      configRouteKey: 'Admin/SummerRequestsManagement'
    }
  },
  {
    path: SUMMER_FEATURE_ROUTES.unitFreezeDetails,
    component: SummerUnitFreezeDetailsPageComponent,
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
