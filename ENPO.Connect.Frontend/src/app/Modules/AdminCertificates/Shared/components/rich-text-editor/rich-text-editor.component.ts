import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-rich-text-editor',
  templateUrl: './rich-text-editor.component.html',
  styleUrls: ['./rich-text-editor.component.scss']
})
export class RichTextEditorComponent {
  @Input() value: string = ''; // To hold the current value of the editor
  @Output() valueChange = new EventEmitter<string>(); // To emit the value to parent components
  textDirection: 'rtl' | 'ltr' = 'ltr'; // اتجاه النص الافتراضي

  ngOnInit() {
    this.alignText('justifyRight');
    this.setTextDirection('rtl')
  }




  // Handle text formatting
  formatText(command: string): void {
    document.execCommand(command, false, '');
  }

  // Change font color
  changeFontColor(event: Event): void {
    const color = (event.target as HTMLSelectElement).value;
    document.execCommand('foreColor', false, color);
  }

  // Change font size
  changeFontSize(event: Event): void {
    const size = (event.target as HTMLSelectElement).value;
    document.execCommand('fontSize', false, '7'); // Use size 7 to override font
    this.applyFontSize(size); // Apply the actual size using inline style
  }

  // Apply font size using inline style
  private applyFontSize(size: string): void {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const span = document.createElement('span');
    span.style.fontSize = size;
    range.surroundContents(span);
  }

  // Align text
  alignText(command: string): void {
    document.execCommand(command, false, '');
  }



  // Emit changes to the parent component
  onInput(event: Event): void {
    const target = event.target as HTMLDivElement;
    // this.value = target.innerHTML;
    this.valueChange.emit(this.value);
    
  }
  private temporaryContent: string = ''; // Temporary content during typing
  // Emit the value when the user leaves the editor
  onBlur(event: Event): void {
    const target = event.target as HTMLDivElement;
     this.value = target.innerHTML;
    // this.value = this.temporaryContent;
    this.valueChange.emit(this.value);
  }
    // تغيير اتجاه النص
    setTextDirection(direction: 'rtl' | 'ltr'): void {
      this.textDirection = direction;
    }
}
