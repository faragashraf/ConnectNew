import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthNewGuardService } from 'src/app/shared/services/helper/auth-new-guard.service';
import { RequestRuntimeCatalogPageComponent } from './pages/request-runtime-catalog-page/request-runtime-catalog-page.component';

const routes: Routes = [
  {
    path: '',
    component: RequestRuntimeCatalogPageComponent,
    canActivate: [AuthNewGuardService],
    data: { func: 'AllEnpoUsersFunc' }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class RequestRuntimeCatalogRoutingModule {}
