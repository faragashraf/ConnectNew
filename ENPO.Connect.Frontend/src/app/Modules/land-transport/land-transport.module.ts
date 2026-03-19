import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { LandTransportRoutingModule } from './land-transport-routing.module';
import { LettersPrintComponent } from './components/letters-print/letters-print.component';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PrimengModule } from 'src/app/shared/Modules/primeng.module';
import { LandTransportController } from './Shared/services/LandTransport.service';
import { LettersPrintDesignComponent } from './Shared/components/letters-print-design/letters-print-design.component';
import { LetraReplyUploadComponent } from './components/letra-reply-upload/letra-reply-upload.component';
import { RlttBarcodeComponent } from './Shared/components/RLTT-Barcode/rltt-barcode.component';
import { LtraTableComponent } from './Shared/components/ltra-table/ltra-table.component';
import { GenericModuleModule } from '../GenericComponents/generic-module.module';


@NgModule({
  declarations: [
    LettersPrintComponent,
    LettersPrintDesignComponent,
    LetraReplyUploadComponent,
    RlttBarcodeComponent,
    LtraTableComponent
  ],
  imports: [
    CommonModule,
    LandTransportRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    PrimengModule,
    GenericModuleModule
    
  ],providers:[LandTransportController]
})
export class LandTransportModule { }
