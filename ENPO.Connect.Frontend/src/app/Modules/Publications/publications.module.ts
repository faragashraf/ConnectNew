import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { PublicationsRoutingModule } from './publications-routing.module';
import { MainAdminLayoutComponent } from './components/main-admin-layout/main-admin-layout.component';
import { PrimengModule } from 'src/app/shared/Modules/primeng.module';
import { GenericModuleModule } from '../GenericComponents/generic-module.module';
import { ViewMainDataComponent } from './components/view-mail-data/view-main-data.component';
import { AddEditPublicationComponent } from './shared/add-edit-publication/add-edit-publication.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PublicationsController } from 'src/app/shared/services/BackendServices/Publications/Publications.service';
import { AttachmentsController } from 'src/app/shared/services/BackendServices/Attachments/Attachments.service';



@NgModule({
  declarations: [
    MainAdminLayoutComponent,
    ViewMainDataComponent,
    AddEditPublicationComponent,
  ],
  imports: [
    CommonModule,
    PrimengModule,
    FormsModule,
    ReactiveFormsModule,
    GenericModuleModule,
    PublicationsRoutingModule,
  ], schemas: [CUSTOM_ELEMENTS_SCHEMA], providers: [PublicationsController,AttachmentsController  ]
})
export class PublicationsModule { }
