import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthNewGuardService } from 'src/app/shared/services/helper/auth-new-guard.service';
import { PowerBiStatementsComponent } from './components/power-bi-statements/power-bi-statements.component';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'Statements',
    pathMatch: 'full'
  },
  {
    path: 'Statements',
    component: PowerBiStatementsComponent,
    canActivate: [AuthNewGuardService],
    data: {
      func: 'ConnectSupperAdminFunc'
    }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PowerBiAdminRoutingModule { }
