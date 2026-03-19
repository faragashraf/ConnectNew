import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { FormControl } from '@angular/forms';
import { GenericFormsService } from '../../GenericForms.service';
import { FileParameter } from 'src/app/shared/services/BackendServices/dto-shared';

export interface EmailPayload {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyHtml: string;
  bodyText: string;
  attachments: FileParameter[];
}

@Component({
  selector: 'app-mail-composer',
  templateUrl: './mail-composer.component.html',
  styleUrls: ['./mail-composer.component.scss']
})
export class MailComposerComponent implements OnInit, OnChanges {
  @Input() fileParameters: FileParameter[] = [];
  // Accept an HTML template string. If it contains '{{body}}' it will be used as a wrapper.
  @Input() templateHtml: string = '';
  @Input() initialHtml: string = '';
  // `bodyHtml` will be composed from the editor and optional `templateHtml`.

  @Output() sendEmail: EventEmitter<EmailPayload> = new EventEmitter<EmailPayload>();
  @Output() attachmentsChange: EventEmitter<FileParameter[]> = new EventEmitter<FileParameter[]>();

  @ViewChild('editor', { static: true }) editor!: ElementRef<HTMLDivElement>;

  toInput: string = '';
  ccInput: string = '';
  bccInput: string = '';
  toControls: FormControl[] = [new FormControl('')];
  ccControls: FormControl[] = [new FormControl('')];
  lastToJoined: string = '';
  lastCcJoined: string = '';
  subject: string = '';
  plainTextMode: boolean = false;
  @Input() genericFormsService?: GenericFormsService;


  constructor(){}

  ngOnInit(): void {
    // seed editor content if initialHtml provided
    try {
      if (this.initialHtml && this.initialHtml.length > 0) {
        this.editor.nativeElement.innerHTML = this.initialHtml;
      }
    } catch (e) {
      // ignore
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Update editor when `initialHtml` input changes after init
    try {
      if (changes['initialHtml'] && this.editor && this.editor.nativeElement) {
        const v = changes['initialHtml'].currentValue;
        if (v !== undefined && v !== null && String(v).length > 0) {
          this.editor.nativeElement.innerHTML = String(v);
        }
      }
    } catch (e) {
      // ignore
    }
  }

  format(command: string, value: string | null = null) {
    try {
      document.execCommand(command, false, value as any);
      this.editor.nativeElement.focus();
    } catch (e) { }
  }

  togglePlainText() {
    this.plainTextMode = !this.plainTextMode;
  }

  getEditorHtml(): string {
    return this.editor?.nativeElement?.innerHTML ?? '';
  }

  getEditorText(): string {
    return this.editor?.nativeElement?.innerText ?? '';
  }

  parseAddressList(raw: string): string[] {
    if (!raw) return [];
    return raw.split(',').map(s => s.trim()).filter(s => s.length > 0);
  }

  addTo() {
    this.toControls.push(new FormControl(''));
  }

  addCc() {
    this.ccControls.push(new FormControl(''));
  }

  removeTo(index: number) {
    if (this.toControls.length > 1) {
      this.toControls.splice(index, 1);
    } else {
      this.toControls[0].setValue('');
    }
  }

  removeCc(index: number) {
    if (this.ccControls.length > 1) {
      this.ccControls.splice(index, 1);
    } else {
      this.ccControls[0].setValue('');
    }
  }

  onDomainUserEvent(event: any, index: number, type: string = 'to') {
  }

  removeAttachment(index: number) {
    try {
      this.fileParameters = this.fileParameters.slice(0);
      this.fileParameters.splice(index, 1);
      this.attachmentsChange.emit(this.fileParameters);
    } catch (e) { }
  }

  send() {
    const to = this.toControls.map(c => (c.value || '').toString().trim()).filter(s => s.length > 0);
    const ccFromControls = this.ccControls.map(c => (c.value || '').toString().trim()).filter(s => s.length > 0);
    const cc = ccFromControls.length ? ccFromControls : this.parseAddressList(this.ccInput);
    const bcc = this.parseAddressList(this.bccInput);
    // Preserve raw editor HTML and compose the final body using `templateHtml` when provided
    const editorHtml = this.getEditorHtml();
    let composedBody = editorHtml;
    const bodyText = this.getEditorText();
    // joined string (semicolon separated) for UIs or backends that expect semicolon-delimited addresses
    const dedupedTo = Array.from(new Set(to));
    this.lastToJoined = dedupedTo.join(';');
    // optional: lastCcJoined if needed elsewhere
    this.lastCcJoined = cc.join(';');
    // Apply `templateHtml` wrapping when provided (template may contain '{{body}}')
    if (this.templateHtml && this.templateHtml.indexOf('{{body}}') !== -1) {
      composedBody = this.templateHtml.replace('{{body}}', editorHtml);
    } else if (this.templateHtml && this.templateHtml.trim().length > 0) {
      // only prepend template when it is not already present in editorHtml to avoid double-wrapping
      const tplTrim = this.templateHtml.trim();
      if (!editorHtml.includes(tplTrim)) {
        composedBody = this.templateHtml + editorHtml;
      } else {
        composedBody = editorHtml;
      }
    }
    // Prepare `bodyHtml` for payload: sanitize by removing newlines and backslashes
    const composedBodyFinal = ((composedBody || '')).replace(/\r?\n/g, '').replace(/\\/g, '');

    const payload: EmailPayload = {
      to,
      cc: cc.length ? cc : undefined,
      bcc: bcc.length ? bcc : undefined,
      subject: this.subject,
      // send the composed, sanitized HTML as `bodyHtml`
      bodyHtml: composedBodyFinal,
      bodyText,
      attachments: this.fileParameters || []
    };

    try {
      this.sendEmail.emit(payload);
    } catch (e) { }
  }
}
