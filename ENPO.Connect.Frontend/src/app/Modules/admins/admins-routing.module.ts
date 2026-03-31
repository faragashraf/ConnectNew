import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthNewGuardService } from 'src/app/shared/services/helper/auth-new-guard.service';
import { RegistrationsRequestsComponent } from './components/registrations-requests/registrations-requests.component';
import { SideBarHierarchyComponent } from './components/side-bar-hierarchy/side-bar-hierarchy.component';
import { RoleHierarchyComponent } from './components/role-hierarchy/role-hierarchy.component';
import { DynamicFieldsManagerComponent } from './Managementcomponents/dynamic-fields-manager/dynamic-fields-manager.component';
import { ServerMonitorManagerComponent } from './components/server-monitor-manager/server-monitor-manager.component';
import { ResetUserPasswordComponent } from './components/reset-user-password/reset-user-password.component';
import { OnlinUsersComponent } from './components/onlin-users/onlin-users.component';
import { ChartConfigManagerComponent } from './Managementcomponents/chart-config-manager/chart-config-manager.component';
import { ComponentConfigManagerComponent } from './Managementcomponents/component-config-manager/component-config-manager.component';
import { NswagEditorComponent } from './Managementcomponents/nswag-editor/nswag-editor.component';
import { ModuleChartsComponent } from '../GenericComponents/ConnectComponents/module-charts/module-charts.component';
import { ApplicationGenericManagerComponent } from './components/application-generic-manager/application-generic-manager.component';

const routes: Routes =
  [
    {
      path: 'SummerRequestsManagement',
      redirectTo: '/EmployeeRequests/SummerRequestsManagement',
      pathMatch: 'full'
    },
    {
      path: 'SummerRequests',
      redirectTo: '/EmployeeRequests/SummerRequests',
      pathMatch: 'full'
    },
    {
      path: 'SummerRequests/edit/:id',
      redirectTo: '/EmployeeRequests/SummerRequests/edit/:id',
      pathMatch: 'full'
    },
    {
      path: 'resorts/unit-freeze',
      redirectTo: '/EmployeeRequests/resorts/unit-freeze',
      pathMatch: 'full'
    },
    {
      path: 'resorts/unit-freeze/create',
      redirectTo: '/EmployeeRequests/resorts/unit-freeze/create',
      pathMatch: 'full'
    },
    {
      path: 'resorts/unit-freeze/:id',
      redirectTo: '/EmployeeRequests/resorts/unit-freeze/:id',
      pathMatch: 'full'
    },
    {
      path: 'ApplicationGenericManager',
      component: ApplicationGenericManagerComponent,
      canActivate: [AuthNewGuardService],
      data: {
        func: 'ConnectSupperAdminFunc'
      }
    },
    {
      path: 'RegistrationRequests',
      component: RegistrationsRequestsComponent,
      canActivate: [AuthNewGuardService], data: {
        func: 'ConnectAdminFunc'
      }
    },
    {
      path: 'GetSideBarHierarchy',
      component: SideBarHierarchyComponent,
      canActivate: [AuthNewGuardService],
      data: {
        func: 'ConnectAdminFunc'
      }
    },
    {
      path: 'GetRoleHierarchy',
      component: RoleHierarchyComponent,
      canActivate: [AuthNewGuardService],
      data: {
        func: 'ConnectAdminFunc'
      }
    }, {
      path: 'DynamicFiledsManager',
      component: DynamicFieldsManagerComponent,
      canActivate: [AuthNewGuardService],
      data: {
        func: 'ConnectAdminFunc'
      }
    }, {
      path: 'ServerMonitorManager',
      component: ServerMonitorManagerComponent,
      canActivate: [AuthNewGuardService],
      data: {
        func: 'ConnectSupperAdminFunc'
      }
    },
    {
      path: 'ResetPassword',
      component: ResetUserPasswordComponent,
      canActivate: [AuthNewGuardService],
      data: {
        func: 'ConnectAdminFunc'
      }
    },
    {
      path: 'OnlineUsers',
      component: OnlinUsersComponent,
      canActivate: [AuthNewGuardService],
      data: {
        func: 'ConnectAdminFunc'
      }
    }, {
      path: 'ApplicationConfiguration',
      component: ComponentConfigManagerComponent,
      canActivate: [AuthNewGuardService], data: {
        func: 'ConnectSupperAdminFunc'
      }
    },
    {
      path: 'NswagConfiguration',
      component: NswagEditorComponent,
      canActivate: [AuthNewGuardService], data: {
        func: 'ConnectSupperAdminFunc'
      }
    },
    {
      path: 'ChartConfiguration',
      component: ChartConfigManagerComponent,
      canActivate: [AuthNewGuardService], data: {
        func: 'ConnectSupperAdminFunc'
      }
    },
    {
      path: 'ServiceDashboard',
      component: ModuleChartsComponent,
      canActivate: [AuthNewGuardService], data: {
        func: 'ServiceDashboardFunc'
      }
    }
  ];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminsRoutingModule { }
