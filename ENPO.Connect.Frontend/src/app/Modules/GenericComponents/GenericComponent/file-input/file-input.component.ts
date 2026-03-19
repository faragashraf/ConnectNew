import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl } from '@angular/forms';
import { GenericFormsService } from '../../GenericForms.service';

@Component({
  selector: 'app-file-input',
  templateUrl: './file-input.component.html',
  styleUrls: ['./file-input.component.scss']
})
export class FileInputComponent {
  @Input() parentForm!: any; // FormGroup
  @Input() control: FormControl | any;
  @Input() controlFullName: string = '';
  @Input() isDivDisabled: boolean = false;
  @Input() isCurrentUser: boolean = false;
  @Output() genericEvent = new EventEmitter<{ event: any, controlFullName: string, eventType: string }>();

  dragging = false;
  fileName: string = '';
  previewUrl: string | null = null;
  fileError: string | null = null;
  fileSize: number = 0;

  constructor(public genericFormService: GenericFormsService) { }

  onFileSelected(evt: any) {
    const file: File = evt.target.files && evt.target.files[0];
    if (!file) return;
    // simple validation: only allow pdf
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      this.fileError = 'الملف غير مدعوم - برجاء رفع ملف PDF';
      return;
    }
    this.fileError = null;
    this.setFile(file);
    evt.target.value = '';
  }

  onDrop(evt: any) {
    evt.preventDefault();
    this.dragging = false;
    const file: File = evt.dataTransfer && evt.dataTransfer.files && evt.dataTransfer.files[0];
    if (!file) return;
    // only accept pdf files on drop as well
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      this.fileError = 'الملف غير مدعوم - برجاء رفع ملف PDF';
      return;
    }
    this.fileError = null;
    this.setFile(file);
  }

  onDragOver(evt: any) {
    // Allow drag-over only when the dragged item is a PDF file
    evt.preventDefault();
    this.dragging = false;
    this.fileError = null;
    try {
      const dt = evt.dataTransfer;
      if (dt && dt.items && dt.items.length > 0) {
        const item = dt.items[0];
        if (item && item.kind === 'file') {
          const f = item.getAsFile && item.getAsFile();
          if (f && f.name && f.name.toLowerCase().endsWith('.pdf')) {
            this.dragging = true;
            // hint drop effect
            if (dt) dt.dropEffect = 'copy';
          } else {
            this.fileError = 'الملف غير مدعوم - برجاء رفع ملف PDF';
            this.dragging = false;
          }
        }
      }
    } catch (e) {
      // if anything goes wrong, don't enable dragging
      this.dragging = false;
    }
  }

  onDragLeave(evt: any) {
    evt.preventDefault();
    this.dragging = false;
  }

  setFile(file: File) {
    this.fileName = file.name;
    this.previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
    this.fileSize = file.size || 0;
    // set control value to file object (so parent form can read it)
    try {
      if (this.control && this.control.setValue) this.control.setValue(file);
    } catch (e) {
      // ignore
    }
    this.genericEvent.emit({ event: file, controlFullName: this.controlFullName, eventType: 'fileChange' });
  }

  clearFile() {
    this.fileName = '';
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = null;
    }
    this.fileSize = 0;
    this.fileError = null;
    try {
      if (this.control && this.control.setValue) this.control.setValue(null);
    } catch (e) { }
    this.genericEvent.emit({ event: null, controlFullName: this.controlFullName, eventType: 'fileClear' });
  }

  removeFile() { this.clearFile(); }

  getFileSize(bytes: number) {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i)) + ' ' + sizes[i];
  }

  // Truncate file name for display, keep full name available via title attribute
  truncateName(name: string | null | undefined, max: number = 50): string {
    if (!name) return '';
    if (name.length <= max) return name;
    const part = name.slice(0, max - 1).trim();
    return part + '…';
  }
}
