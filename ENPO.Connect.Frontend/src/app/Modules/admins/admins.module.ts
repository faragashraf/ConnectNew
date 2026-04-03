import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AdminsRoutingModule } from './admins-routing.module';
import { TeamTreeComponent } from './components/team-tree/team-tree.component';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PrimengModule } from 'src/app/shared/Modules/primeng.module';
import { GenericModuleModule } from '../GenericComponents/generic-module.module';
import { DomainAuthController } from '../auth/services/Domain_Auth.service';
import { SSOController } from '../auth/services/SSO.service';
import { SideBarHierarchyComponent } from './components/side-bar-hierarchy/side-bar-hierarchy.component';
import { RegistrationsRequestsComponent } from './components/registrations-requests/registrations-requests.component';
import { RoleHierarchyComponent } from './components/role-hierarchy/role-hierarchy.component';
import { DynamicFieldsManagerComponent } from './Managementcomponents/dynamic-fields-manager/dynamic-fields-manager.component';
import { GenericElementDetailsComponent } from './components/generic-element-details/generic-element-details.component';
import { GenericFormsService } from '../GenericComponents/GenericForms.service';
import { ServerMonitorManagerComponent } from './components/server-monitor-manager/server-monitor-manager.component';
import { ResetUserPasswordComponent } from './components/reset-user-password/reset-user-password.component';
import { AuthorizationController } from '../auth/services/Authorization.service';
import { OnlinUsersComponent } from './components/onlin-users/onlin-users.component';
import { ChartConfigManagerComponent } from './Managementcomponents/chart-config-manager/chart-config-manager.component';
import { NswagEditorComponent } from './Managementcomponents/nswag-editor/nswag-editor.component';
import { ComponentConfigManagerComponent } from './Managementcomponents/component-config-manager/component-config-manager.component';
import { ApplicationGenericManagerComponent } from './components/application-generic-manager/application-generic-manager.component';
import { DynamicSubjectTypeAdminComponent } from './components/dynamic-subject-type-admin/dynamic-subject-type-admin.component';
// SidebarComponent is provided by GenericModuleModule now


@NgModule({
  declarations: [
    TeamTreeComponent,
    RegistrationsRequestsComponent,
    SideBarHierarchyComponent,
    RoleHierarchyComponent,
    DynamicFieldsManagerComponent,
    GenericElementDetailsComponent,
    ServerMonitorManagerComponent,
    ResetUserPasswordComponent,
    OnlinUsersComponent,
    ChartConfigManagerComponent,
    ComponentConfigManagerComponent,
    NswagEditorComponent,
    ApplicationGenericManagerComponent,
    DynamicSubjectTypeAdminComponent
  ],
  imports: [
    CommonModule,
    AdminsRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    PrimengModule,
    GenericModuleModule
  ],
  providers: [DomainAuthController, SSOController, GenericFormsService, AuthorizationController],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AdminsModule { }
