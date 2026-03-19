import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TotalReuestsParentComponent } from '../GenericComponents/ConnectComponents/total-Reuests-Parent/total-Reuests-Parent.component';
import { AuthNewGuardService } from 'src/app/shared/services/helper/auth-new-guard.service';
import { ModuleChartsComponent } from '../GenericComponents/ConnectComponents/module-charts/module-charts.component';

const routes: Routes = [
  {
    path: 'AreaRequests',
    component: TotalReuestsParentComponent,
    canActivate: [AuthNewGuardService], data: {
      func: 'AdminCerCSFunc'
    }
  }, {
    path: 'MyInbox',
    component: TotalReuestsParentComponent,
    canActivate: [AuthNewGuardService], data: {
      func: 'AdminCerInBoxFunc'
    }
  }, {
    path: 'MyOutbox',
    component: TotalReuestsParentComponent,
    canActivate: [AuthNewGuardService], data: {
      func: 'AdminCerOutBoxFunc'
    },
  }, {
    path: 'Chart',
    component: ModuleChartsComponent,
    canActivate: [AuthNewGuardService], data: {
      func: 'AdminCerReportsFunc'
    }
  },
  {
    path: 'Global',
    component: TotalReuestsParentComponent,
    canActivate: [AuthNewGuardService], data: {
      func: 'AdminCerReportsFunc'
    }
  },
  {
    path: 'Test',
    component: TotalReuestsParentComponent,
    canActivate: [AuthNewGuardService], data: {
      func: 'AdminCerCSFunc'
    }
  }, {
    path: 'Show',
    component: TotalReuestsParentComponent,
    canActivate: [AuthNewGuardService], data: {
      func: 'AdminCerCSFunc'
    }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminCerRoutingModule { }
