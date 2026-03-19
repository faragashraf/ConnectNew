import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { RegisterMeComponent } from './components/register-me/register-me.component';
import { AccessDeniedComponent } from './components/access-denied/access-denied.component';
import { AuthNewGuardService } from 'src/app/shared/services/helper/auth-new-guard.service';
import { EncryptDecryptComponent } from './components/encrypt-decrypt/encrypt-decrypt.component';

const routes: Routes = [
  {
    path: 'Login',
    component: LoginComponent
  }, {
    path: 'Register',
    component: RegisterMeComponent
  }, {
    path: 'AccessDenied',
    component: AccessDeniedComponent
  }, {
    path: 'EncryptDecrypt',
    component: EncryptDecryptComponent,
    canActivate: [AuthNewGuardService], data: {
      func: 'ConnectSupperAdminFunc'
    }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AuthRoutingModule { }
