import { Component, OnInit } from '@angular/core';
import { PowerBiController } from 'src/app/Modules/enpopower-bi/services/PowerBi.service';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';

type GenericRow = Record<string, string | number | boolean | Date | null>;

@Component({
  selector: 'app-postoffices-list',
  templateUrl: './postoffices-list.component.html',
  styleUrls: ['./postoffices-list.component.scss']
})
export class PostofficesListComponent implements OnInit {
  rows: any[] = [];
  columns: string[] = [];
  loading: boolean = false;
  errorMessage: string = '';

  constructor(
    private powerBiController: PowerBiController,
    private msg: MsgsService
  ) { }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.errorMessage = '';
    
    // Call getGenericDataById with id=1006 and parameters='1'
    this.powerBiController.getGenericDataById(66, '1')
      .subscribe({
        next: (resp) => {
          if (resp.isSuccess && resp.data) {
            this.rows = resp.data;
            if (this.rows.length > 0) {
              this.columns = Object.keys(this.rows[0]);
            } else {
              this.columns = [];
            }
          } else {
            this.errorMessage = 'Failed to load data';
            if (resp.errors && resp.errors.length > 0) {
              this.errorMessage = resp.errors.map(e => e.message).join('<br>');
            }
            this.msg.msgError(this.errorMessage, 'Error', true);
            this.rows = [];
            this.columns = [];
          }
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading post offices:', error);
          this.errorMessage = 'An unexpected error occurred while loading data.';
          if (error && error.message) {
            this.errorMessage = error.message;
          }
          this.msg.msgError(this.errorMessage, 'Error', true);
          this.loading = false;
          this.rows = [];
          this.columns = [];
        }
      });
  }
}
