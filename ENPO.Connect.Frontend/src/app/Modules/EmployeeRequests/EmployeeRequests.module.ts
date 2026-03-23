import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';

import { EmployeeRequestsRoutingModule } from './EmployeeRequests-routing.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PrimengModule } from 'src/app/shared/Modules/primeng.module';
import { GenericModuleModule } from '../GenericComponents/generic-module.module';
import { SummerRequestsWorkspaceComponent } from './components/summer-requests-workspace/workspace-screen/summer-requests-workspace.component';
import { SummerRequestsAdminConsoleComponent } from './components/summer-requests-admin-console/summer-requests-admin-console.component';
import { SummerDynamicBookingBuilderComponent } from './components/summer-requests-workspace/dynamic-booking-builder-screen/summer-dynamic-booking-builder.component';
import { GenericDynamicFormDetailsComponent } from './components/generic-dynamic-form-details/generic-dynamic-form-details.component';
import { SummerRequestOwnerCardComponent } from './components/summer-shared/summer-request-owner-card/summer-request-owner-card.component';
import { SummerRequestFieldsGridComponent } from './components/summer-shared/summer-request-fields-grid/summer-request-fields-grid.component';
import { SummerAttachmentsListComponent } from './components/summer-shared/summer-attachments-list/summer-attachments-list.component';
import { SummerUpdatesTimelineComponent } from './components/summer-shared/summer-updates-timeline/summer-updates-timeline.component';
import { SummerRequestsListComponent } from './components/summer-shared/summer-requests-list/summer-requests-list.component';
import { SummerRequestCompanionsTableComponent } from './components/summer-shared/summer-request-companions-table/summer-request-companions-table.component';


@NgModule({
  declarations: [
    SummerRequestsWorkspaceComponent,
    SummerRequestsAdminConsoleComponent,
    SummerDynamicBookingBuilderComponent,
    GenericDynamicFormDetailsComponent,
    SummerRequestOwnerCardComponent,
    SummerRequestFieldsGridComponent,
    SummerAttachmentsListComponent,
    SummerUpdatesTimelineComponent,
    SummerRequestsListComponent,
    SummerRequestCompanionsTableComponent
  ],
  imports: [
    CommonModule,
    PrimengModule,
    FormsModule,
    ReactiveFormsModule,
    GenericModuleModule,
    EmployeeRequestsRoutingModule
  ], schemas: [CUSTOM_ELEMENTS_SCHEMA],
  providers: []

})
export class EmployeeRequestsModule { }
