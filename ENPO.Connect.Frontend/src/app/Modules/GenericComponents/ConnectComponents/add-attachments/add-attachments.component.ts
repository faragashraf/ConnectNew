import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { GenericFormsService } from '../../GenericForms.service';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { ComponentConfig } from 'src/app/shared/models/Component.Config.model';
import { AttchShipment } from 'src/app/shared/services/BackendServices/AdministrativeCertificate/AdministrativeCertificate.dto';
import { FileParameter } from 'src/app/shared/services/BackendServices/dto-shared';

@Component({
  selector: 'app-add-attachments',
  templateUrl: './add-attachments.component.html',
  styleUrls: ['./add-attachments.component.scss']
})
export class AddAttachmentsComponent implements OnInit {
  @Output() fileUploadEvent = new EventEmitter<FileParameter[]>();
  @Output() AttachIDemit = new EventEmitter<{ id: number, fileName: string }>();
  @Input() attchShipments: AttchShipment[] = []

  @Input() config: ComponentConfig = {} as ComponentConfig;
  @Input() fileParameters: FileParameter[] = [];
  isDragOver: boolean = false;

  // Computed properties for UI
  get acceptString(): string {
    const cfg: any = this.config as any;
    const arr = cfg && cfg.attachmentConfig && Array.isArray(cfg.attachmentConfig.AllowedExtensions) ? cfg.attachmentConfig.AllowedExtensions : [];
    return (arr || []).join(',');
  }

  get fileTypesDisplay(): string {
    const cfg: any = this.config as any;
    const arr = cfg && cfg.attachmentConfig && Array.isArray(cfg.attachmentConfig.AllowedExtensions) ? cfg.attachmentConfig.AllowedExtensions : [];
    return (arr || []).map((type: string) => type.replace('.', '').toUpperCase()).join(', ');
  }

  get uploadHintText(): string {
    const countText = this.config.attachmentConfig.maxFileCount && this.config.attachmentConfig.maxFileCount > 0 ? ` • حد أقصى ${this.config.attachmentConfig.maxFileCount} ملف` : '';
    return `${this.fileTypesDisplay} فقط • حد أقصى ${this.config.attachmentConfig.maximumFileSize} ميجابايت${countText}`;
  }

  get uploadTitleText(): string {
    const cfg: any = this.config as any;
    const arr = cfg && cfg.attachmentConfig && Array.isArray(cfg.attachmentConfig.AllowedExtensions) ? cfg.attachmentConfig.AllowedExtensions : [];
    const fileTypeText = arr.length === 1 && arr[0] === '.pdf'
      ? 'ملفات PDF'
      : 'الملفات';
    const allowMultiple = this.config?.attachmentConfig?.allowMultiple ?? true;
    return this.fileParameters.length > 0 ? (allowMultiple ? 'إضافة ملفات أخرى' : 'استبدال الملف') : `تحميل ${fileTypeText}`;
  }

  get remainingFiles(): number | null {
    if (!this.config.attachmentConfig.maxFileCount || this.config.attachmentConfig.maxFileCount <= 0) return null;
    return Math.max(0, this.config.attachmentConfig.maxFileCount - this.fileParameters.length);
  }

  get remainingText(): string {
    const rem = this.remainingFiles;
    if (rem === null) return '';
    return `المتبقي: ${rem} من ${this.config.attachmentConfig.maxFileCount}`;
  }
  constructor(public genericFormService: GenericFormsService, private msg: MsgsService,
    private msgsService: MsgsService) {
  }
  ngOnInit(): void {
    // if (!(this.config?.attachmentConfig?.allowAdd ?? false)) {
      if (this.attchShipments && this.attchShipments.length > 0) {
        this.attchShipments.forEach(attachment => {
          const fileParameter: FileParameter = {
            data: new File([], attachment.attchNm || 'unknown'),
            fileName: attachment.attchNm || 'unknown',
            fileID: attachment.id,
            originalSize: attachment.attchSize
          };
          this.fileParameters.push(fileParameter);
        });
      }
    }
  // }

  onFileChange(event: any) {
    if (!(this.config?.attachmentConfig?.allowMultiple ?? true))
      this.fileParameters = [];
    if (event.target.files && event.target.files.length > 0) {
      const newFiles = Array.from(event.target.files) as File[];
      let _errMessage = '';

      // Enforce maxFileCount if set (>0)
      if (this.config.attachmentConfig.maxFileCount && this.config.attachmentConfig.maxFileCount > 0) {
        const available = this.config.attachmentConfig.maxFileCount - this.fileParameters.length;
        if (available < 0) {
          this.msg.msgError('حد الملفات', `لا يمكن إضافة المزيد من الملفات. الحد الأقصى ${this.config.attachmentConfig.maxFileCount} ملف.`, true);
          // Reset the file input
          event.target.value = '';
          return;
        }
        if (newFiles.length > available) {
          _errMessage += `تم قبول ${available} ملفات فقط من أصل ${newFiles.length} بسبب حد الملفات (${this.config.attachmentConfig.maxFileCount}).<br>`;
          // reduce the list to available slots
          newFiles.splice(available);
        }
      }

      newFiles.forEach((file: File) => {
        // Check file type validation
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
        const cfg: any = this.config as any;
        const allowed = cfg && cfg.attachmentConfig && Array.isArray(cfg.attachmentConfig.AllowedExtensions) ? cfg.attachmentConfig.AllowedExtensions : [];
        const isValidType = allowed.some((type: string) =>
          type.toLowerCase() === fileExtension
        );

        if (!isValidType) {
          _errMessage += `نوع الملف "${fileExtension}" غير مدعوم. الأنواع المسموحة: ${this.fileTypesDisplay}.<br>`;
          return;
        }

        // Check file size validation
        const fileSizeInMB = file.size / (1024 * 1024);
        const maxSize = (this.config as any).attachmentConfig && (this.config as any).attachmentConfig.maximumFileSize !== undefined ? (this.config as any).attachmentConfig.maximumFileSize : this.config.attachmentConfig.maximumFileSize;
        if (fileSizeInMB > maxSize) {
          _errMessage += `حجم الملف "${file.name}" كبير جداً. الحد الأقصى ${maxSize} ميجابايت.<br>`;
          return;
        }

        // Check if a file with the same name exists
        const fileExists = this.fileParameters.some(
          (existing) => existing.fileName === file.name
        );

        if (!fileExists) {
          const fileParameter: FileParameter = {
            data: file,
            fileName: file.name
          };
          this.fileParameters.push(fileParameter);
        } else {
          _errMessage += `الملف "${file.name}" تم اختياره مسبقاً.<br>`;
        }
        // If we've reached maxFileCount, stop processing further files
        if (this.config.attachmentConfig.maxFileCount && this.config.attachmentConfig.maxFileCount > 0 && this.fileParameters.length > this.config.attachmentConfig.maxFileCount) {
          _errMessage += `تم الوصول إلى الحد الأقصى لعدد الملفات (${this.config.attachmentConfig.maxFileCount}).<br>`;
          return;
        }
      });

      this.fileUploadEvent.emit(this.fileParameters);

      if (_errMessage.length > 0) {
        this.msg.msgError('خطأ في اختيار الملف', _errMessage, true);
      }

      console.log('this.fileParameters', this.fileParameters);
      // Reset the file input
      event.target.value = '';
    }
  }

  // Drag & Drop handlers
  onDragOver(event: DragEvent) {
    event.preventDefault();
    if (this.config.fieldsConfiguration.isDivDisabled) return;
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
    if (this.config.fieldsConfiguration.isDivDisabled) return;

    const dt = event.dataTransfer;
    if (dt && dt.files && dt.files.length > 0) {
      // Create a fake event shape expected by onFileChange
      const fakeEvent: any = { target: { files: dt.files } };
      this.onFileChange(fakeEvent);
    }
  }

  deleteFile(index: number) {
    this.fileParameters.splice(index, 1);
    this.fileUploadEvent.emit(this.fileParameters)
  }
  deleteAll() {
    this.fileParameters = [];
    this.fileUploadEvent.emit(this.fileParameters)
  }

  getFileSize(bytes: number) {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i)) + ' ' + sizes[i];
  }

  getFileSizeForDisplay(file: FileParameter): string {
    // Try to get original size first (for existing attachments), then file data size
    const size = (file as any).originalSize || file.data.size || 0;
    return this.getFileSize(size);
  }

  // Truncate file name for display, keep full name available via title attribute
  truncateName(name: string | null | undefined, max: number = 50): string {
    if (!name) return '';
    if (name.length <= max) return name;
    const part = name.slice(0, max - 1).trim();
    return part + '…';
  }

  // Get file icon based on file extension
  getFileIcon(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();
    const iconMap: { [key: string]: string } = {
      'pdf': 'pi-file-pdf',
      'doc': 'pi-file-word',
      'docx': 'pi-file-word',
      'xls': 'pi-file-excel',
      'xlsx': 'pi-file-excel',
      'ppt': 'pi-file',
      'pptx': 'pi-file',
      'txt': 'pi-file-text',
      'jpg': 'pi-image',
      'jpeg': 'pi-image',
      'png': 'pi-image',
      'gif': 'pi-image',
      'zip': 'pi-file-archive',
      'rar': 'pi-file-archive',
      '7z': 'pi-file-archive'
    };
    return iconMap[extension || ''] || 'pi-file';
  }

  // Get file type display name
  getFileType(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();
    return extension?.toUpperCase() || 'FILE';
  }

  // Preview file method
  previewFile(fileParameter: FileParameter, index: number): void {
    const file = fileParameter.data;
    const extension = file.name.split('.').pop()?.toLowerCase();

    try {
      // Create object URL for the file
      const fileURL = URL.createObjectURL(file);

      // Handle different file types
      switch (extension) {
        case 'pdf':
          this.previewPDF(fileURL, file.name);
          break;

        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'gif':
          this.previewImage(fileURL, file.name);
          break;

        case 'doc':
        case 'docx':
        case 'xls':
        case 'xlsx':
        case 'ppt':
        case 'pptx':
          this.previewOfficeDocument(fileParameter, file.name);
          break;

        case 'txt':
          this.previewTextFile(file);
          break;

        default:
          this.downloadFile(fileParameter, file.name);
          break;
      }
    } catch (error) {
      console.error('Error previewing file:', error);
      this.msg.msgError('خطأ في معاينة الملف', 'لا يمكن معاينة هذا الملف', true);
    }
  }

  // Preview PDF files
  private previewPDF(fileURL: string, fileName: string): void {
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>معاينة PDF - ${fileName}</title>
          <style>
            body { margin: 0; padding: 20px; background: #f5f5f5; font-family: Arial, sans-serif; }
            .header { background: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header h2 { margin: 0; color: #333; }
            .pdf-container { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            embed { width: 100%; height: 80vh; border: none; }
            .error { text-align: center; padding: 40px; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>📄 ${fileName}</h2>
          </div>
          <div class="pdf-container">
            <embed src="${fileURL}" type="application/pdf" />
            <div class="error" style="display: none;">
              <p>لا يمكن عرض ملف PDF في هذا المتصفح.</p>
              <a href="${fileURL}" download="${fileName}">تحميل الملف</a>
            </div>
          </div>
          <script>
            // Fallback for browsers that don't support PDF embedding
            setTimeout(() => {
              const embed = document.querySelector('embed');
              const error = document.querySelector('.error');
              if (embed && embed.offsetHeight === 0) {
                embed.style.display = 'none';
                error.style.display = 'block';
              }
            }, 1000);
          </script>
        </body>
        </html>
      `);
      newWindow.document.close();
    } else {
      // Fallback: download the file
      this.downloadFileFromURL(fileURL, fileName);
    }
  }

  // Preview image files
  private previewImage(fileURL: string, fileName: string): void {
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>معاينة الصورة - ${fileName}</title>
          <style>
            body { 
              margin: 0; padding: 20px; background: #000; 
              display: flex; flex-direction: column; align-items: center; 
              font-family: Arial, sans-serif; min-height: 100vh; 
            }
            .header { 
              background: rgba(255,255,255,0.9); padding: 15px 25px; 
              border-radius: 8px; margin-bottom: 20px; color: #333; 
            }
            .image-container { 
              max-width: 90vw; max-height: 80vh; 
              border-radius: 8px; overflow: hidden; 
              box-shadow: 0 4px 20px rgba(0,0,0,0.3); 
            }
            img { 
              max-width: 100%; max-height: 100%; 
              object-fit: contain; display: block; 
            }
            .controls {
              margin-top: 20px; display: flex; gap: 10px;
            }
            .btn {
              background: #007bff; color: white; border: none;
              padding: 10px 20px; border-radius: 5px; cursor: pointer;
              text-decoration: none; display: inline-block;
            }
            .btn:hover { background: #0056b3; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>🖼️ ${fileName}</h2>
          </div>
          <div class="image-container">
            <img src="${fileURL}" alt="${fileName}" />
          </div>
          <div class="controls">
            <a href="${fileURL}" download="${fileName}" class="btn">تحميل الصورة</a>
            <button onclick="window.close()" class="btn">إغلاق</button>
          </div>
        </body>
        </html>
      `);
      newWindow.document.close();
    }
  }

  // Preview text files
  private previewTextFile(file: File): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>معاينة النص - ${file.name}</title>
            <style>
              body { 
                margin: 0; padding: 20px; background: #f5f5f5; 
                font-family: 'Courier New', monospace; line-height: 1.6; 
              }
              .header { 
                background: white; padding: 15px; border-radius: 8px; 
                margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
              }
              .content { 
                background: white; padding: 20px; border-radius: 8px; 
                box-shadow: 0 2px 10px rgba(0,0,0,0.1); white-space: pre-wrap; 
                max-height: 70vh; overflow-y: auto; 
              }
              .controls {
                margin-top: 20px; text-align: center;
              }
              .btn {
                background: #007bff; color: white; border: none;
                padding: 10px 20px; border-radius: 5px; cursor: pointer;
                margin: 0 5px;
              }
              .btn:hover { background: #0056b3; }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>📄 ${file.name}</h2>
              <p>حجم الملف: ${this.getFileSize(file.size)}</p>
            </div>
            <div class="content">${this.escapeHtml(content)}</div>
            <div class="controls">
              <button onclick="window.print()" class="btn">طباعة</button>
              <button onclick="window.close()" class="btn">إغلاق</button>
            </div>
          </body>
          </html>
        `);
        newWindow.document.close();
      }
    };
    reader.readAsText(file, 'UTF-8');
  }

  // Handle Office documents (requires external service or download)
  private previewOfficeDocument(fileParameter: FileParameter, fileName: string): void {
    // Show info dialog for Office documents
    this.msg.msgInfo(
      'معاينة مستند Office',
      `لا يمكن معاينة ملفات Office مباشرة في المتصفح.<br>
       سيتم تحميل الملف "${fileName}" لفتحه في التطبيق المناسب.`,
      true
    );

    // Download the file
    setTimeout(() => {
      this.downloadFile(fileParameter, fileName);
    }, 2000);
  }

  // Download file method
  downloadFile(fileParameter: FileParameter, fileName: string): void {
    if (fileParameter.fileID != null) {
      this.AttachIDemit.emit({ id: fileParameter.fileID, fileName: fileName });
    } else {
      // No server file ID — download the local File object directly
      const file = fileParameter.data;
      try {
        const url = URL.createObjectURL(file);
        this.downloadFileFromURL(url, fileName);
      } catch (e) {
        console.error('Error downloading local file:', e);
        this.msgsService.msgError('خطأ في تنزيل الملف المحلي', 'لا يمكن تنزيل الملف المحلي', true);
      }
    }
  }

  // Helper method to download file from URL
  private downloadFileFromURL(fileURL: string, fileName: string): void {
    const link = document.createElement('a');
    link.href = fileURL;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the object URL after a short delay
    setTimeout(() => {
      URL.revokeObjectURL(fileURL);
    }, 1000);
  }

  // Helper method to escape HTML
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Show file information
  showFileInfo(fileParameter: FileParameter, index: number): void {
    const file = fileParameter.data;
    const fileInfo = `
      <div style="text-align: right; line-height: 1.8;">
        <p><strong>اسم الملف:</strong> ${file.name}</p>
        <p><strong>حجم الملف:</strong> ${this.getFileSize(file.size)}</p>
        <p><strong>نوع الملف:</strong> ${this.getFileType(file.name)}</p>
        <p><strong>تاريخ التعديل:</strong> ${new Date(file.lastModified).toLocaleDateString('ar-SA')}</p>
        <p><strong>رقم الملف:</strong> ${index + 1}</p>
      </div>
    `;

    this.msg.msgInfo('معلومات الملف', fileInfo, true);
  }

  // Check if file can be previewed in browser
  canPreviewInBrowser(fileName: string): boolean {
    const extension = fileName.split('.').pop()?.toLowerCase();
    const previewableTypes = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'txt'];
    return previewableTypes.includes(extension || '');
  }

  // Get appropriate action text for file type
  getPreviewActionText(fileName: string): string {
    if (this.canPreviewInBrowser(fileName)) {
      return 'معاينة';
    } else {
      return 'تحميل';
    }
  }
}
