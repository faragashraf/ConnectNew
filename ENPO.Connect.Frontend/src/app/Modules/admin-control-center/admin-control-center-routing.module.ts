import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthNewGuardService } from 'src/app/shared/services/helper/auth-new-guard.service';
import { ControlCenterShellComponent } from './components/control-center-shell/control-center-shell.component';
import { ControlCenterWorkspaceComponent } from './components/control-center-workspace/control-center-workspace.component';
import { ADMIN_CONTROL_CENTER_DEFAULT_STEP } from './domain/models/admin-control-center.models';
import { AdminControlCenterStepGuard } from './guards/admin-control-center-step.guard';
import { ScopeDefinitionPageComponent } from './pages/scope-definition/scope-definition-page.component';
import { SubjectStructurePageComponent } from './pages/subject-structure/subject-structure-page.component';
import { FieldLibraryBindingPageComponent } from './pages/field-library-binding/field-library-binding-page.component';
import { FormCompositionPageComponent } from './pages/form-composition/form-composition-page.component';
import { WorkflowRoutingPageComponent } from './pages/workflow-routing/workflow-routing-page.component';
import { AccessVisibilityPageComponent } from './pages/access-visibility/access-visibility-page.component';
import { ValidationRulesPageComponent } from './pages/validation-rules/validation-rules-page.component';
import { PreviewSimulationPageComponent } from './pages/preview-simulation/preview-simulation-page.component';
import { ReadinessAuditPageComponent } from './pages/readiness-audit/readiness-audit-page.component';
import { PublishReleasePageComponent } from './pages/publish-release/publish-release-page.component';

const routes: Routes = [
  {
    path: '',
    component: ControlCenterShellComponent,
    canActivate: [AuthNewGuardService],
    data: { func: 'ConnectSupperAdminFunc' },
    children: [
      { path: '', redirectTo: ADMIN_CONTROL_CENTER_DEFAULT_STEP, pathMatch: 'full' },
      {
        path: 'scope-definition',
        component: ScopeDefinitionPageComponent,
        canActivate: [AdminControlCenterStepGuard]
      },
      {
        path: 'subject-structure',
        component: SubjectStructurePageComponent,
        canActivate: [AdminControlCenterStepGuard]
      },
      {
        path: 'field-library-binding',
        component: FieldLibraryBindingPageComponent,
        canActivate: [AdminControlCenterStepGuard]
      },
      {
        path: 'form-composition',
        component: FormCompositionPageComponent,
        canActivate: [AdminControlCenterStepGuard]
      },
      {
        path: 'workflow-routing',
        component: WorkflowRoutingPageComponent,
        canActivate: [AdminControlCenterStepGuard]
      },
      {
        path: 'access-visibility',
        component: AccessVisibilityPageComponent,
        canActivate: [AdminControlCenterStepGuard]
      },
      {
        path: 'validation-rules',
        component: ValidationRulesPageComponent,
        canActivate: [AdminControlCenterStepGuard]
      },
      {
        path: 'preview-simulation',
        component: PreviewSimulationPageComponent,
        canActivate: [AdminControlCenterStepGuard]
      },
      {
        path: 'readiness-audit',
        component: ReadinessAuditPageComponent,
        canActivate: [AdminControlCenterStepGuard]
      },
      {
        path: 'publish-release',
        component: PublishReleasePageComponent,
        canActivate: [AdminControlCenterStepGuard]
      },
      {
        path: ':stepKey',
        component: ControlCenterWorkspaceComponent,
        canActivate: [AdminControlCenterStepGuard]
      },
      { path: '**', redirectTo: ADMIN_CONTROL_CENTER_DEFAULT_STEP }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminControlCenterRoutingModule {}
