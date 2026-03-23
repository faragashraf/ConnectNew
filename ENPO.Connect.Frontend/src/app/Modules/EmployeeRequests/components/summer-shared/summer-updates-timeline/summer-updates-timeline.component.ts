import { Component, EventEmitter, Input, Output } from '@angular/core';

type AttachmentItem = {
  id?: number;
  name?: string;
  size?: number;
};

type UpdateItem = {
  id?: number;
  replyId?: number;
  author?: string;
  authorName?: string;
  message?: string;
  created?: string;
  createdDate?: string;
  attachments?: AttachmentItem[];
};

@Component({
  selector: 'app-summer-updates-timeline',
  templateUrl: './summer-updates-timeline.component.html',
  styleUrls: ['./summer-updates-timeline.component.scss']
})
export class SummerUpdatesTimelineComponent {
  @Input() title = 'سجل التحديثات';
  @Input() emptyMessage = 'لا توجد تحديثات مسجلة حتى الآن.';
  @Input() updates: UpdateItem[] = [];
  @Input() showSize = false;
  @Input() dateFormatter?: (value?: string) => string;

  @Output() download = new EventEmitter<{ id: number; name: string }>();

  resolveId(item: UpdateItem): number {
    const id = Number(item?.id ?? item?.replyId ?? 0);
    return Number.isFinite(id) && id > 0 ? id : 0;
  }

  resolveAuthor(item: UpdateItem): string {
    const author = String(item?.authorName ?? item?.author ?? '').trim();
    return author.length > 0 ? author : 'غير معروف';
  }

  resolveMessage(item: UpdateItem): string {
    const message = String(item?.message ?? '').trim();
    return message.length > 0 ? message : '-';
  }

  resolveCreatedDate(item: UpdateItem): string | undefined {
    const date = String(item?.createdDate ?? item?.created ?? '').trim();
    return date.length > 0 ? date : undefined;
  }

  resolveAttachments(item: UpdateItem): AttachmentItem[] {
    return Array.isArray(item?.attachments) ? item.attachments : [];
  }

  resolveAttachmentId(item: AttachmentItem): number {
    const id = Number(item?.id ?? 0);
    return Number.isFinite(id) && id > 0 ? id : 0;
  }

  resolveAttachmentName(item: AttachmentItem): string {
    const name = String(item?.name ?? '').trim();
    return name.length > 0 ? name : '-';
  }

  resolveAttachmentSize(item: AttachmentItem): number {
    const size = Number(item?.size ?? 0);
    return Number.isFinite(size) && size > 0 ? size : 0;
  }

  formatDate(value?: string): string {
    if (this.dateFormatter) {
      return this.dateFormatter(value);
    }
    return value && String(value).trim().length > 0 ? String(value) : '-';
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
    this.download.emit({
      id: this.resolveAttachmentId(item),
      name: this.resolveAttachmentName(item)
    });
  }
}

