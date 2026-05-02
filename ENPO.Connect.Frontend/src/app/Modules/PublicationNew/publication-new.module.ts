import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PrimengModule } from 'src/app/shared/Modules/primeng.module';
import { PublicationNewRoutingModule } from './publication-new-routing.module';
import { AllPublicationsComponent } from './components/all-publications/all-publications.component';
import { PublicationNewApiService } from './shared/services/publication-new-api.service';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { GenericModuleModule } from '../GenericComponents/generic-module.module';

@NgModule({
  declarations: [AllPublicationsComponent],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    PrimengModule,
    GenericModuleModule,
    PublicationNewRoutingModule
  ],
  providers: [PublicationNewApiService]
})
export class PublicationNewModule { }
