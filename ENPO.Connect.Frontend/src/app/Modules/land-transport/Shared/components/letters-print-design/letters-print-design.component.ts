import { Component, Input } from '@angular/core';
import { VwLtraTransTraficPrint } from '../../services/LandTransport.service';


@Component({
  selector: 'app-letters-print-design',
  templateUrl: './letters-print-design.component.html',
  styleUrls: ['./letters-print-design.component.scss']
})
export class LettersPrintDesignComponent {
  @Input() vwLtraTransTraficPrint: VwLtraTransTraficPrint = {} as VwLtraTransTraficPrint;
}
