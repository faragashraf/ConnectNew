import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { TopMaganementRoutingModule } from './top-maganement-routing.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PrimengModule } from 'src/app/shared/Modules/primeng.module';
import { GenericModuleModule } from '../GenericComponents/generic-module.module';
import { AddEditSubjectComponent } from './components/AddEditSubject/add-edit-subject.component';


@NgModule({
  declarations: [
    AddEditSubjectComponent
  ],
  imports: [
    CommonModule,
    PrimengModule,
    FormsModule,
    ReactiveFormsModule,
    GenericModuleModule,
    TopMaganementRoutingModule
  ], schemas: [CUSTOM_ELEMENTS_SCHEMA],
  providers: []

})
export class TopMaganementModule { }
 