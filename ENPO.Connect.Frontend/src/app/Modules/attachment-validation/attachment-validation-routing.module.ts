import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthNewGuardService } from 'src/app/shared/services/helper/auth-new-guard.service';
import { AttachmentValidationAdminPageComponent } from './pages/attachment-validation-admin-page/attachment-validation-admin-page.component';

const routes: Routes = [
  {
    path: '',
    component: AttachmentValidationAdminPageComponent,
    canActivate: [AuthNewGuardService],
    data: {
      func: 'ConnectSupperAdminFunc',
      configRouteKey: 'Admin/AttachmentValidation'
    }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AttachmentValidationRoutingModule {}
