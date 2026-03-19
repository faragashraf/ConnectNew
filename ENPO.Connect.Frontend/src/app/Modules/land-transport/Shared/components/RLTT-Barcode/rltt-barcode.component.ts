import { Component, Input } from '@angular/core';
import { VwLtraTransTraficPrint } from '../../services/LandTransport.service';

@Component({
  selector: 'app-rltt-barcode',
  templateUrl: './rltt-barcode.component.html',
  styleUrls: ['./rltt-barcode.component.scss']
})
export class RlttBarcodeComponent {
  @Input() vwLtraTransTraficPrint: VwLtraTransTraficPrint = {} as VwLtraTransTraficPrint;
}
