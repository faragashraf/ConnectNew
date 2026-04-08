import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthNewGuardService } from 'src/app/shared/services/helper/auth-new-guard.service';
import { AdminControlCenterCatalogPageComponent } from './pages/admin-control-center-catalog-page/admin-control-center-catalog-page.component';

const routes: Routes = [
  {
    path: '',
    component: AdminControlCenterCatalogPageComponent,
    canActivate: [AuthNewGuardService],
    data: { func: 'ConnectSupperAdminFunc' }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminControlCenterCatalogRoutingModule {}
