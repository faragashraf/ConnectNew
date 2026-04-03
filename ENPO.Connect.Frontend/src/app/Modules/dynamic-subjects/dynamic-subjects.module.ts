import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PrimengModule } from 'src/app/shared/Modules/primeng.module';
import { GenericModuleModule } from '../GenericComponents/generic-module.module';
import { DynamicSubjectDashboardComponent } from './components/dashboard/dynamic-subject-dashboard.component';
import { DynamicSubjectEnvelopeEditorComponent } from './components/envelope-editor/dynamic-subject-envelope-editor.component';
import { DynamicSubjectEnvelopeListComponent } from './components/envelope-list/dynamic-subject-envelope-list.component';
import { DynamicSubjectsShellComponent } from './components/shell/dynamic-subjects-shell.component';
import { DynamicSubjectDetailComponent } from './components/subject-detail/dynamic-subject-detail.component';
import { DynamicSubjectEditorComponent } from './components/subject-editor/dynamic-subject-editor.component';
import { DynamicSubjectListComponent } from './components/subject-list/dynamic-subject-list.component';
import { DynamicFieldsSectionComponent } from './components/shared/dynamic-fields-section/dynamic-fields-section.component';
import { DynamicSubjectsRoutingModule } from './dynamic-subjects-routing.module';

@NgModule({
  declarations: [
    DynamicSubjectsShellComponent,
    DynamicSubjectDashboardComponent,
    DynamicSubjectListComponent,
    DynamicSubjectEditorComponent,
    DynamicSubjectDetailComponent,
    DynamicSubjectEnvelopeListComponent,
    DynamicSubjectEnvelopeEditorComponent,
    DynamicFieldsSectionComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    PrimengModule,
    GenericModuleModule,
    DynamicSubjectsRoutingModule
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class DynamicSubjectsModule {}
