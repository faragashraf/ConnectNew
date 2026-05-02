import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthNewGuardService } from 'src/app/shared/services/helper/auth-new-guard.service';
import { AllPublicationsComponent } from './components/all-publications/all-publications.component';
import { CreatePublicationPageComponent } from './components/create-publication-page/create-publication-page.component';

const routes: Routes = [
  {
    path: '',
    component: AllPublicationsComponent,
    canActivate: [AuthNewGuardService],
    data: {
      func: 'AllEnpoUsersFunc'
    }
  },
  {
    path: 'create',
    component: CreatePublicationPageComponent,
    canActivate: [AuthNewGuardService],
    data: {
      func: 'AllEnpoUsersFunc'
    }
  },
  {
    path: 'AddNew',
    redirectTo: 'create',
    pathMatch: 'full'
  },
  {
    path: 'AllPublicationsComponent',
    redirectTo: '',
    pathMatch: 'full'
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PublicationNewRoutingModule { }
