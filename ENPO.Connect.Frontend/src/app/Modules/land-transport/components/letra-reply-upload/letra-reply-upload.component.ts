import { Component } from '@angular/core';
import {  LandTransportController } from '../../Shared/services/LandTransport.service';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';
import { FileParameter } from 'src/app/shared/services/BackendServices/dto-shared';

@Component({
  selector: 'app-letra-reply-upload',
  templateUrl: './letra-reply-upload.component.html',
  styleUrls: ['./letra-reply-upload.component.scss']
})
export class LetraReplyUploadComponent {

  constructor(private landTransportController: LandTransportController, private spinner: SpinnerService, private msg: MsgsService) { }

  fileParameters: FileParameter[] = []
  file: any;

  onFileChange(event: any) {
    this.file = []
    if (event.target.files.length > 0) {
      const file = event.target.files[0];
      this.file = file

      if (this.file) {
        let _fileParameters: FileParameter = {
          data: file,
          fileName: file.name
        }
        this.fileParameters.push(_fileParameters)
      }
    }
    event.target.value = '';
  }

  upload() {
    this.spinner.show('جاري تحميل الملف ..')
    this.landTransportController.uploadData(this.fileParameters[0])
      .subscribe({
        next: (res: any) => {
          if (res.isSuccess) {
            
            this.msg.msgSuccess(res.data)
          }
          else {
            
            let errr = ''
            res.errors.forEach((e: any) => errr += e.message + "<br>")
            this.msg.msgError(errr, "هناك خطا ما", true);
            this.fileParameters = []
          }
        },
        error: (err) => {
          
          this.msg.msgError(err.code, err.message, true)
          const newLocal = this;
          newLocal.msg.msgError(err, "", true)
          this.fileParameters = []
        },
        complete: () => {
          this.fileParameters = []
        }
      });
  }
}
