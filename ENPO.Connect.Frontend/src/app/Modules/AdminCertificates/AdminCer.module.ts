import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PrimengModule } from 'src/app/shared/Modules/primeng.module';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';
import { RichTextEditorComponent } from './Shared/components/rich-text-editor/rich-text-editor.component';
import { AdminCerRoutingModule } from './AdminCer-routing.module';
import { FormlyBootstrapModule } from '@ngx-formly/bootstrap';
import { FormlyModule } from '@ngx-formly/core';
import { RemittancesComponent } from './components/Shared/Remittances/remittances.component';
import { FooterComponent } from './components/Shared/footer/footer.component';
import { HeaderComponent } from './components/Shared/header/header.component';
import { AuthorizationDataComponent } from './components/Shared/authorization-data/authorization-data.component';
import { GenericModuleModule } from '../GenericComponents/generic-module.module';
import { RequestStatusService } from './Shared/helper/RequestStatus.service';

@NgModule({
  declarations: [
    RichTextEditorComponent  
  ],
  imports: [
    CommonModule,
    AdminCerRoutingModule,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    PrimengModule,
    FormlyBootstrapModule,
    GenericModuleModule,
    FormlyModule.forRoot({
      validationMessages: [{ name: 'required', message: 'This field is required' }],
    }),
  ], providers: [SpinnerService,
     RequestStatusService, DecimalPipe]
  , schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AdminCerModule { }
