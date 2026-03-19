import { Component, OnInit } from '@angular/core';
import { GenerateQueryService } from 'src/app/Modules/enpopower-bi/services/generate-query.service';
import { PowerBiController } from 'src/app/Modules/enpopower-bi/services/PowerBi.service';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-server-monitor-manager',
  templateUrl: './server-monitor-manager.component.html',
  styleUrls: ['./server-monitor-manager.component.scss']
})
export class ServerMonitorManagerComponent implements OnInit {
  isDialogVisible: boolean = false;
  form: FormGroup;
  isEditing: boolean = false;
  editingIndex: number | null = null;

  constructor(
    private spinner: SpinnerService,
    private msg: MsgsService,
    private powerBiController: PowerBiController,
    public generateServerMonitorItems: GenerateQueryService,
    public generateServerMonitorSubscribers: GenerateQueryService,
    public generateServerMonitorLog: GenerateQueryService,
    private fb: FormBuilder
  ) {
    this.form = this.fb.group({});
  }
  onTabSelect(event: any): void {
    console.log('Tab selected:', event.index);
    if (event.index === 0) {
      // this.GetServerMonitorItems();
    } else if (event.index === 1) {
      // this.GetServerMonitorSubscribers();
    }
  }
  ngOnInit(): void {
    this.GetServerMonitorItems();
  }
  itemData: any[] = [];
  item_columns: string[] = [];

  LogData: any[] = [];
  Log_columns: string[] = [];

  subscribersData: any[] = [];
  subscribers_columns: string[] = [];
  GetServerMonitorItems() {
    this.spinner.show('جاري تحميل البيانات ...');
    const startTime = Date.now();
    this.powerBiController.getGenericDataById(41, '1')
      .subscribe({
        next: (resp) => {
          if (resp.isSuccess) {
            
            this.itemData = resp.data as any[]
            console.log(this.itemData);
            if (this.itemData.length > 0) {
              this.item_columns = Object.keys((resp.data as any[])[0]);
            }
            this.generateServerMonitorItems.duration = (Date.now() - startTime) / 1000;
          }
          else {
            
            let errr = '';
            resp.errors?.forEach(e => errr += e.message + "<br>");
            this.msg.msgError(errr, "هناك خطا ما", true);
          }
          
        },
        error: (error) => {
          console.log(error.message);
          
          this.msg.msgError(error, "هناك خطا ما", true);
        },
        complete: () => {
          console.log(' Complete');
        }
      }
      );
  }
  GetServerMonitorSubscribers() {
    this.spinner.show('جاري تحميل البيانات ...');
    const startTime = Date.now();
    this.powerBiController.getGenericDataById(61, this.generateServerMonitorItems.tableGenericSelectedRow.ITEM_ID)
      .subscribe({
        next: (resp) => {
          if (resp.isSuccess) {
            
            this.subscribersData = resp.data as any[];
            if (this.subscribersData.length > 0) {
              this.subscribers_columns = Object.keys((resp.data as any[])[0]);
            }
            this.generateServerMonitorSubscribers.duration = (Date.now() - startTime) / 1000;
          }
          else {
            
            let errr = '';
            resp.errors?.forEach(e => errr += e.message + "<br>");
            this.msg.msgError(errr, "هناك خطا ما", true);
          }
          
        },
        error: (error) => {
          console.log(error.message);
          
          this.msg.msgError(error, "هناك خطا ما", true);
        },
        complete: () => {
          console.log(' Complete');
        }
      }
      );
  }
  GetServerMonitorLog() {
    this.spinner.show('جاري تحميل البيانات ...');
    const startTime = Date.now();
    this.powerBiController.getGenericDataById(62, this.generateServerMonitorItems.tableGenericSelectedRow.ITEM_ID)
      .subscribe({
        next: (resp) => {
          if (resp.isSuccess) {
            
            this.LogData = resp.data as any[];
            if (this.LogData.length > 0) {
              this.Log_columns = Object.keys((resp.data as any[])[0]);
            }
            this.generateServerMonitorLog.duration = (Date.now() - startTime) / 1000;
          }
          else {
            
            let errr = '';
            resp.errors?.forEach(e => errr += e.message + "<br>");
            this.msg.msgError(errr, "هناك خطا ما", true);
          }
          
        },
        error: (error) => {
          console.log(error.message);
          
          this.msg.msgError(error, "هناك خطا ما", true);
        },
        complete: () => {
          console.log(' Complete');
        }
      }
      );
  }
  deleteSubscriberRow(event: any) {
    this.powerBiController.excuteGenericStatmentById(65, `${event.SUBSCRIBER_ID}`)
      .subscribe({
        next: (resp) => {
          if (resp.isSuccess) {
            console.log('resp', resp)
            const _index = this.subscribersData.findIndex(e => e.SUBSCRIBER_ID == event.SUBSCRIBER_ID)
            this.subscribersData.splice(_index, 1);
            this.msg.msgSuccess('تم الحذف بنجاح');

          }
          else {
            
            let errr = '';
            resp.errors?.forEach(e => errr += e.message + "<br>");
            this.msg.msgError(errr, "هناك خطا ما", true);
          }
          
        },
        error: (error) => {
          console.log(error.message);
          
          this.msg.msgError(error, "هناك خطا ما", true);
        },
        complete: () => {
          console.log(' Complete');
        }
      }
      );

  }
  deleteServerItemRow(event: any) {
    this.powerBiController.excuteGenericStatmentById(64, `${event.ITEM_ID}`)
      .subscribe({
        next: (resp) => {
          if (resp.isSuccess) {
            const _index = this.itemData.findIndex(e => e.ITEM_ID == event.ITEM_ID)
            this.itemData = [...this.itemData.slice(0, _index), ...this.itemData.slice(_index + 1)];
            this.msg.msgSuccess('تم الحذف بنجاح');

          }
          else {
            
            let errr = '';
            resp.errors?.forEach(e => errr += e.message + "<br>");
            this.msg.msgError(errr, "هناك خطا ما", true);
          }
          
        },
        error: (error) => {
          console.log(error.message);
          
          this.msg.msgError(error, "هناك خطا ما", true);
        },
        complete: () => {
          console.log(' Complete');
        }
      }
      );

  }
  EditRow(event: any) {
    this.powerBiController.excuteGenericStatmentById(24, `${event.USER_ID}|${event.ROLE_ID}`)
      .subscribe({
        next: (resp) => {
          if (resp.isSuccess) {
            const _index = this.generateServerMonitorItems.tableGenericData.findIndex(e => e.ROLE_ID == event.ROLE_ID && e.USER_ID == event.USER_ID)
            this.generateServerMonitorItems.tableGenericData.splice(_index, 1);
            this.msg.msgSuccess('تم الحذف بنجاح');

          }
          else {
            
            let errr = '';
            resp.errors?.forEach(e => errr += e.message + "<br>");
            this.msg.msgError(errr, "هناك خطا ما", true);
          }
          
        },
        error: (error) => {
          console.log(error.message);
          
          this.msg.msgError(error, "هناك خطا ما", true);
        },
        complete: () => {
          console.log(' Complete');
        }
      }
      );

  }
  onselectItemEvent(event: any) {
    if (event != null) {
      // this.openDialog(event)
      this.GetServerMonitorSubscribers();
      this.GetServerMonitorLog();
    }
  }
  expectedColumns: any[] = []

  openDialog(rowData: any = null, index: number | null = null): void {
    this.isEditing = !!rowData;
    this.editingIndex = index;
    this.isDialogVisible = true;

    // Expected columns (fallback in case _columns is incomplete)
    this.expectedColumns = ['ITEM_ID', 'CATEGORY', 'ITEM_NAME', 'SERVER_IP', 'PORT', 'IS_HA', 'LOAD_BALANCER_IP'];

    // Initialize form fields dynamically based on columns
    const controls: any = {};
    (this.expectedColumns).forEach((col: string) => {
      controls[col] = rowData && rowData[col] !== undefined && rowData[col] != null
        ? [rowData[col], Validators.required]
        : [''];
    });
    this.form = this.fb.group(controls);
  }

  saveData(): void {
    if (this.form.valid) {
      const rowData = this.form.value;
      if (this.isEditing && this.editingIndex !== null) {
        // Update existing row
        this.itemData[this.editingIndex] = rowData;
      } else {
        // Add new row
        this.itemData.push(rowData);
      }
      this.isDialogVisible = false;
      this.msg.msgSuccess('Data saved successfully!');
    } else {
      this.msg.msgError('Please fill all required fields.', 'Validation Error');
    }
  }

  closeDialog(): void {
    this.isDialogVisible = false;
    this.form.reset();
  }

  categoryOptions = [
    { label: 'Windows Service', value: 'Windows Service' },
    { label: 'IIS Pool', value: 'IIS Pool' },
    { label: 'Ping', value: 'Ping' },
    { label: 'Telnet', value: 'Telnet' },
  ];

  isHaOptions = [
    { label: 'Yes', value: 1 },
    { label: 'No', value: 0 }
  ];
}
