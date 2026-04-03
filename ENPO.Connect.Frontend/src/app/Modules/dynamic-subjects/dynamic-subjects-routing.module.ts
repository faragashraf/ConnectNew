import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthNewGuardService } from 'src/app/shared/services/helper/auth-new-guard.service';
import { DynamicSubjectDashboardComponent } from './components/dashboard/dynamic-subject-dashboard.component';
import { DynamicSubjectEnvelopeEditorComponent } from './components/envelope-editor/dynamic-subject-envelope-editor.component';
import { DynamicSubjectEnvelopeListComponent } from './components/envelope-list/dynamic-subject-envelope-list.component';
import { DynamicSubjectsShellComponent } from './components/shell/dynamic-subjects-shell.component';
import { DynamicSubjectDetailComponent } from './components/subject-detail/dynamic-subject-detail.component';
import { DynamicSubjectEditorComponent } from './components/subject-editor/dynamic-subject-editor.component';
import { DynamicSubjectListComponent } from './components/subject-list/dynamic-subject-list.component';

const routes: Routes = [
  {
    path: '',
    component: DynamicSubjectsShellComponent,
    canActivate: [AuthNewGuardService],
    data: { func: 'AllEnpoUsersFunc' },
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DynamicSubjectDashboardComponent },
      { path: 'subjects', component: DynamicSubjectListComponent },
      { path: 'subjects/new', component: DynamicSubjectEditorComponent },
      { path: 'subjects/:id', component: DynamicSubjectDetailComponent },
      { path: 'subjects/:id/edit', component: DynamicSubjectEditorComponent },
      { path: 'envelopes', component: DynamicSubjectEnvelopeListComponent },
      { path: 'envelopes/new', component: DynamicSubjectEnvelopeEditorComponent },
      { path: 'envelopes/:id', component: DynamicSubjectEnvelopeEditorComponent }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DynamicSubjectsRoutingModule {}
