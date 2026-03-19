import { Component, Input } from '@angular/core';
import { MessageDto } from 'src/app/shared/services/BackendServices/AdministrativeCertificate/AdministrativeCertificate.dto';;
import { GenericFormsService } from 'src/app/Modules/GenericComponents/GenericForms.service';

@Component({
  selector: 'app-authorization-data',
  templateUrl: './authorization-data.component.html',
  styleUrls: ['./authorization-data.component.scss']
})
export class AuthorizationDataComponent {
  @Input() formData: MessageDto = {} as MessageDto

  constructor(public genericFormService: GenericFormsService) { }
}
