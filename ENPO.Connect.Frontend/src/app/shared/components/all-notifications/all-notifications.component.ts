import { Component, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { Table } from 'primeng/table';
import { SignalRService } from '../../services/SignalRServices/SignalR.service';
import { ConditionalDate } from '../../Pipe/Conditional-date.pipe';

@Component({
    selector: 'app-all-notifications',
    templateUrl: './all-notifications.component.html',
    styleUrls: ['./all-notifications.component.scss']
})
export class AllNotificationsComponent {
    @Input() notifications: any[] = [];
    @Input() display: boolean = false;
    @Output() displayChange = new EventEmitter<boolean>();

    search: string = '';
    // ...existing code


    constructor(public customDatePipe: ConditionalDate,public signalRService: SignalRService) { }

    // Example method to close/hide the dialog and emit the change
    close() {
        this.display = false;
        this.displayChange.emit(this.display);
    }

    @ViewChild('dt1') dt1!: Table; // Using non-null assertion to tell TypeScript that it will always be initialized

    onFilterInput(event: Event): void {
        const inputElement = event.target as HTMLInputElement; // Explicitly assert as HTMLInputElement
        const inputValue = inputElement.value;
        this.dt1?.filterGlobal(inputValue, 'contains');
    }

}
