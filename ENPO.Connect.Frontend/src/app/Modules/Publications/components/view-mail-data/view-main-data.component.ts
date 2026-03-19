import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';
import { ColumnConfig, GenerateQueryService } from 'src/app/Modules/enpopower-bi/services/generate-query.service';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';
import { AttchedObjectService } from 'src/app/shared/services/helper/attched-object.service';
import { AuthObjectsService } from 'src/app/shared/services/helper/auth-objects.service';
import { ComponentConfig, getConfigByRoute, processRequestsAndPopulate, routeKey } from 'src/app/shared/models/Component.Config.model';
import { GenericFormsService } from 'src/app/Modules/GenericComponents/GenericForms.service';
import { ComponentConfigService } from 'src/app/Modules/admins/services/component-config.service';
import { EditActiveRequestDto, ExpressionDto } from 'src/app/shared/services/BackendServices/Publications/Publications.dto';
import { PublicationsController } from 'src/app/shared/services/BackendServices/Publications/Publications.service';
import { MessageDto, MessageStatus, Priority, TkmendField } from 'src/app/shared/services/BackendServices/AdministrativeCertificate/AdministrativeCertificate.dto';

@Component({
  selector: 'app-view-main-data',
  templateUrl: './view-main-data.component.html',
  styleUrls: ['./view-main-data.component.scss']
})
export class ViewMainDataComponent implements OnInit {
  @Input() itemName: string = 'Test';

  @Output() addNew: EventEmitter<void> = new EventEmitter<void>();
  config: ComponentConfig = {} as ComponentConfig;
  configPanelOpen = false;

  // Table configuration panel booleans
  showExportButton = false;
  showRemoveColumn = false;
  showDeleteButton = false;
  showViewButton = false;
  showEditButton = false;
  showFieldSort = false;
  showColumnFilter = false;
  showTableDetails = false;

  currentPage: number = 1;
  pageSize: number = 5;
  totalItems: number = 0;
  totalPages: number = 0;
  rowsPerPageOptions: number[] = [5, 10, 25];
  allPublications: Record<string, any>[] = [];
  item_columns: string[] = [];
  expressionsDto: ExpressionDto[] = []

  routeConfigs: { key: string; endpoint: any; config: string; itemName?: string }[] = [
    {
      key: 'FullPublication',
      endpoint: () => this.publicationsController.getDocumentsList_admin(this.currentPage, this.pageSize, this.expressionsDto),
      config: 'FullPublication',
      itemName: 'وثيقة',
    },
    // {
    //   key: 'All-Publication',
    //   endpoint: () => this.publicationsController.getPublicationTypeList(this.currentPage, this.pageSize),
    //   config: 'All-Publication',
    //   itemName: 'نوع النشر',
    // }
  ];

  constructor(
    private msg: MsgsService, private genericFormService: GenericFormsService,
    private publicationsController: PublicationsController, private appConfigService: ComponentConfigService,
    private spinner: SpinnerService, private authObjectsService: AuthObjectsService,
    private generateQueryService: GenerateQueryService, private attchedObjectService: AttchedObjectService,
    public router: Router) {

    const _routeKey = routeKey(this.router.url);
    this.appConfigService.getAll().subscribe(items => {
      const cfg = getConfigByRoute(_routeKey, items || []);
      if (!cfg) return;
      this.config = cfg;
      this.genericFormService.applicationName = this.config.genericFormName || '';
      this.genericFormService.GetDataMetadata(this.config.menuId).subscribe((ready) => {
        if (ready) {
          processRequestsAndPopulate(this, this.genericFormService,spinner).subscribe({
            next: () => {
            },
            complete: () => {
            }
          });
        }
      });
    });
  }

  targetArray: any[] = [];
  rawPublications: any[] = [];
  documentConfig: ColumnConfig[] = [];
  fileParameters: any[] = [];
  displayDialog: boolean = false;
  selectedRow: any = null;
  editDialogVisible: boolean = false;
  editRow: any = {};

  ngOnInit(): void {
    this.GETData();
  }

  GETData() {
    for (const route of this.routeConfigs) {
      if (this.router.url.includes(route.key)) {
        // set itemName based on the route mapping so UI reflects context immediately
        if (route.itemName) {
          this.itemName = route.itemName;
          this.showEditButton = (this.itemName == 'وثيقة') && this.authObjectsService.checkAuthFun('PublSuperAdminFunc');
          this.showViewButton = (this.itemName == 'وثيقة');
        }
        const _endpoint = route.endpoint();
        this.documentConfig = this.getColumnConfig(route.config);
        this.Get(_endpoint, this.documentConfig);
        break;
      }
    }
  }

  getColumnConfig(type: string): ColumnConfig[] {
    switch (type) {
      case 'All-Publication':
        return [
          { field: 'PublicationTypeNameAr', header: 'اسم نوع النشور', visible: true },
          { field: 'LastModifiedDate', header: 'تاريخ آخر تعديل المنشور', visible: true },
        ];
      case 'FullPublication':
        return [
          { field: 'DOCUMENT_NUMBER', header: 'رقم الوثيقة', visible: true },
          { field: 'WORKING_START_DATE', header: 'تاريخ بدء العمل', visible: true },
          { field: 'MINI_DOC', header: 'ملخص الوثيقة', visible: true },
          { field: 'SectorName', header: 'اسم القطاع', visible: true },
          { field: 'DistrictName', header: 'اسم المنطقة', visible: true },
          { field: 'DocumentType', header: 'نوع الوثيقة', visible: true },
          { field: 'Application', header: 'اسم التطبيق', visible: true },

          { field: 'PublicationTypeName', header: 'نوع النشر', visible: true },
          { field: 'ALL_TEXT_DOC', header: 'النص الكامل للوثيقة', visible: false },
        ];
      default:
        return [];
    }
  }
  Get(endpoint: any, documentConfig: ColumnConfig[]) {
    this.spinner.show('جاري تحميل البيانات ...');
    endpoint
      .subscribe({
        next: (resp: any) => {
          if (resp.IsSuccess) {
            this.rawPublications = resp.Data;
            this.mapResponseToTargetArray(this.rawPublications, documentConfig);
            this.totalItems = resp.TotalCount;
            this.totalPages = Math.ceil(this.totalItems / this.pageSize) || 1;
          } else {

            let errr = '';
            if (resp.ResponseDetail && resp.ResponseDetail.length > 0) {
              this.msg.msgSuccess(resp.ResponseDetail.responseMessage as string, 7000, true)
            }
          }
        },
        error: (error: any) => {
          console.log(error.message);
          this.msg.msgError(error, "هناك خطا ما", true);
        },
        complete: () => {
          console.log('menuWithItems Complete');
        }
      });
  }
  private mapResponseToTargetArray(resp: any, documentConfig: ColumnConfig[]) {
    const mapped = this.generateQueryService.mapDataToTable(resp, documentConfig);
    this.targetArray.length = 0;
    mapped.forEach((item: any) => this.targetArray.push(item));
    this.item_columns = documentConfig.filter(c => c.visible).map(c => c.header);
  }

  onselectItemEvent(event: any) {
    console.log(event)
  }
  deleteRow(event: any) {
  }

  viewRow(event: any) {
    this.fileParameters = [];
    const globalIndex = event.index;
    const pageOffset = (this.currentPage - 1) * this.pageSize;
    const localIndex = globalIndex - pageOffset;
    const row: any[] = [this.rawPublications[localIndex]];
    const mapped = this.generateQueryService.mapDataToTable(row, this.documentConfig, false);
    this.selectedRow = mapped && mapped.length > 0 ? mapped[0] : null;
    this.fileParameters = this.rawPublications[localIndex].AttachmentList;

    const attach = this.rawPublications[localIndex].AttachmentList;

    if (attach && Array.isArray(attach)) {
      this.fileParameters = attach.map((attachment: any) => ({
        data: null as any, // File data would be loaded separately
        fileName: attachment.FILE_NAME || '',
        fileID: attachment.ATTACHMENT_ID,
        originalSize: attachment.FILE_SIZE_BYTES
      }));
    } else {
      this.fileParameters = [];
    }

    this.displayDialog = !!this.selectedRow;
  }

  downloadAttachment(event: any) {
    this.spinner.show('جاري تنزيل المرفق ..');
    this.publicationsController.getFileContent(event.id)
      .subscribe({
        next: (res: any) => {
          if (res.IsSuccess) {
            if (res.FILE_CONTENT.length > 0)
              // this.fileParameters[event.id].data = res.FILE_CONTENT
              this.attchedObjectService.createObjectURL(res.FILE_CONTENT, event.fileName)
          }
          else {
            let errr = ''
            res.errors.forEach((e: any) => errr += e.message + "<br>")
            this.msg.msgError(errr, "هناك خطا ما", true);
          }
        },
        error: (err) => {
          this.msg.msgError(err.code, err.message, true)
        }
      });
  }
  messageDto: MessageDto = {} as MessageDto;
  edit(event: any) {
    const globalIndex = event.index;
    const pageOffset = (this.currentPage - 1) * this.pageSize;
    const localIndex = globalIndex - pageOffset;
    const src = this.rawPublications[localIndex] || {};
    this.editRow = src;

    const attach = src.AttachmentList;
    if (attach && Array.isArray(attach)) {
      this.fileParameters = attach.map((attachment: any) => ({
        data: null as any,
        fileName: attachment.FILE_NAME || '',
        fileID: attachment.ATTACHMENT_ID,
        originalSize: attachment.FILE_SIZE_BYTES
      }));
    } else {
      this.fileParameters = [];
    }
    
    const allTextFields: TkmendField[] = Object.keys(src)
      .filter(k => k !== 'AttachmentList')
      .map((key, idx) => {
        const val = (src as any)[key];
        const text = val === null || val === undefined ? '' : (typeof val === 'object' ? JSON.stringify(val) : String(val));
        return {
          fildSql: idx,
          fildRelted: undefined,
          fildKind: (key && key.length > 0)
            ? key
              .replace(/([a-z])([A-Z])/g, '$1_$2')
              .replace(/\s+/g, '_')
              .replace(/__+/g, '_')
              .replace(/^_+|_+$/g, '')
              .toUpperCase()
            : key,
          fildTxt: text,
          mendGroup: 1,
          isExtendable: false
        } as unknown as TkmendField;
      });

    this.messageDto = {
      messageId: 0,
      subject: '',
      description: '',
      status:  MessageStatus.جديد,
      priority: Priority.Low,
      createdBy: '',
      assignedSectorId: undefined,
      currentResponsibleSectorId: undefined,
      createdDate: new Date(),
      dueDate: undefined,
      closedDate: undefined,
      requestRef: undefined,
      type: 0,
      categoryCd: 0,// 'المنشورات',
      fields: allTextFields,
      replies: undefined,
      attachments: undefined,
      // isReading: false,
      // userRead: undefined
    } as MessageDto;
    this.editDialogVisible = true;
  }

  closeDialog() {
    this.displayDialog = false;
    this.selectedRow = null;
  }

  closeEditDialog(): void {
    this.editDialogVisible = false;
  }

  editActiveRequestDto: EditActiveRequestDto = {} as EditActiveRequestDto;

  AcivateDocuments(): void {
    this.editActiveRequestDto.DOCUMENT_ID = Number(this.messageDto.fields?.find(f => f.fildKind === "DOCUMENT_ID")?.fildTxt) || 0 ;
    this.editActiveRequestDto.Val = this.messageDto.fields?.find(f => f.fildKind === 'VAL')?.fildTxt == '1' ? '0' : '1';
    // this.editRow['VAL'] = this.editRow['VAL'] == '1' ? '0' : '1';

    this.publicationsController.editActivation(this.editActiveRequestDto).subscribe({
      next: (resp: any) => {
        if (resp && resp.IsSuccess) {
          this.msg.msgSuccess('تم الحفظ بنجاح', 4000);
          if (resp.Document_Number && resp.Document_Number.length > 0) {
            const editRowIndex = this.rawPublications.findIndex(row => row.DocumentId === this.editActiveRequestDto.DOCUMENT_ID);
            if (editRowIndex !== -1) {
              this.rawPublications[editRowIndex]['DOCUMENT_NUMBER'] = resp.Document_Number;
              this.mapResponseToTargetArray(this.rawPublications, this.documentConfig);
              this.editDialogVisible = false;
            }
          }
        } else {
          let errors = '';
          [resp.ResponseDetails].forEach(r => {
            if (r && Array.isArray(r)) {
              r.forEach((e: any) => errors += (e?.responseMessage || e) + '\n');
            }
          });
          this.msg.msgError(errors, 'فشل الحفظ', true);
        }
      },
      error: (err: any) => {
        console.error('save error', err);
        this.msg.msgError(err?.message || err, 'خطأ في الاتصال', true);
      }
    });
  }
  updateRow(enevt: any) {
    const editRowIndex = this.rawPublications.findIndex(row => row === this.editRow);
    if (editRowIndex !== -1) {
      this.rawPublications[editRowIndex] = enevt;
      this.mapResponseToTargetArray(this.rawPublications, this.documentConfig);
    }
  }
  getEditableKeys(row: any): string[] {
    return Object.keys(row);
  }

  getRowKeys(obj: any): string[] {
    if (!obj) return [];
    return Object.keys(obj);
  }

  formatHeader(key: string): string {
    if (!key) return '';
    // replace underscores, split camelCase, and trim
    const withSpaces = key.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
    return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
  }
  onAddNew() {
    // Decide destination based on current route key
    const url = this.router && this.router.url ? this.router.url : '';

    const routeToAddMap: { key: string; path: string; itemName?: string }[] = [
      { key: 'FullPublication', path: '/Publications/AddNew', itemName: 'وثيقة' },
      { key: 'All-Document', path: '/Publications/AddNewDocumentTypes', itemName: 'نوع الوثيقة' },
      { key: 'All-District', path: '/Publications/AddNewDistricts', itemName: 'منطقة' },
      { key: 'All-Category', path: '/Publications/AddNewCategories', itemName: 'تصنيف' },
      { key: 'All-Main-Services', path: '/Publications/AddNewMainServices', itemName: 'خدمة رئيسية' },
      { key: 'All-Publication', path: '/Publications/AddNewPublicationTypes', itemName: 'نوع النشر' },
      { key: 'All-Sector', path: '/Publications/AddNewSectors', itemName: 'قطاع' },
    ];

    const match = routeToAddMap.find(r => url.includes(r.key));
    if (match) {
      this.router.navigate([match.path]);
    }

    // Still emit addNew for parent listeners and log action
    this.addNew.emit();
    console.log('Add new', this.itemName, 'navigated to', match ? match.path : 'none');
  }
  onPageChange(event: any) {
    console.log('event', event)
    this.currentPage = (event.first / event.rows) + 1;
    this.pageSize = event.rows
    this.GETData();
  }

  getActivateLabel(): string {
    const active = !!(this.messageDto && (this.messageDto.fields?.find(f => f.fildKind === 'VAL')?.fildTxt === '1' ));
    return active ? 'تعطيل' : 'تفعيل';
  }
}
