import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PrimengModule } from 'src/app/shared/Modules/primeng.module';
import { RequestRuntimeCatalogPageComponent } from './pages/request-runtime-catalog-page/request-runtime-catalog-page.component';
import { RequestRuntimeCatalogRoutingModule } from './request-runtime-catalog-routing.module';
import { RequestRuntimeCatalogApiService } from './services/request-runtime-catalog-api.service';
import { RequestRuntimeCatalogFacadeService } from './services/request-runtime-catalog-facade.service';

@NgModule({
  declarations: [RequestRuntimeCatalogPageComponent],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    PrimengModule,
    RequestRuntimeCatalogRoutingModule
  ],
  providers: [
    RequestRuntimeCatalogApiService,
    RequestRuntimeCatalogFacadeService
  ]
})
export class RequestRuntimeCatalogModule {}
