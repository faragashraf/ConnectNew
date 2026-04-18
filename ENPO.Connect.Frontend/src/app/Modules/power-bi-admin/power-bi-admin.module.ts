import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PrimengModule } from 'src/app/shared/Modules/primeng.module';
import { PowerBiStatementsComponent } from './components/power-bi-statements/power-bi-statements.component';
import { PowerBiAdminRoutingModule } from './power-bi-admin-routing.module';

@NgModule({
  declarations: [
    PowerBiStatementsComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    PrimengModule,
    PowerBiAdminRoutingModule
  ]
})
export class PowerBiAdminModule { }
