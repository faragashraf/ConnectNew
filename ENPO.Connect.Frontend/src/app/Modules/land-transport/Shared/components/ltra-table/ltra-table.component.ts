import { Component, Input, SimpleChanges } from '@angular/core';
import { LandTransportController, VwLtraTransTraficPrint } from '../../services/LandTransport.service';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';
import { PrintService, PrintStyles } from 'src/app/shared/services/helper/print.service';

@Component({
  selector: 'app-ltra-table',
  templateUrl: './ltra-table.component.html',
  styleUrls: ['./ltra-table.component.scss']
})
export class LtraTableComponent {
  @Input() vwLtraTransTraficPrint: VwLtraTransTraficPrint[] = [];
  traTransTrafic: VwLtraTransTraficPrint = {} as VwLtraTransTraficPrint
  @Input() IsReprint: boolean = false;

  pageSize: number = 5;
  totalRecords: number = 0;
  loading: boolean = false;
  currentPage: number = 1

  constructor(private msg: MsgsService, private spinner: SpinnerService, private landTransportController: LandTransportController,
    public printService: PrintService
  ) { }

  // Example for another button
  a4PortraitStyles: PrintStyles = {
    '@page': {
      'size': 'A4 portrait',
      'margin': '1cm'
    },
    'h1': {
      'color': 'red'
    }
  };

  // In your component class

  UpdatePrintStatus(item: VwLtraTransTraficPrint) {
    this.traTransTrafic = item
    this.spinner.show('جاري تحميل البيانات ..')
    this.landTransportController.updateRequestToPrintStatus(item.barcode, item.plateNumber)
      .subscribe({
        next: (res: any) => {
          if (res.isSuccess) {
            
            this.msg.msgSuccess(res.data);
            item.rlttBarcode = res.data.slice(-13);
            item.isPrint = true;
          }
          else {
            
            let errr = ''
            res.errors.forEach((e: any) => errr += e.message + "<br>")
            this.msg.msgError(errr, "هناك خطا ما", true);
          }
        },
        error: (err) => {
          
          this.msg.msgError(err.code, err.message, true)
          const newLocal = this;
          newLocal.msg.msgError(err, "", true)
        }
      });
  }
  afterPrint(item: VwLtraTransTraficPrint) {
    const index = this.vwLtraTransTraficPrint.indexOf(item);
    if (index !== -1 && !this.IsReprint) {
      this.vwLtraTransTraficPrint.splice(index, 1);
    }
  }
  ngOnChanges(changes: SimpleChanges) {

    this.vwLtraTransTraficPrint = []
    // React to input changes
    if (changes['vwLtraTransTraficPrint']) {
      const currentValue = changes['vwLtraTransTraficPrint'].currentValue;
      if (Array.isArray(currentValue)) {
        this.vwLtraTransTraficPrint = [...currentValue];  // Assign array copy
      } else if (typeof currentValue === 'object' && currentValue !== null) {
        this.vwLtraTransTraficPrint.push(currentValue); // Ensure it's an array
      } else {
        console.log('Neither array nor object:', currentValue);
      }
    }
  }
  onPageChange(event: any) {
    console.log('onPageChange', event);
  }
  onRowSelect(event: any): void {
    // console.log('Row Selected:', event.data);
  }

  onRowUnselect(event: any): void {
    // console.log('Row Unselected:', event.data);
  }

}
