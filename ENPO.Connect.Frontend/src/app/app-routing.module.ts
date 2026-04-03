import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LandingComponent } from './shared/components/landing/landing.component';
import { EmployeesAnnouncementsComponent } from './shared/components/employees-announcements/employees-announcements.component';
import { PostofficesListComponent } from './shared/components/postoffices-list/postoffices-list.component';
import { AtmListComponent } from './shared/components/atm-list/atm-list.component';
import { AddEditSubjectComponent } from './Modules/top-maganement/components/AddEditSubject/add-edit-subject.component';
import { AuthNewGuardService } from './shared/services/helper/auth-new-guard.service';

const routes: Routes = [
  { path: '', redirectTo: '/Home', pathMatch: 'full' },
  { path: 'Home', component: LandingComponent },
  { path: 'employees-announcements', component: EmployeesAnnouncementsComponent },
  {
    path: 'postoffices', component: PostofficesListComponent,
    canActivate: [AuthNewGuardService], data: {
      func: 'AllEnpoUsersFunc'
    }
  },
  {
    path: 'ATMlIST', component: AtmListComponent,
    canActivate: [AuthNewGuardService], data: {
      func: 'AllEnpoUsersFunc'
    }
  },
  {
    path: 'NewRequest',
    component: AddEditSubjectComponent,
    canActivate: [AuthNewGuardService], data: {
      func: 'AllEnpoUsersFunc'
    }
  },
  { path: 'Auth', loadChildren: () => import('./Modules/auth/auth.module').then(m => m.AuthModule) },
  { path: 'admin/resorts/unit-freeze', redirectTo: '/Admin/resorts/unit-freeze', pathMatch: 'full' },
  { path: 'admin/resorts/unit-freeze/create', redirectTo: '/Admin/resorts/unit-freeze/create', pathMatch: 'full' },
  { path: 'admin/resorts/unit-freeze/:id', redirectTo: '/Admin/resorts/unit-freeze/:id', pathMatch: 'full' },
  { path: 'Admin', loadChildren: () => import('./Modules/admins/admins.module').then(m => m.AdminsModule) },
  { path: 'Docs', loadChildren: () => import('./Modules/docs/docs.module').then(m => m.DocsModule) },
  { path: 'AdminCer', loadChildren: () => import('./Modules/AdminCertificates/AdminCer.module').then(m => m.AdminCerModule) },
  { path: 'LandTransport', loadChildren: () => import('./Modules/land-transport/land-transport.module').then(m => m.LandTransportModule) },
  { path: 'ENPOPowerBi', loadChildren: () => import('./Modules/enpopower-bi/enpopower-bi.module').then(m => m.ENPOPowerBiModule) },
  { path: 'Publications', loadChildren: () => import('./Modules/Publications/publications.module').then(m => m.PublicationsModule) },
  { path: 'TopManagement', loadChildren: () => import('./Modules/top-maganement/top-maganement.module').then(m => m.TopMaganementModule) },
  { path: 'EmployeeRequests', loadChildren: () => import('./Modules/EmployeeRequests/EmployeeRequests.module').then(m => m.EmployeeRequestsModule) },
  { path: 'DynamicSubjects', loadChildren: () => import('./Modules/dynamic-subjects/dynamic-subjects.module').then(m => m.DynamicSubjectsModule) },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
