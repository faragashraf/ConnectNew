import { Component, Input } from '@angular/core';
import { MessageDto } from 'src/app/shared/services/BackendServices/AdministrativeCertificate/AdministrativeCertificate.dto';;
import { GenericFormsService } from 'src/app/Modules/GenericComponents/GenericForms.service';

@Component({
  selector: 'app-accounts',
  templateUrl: './accounts.component.html',
  styleUrls: ['./accounts.component.scss']
})
export class AccountsComponent {
  @Input() formData: MessageDto = {} as MessageDto

  constructor(public genericFormService: GenericFormsService) { }
}
