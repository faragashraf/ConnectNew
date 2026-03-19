import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ENPOPowerBiRoutingModule } from './enpopower-bi-routing.module';
import { QueryBuilderComponent } from './components/query-builder/query-builder.component';
import { PrimengModule } from 'src/app/shared/Modules/primeng.module';
import { PowerBiController } from './services/PowerBi.service';
import { SelectGroupsComponent } from './components/select-groups/select-groups.component';
import { SelectStatementComponent } from './components/Shared/select-statement/select-statement.component';
import { GenerateQueryService } from './services/generate-query.service';
import { SelectGroupsHierarchyComponent } from './components/Shared/select-groups-hierarchy/select-groups-hierarchy.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SelectGroupsHierarchyService } from './services/select-groups-hierarchy.service';
import { GenericModuleModule } from '../GenericComponents/generic-module.module';


@NgModule({
  declarations: [
    QueryBuilderComponent,
    SelectGroupsComponent,
    SelectStatementComponent,
    SelectGroupsHierarchyComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ENPOPowerBiRoutingModule,
    PrimengModule,
    GenericModuleModule
  ], providers: [PowerBiController, GenerateQueryService,SelectGroupsHierarchyService],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ENPOPowerBiModule { }
