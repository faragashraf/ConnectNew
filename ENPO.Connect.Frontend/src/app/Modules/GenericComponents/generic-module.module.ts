import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgxSpinnerModule } from 'ngx-spinner';
import { PrimengModule } from 'src/app/shared/Modules/primeng.module';
import { GenericFormArrayComponent } from './generic-form-array/generic-form-array.component';
import { GenericTableComponent } from './GenericComponent/Generic-Table/Generic-Table.component';
import { DateComponent } from './GenericComponent/date/date.component';
import { DomainUserComponent } from './GenericComponent/domain-user/domain-user.component';
import { TextareaComponent } from './GenericComponent/textarea/textarea.component';
import { DropdownComponent } from './GenericComponent/dropdown/dropdown.component';
import { InputTextIntegeronlyComponent } from './GenericComponent/input-text-integeronly/input-text-integeronly.component';
import { InputTextComponent } from './GenericComponent/input-text/input-text.component';
import { RadioButtonComponent } from './GenericComponent/radio-button/radio-button.component';
import { FileInputComponent } from './GenericComponent/file-input/file-input.component';
import { SidebarComponent } from './GenericComponent/sidebar/sidebar.component';
import { GenericTreeComponent } from './GenericComponent/generic-sidebar/generic-tree.component';
import { GenericButtonComponent } from './GenericComponent/generic-button/generic-button.component';
import { AddAttachmentsComponent } from './ConnectComponents/add-attachments/add-attachments.component';
import { ChoiceHintComponent } from './GenericComponent/choice-hint/choice-hint.component';
import { FormDetailsComponent } from './ConnectComponents/form-details/form-details.component';
import { DtoRendererComponent } from '../admins/Managementcomponents/component-config-manager/dto-renderer/dto-renderer.component';


import { NgxPrintModule } from 'ngx-print';
import { NgxBarcodeModule } from 'ngx-barcode';
import { DropdownTreeComponent } from './GenericComponent/dropdown-tree/dropdown-tree.component';
import { MailComposerComponent } from './GenericComponent/mail-composer/mail-composer.component';
import { RequestTableComponent } from './ConnectComponents/request-table/request-table.component';
import { RepliesListComponent } from './ConnectComponents/replies-list/replies-list.component';
import { ReplyComponent } from './ConnectComponents/reply/reply.component';
import { SeachDomainUsersComponent } from '../AdminCertificates/Shared/components/seach-domain-users/seach-domain-users.component';
import { TotalReuestsParentComponent } from './ConnectComponents/total-Reuests-Parent/total-Reuests-Parent.component';
import { AttachmentsController } from 'src/app/shared/services/BackendServices/Attachments/Attachments.service';
import { RepliesController } from 'src/app/shared/services/BackendServices/Replies/Replies.service';
import { GenericChartComponent } from './GenericComponent/generic-chart/generic-chart.component';
import { ModuleChartsComponent } from './ConnectComponents/module-charts/module-charts.component';
import { InViewportDirective } from 'src/app/shared/directives/in-viewport.directive';
import { DateTimeComponent } from './GenericComponent/date-time/date-time.component';
import { ToggleSwitchComponent } from './GenericComponent/toggle-switch/toggle-switch.component';
import { PrePrintFormComponent } from '../AdminCertificates/components/PrintForms/pre-print-form/pre-print-form.component';
import { AwbPrintComponent } from '../AdminCertificates/components/PrintForms/awb-print/awb-print.component';
import { MainFormComponent } from '../AdminCertificates/components/PrintForms/main-form/main-form.component';
import { AccountsComponent } from '../AdminCertificates/components/Shared/accounts/accounts.component';
import { GovComponent } from '../AdminCertificates/components/Shared/gov/gov.component';
import { PostalComponent } from '../AdminCertificates/components/Shared/postal/postal.component';
import { ToAnyComponent } from '../AdminCertificates/components/Shared/to-any/to-any.component';
import { ToJudicialAuthorityComponent } from '../AdminCertificates/components/Shared/to-judicial-authority/to-judicial-authority.component';
import { AuthorizationDataComponent } from '../AdminCertificates/components/Shared/authorization-data/authorization-data.component';
import { FooterComponent } from '../AdminCertificates/components/Shared/footer/footer.component';
import { HeaderComponent } from '../AdminCertificates/components/Shared/header/header.component';
import { RemittancesComponent } from '../AdminCertificates/components/Shared/Remittances/remittances.component';
import { OtpCodeInputComponent } from 'src/app/shared/components/otp-code-input/otp-code-input.component';

@NgModule({
  declarations: [
    GenericFormArrayComponent,
    GenericTableComponent,
    DateComponent,
    DomainUserComponent,
    InputTextComponent,
    RadioButtonComponent,
    DropdownComponent,
    InputTextIntegeronlyComponent,
    TextareaComponent,
    GenericButtonComponent,
    SidebarComponent,
    GenericTreeComponent,
    FileInputComponent,
    AddAttachmentsComponent,
    ChoiceHintComponent,
    DtoRendererComponent,
    FormDetailsComponent,
    DropdownTreeComponent,
    MailComposerComponent,
    TotalReuestsParentComponent,
    RequestTableComponent,
    /** Admin Cer components */
    PrePrintFormComponent,

    MainFormComponent,
    FooterComponent,
    HeaderComponent,
    RemittancesComponent,
    AuthorizationDataComponent,
    AccountsComponent,
    ToJudicialAuthorityComponent,
    ToAnyComponent,
    PostalComponent,
    GovComponent,
    AwbPrintComponent,

    ReplyComponent,
    RepliesListComponent,
    SeachDomainUsersComponent,
    GenericChartComponent,
    ModuleChartsComponent,
    InViewportDirective,
    DateTimeComponent,
    ToggleSwitchComponent
  ],
  imports: [
    CommonModule,
    NgxSpinnerModule,
    HttpClientModule, // Import HttpClientModule
    FormsModule,
    ReactiveFormsModule,
    PrimengModule,
    NgxPrintModule,
    NgxBarcodeModule,
    OtpCodeInputComponent
  ], exports: [
    GenericFormArrayComponent,
    GenericTableComponent,
    DateComponent,
    DomainUserComponent,
    InputTextComponent,
    RadioButtonComponent,
    DropdownComponent,
    InputTextIntegeronlyComponent,
    TextareaComponent,
    GenericButtonComponent,
    SidebarComponent,
    GenericTreeComponent,
    FileInputComponent,
    DtoRendererComponent,
    AddAttachmentsComponent,
    ChoiceHintComponent,
    FormDetailsComponent,
    MailComposerComponent,
    TotalReuestsParentComponent,
    RequestTableComponent,
OtpCodeInputComponent,
    /** Admin Cer components */
    PrePrintFormComponent,
    

    FooterComponent,
    HeaderComponent,
    RemittancesComponent,
    AuthorizationDataComponent,
    MainFormComponent,
    AccountsComponent,
    ToJudicialAuthorityComponent,
    ToAnyComponent,
    PostalComponent,
    GovComponent,
    AwbPrintComponent,

    ReplyComponent,
    RepliesListComponent,
    SeachDomainUsersComponent,
    ModuleChartsComponent,
    GenericChartComponent,
    InViewportDirective,
    ToggleSwitchComponent,

    NgxPrintModule,
    NgxBarcodeModule
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  providers: [AttachmentsController, RepliesController]
})
export class GenericModuleModule { }
