import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PrimengModule } from 'src/app/shared/Modules/primeng.module';
import { AdminControlCenterCatalogRoutingModule } from './admin-control-center-catalog-routing.module';
import { AdminControlCenterCatalogPageComponent } from './pages/admin-control-center-catalog-page/admin-control-center-catalog-page.component';
import { AdminControlCenterCatalogFieldLibraryPageComponent } from './pages/admin-control-center-catalog-field-library-page/admin-control-center-catalog-field-library-page.component';
import { AdminControlCenterCatalogRoutingWorkspaceComponent } from './pages/admin-control-center-catalog-routing-workspace/admin-control-center-catalog-routing-workspace.component';
import { AdminControlCenterCatalogFieldAccessPolicyWorkspaceComponent } from './pages/admin-control-center-catalog-field-access-policy-workspace/admin-control-center-catalog-field-access-policy-workspace.component';
import { AdminControlCenterRequestPreviewPageComponent } from './pages/admin-control-center-request-preview-page/admin-control-center-request-preview-page.component';
import { AdminControlCenterCatalogDisplaySettingsWorkspaceComponent } from './pages/admin-control-center-catalog-display-settings-workspace/admin-control-center-catalog-display-settings-workspace.component';
import { FieldLibraryBindingPageComponent } from './pages/field-library-binding/field-library-binding-page.component';
import { FieldLibraryBindingEngine } from './domain/field-library-binding/field-library-binding.engine';

@NgModule({
  declarations: [
    AdminControlCenterCatalogPageComponent,
    AdminControlCenterCatalogFieldLibraryPageComponent,
    AdminControlCenterCatalogRoutingWorkspaceComponent,
    AdminControlCenterCatalogFieldAccessPolicyWorkspaceComponent,
    AdminControlCenterRequestPreviewPageComponent,
    AdminControlCenterCatalogDisplaySettingsWorkspaceComponent,
    FieldLibraryBindingPageComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    PrimengModule,
    AdminControlCenterCatalogRoutingModule
  ],
  providers: [
    FieldLibraryBindingEngine
  ]
})
export class AdminControlCenterCatalogModule {}
