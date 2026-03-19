import { CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA, NgModule, APP_INITIALIZER } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { JWT_OPTIONS, JwtHelperService } from '@auth0/angular-jwt';
import { NgxSpinnerModule } from 'ngx-spinner';
import { BasicInterceptorService } from './shared/services/helper/basic-interceptor.service';
import { NavBarComponent } from './shared/components/nav-bar/nav-bar.component';
import { PrimengModule } from './shared/Modules/primeng.module';
import { MessageService, ConfirmationService } from 'primeng/api';
import { SpinnerService } from './shared/services/helper/spinner.service';
import { FormlyBootstrapModule } from '@ngx-formly/bootstrap';
import { FormlyModule } from '@ngx-formly/core';
import { LocationStrategy, HashLocationStrategy } from '@angular/common';
import { AuthorizationController } from './Modules/auth/services/Authorization.service';
import { ConditionalDate } from './shared/Pipe/Conditional-date.pipe';
import { AllNotificationsComponent } from './shared/components/all-notifications/all-notifications.component';
import { PowerBiController } from './Modules/enpopower-bi/services/PowerBi.service';
import { DomainAuthController } from './Modules/auth/services/Domain_Auth.service';
import { LandingComponent } from './shared/components/landing/landing.component';
import { SeasonalBannerComponent } from './shared/components/landing/seasonal-banner/seasonal-banner.component';
import { EmployeesAnnouncementsComponent } from './shared/components/employees-announcements/employees-announcements.component';
import { SharedComponentsModule } from './shared/components/shared-components.module';
import { OtpCodeInputComponent } from './shared/components/otp-code-input/otp-code-input.component';
import { DynamicFormController, PublicationsController } from './shared/services/BackendServices';
import { ThemeService } from './shared/services/theme.service';

@NgModule({
  declarations: [
    AppComponent,
    NavBarComponent,
    LandingComponent,
    SeasonalBannerComponent,
    EmployeesAnnouncementsComponent,
    ConditionalDate,
    AllNotificationsComponent
  ],
  imports: [
    NgxSpinnerModule,
    BrowserModule,
    HttpClientModule, // Import HttpClientModule
    AppRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    BrowserAnimationsModule,
    PrimengModule,
    SharedComponentsModule,
    OtpCodeInputComponent,

    FormlyBootstrapModule,
    FormlyModule.forRoot({
      validationMessages: [{ name: 'required', message: 'This field is required' }],
    }),

  ], schemas: [CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA],
  providers: [
    JwtHelperService, { provide: JWT_OPTIONS, useValue: JWT_OPTIONS }, { provide: LocationStrategy, useClass: HashLocationStrategy },
    { provide: HTTP_INTERCEPTORS, useClass: BasicInterceptorService, multi: true, },
    MessageService, ConfirmationService, SpinnerService, AuthorizationController, ConditionalDate, PowerBiController, DynamicFormController, DomainAuthController
    , PublicationsController,
    {
      provide: APP_INITIALIZER,
      useFactory: (themeService: ThemeService) => () => themeService.init(),
      deps: [ThemeService],
      multi: true
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
