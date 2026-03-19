import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})
export class FooterComponent {
  @Input() rightString: string = ''
  @Input() middleString: string = ''
  @Input() leftString: string = ''
  @Input() stamptring: string = ''
}
