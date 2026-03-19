import { Component, Input } from '@angular/core';
import { MessageDto } from 'src/app/shared/services/BackendServices/AdministrativeCertificate/AdministrativeCertificate.dto';;
import { GenericFormsService } from 'src/app/Modules/GenericComponents/GenericForms.service';
import { ConditionalDate } from 'src/app/shared/Pipe/Conditional-date.pipe';

@Component({
  selector: 'app-remittances',
  templateUrl: './remittances.component.html',
  styleUrls: ['./remittances.component.scss']
})
export class RemittancesComponent {
  @Input() formData: MessageDto = {} as MessageDto

  constructor(public genericFormService: GenericFormsService,public conditionalDate: ConditionalDate) { }
}
