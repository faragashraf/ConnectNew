import { Component, Input, ViewChild } from '@angular/core';
import { NgxSpinnerService } from 'ngx-spinner';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { AttchedObjectService } from 'src/app/shared/services/helper/attched-object.service';
import { ComponentConfig } from 'src/app/shared/models/Component.Config.model';
import { AttachmentsController } from 'src/app/shared/services/BackendServices/Attachments/Attachments.service';
import { FileParameter } from 'src/app/shared/services/BackendServices/dto-shared';
import { ReplyDto } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.dto';

@Component({
  selector: 'app-replies-list',
  templateUrl: './replies-list.component.html',
  styleUrls: ['./replies-list.component.scss']
})
export class RepliesListComponent {
  @Input() replyDtos: ReplyDto[] = [];
    @Input() config: ComponentConfig = {} as ComponentConfig;
  
  replyDto: ReplyDto = {} as ReplyDto
  fileParameters: FileParameter[] = [];
  constructor(private msgsService: MsgsService,
      private spinner: NgxSpinnerService, private attachmentsController: AttachmentsController,private attchedObjectService: AttchedObjectService) { }

  calculateRows(message: string): number {
    if (!message) return 1; // Ensure at least 1 row if message is empty
    const lines = message.split('\n').length;
    return Math.min(Math.max(lines, 1), 4); // Clamp between 1 and maxRows
  }

  ngOnInit() {
  }
  downloadAttachment(event:any) {
    this.spinner.show('جاريي تنزيل المرفق ..')
    this.attachmentsController.downloadDocument(event.id)
      .subscribe({
        next: (res: any) => {
          if (res.isSuccess) {
            if (res.data.length > 0)
              this.attchedObjectService.createObjectURL(res.data, event.fileName)
          }
          else {
            let errr = ''
            res.errors.forEach((e: any) => errr += e.message + "<br>")
            this.msgsService.msgError(errr, "هناك خطا ما", true);
          }
        },
        error: (err) => {
          this.msgsService.msgError(err.code, err.message, true)
          const newLocal = this;
          newLocal.msgsService.msgError(err, "", true)
        }
      });
  }
  handleRowExpand(event: any) {
    this.replyDto = event.data;
    // Clear previous file parameters
    this.fileParameters = [];

    // Process attachments for the expanded reply
    if (this.replyDto.attchShipmentDtos && this.replyDto.attchShipmentDtos.length > 0) {
      this.replyDto.attchShipmentDtos.forEach(attachment => {
        const fileParameter: FileParameter = {
          data: new File([], attachment.attchNm || 'unknown'),
          fileName: attachment.attchNm || 'unknown'
        };
        this.fileParameters.push(fileParameter);
      });
    }
  }

  onRowSelect(event: any) {
    console.log(event)
  }
  onRowUnselect(event: any) {
    this.replyDto = {} as ReplyDto
  }
  handleAttachCount(event: number) {
    // this.attachCount = event;
  }
}
