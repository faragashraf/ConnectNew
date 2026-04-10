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
import { DynamicSubjectTypeAdminComponent } from './components/dynamic-subject-type-admin/dynamic-subject-type-admin.component';
import { CentralAdminShellComponent } from './components/central-admin-shell/central-admin-shell.component';
import { CentralAdminPreviewWorkspaceComponent } from './components/central-admin-preview-workspace/central-admin-preview-workspace.component';

const routes: Routes =
  [
    {
      path: 'SummerRequestsManagement',
      redirectTo: '/EmployeeRequests/SummerRequestsManagement',
      pathMatch: 'full'
    },
    {
      path: 'SummerRequestsManagement/print-bookings',
      redirectTo: '/EmployeeRequests/SummerRequestsManagement/print-bookings',
      pathMatch: 'full'
    },
    {
      path: 'SummerRequests',
      redirectTo: '/EmployeeRequests/SummerRequests',
      pathMatch: 'full'
    },
    {
      path: 'SummerRequests/edit/:token',
      redirectTo: '/EmployeeRequests/SummerRequests/edit/:token',
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
        func: 'ConnectSupperAdminFunc'
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
    },
    {
      path: 'DynamicSubjectTypes',
      component: DynamicSubjectTypeAdminComponent,
      canActivate: [AuthNewGuardService], data: {
        func: 'ConnectSupperAdminFunc'
      }
    },
    {
      path: 'CentralAdminShellLegacy',
      component: CentralAdminShellComponent,
      canActivate: [AuthNewGuardService], data: {
        func: 'ConnectSupperAdminFunc'
      },
      children: [
        { path: '', redirectTo: 'subject-types', pathMatch: 'full' },
        { path: 'subject-types', component: DynamicSubjectTypeAdminComponent },
        { path: 'fields-library', component: DynamicFieldsManagerComponent },
        { path: 'application-configuration', component: ComponentConfigManagerComponent },
        { path: 'preview-workspace', component: CentralAdminPreviewWorkspaceComponent }
      ]
    },
    {
      path: 'CentralAdminShell',
      canActivate: [AuthNewGuardService], data: {
        func: 'ConnectSupperAdminFunc'
      },
      children: [
        { path: '', redirectTo: '/Admin/ControlCenter/scope-definition', pathMatch: 'full' },
        { path: 'subject-types', redirectTo: '/Admin/ControlCenter/scope-definition', pathMatch: 'full' },
        { path: 'fields-library', redirectTo: '/Admin/ControlCenterCatalog/field-library-binding', pathMatch: 'full' },
        { path: 'application-configuration', redirectTo: '/Admin/ControlCenter/workflow-routing', pathMatch: 'full' },
        { path: 'preview-workspace', redirectTo: '/Admin/ControlCenter/preview-simulation', pathMatch: 'full' },
        { path: '**', redirectTo: '/Admin/ControlCenter/scope-definition' }
      ]
    },
    {
      path: 'DynamicSubjectManagement',
      redirectTo: 'CentralAdminShell',
      pathMatch: 'full'
    }
  ];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminsRoutingModule { }
