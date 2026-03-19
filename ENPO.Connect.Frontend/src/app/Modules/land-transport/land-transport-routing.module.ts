import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LettersPrintComponent } from './components/letters-print/letters-print.component';
import { LetraReplyUploadComponent } from './components/letra-reply-upload/letra-reply-upload.component';
import { AuthNewGuardService } from 'src/app/shared/services/helper/auth-new-guard.service';

const routes: Routes = [
  {
    path: 'PrintTrafficLetter',
    component: LettersPrintComponent,
        canActivate: [AuthNewGuardService], data: {
          func: 'CORR_landTransport_PrintLetter'
        }
  },
  {
    path: 'RePrintTrafficLetter',
    component: LettersPrintComponent,
    canActivate: [AuthNewGuardService], data: {
      func: 'CORR_landTransport_PrintLetter'
    }
  },
  {
    path: 'LetraReplyUpload',
    component: LetraReplyUploadComponent,
    canActivate: [AuthNewGuardService], data: {
      func: 'CORR_landTransport_UploadReply'
    }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class LandTransportRoutingModule { }
