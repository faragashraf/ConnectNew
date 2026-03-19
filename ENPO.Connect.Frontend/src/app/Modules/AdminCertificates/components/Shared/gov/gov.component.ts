import { Component, Input } from '@angular/core';
import { MessageDto } from 'src/app/shared/services/BackendServices/AdministrativeCertificate/AdministrativeCertificate.dto';;
import { GenericFormsService } from 'src/app/Modules/GenericComponents/GenericForms.service';


@Component({
  selector: 'app-gov',
  templateUrl: './gov.component.html',
  styleUrls: ['./gov.component.scss']
})
export class GovComponent {
  @Input() formData: MessageDto = {} as MessageDto

  constructor(public genericFormService: GenericFormsService) { }
}
