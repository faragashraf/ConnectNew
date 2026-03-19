import { Component, Input } from '@angular/core';
import { MessageDto } from 'src/app/shared/services/BackendServices/AdministrativeCertificate/AdministrativeCertificate.dto';
import { GenericFormsService } from 'src/app/Modules/GenericComponents/GenericForms.service';
import { ConditionalDate } from 'src/app/shared/Pipe/Conditional-date.pipe';

@Component({
  selector: 'app-main-form',
  templateUrl: './main-form.component.html',
  styleUrls: ['./main-form.component.scss']
})
export class MainFormComponent {
  @Input() formData: MessageDto = {} as MessageDto

  constructor(public genericFormService: GenericFormsService, public conditionalDate: ConditionalDate) { }
}
