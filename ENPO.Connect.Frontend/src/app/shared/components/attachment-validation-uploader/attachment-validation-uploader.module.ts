import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PrimengModule } from '../../Modules/primeng.module';
import { AttachmentValidationUploaderComponent } from './attachment-validation-uploader.component';

@NgModule({
  declarations: [AttachmentValidationUploaderComponent],
  imports: [CommonModule, PrimengModule],
  exports: [AttachmentValidationUploaderComponent]
})
export class AttachmentValidationUploaderModule {}
