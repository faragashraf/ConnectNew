import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PrimengModule } from 'src/app/shared/Modules/primeng.module';
import { AdminControlCenterCatalogRoutingModule } from './admin-control-center-catalog-routing.module';
import { AdminControlCenterCatalogPageComponent } from './pages/admin-control-center-catalog-page/admin-control-center-catalog-page.component';
import { AdminControlCenterCatalogFieldLibraryPageComponent } from './pages/admin-control-center-catalog-field-library-page/admin-control-center-catalog-field-library-page.component';
import { AdminControlCenterCatalogRoutingWorkspaceComponent } from './pages/admin-control-center-catalog-routing-workspace/admin-control-center-catalog-routing-workspace.component';
import { AdminControlCenterCatalogFieldAccessPolicyWorkspaceComponent } from './pages/admin-control-center-catalog-field-access-policy-workspace/admin-control-center-catalog-field-access-policy-workspace.component';

@NgModule({
  declarations: [
    AdminControlCenterCatalogPageComponent,
    AdminControlCenterCatalogFieldLibraryPageComponent,
    AdminControlCenterCatalogRoutingWorkspaceComponent,
    AdminControlCenterCatalogFieldAccessPolicyWorkspaceComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    PrimengModule,
    AdminControlCenterCatalogRoutingModule
  ]
})
export class AdminControlCenterCatalogModule {}
