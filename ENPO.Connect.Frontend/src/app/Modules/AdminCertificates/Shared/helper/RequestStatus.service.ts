import { Injectable } from "@angular/core";
import { MsgsService } from "src/app/shared/services/helper/msgs.service";
import { SpinnerService } from "src/app/shared/services/helper/spinner.service";
import { AdministrativeCertificateController } from "src/app/shared/services/BackendServices";
import { MessageDto, MessageStatus } from "src/app/shared/services/BackendServices/AdministrativeCertificate/AdministrativeCertificate.dto";
import { GenericFormsService } from "src/app/Modules/GenericComponents/GenericForms.service";

@Injectable({
    providedIn: 'root'
})


export class RequestStatusService {

    messageDto: MessageDto = {} as MessageDto;
    originalStatus: any;
    filteredStatusOptions: any[] = [];


    AdminCerStatusOptions = [
        { key: MessageStatus.جديد, label: 'جديد' },
        { key: MessageStatus.جاري_التنفيذ, label: 'جاري التنفيذ' },
        { key: MessageStatus.تم_الرد, label: 'تم الرد' },
        { key: MessageStatus.مرفوض, label: 'مرفوض' },
        { key: MessageStatus.تم_الطباعة, label: 'تم' },
        // { key: MessageStatus.All, label: 'الكل' }
    ];

    constructor(public genericFormService: GenericFormsService, private spinner: SpinnerService, private msg: MsgsService,
        private administrativeCertificateController: AdministrativeCertificateController) { }


    updateStatus(message: MessageDto, messageDtos: MessageDto[], isRequireConfirm: boolean = true) {
        if (!isRequireConfirm) {
            this.ChangeStatus(message, messageDtos);
            return;
        }

        this.msg.msgConfirm('هل تريد تغيير حالة الطلب    ' + '<span style="color:blue;font-weight: bold;font-size:large;">'
            // + (this.corrstatusPipe.transform(Number(message.status))) 
            + '</span> ', 'تحديث')
            .then(result => {
                if (result == true) {
                    this.ChangeStatus(message, messageDtos);
                }
                else {
                    message.status = this.originalStatus;
                }
            })
    }
    ChangeStatus(message: MessageDto, messageDtos: MessageDto[]) {
        this.spinner.show();
        this.administrativeCertificateController.updateStatus(message.messageId, message.status)
            .subscribe({
                next: (res) => { 
                    if (res.isSuccess) {
                        this.msg.msgSuccess('تم التحديث بنجاح', 3000, true)
                        // Merge the updated message entity into the existing arrays and active references
                        const updatedObj = res.data as MessageDto;
                        Object.assign(message, updatedObj);

                        messageDtos = messageDtos?.map(m => {
                            if (m.messageId == message.messageId) {
                                Object.assign(m, updatedObj);
                            }
                            return m
                        }
                        );
                    }
                    else {
                        let errors = "";
                        res.errors?.forEach(e => {
                            errors += e.message + '\n';
                        });
                        this.msg.msgError('Error', '<h5>' + errors + '</h5>', true)
                    }
                },
                error: (error) => {
                    this.msg.msgError('Error', '<h5>' + error + '</h5>', true)
                },
                complete: () => {
                    
                }
            })
    }
}