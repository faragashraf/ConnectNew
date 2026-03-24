import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, SimpleChanges, ViewChild } from '@angular/core';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FileHandle } from 'src/app/shared/services/helper/attched-object.service';
import { Table } from 'primeng/table';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ReplyComponent } from 'src/app/Modules/GenericComponents/ConnectComponents/reply/reply.component';
import { GenericFormsService, GenericFormsIsolationProvider } from 'src/app/Modules/GenericComponents/GenericForms.service';
import { Observable, Subject, Subscription } from 'rxjs';
import { SignalRService } from 'src/app/shared/services/SignalRServices/SignalR.service';
import { assignSubscription } from 'src/app/shared/services/SignalRServices/AdminCerObjectHub.service';
import { AuthObjectsService } from 'src/app/shared/services/helper/auth-objects.service';
import { ComponentConfig, populateTreeGeneric } from '../../../../shared/models/Component.Config.model';
import { TreeNode } from 'primeng/api';
import { MessageDto, MessageStatus, RequestedData, SearchKind } from 'src/app/shared/services/BackendServices/AdministrativeCertificate/AdministrativeCertificate.dto';
import { CdmendDto } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.dto';
import { AttachmentsController } from 'src/app/shared/services/BackendServices/Attachments/Attachments.service';
import { FileParameter } from 'src/app/shared/services/BackendServices/dto-shared';
import { RepliesController } from 'src/app/shared/services/BackendServices/Replies/Replies.service';
import { RepliesReplyWithAttchmentFormRequest, Reply } from 'src/app/shared/services/BackendServices/Replies/Replies.dto';
import { RequestStatusService } from 'src/app/Modules/AdminCertificates/Shared/helper/RequestStatus.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-request-table',
  templateUrl: './request-table.component.html',
  styleUrls: ['./request-table.component.scss'],
  providers: [GenericFormsIsolationProvider]
})
export class RequestTableComponent implements OnInit, OnDestroy {
  [x: string]: any;

  TextKind: string = '';
  TextTypeOptions = [
    { label: 'يساوي', value: 'Equal' },
    { label: 'يحتوي', value: 'Contains' },
    { label: 'يبدأ بـ', value: 'Start With' },
    { label: 'ينتهي بـ', value: 'End With' },
  ];
  TextType: string = 'Equal';
  TextSearch: string = '';

  @Input() unitTree: TreeNode[] = [];
  @Input() cdmendDto: CdmendDto[] = [];
  @Input() messageDtos: MessageDto[] = [];

  @Input() config: ComponentConfig = {} as ComponentConfig;
  @Input() public genericFormService!: GenericFormsService;
  @Input() loading: boolean = false;
  @Input() admCertDeptDtos: any[] = []
  @Output() currentPage = new EventEmitter<number>();
  @Output() listRequestModelChange = new EventEmitter<any>();
  @Output() editRequested = new EventEmitter<MessageDto>();
  @Output() tabChanged = new EventEmitter<{ message: MessageDto, index: number | null }>();

  filteredticketDtos: MessageDto[] = []
  counters: MessageDto[] = []
  filteredCounters: MessageDto[] = []

  messageDto: MessageDto = {} as MessageDto;
  attachCount: number = 0;
  isSearchMode: boolean = false;
  // Controls whether the filter panel is collapsed (default: collapsed)
  filtersCollapsed: boolean = true;

  // Unique ID for radio button group to prevent conflicts when multiple tables exist
  uniqueId: string = 'mode-' + Math.random().toString(36).substring(2);

  categoryTree: TreeNode[] = [];
  isCategoryTreeMode: boolean = false;
  overlayVisible: boolean = false;

  MessageStatus = MessageStatus; // Expose enum to the template
  EnpoCompleteRequestVisible: boolean = false;
  constructor(private attachmentsController: AttachmentsController, private spinner: SpinnerService, private msg: MsgsService,
    private fb: FormBuilder, private replies: RepliesController, private router: Router,
    private http: HttpClient,
    public authObjectsService: AuthObjectsService, public requestStatusService: RequestStatusService, private chatService: SignalRService) {

    this.frm = this.fb.group({
      file: [this.file, Validators.required],
    })
    this.typefrm = this.fb.group({
      type: [0, Validators.required],
    });
    this.statusfrm = this.fb.group({
      type: [5, Validators.required],
    });
  }
  onPageChange(event?: any) {
    const _CurrentPage = Number(event.first / event.rows) + 1;
    // this.goToPage(_CurrentPage);
    // this.currentPage.emit(_CurrentPage);
    this.config.listRequestModel.pageNumber = _CurrentPage
    this.listRequestModelChange.emit(this.config.listRequestModel);
  }
  onRowsPerPageChange(event: any): void {
    const newRows = (event && (event.value ?? event.rows))
      ? (event.value ?? event.rows)
      : (this.dt1?.rows ?? (this.config.listRequestModel?.pageSize ?? 10));

    if (this.dt1) {
      this.dt1.rows = newRows;
      this.dt1.first = 0;
    }
    if (this.config && this.config.listRequestModel) {
      const model: any = this.config.listRequestModel;
      if ('pageSize' in model) model.pageSize = newRows;
      else if ('rows' in model) model.rows = newRows;
      else model.pageSize = newRows;
    }

    // Emit page change so parent can react (first index and rows)
    this.onPageChange({ first: 0, rows: newRows, page: 0 });
  }
  @ViewChild(ReplyComponent) childComponent!: ReplyComponent;
  ReplyCreateDto: RepliesReplyWithAttchmentFormRequest = {} as RepliesReplyWithAttchmentFormRequest;
  fileParameters: FileParameter[] = []

  searchOptions: { cdmendTxt: string | undefined, cdMendLbl: string | undefined }[] = []

  private SetSearchKind() {
    this.searchOptions = this.genericFormService.getSearchableCdmendDtosByCategory();

    if (this.config.listRequestModel.requestedData == RequestedData.MyRequest)
      this.config.listRequestModel.search.searchKind = SearchKind.NormalSearch;
    else if (this.config.listRequestModel.requestedData == RequestedData.Inbox
      || this.config.listRequestModel.requestedData == RequestedData.Outbox)
      this.config.listRequestModel.search.searchKind = SearchKind.LimitedSearch;
    else if (this.config.listRequestModel.requestedData == RequestedData.Global)
      this.config.listRequestModel.search.searchKind = SearchKind.GlobalSearch;
  }

  onSearchModeChange() {
    // Check the intended mode (isSearchMode) directly from the component property
    if (this.isSearchMode) {
      this.SetSearchKind();
      // Clear data to prepare for search results
      this.messageDtos = [];
      this.filteredticketDtos = [];
    } else {
      this.config.listRequestModel.search.searchKind = SearchKind.NoSearch;

      this.typefrm.get('type')?.patchValue(0)
      this.statusfrm.get('type')?.patchValue(5)

      this.TextKind = ''
      this.TextSearch = ''
      this.mergedFilterRequests();
    }
  }

  handleFiles(event: FileParameter[]) {
    this.fileParameters = event;
    console.log('eventfileParameters', this.fileParameters);
  }
  handleFormReplySubmit(formData: RepliesReplyWithAttchmentFormRequest) {
    // Handle form submission logic here
    this.ReplyCreateDto = formData
    this.spinner.show();
    this.replies.replyWithAttchment(this.ReplyCreateDto.message, this.ReplyCreateDto.messageId, this.ReplyCreateDto.nextResponsibleSectorID, this.ReplyCreateDto.files)
      .subscribe({
        next: (res) => {
          if (res.isSuccess) {
            if (this.config.routeKey == 'AdminCer/MyInbox') {
              this.filteredticketDtos = this.filteredticketDtos.filter(item => item.messageId !== this.ReplyCreateDto.messageId);
              this.messageDtos = this.messageDtos.filter(item => item.messageId !== this.ReplyCreateDto.messageId);

            }
            this.msg.msgSuccess('Done', 3000, false)
            this.childComponent.replyForm.reset();
            this.childComponent.replyForm.get('messageId')?.patchValue(this.messageDto.messageId);
            this.childComponent.SearchText = '';
          }
          else {
            let errors = "";
            res.errors?.forEach(e => {
              errors += e.message + '\n';
            });
            this.msg.msgError('Error', '<h5>' + errors + '</h5>', true)
          }
        },
        error: (error) => {

          this.msg.msgError('Error', '<h5>' + error + '</h5>', true)
        },
        complete: () => {

        }
      })
    // If you need to set message ID:
    // this.replyFormComponent.setMessageId(123);
  }
  handleAttachCount(event: number) {
    this.attachCount = event;
  }
  replyIds: any[] = []
  frm!: FormGroup
  typefrm!: FormGroup
  statusfrm!: FormGroup
  file!: File

  OnHideAction() {
    this.messageDto = {} as MessageDto
  }

  onMessageUpdated(updatedMessage: MessageDto | Event) {
    const candidate = updatedMessage as MessageDto;
    if (!candidate || typeof candidate !== 'object' || !Number.isFinite(Number(candidate.messageId))) {
      return;
    }

    // Also keeping the local messageDto in sync in case the modal uses it.
    this.messageDto = candidate;
    // Replace the messageDto in the messageDtos array to reflect changes on UI
    const index = this.messageDtos.findIndex(m => m.messageId === candidate.messageId);
    if (index !== -1) {
      this.messageDtos[index] = candidate;
    }
  }

  GetDataMetadata() {
    this.genericFormService.GetDataMetadata(this.config.menuId).subscribe((ready) => {
      // callers can react after metadata is loaded; here we don't need to do anything special,
      // but keeping this hook allows other initialization steps to run after metadata is ready.
      if (ready) {
        // metadata loaded successfully
      }
    });
  }
  gropName$: Subject<string> = new Subject<string>();
  gropName: string = '';
  gropNameSubscription!: any; // Local subscription for gropName$
  adminCerObjectSubscription!: any; // Local subscription for adminCerObject$

  assignSubscriptionNew(
    prevSubscription: Subscription | undefined,
    observable: Observable<any>,
    next: (value: any) => void,
    error?: (err: any) => void,
    complete?: () => void,
    onUnsubscribe?: (wasActive: boolean) => void
  ): Subscription {
    let wasActive = false;
    if (prevSubscription && !prevSubscription.closed) {
      wasActive = true;
      prevSubscription.unsubscribe();
      if (onUnsubscribe) {
        onUnsubscribe(wasActive);
      }
    }
    return observable.subscribe({ next, error, complete });
  }

  ngOnDestroy(): void {
    // this.chatService.RemoveFromGroupAsync(this.gropName).catch(error => console.log(error));
    if (this.gropNameSubscription) {
      this.gropNameSubscription.unsubscribe();
    }

    if (this.adminCerObjectSubscription && !this.adminCerObjectSubscription.closed) {
      this.adminCerObjectSubscription.unsubscribe();
    }
  }
  ngOnInit() {
    this.typefrm.get('type')?.patchValue(0)
    this.statusfrm.get('type')?.patchValue(5)
    this.filteredticketDtos = [...this.messageDtos];

    this.gropNameSubscription = assignSubscription(
      this.gropNameSubscription,
      this.gropName$,
      (group: string) => {
        if (group.length > 0) {
          this.gropName = group;
          // this.chatService.AddUserTogroup(this.gropName);
        }
      },
      error => {
        // handle error if needed
      },
      () => {
        // handle complete if needed
      },
      (wasActive) => {
        // On unsubscribe, remove from group if there was an active subscription
        if (wasActive)
          this.gropNameSubscription.unsubscribe();
        if (wasActive && this.gropName) {
          // this.chatService.RemoveFromGroupAsync(this.gropName).catch(error => console.log(error));
        }
      }
    );
  }
  ngOnChanges(changes: SimpleChanges) {
    // React to input changes
    if (changes['messageDtos']) {
      try {
        this.filteredticketDtos = [...(changes['messageDtos'].currentValue || [])];
        if (this.filteredticketDtos.length > 0) {
          if (this.router.url.includes('AdminCer/MyInbox'))
            this.gropName$.next(this.filteredticketDtos[0].currentResponsibleSectorId as string)
          else
            this.gropName$.next(this.filteredticketDtos[0].assignedSectorId as string)
        }
      } catch (e) {
        console.log(e)
      }
    }

    if (changes['config'] && this.config) {
      this.isCategoryTreeMode = this.config.fieldsConfiguration?.isCategoryTreeMode ?? false;
      if (this.isCategoryTreeMode) {
        this.prepareCategoryTree();
      }
    }
  }

  saveOriginalStatus(status: any): void {
    this.requestStatusService.originalStatus = status;
  }

  public FilterOnlyStatus(status: any): any[] {
    return this.requestStatusService.AdminCerStatusOptions.filter(f => f.key == status || (f.key <= 3 ? f.key == Number(status) + 1 : 0));
  }

  getStatusRadioOptions(status: any): Array<{ label: string; value: number }> {
    const fallback = this.FilterOnlyStatus(status)
      .map((opt: any) => ({ label: String(opt?.label ?? opt?.value ?? ''), value: Number(opt?.key ?? opt?.value) }))
      .filter((opt: any) => opt.label.length > 0 && !isNaN(opt.value));

    const configured = Array.isArray((this.config as any)?.statusChangeOptions) ? (this.config as any).statusChangeOptions : [];
    if (!configured.length) return fallback;

    const allowedValues = new Set(fallback.map(o => Number(o.value)));
    const normalized = configured
      .map((opt: any) => ({ label: String(opt?.label ?? '').trim(), value: Number(opt?.value) }))
      .filter((opt: any) => opt.label.length > 0 && !isNaN(opt.value) && allowedValues.has(Number(opt.value)));

    return normalized.length ? normalized : fallback;
  }

  isStatusChangeDisabled(message: MessageDto): boolean {
    const notSameSector = (message.assignedSectorId != message.currentResponsibleSectorId && message.currentResponsibleSectorId != null);
    const isDeadStatus = Array.isArray(this.config?.deadStatus) ? this.config.deadStatus.indexOf(message.status as any) !== -1 : false;
    return notSameSector || isDeadStatus || this.config.allowStatusChange === false;
  }

  isStatusChecked(message: MessageDto, value: any): boolean {
    return Number(message.status) === Number(value);
  }

  onStatusRadioSelect(message: MessageDto, selectedStatus: any): void {
    if (this.isStatusChangeDisabled(message)) return;
    const nextStatus = Number(selectedStatus);
    const currentStatus = Number(message.status);
    if (isNaN(nextStatus) || currentStatus === nextStatus) return;

    this.saveOriginalStatus(message.status);
    message.status = nextStatus as any;
    this.requestStatusService.updateStatus(message, this.messageDtos);
  }

  get(message: MessageDto, field: string): string {
    return message.fields?.find(f => f.fildKind === field)?.fildTxt || ''
  }

  /** Triggered by the animated Edit button in the caption. Emits the selected message (if any). */
  onEdit(): void {
    if (this.messageDto && this.messageDto.messageId) {
      this.editRequested.emit(this.messageDto);
      // Create server-side token mapping, then navigate using the token
      const routeParts = (this.config.routeKey || '').split('/');
      const modulePath = routeParts.length >= 1 ? routeParts[0] : '';
      this.http.post<any>(environment.ConnectApiURL+'/api/AdministrativeCertificate/CreateRequestToken', this.messageDto.messageId).subscribe({
        next: (res) => {
          if (res?.isSuccess === false) {
            const errors = (res?.errors || []).map((e: any) => e.message).join('\n') || 'خطأ أثناء إنشاء الرابط';
            this.msg.msgError('خطأ', '<h5>' + errors + '</h5>', true);
            return;
          }
          const token = res?.data || res;
          if (!token) {
            this.msg.msgError('خطأ', 'فشل إنشاء الرابط', true);
            return;
          }
          this.router.navigate(['/' + modulePath, 'edit', token], {
            state: { config: this.config, returnUrl: this.router.url }
          });
        },
        error: (err) => {
          this.msg.msgError('خطأ', '<h5>خطأ في الاتصال بالخادم</h5>', true);
        }
      });
    } else {
      // friendly UX: show a message if no row is selected
      this.msg.msgError('اختر سطرًا', 'الرجاء تحديد سطر لتعديله', false);
    }
  }
  canShowPrePrintButton(message: MessageDto): boolean {

    if (this.config.routeKey != 'AdminCer/AreaRequests' || message.status == MessageStatus.مرفوض) return false;
    if (this.config.routeKey == 'AdminCer/AreaRequests' && this.config.listRequestModel.search.searchKind === SearchKind.NormalSearch) return true;

    // Case 1: message has a currentResponsibleSectorId and it matches assignedSectorId and status != 3
    const case1 = !!message.currentResponsibleSectorId &&
      message.currentResponsibleSectorId === message.assignedSectorId;
    // && message.status != MessageStatus.تم_الطباعة;

    // Case 2: message has no currentResponsibleSectorId (null/undefined)
    const case2 = (message.currentResponsibleSectorId == null);

    // Case 3: message status is 0
    const case3 = (message.status === MessageStatus.جديد);

    return case1 || case2 || case3;
  }
  canShowEnpoCompleteRequest(message: MessageDto): boolean {
    if (this.config.routeKey == 'EmployeeRequests/MyRequests' && message.status == 2) return true;
    else return false;
  }
  reply: Reply = {} as Reply;
  submit() {
    this.spinner.show();
    let Ext = '.' + this.file.name.split('.')[this.file.name.split('.').length - 1]
    let fileParameter: FileParameter =
    {
      data: this.file,
      fileName: this.file.name
    };
    this.attachmentsController.documentRecieve(this.messageDto.messageId.toString(), fileParameter)
      .subscribe({
        next: (res) => {

          if (res.isSuccess) {
            this.genericFormService.prePrintFormVisible = false;
            this.file = {} as File
            this.msg.msgSuccess(res.data as string, 3000, false)
          }
          else {
            this.genericFormService.prePrintFormVisible = false;
            let errors = "";
            res.errors?.forEach(e => {
              errors += e.message + '\n';
            });
            this.msg.msgError('Error', '<h5>' + errors + '</h5>', true)
          }
        },
        error: (error) => {
          this.genericFormService.prePrintFormVisible = false;

          this.msg.msgError('Error', '<h5>' + error + '</h5>', true)
        },
        complete: () => {

        }
      })
  }
  fille!: FileHandle
  @ViewChild('dt1') dt1!: Table; // Using non-null assertion to tell TypeScript that it will always be initialized

  onSmartSearch(): void {
    // this.config.listRequestModel.search = {
    //   searchKind: this.adminCerFlags.isAreaRequests ? SearchKind.NormalSearch : SearchKind.NoSearch,
    //   searchField: this.TextKind,
    //   searchText: this.TextSearch,
    //   searchType: this.TextType
    // }
    this.config.listRequestModel.search.searchField = this.TextKind;
    this.config.listRequestModel.search.searchText = this.TextSearch;
    this.config.listRequestModel.search.searchType = this.TextType;
    this.config.listRequestModel.pageNumber = 1;
    this.listRequestModelChange.emit(this.config.listRequestModel);
  }


  onRowSelect(event: any) {
    this.messageDto = event.data;
    console.log(this.messageDto)
  }

  handleRowExpand(event: any) {
    this.messageDto = event.data
  }

  onRowUnselect(event: any) {
    // this.isReadFunc();
    this.messageDto = {} as MessageDto;
  }

  handleRowCollapse(event: any) {
    this.messageDto = {} as MessageDto
  }

  /** Handles tab view change inside the expanded row; emits `tabChanged` with the message and selected tab index. */
  onTabChange(event: any, message: MessageDto): void {
    const index = (event && (typeof event.index === 'number')) ? event.index : null;
    if (index !== null && index === 1 && !this.authObjectsService.checkAuthFun('AdminEditFunc'))
      this.config.fieldsConfiguration.isDivDisabled = true;
    if (index !== null && index === 2)
      this.config.fieldsConfiguration.isDivDisabled = false;
    this.tabChanged.emit({ message, index });
  }
  mergedFilterRequests() {
    // Get current filter values safely
    const typeValue = this.typefrm.get('type')?.value;
    const statusValue = this.statusfrm.get('type')?.value;
    this.filteredticketDtos = [];
    this.config.listRequestModel.categoryCd = Number(typeValue);
    this.config.listRequestModel.status = Number(statusValue);
    this.config.listRequestModel.pageNumber = 1

    // this.goToPage(0);
    this.listRequestModelChange.emit(this.config.listRequestModel);
  }

  goToPage(pageIndex: number) {
    if (this.dt1) {
      const rows = this.dt1.rows || 5; // Default to 10 if not set
      this.dt1.first = (pageIndex) * rows;
      this.dt1.onPageChange({
        first: this.dt1.first, rows: rows, page: pageIndex, pageCount: Math.ceil(this.dt1.totalRecords / rows)
      });
    }
  }
  getSeverity(status: string): string {
    switch (status) {
      case 'جديد':
        return 'primary';
      case 'جاري التنفيذ':
        return 'warning';
      case 'معلق':
        return 'warning';
      case 'تم الرد':
        return 'info';
      case 'مرفوض':
        return 'danger';
      case 'تمت الطباعة':
        return 'success';
      case 'موافقة مبدئية':
        return 'info';
      case 'تمت الموافقة':
        return 'success';
      case 'الكل':
        return 'secondary';
      default:
        return 'secondary';
    }
  }

  prepareCategoryTree() {
    if (this.genericFormService?.cdcategoryDtos && this.genericFormService.cdcategoryDtos.length > 0) {
      if (this.categoryTree.length === 0) {
        populateTreeGeneric(this.genericFormService.cdcategoryDtos, 'catId', 'catParent', 'catName', this.categoryTree, false, true);
        this.categoryTree.unshift({
          label: 'الكل',
          key: '0',
          data: { catId: 0, catName: 'الكل' },
          selectable: true,
          icon: 'pi pi-fw pi-th-large'
        });
      }
    }
  }

  onCategoryNodeSelect(event: any) {
    if (event.node && event.node.data) {
      this.typefrm.get('type')?.setValue(event.node.data.catId);
      this.mergedFilterRequests();
      this.overlayVisible = false;
    }
  }

  get selectedCategoryLabel(): string {
    const val = this.typefrm.get('type')?.value;
    if (val == 0) return 'الكل';
    const cat = this.genericFormService.cdcategoryDtos?.find(c => c.catId == val);
    return cat ? (cat.catName || '') : 'الكل';
  }
}
