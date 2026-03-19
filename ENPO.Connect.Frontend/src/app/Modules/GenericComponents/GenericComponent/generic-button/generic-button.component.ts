import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-generic-button',
  templateUrl: './generic-button.component.html',
  styleUrls: ['./generic-button.component.scss']
})
export class GenericButtonComponent {
  /** HTML button type */
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  /** visual kind - maps to bootstrap/utility classes (e.g. primary, secondary, success, danger) */
  @Input() kind: string = 'primary';
  /** additional CSS class(es) */
  @Input() styleClass: string = '';
  /** size modifier - e.g. sm, lg, '' */
  @Input() size: '' | 'sm' | 'lg' = '';
  /** whether the button is disabled */
  @Input() disabled: boolean = false;
  /** optional label if no projected content is provided */
  @Input() label: string = '';

  /** optional icon to display before the label/content */
  @Input() icon: 'pencil' | 'trash' | 'print' | 'save' | 'show' | '' = '';
  /** optional tooltip text (PrimeNG pTooltip will be used if available) */
  @Input() tooltip: string = '';
  /** tooltip position: top | bottom | left | right */
  @Input() tooltipPosition: 'top' | 'bottom' | 'left' | 'right' = 'top';

  @Output() clicked = new EventEmitter<Event>();

  get cssClasses(): string {
    const classes = ['btn'];
    if (this.kind) classes.push(`btn-${this.kind}`);
    if (this.size) classes.push(`btn-${this.size}`);
    if (this.styleClass) classes.push(this.styleClass);
    return classes.join(' ');
  }

  /** Map icon input to PrimeIcons CSS class */
  getIconClass(): string {
    switch (this.icon) {
      case 'pencil':
        return 'pi pi-pencil';
      case 'trash':
        return 'pi pi-trash';
      case 'print':
        return 'pi pi-print';
      case 'save':
        return 'pi pi-save';
      case 'show':
        return 'pi pi-eye';
      default:
        return '';
    }
  }

  onClick(ev: Event) {
    if (this.disabled) {
      ev.preventDefault();
      ev.stopPropagation();
      return;
    }
    this.clicked.emit(ev);
  }
}
