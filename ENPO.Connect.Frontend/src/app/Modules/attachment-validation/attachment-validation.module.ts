import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PrimengModule } from 'src/app/shared/Modules/primeng.module';
import { AttachmentValidationRoutingModule } from './attachment-validation-routing.module';
import { AttachmentValidationAdminPageComponent } from './pages/attachment-validation-admin-page/attachment-validation-admin-page.component';
import { AttachmentValidationUploaderModule } from 'src/app/shared/components/attachment-validation-uploader/attachment-validation-uploader.module';

@NgModule({
  declarations: [AttachmentValidationAdminPageComponent],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    PrimengModule,
    AttachmentValidationUploaderModule,
    AttachmentValidationRoutingModule
  ]
})
export class AttachmentValidationModule {}
