import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AuthRoutingModule } from './auth-routing.module';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PrimengModule } from '../../shared/Modules/primeng.module';
import { SharedComponentsModule } from '../../shared/components/shared-components.module';
import { SSOController } from './services/SSO.service';
import { DomainAuthController } from './services/Domain_Auth.service';
import { LoginComponent } from './components/login/login.component';
import { RegisterMeComponent } from './components/register-me/register-me.component';
import { AccessDeniedComponent } from './components/access-denied/access-denied.component';
import { GenericModuleModule } from "../GenericComponents/generic-module.module";
import { EncryptDecryptComponent } from './components/encrypt-decrypt/encrypt-decrypt.component';



@NgModule({
  declarations: [
    LoginComponent,
    RegisterMeComponent,
    AccessDeniedComponent,
    EncryptDecryptComponent
  ],
  imports: [
    AuthRoutingModule,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    PrimengModule,
    SharedComponentsModule,
    GenericModuleModule
  ], providers: [SSOController, DomainAuthController],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AuthModule { }
