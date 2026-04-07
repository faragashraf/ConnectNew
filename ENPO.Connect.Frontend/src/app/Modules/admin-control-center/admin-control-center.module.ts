import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PrimengModule } from 'src/app/shared/Modules/primeng.module';
import { AdminControlCenterRoutingModule } from './admin-control-center-routing.module';
import { ControlCenterShellComponent } from './components/control-center-shell/control-center-shell.component';
import { ControlCenterWorkspaceComponent } from './components/control-center-workspace/control-center-workspace.component';
import { ControlCenterSummaryComponent } from './components/control-center-summary/control-center-summary.component';
import { AdminControlCenterStepGuard } from './guards/admin-control-center-step.guard';
import { AdminControlCenterFacade } from './facades/admin-control-center.facade';
import { AdminControlCenterStore } from './store/admin-control-center.store';
import { AdminControlCenterWorkflowEngine } from './domain/workflow/admin-control-center-workflow.engine';
import { ScopeDefinitionPageComponent } from './pages/scope-definition/scope-definition-page.component';
import { SubjectStructurePageComponent } from './pages/subject-structure/subject-structure-page.component';
import { FieldLibraryBindingPageComponent } from './pages/field-library-binding/field-library-binding-page.component';
import { SubjectStructureEngine } from './domain/subject-structure/subject-structure.engine';
import { FieldLibraryBindingEngine } from './domain/field-library-binding/field-library-binding.engine';
import { FormCompositionPageComponent } from './pages/form-composition/form-composition-page.component';
import { WorkflowRoutingPageComponent } from './pages/workflow-routing/workflow-routing-page.component';
import { AccessVisibilityPageComponent } from './pages/access-visibility/access-visibility-page.component';
import { ValidationRulesPageComponent } from './pages/validation-rules/validation-rules-page.component';
import { FormCompositionEngine } from './domain/form-composition/form-composition.engine';
import { WorkflowRoutingEngine } from './domain/workflow-routing/workflow-routing.engine';
import { AccessVisibilityEngine } from './domain/access-visibility/access-visibility.engine';
import { ValidationRulesEngine } from './domain/validation-rules/validation-rules.engine';
import { PreviewSimulationPageComponent } from './pages/preview-simulation/preview-simulation-page.component';
import { ReadinessAuditPageComponent } from './pages/readiness-audit/readiness-audit-page.component';
import { PublishReleasePageComponent } from './pages/publish-release/publish-release-page.component';
import { PreviewSimulationEngine } from './domain/preview-simulation/preview-simulation.engine';
import { PreviewSimulationArtifactEngine } from './domain/preview-simulation/preview-simulation-artifact.engine';
import { ReadinessAuditEngine } from './domain/readiness-audit/readiness-audit.engine';
import { RuntimeRequestIntegrationEngine } from './domain/runtime-request/runtime-request-integration.engine';
import { PublishReleaseEngine } from './domain/publish-release/publish-release.engine';
import { AdminControlCenterDraftStorageService } from './services/admin-control-center-draft-storage.service';
import { AdminControlCenterDemoScopeService } from './services/admin-control-center-demo-scope.service';

@NgModule({
  declarations: [
    ControlCenterShellComponent,
    ControlCenterWorkspaceComponent,
    ControlCenterSummaryComponent,
    ScopeDefinitionPageComponent,
    SubjectStructurePageComponent,
    FieldLibraryBindingPageComponent,
    FormCompositionPageComponent,
    WorkflowRoutingPageComponent,
    AccessVisibilityPageComponent,
    ValidationRulesPageComponent,
    PreviewSimulationPageComponent,
    ReadinessAuditPageComponent,
    PublishReleasePageComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    PrimengModule,
    AdminControlCenterRoutingModule
  ],
  providers: [
    AdminControlCenterWorkflowEngine,
    AdminControlCenterDraftStorageService,
    AdminControlCenterDemoScopeService,
    AdminControlCenterStore,
    AdminControlCenterFacade,
    AdminControlCenterStepGuard,
    SubjectStructureEngine,
    FieldLibraryBindingEngine,
    FormCompositionEngine,
    WorkflowRoutingEngine,
    AccessVisibilityEngine,
    ValidationRulesEngine,
    PreviewSimulationEngine,
    PreviewSimulationArtifactEngine,
    ReadinessAuditEngine,
    RuntimeRequestIntegrationEngine,
    PublishReleaseEngine
  ]
})
export class AdminControlCenterModule {}
