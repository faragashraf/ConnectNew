import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';

import { EmployeeRequestsRoutingModule } from './EmployeeRequests-routing.module';
import { EmployeeSummerRequestsComponent } from './components/EmployeeSummerRequests/employee-summer-requests.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PrimengModule } from 'src/app/shared/Modules/primeng.module';
import { GenericModuleModule } from '../GenericComponents/generic-module.module';


@NgModule({
  declarations: [
    EmployeeSummerRequestsComponent
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