import { Injectable } from '@angular/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root'
})

export class MsgsService {

  // Toggle this to switch strategies. Initialize from LocalStorage.
  public usePrimeNG: boolean = false;
  private bol: boolean = false; // For legacy async behavior

  constructor(
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) {
    const stored = localStorage.getItem('useModernAlerts');
    // Default to false. Only true if explicitly 'true'.
    this.usePrimeNG = stored === 'true';
    localStorage.setItem('useModernAlerts', String(this.usePrimeNG));

  }

  public setStrategy(isModern: boolean) {
    this.usePrimeNG = isModern;
    localStorage.setItem('useModernAlerts', String(isModern));
  }

  /**
   * Displays an error message.
   */
  msgError(title: string, msgBody: string, isHtml?: boolean) {
    if (this.usePrimeNG) {
      this.messageService.add({
        key: 'center',
        severity: 'error',
        summary: title,
        detail: msgBody,
        life: 5000
      });
    } else {
      if (isHtml) {
        Swal.fire({
          icon: 'error',
          title: title,
          html: '<div style="direction:rtl">' + msgBody + '</div>'
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: title,
          text: msgBody
        });
      }
    }
  }

  /**
   * Displays a success message.
   */
  msgSuccess(msgBody: string, milliseconds: number = 4000, small?: boolean) {
    if (this.usePrimeNG) {
      if (small) {
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: msgBody,
          life: milliseconds
        });
      } else {
        this.messageService.add({
          key: 'center',
          severity: 'success',
          summary: 'Success',
          detail: msgBody,
          life: milliseconds
        });
      }
    } else {
      const Toast = Swal.mixin({
        position: small ? 'top-end' : 'center',
        showConfirmButton: false,
        timer: milliseconds,
        timerProgressBar: true,
        didOpen: (toast) => {
          toast.addEventListener('mouseenter', Swal.stopTimer);
          toast.addEventListener('mouseleave', Swal.resumeTimer);
        }
      });
      Toast.fire({
        icon: 'success',
        title: '<div style="direction:rtl">' + msgBody + '</div>'
      });
    }
  }

  /**
   * Displays a confirmation dialog.
   */
  msgConfirm(msgBody: string, confirmButtonTxt: string): Promise<boolean> {
    if (this.usePrimeNG) {
      return new Promise((resolve) => {
        this.confirmationService.confirm({
          message: msgBody,
          header: 'تأكيد',
          icon: 'pi pi-exclamation-triangle',
          acceptLabel: confirmButtonTxt,
          rejectLabel: 'إلغاء',
          acceptButtonStyleClass: 'p-button-success',
          rejectButtonStyleClass: 'p-button-danger p-button-text',
          accept: () => resolve(true),
          reject: () => resolve(false)
        });
      });
    } else {
      return Swal.fire({
        position: 'center',
        title: 'هل أنت متأكد ؟',
        html: '<div style="direction: rtl">' + msgBody + '</div>',
        text: '<div style="direction:rtl">' + msgBody + '</div>',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#206602',
        cancelButtonColor: '#d33',
        confirmButtonText: confirmButtonTxt
      }).then(result => {
        return result.isConfirmed;
      });
    }
  }

  /**
   * Displays an info message.
   */
  msgInfo(msgBody: string, title: string = 'Information', _icon: any = 'info') {
    if (this.usePrimeNG) {
      this.messageService.add({
        key: 'center',
        severity: _icon,
        summary: title,
        detail: msgBody
      });
    } else {
      if (_icon == null) _icon = 'info';
      Swal.fire({
        icon: _icon,
        html: title,
        title: '<div style="direction:rtl">' + msgBody + '</div>',
        text: '<div style="direction:rtl">' + title + '</div>'
      });
    }
  }
}
