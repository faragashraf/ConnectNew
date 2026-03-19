import { Component } from '@angular/core';
import { LandTransportController, VwLtraTransTraficPrint } from '../../Shared/services/LandTransport.service';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-letters-print',
  templateUrl: './letters-print.component.html',
  styleUrls: ['./letters-print.component.scss']
})
export class LettersPrintComponent {


  pageSize: number = 5;
  totalRecords: number = 0;
  loading: boolean = false;
  currentPage: number = 1

  vwLtraTransTraficPrint: VwLtraTransTraficPrint[] = []
  IsReprint: boolean = false;

  barcode: string = '';
  plateNumber: string = '';
  constructor(private msg: MsgsService, private spinner: SpinnerService, private landTransportController: LandTransportController, private router: Router) { }

  ngOnInit() {
    
    // this.vwLtraTransTraficPrint = []
    if (this.router.url == `/LandTransport/PrintTrafficLetter`) {
      this.IsReprint = false;
      this.getTrafficLettersRequests();
    }
    if (this.router.url == `/LandTransport/RePrintTrafficLetter`) {
      this.IsReprint = true
    }
  }

  getTrafficLettersRequests() {
    this.spinner.show('جاري تحميل البيانات ..')
    this.landTransportController.getTransportationRequestsToPrint(this.currentPage, this.pageSize)
      .subscribe({
        next: (res: any) => {
          if (res.isSuccess) {
            
            this.vwLtraTransTraficPrint = res.data
            console.log('this.vwLtraTransTraficPrint',this.vwLtraTransTraficPrint);
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
  search(){
    this.spinner.show('جاري تحميل البيانات ..')
    this.landTransportController.getLLTR_request(this.barcode)
      .subscribe({
        next: (res: any) => {
          if (res.isSuccess) {
            
            this.vwLtraTransTraficPrint = res.data
            console.log('this.vwLtraTransTraficPrint',this.vwLtraTransTraficPrint);
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

}
