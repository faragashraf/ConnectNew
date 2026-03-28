import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';

import { EmployeeRequestsRoutingModule } from './EmployeeRequests-routing.module';
import { SummerRequestsFeatureModule } from './summer-requests-feature/summer-requests-feature.module';


@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    SummerRequestsFeatureModule,
    EmployeeRequestsRoutingModule
  ], schemas: [CUSTOM_ELEMENTS_SCHEMA],
  providers: []

})
export class EmployeeRequestsModule { }
