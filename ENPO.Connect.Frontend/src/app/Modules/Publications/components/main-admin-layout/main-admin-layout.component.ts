import { Component, AfterViewInit } from '@angular/core';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';
import { ColumnConfig, GenerateQueryService } from 'src/app/Modules/enpopower-bi/services/generate-query.service';
import { TreeNode } from 'src/app/shared/services/helper/auth-objects.service';
import { AttchedObjectService } from 'src/app/shared/services/helper/attched-object.service';
import { ComponentConfig, getConfigByRoute, processRequestsAndPopulate, routeKey } from 'src/app/shared/models/Component.Config.model';
import { Router } from '@angular/router';
import { GenericFormsService, GenericFormsIsolationProvider } from 'src/app/Modules/GenericComponents/GenericForms.service';
import { FormGroup, FormArray } from '@angular/forms';
import { ComponentConfigService } from 'src/app/Modules/admins/services/component-config.service';
import { PublicationsController, DynamicFormController } from 'src/app/shared/services/BackendServices';
import { ExpressionDto, DocumentRespPagedResult } from 'src/app/shared/services/BackendServices/Publications/Publications.dto';
import { FileParameter } from 'src/app/shared/services/BackendServices/dto-shared';
import { TourService } from 'src/app/shared/services/tour.service';


@Component({
  selector: 'app-main-admin-layout',
  templateUrl: './main-admin-layout.component.html',
  styleUrls: ['./main-admin-layout.component.scss'],
  providers: [GenericFormsIsolationProvider]
})
export class MainAdminLayoutComponent implements AfterViewInit {

  configPanelOpen = false;

  // Table configuration panel booleans
  showExportButton = false;
  showRemoveColumn = false;
  showDeleteButton = false;
  showViewButton = true;
  showEditButton = false;
  showFieldSort = false;
  showColumnFilter = false;
  showTableDetails = false;


  formExpanded = true;

  tree: any[] = [];
  categoryTree: TreeNode[] = [];
  unitTree: TreeNode[] = [];

  panelSizes: number[] = [20, 80];


  allPublications: Record<string, any>[] = [];
  rawPublications: any[] = [];
  item_columns: string[] = [];
  documentConfig: ColumnConfig[] = [];
  fileParameters: FileParameter[] = []

  expressionsDto: ExpressionDto[] = []
  config: ComponentConfig = {} as ComponentConfig;

  constructor(
    private msg: MsgsService,
    private publicationsController: PublicationsController,
    private spinner: SpinnerService, private router: Router,
    private generateQueryService: GenerateQueryService, public genericFormService: GenericFormsService, private dynamicFormController: DynamicFormController,
    private attchedObjectService: AttchedObjectService,
    private appConfigService: ComponentConfigService,
    private tourService: TourService) {

    this.documentConfig = [
      // { field: 'serial', header: '#', visible: true },
      { field: 'DOCUMENT_NUMBER', header: 'رقم الوثيقة', visible: true },
      { field: 'WORKING_START_DATE', header: 'تاريخ بدء العمل', visible: true },
      { field: 'MINI_DOC', header: 'ملخص الوثيقة', visible: true },
      { field: 'SectorName', header: 'اسم القطاع', visible: true },
      { field: 'DistrictName', header: 'اسم المنطقة', visible: true },
      { field: 'DocumentType', header: 'نوع الوثيقة', visible: true },
      { field: 'Application', header: 'اسم التطبيق', visible: true },

      { field: 'PublicationTypeName', header: 'نوع النشر', visible: true },
      { field: 'ALL_TEXT_DOC', header: 'النص الكامل للوثيقة', visible: false },
      // { field: 'AttachmentList', header: 'المرفقات', visible: false },
    ];
    const _routeKey = routeKey(this.router.url);
    this.appConfigService.getAll().subscribe(items => {
      const cfg = getConfigByRoute(_routeKey, items || []);
      if (!cfg) return;
      this.config = cfg;
      this.genericFormService.applicationName = this.config.genericFormName || '';
      if (this.config.isNew) {
        processRequestsAndPopulate(this, this.genericFormService, this.spinner).subscribe({
          next: () => {
          },
          complete: () => {
          }
        });
      }
    });
  }

  ngAfterViewInit() {
    // setTimeout(() => {
    //     // this.tourService.startPublicationsTour();
    // }, 1500);
  }

  restartTour() {
      this.tourService.forceStartPublicationsTour();
  }

  private populatePublicationTable(source?: any[]) {
    const src = source ?? this.config.requestsarray?.[4]?.arrValue ??  [];
    const sourceArray = Array.isArray(src) ? src.slice() : [];
    sourceArray.sort((a: any, b: any) => {
      return new Date(b.LastModifiedDate).getTime() - new Date(a.LastModifiedDate).getTime();
    });
    const mapped = this.generateQueryService.mapDataToTable(sourceArray, this.documentConfig);
    this.allPublications = mapped;
    this.item_columns = this.documentConfig.filter(c => c.visible).map(c => c.header);
  }

  onPageChange(event: any) {
    this.config.listRequestModel.pageNumber = Number(event.first / event.rows) + 1;
    this.config.listRequestModel.pageSize = event.rows
    this.Get(this.publicationsController.getDocumentsList_user(this.config.listRequestModel.pageNumber, this.config.listRequestModel.pageSize, this.expressionsDto));
  }

  Get(endpoint: any) {
    this.spinner.show('جاري تحميل البيانات ...');
    endpoint.subscribe({
      next: (resp: DocumentRespPagedResult) => {
        if (resp.Data) {
          const sorted = resp.Data?.sort((a: any, b: any) => {
            return new Date(b.LastModifiedDate).getTime() - new Date(a.LastModifiedDate).getTime();
          }) || [];
          this.rawPublications = sorted;
          this.config.totalRecords = resp.TotalCount;
          this.populatePublicationTable(sorted);

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
  menuItemId: number = 0;
  onSidebarMenuItemSelected(event: any) {
    this.menuItemId = event.node.key;
    if (!this.menuItemId) {
      console.warn('No menu item ID found');
      this.msg.msgInfo('لا يمكن تحديد معرف العنصر المحدد', 'تحذير', 'warning');
      return;
    }
    // this.config.listRequestModel.pageSize = 5;
    this.config.listRequestModel.pageNumber = 1;
    this.expressionsDto = this.buildExpressionsFromForm(this.ticketForm);
    this.Get(this.publicationsController.getDocumentsList_user(this.config.listRequestModel.pageNumber, this.config.listRequestModel.pageSize, this.expressionsDto));
  }
  nodeUnselection(event: any) {
    const node = event && event.node ? event.node : event;
    console.log('UnSelected', node);
    // Clear selected menu filter and reload default list
    this.menuItemId = 0;
    this.expressionsDto = [];
    try {
      this.Get(this.publicationsController.getDocumentsList_user(this.config.listRequestModel.pageNumber, this.config.listRequestModel.pageSize, this.expressionsDto));
    } catch (err) {
      console.error('Error reloading list after node unselection', err);
    }
  }
  onselectItemEvent(event: any) {
    console.log(event)
  }
  selectedRow: any = null;
  displayDialog: boolean = false;

  private buildExpressionsFromForm(formOrGroup?: any): ExpressionDto[] {
    const expressions: ExpressionDto[] = [];

    // Try to locate the subgroup `mandFileds_group_5` from a full form object
    let group: FormGroup<any> | undefined = undefined;
    if (!formOrGroup) {
      group = undefined;
    } else {
      group = formOrGroup?.controls?.mandFileds_group_5
        ?? (formOrGroup?.get ? formOrGroup.get('mandFileds_group_5') : null)
        ?? formOrGroup?.value?.mandFileds_group_5;
      // If the passed object itself looks like the subgroup, accept it
      if (!group && formOrGroup instanceof FormGroup) {
        group = formOrGroup as FormGroup<any>;
      }
    }

    const collect = (ctrl: any, prefix?: string) => {
      if (!ctrl) return;
      if (ctrl instanceof FormGroup) {
        Object.keys(ctrl.controls).forEach(k => collect(ctrl.controls[k], prefix ? `${k}` : k));
        return;
      }
      if (ctrl instanceof FormArray) {
        for (let i = 0; i < ctrl.length; i++) collect(ctrl.at(i), prefix ? `${i}` : String(i));
        return;
      }
      const val = ctrl?.value ?? '';
      if (val !== undefined && val !== null && val !== '') {
        const propName = this.genericFormService.nameIndexes((prefix || '').toUpperCase()).name;
        const asNumber = Number(val);
        if (!isNaN(asNumber) && String(val).trim() !== '') {
          expressions.push({ PropertyName: propName, PropertyIntValue: asNumber } as ExpressionDto);
        } else {
          expressions.push({ PropertyName: propName, PropertyStringValue: String(val) } as ExpressionDto);
        }
      }
    };

    collect(group);
    if (this.menuItemId && this.menuItemId !== 0) {
      expressions.push({ PropertyName: 'MENUITEMID', PropertyIntValue: Number(this.menuItemId) } as ExpressionDto);
    }

    return expressions;
  }

  ticketForm: FormGroup = {} as FormGroup;
  updateForm($event: FormGroup<any>) {
    this.ticketForm = $event;
    this.expressionsDto = this.buildExpressionsFromForm($event);
  }
  onSubmit(event: any) {
    const group = event?.controls?.mandFileds_group_5
      ?? (event?.get ? event.get('mandFileds_group_5') : null)
      ?? event?.value?.mandFileds_group_5;

    const expressions = this.buildExpressionsFromForm(event);
    // if (!expressions || expressions.length === 0) return;

    // reset to first page and perform the search using existing config
    this.config.listRequestModel.pageNumber = 1;
    this.expressionsDto = expressions;
    this.Get(this.publicationsController.getDocumentsList_user(this.config.listRequestModel.pageNumber, this.config.listRequestModel.pageSize, this.expressionsDto));
  }

  //XXXXXXXXXXXXXXXXXXXXX HTML XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

  edit(event: any) {
    console.log(event)
  }
  viewRow(event: any) {
    // event.index is the global rowIndex from PrimeNG (across all pages)
    // Calculate the page-local index by subtracting the offset of previous pages
    const globalIndex = event.index;
    const pageOffset = (this.config.listRequestModel.pageNumber - 1) * this.config.listRequestModel.pageSize;
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
    // this.config.attachmentConfig.showAttachmentSection = true;
    this.displayDialog = !!this.selectedRow;
  }
  downloadAttachment(event: any) {
    console.log(event)
    this.spinner.show('جاري تنزيل المرفق ..');
    this.publicationsController.getFileContent(event.id)
      .subscribe({
        next: (res: any) => {
          if (res.IsSuccess) {
            if (res.FILE_CONTENT.length > 0)
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
          const newLocal = this;
          newLocal.msg.msgError(err, "", true)
        }
      });
  }
  closeDialog() {
    this.displayDialog = false;
    this.selectedRow = null;
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
  formatRelativeHours(dateVal: any): string {
    if (!dateVal) return '';
    try {
      const diffMs = Date.now() - new Date(dateVal).getTime();
      const hours = Math.floor(diffMs / 3600000);
      return `قبل ${hours} ساعة`;
    } catch (e) {
      return '';
    }
  }
}
