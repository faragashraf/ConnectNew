import { Component, EventEmitter, Input, Output } from '@angular/core';

type AttachmentItem = {
  id?: number;
  name?: string;
  size?: number;
};

@Component({
  selector: 'app-summer-attachments-list',
  templateUrl: './summer-attachments-list.component.html',
  styleUrls: ['./summer-attachments-list.component.scss']
})
export class SummerAttachmentsListComponent {
  @Input() title = 'المرفقات';
  @Input() items: AttachmentItem[] = [];
  @Input() showSize = false;

  @Output() download = new EventEmitter<{ id: number; name: string }>();

  resolveId(item: AttachmentItem): number {
    const id = Number(item?.id ?? 0);
    return Number.isFinite(id) && id > 0 ? id : 0;
  }

  resolveName(item: AttachmentItem): string {
    const name = String(item?.name ?? '').trim();
    return name.length > 0 ? name : '-';
  }

  resolveSize(item: AttachmentItem): number {
    const size = Number(item?.size ?? 0);
    return Number.isFinite(size) && size > 0 ? size : 0;
  }

  formatSize(size: number): string {
    if (!size || size <= 0) {
      return '0 B';
    }

    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
    const value = size / Math.pow(1024, index);
    return `${value.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
  }

  onDownload(item: AttachmentItem): void {
    const id = this.resolveId(item);
    const name = this.resolveName(item);
    this.download.emit({ id, name });
  }
}

