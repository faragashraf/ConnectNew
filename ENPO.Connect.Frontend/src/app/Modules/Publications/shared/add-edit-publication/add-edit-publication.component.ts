import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { FormArray, FormBuilder, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { GenericFormsService, GenericFormsIsolationProvider } from 'src/app/Modules/GenericComponents/GenericForms.service';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { AuthObjectsService, TreeNode } from 'src/app/shared/services/helper/auth-objects.service';
import { MenuItem } from 'primeng/api';
import { PowerBiController } from 'src/app/Modules/enpopower-bi/services/PowerBi.service';
import { ComponentConfig, getAnyNode, getConfigByRoute, processRequestsAndPopulate, routeKey } from 'src/app/shared/models/Component.Config.model';
import { ComponentConfigService } from 'src/app/Modules/admins/services/component-config.service';
import { PublicationsController, DynamicFormController } from 'src/app/shared/services/BackendServices';
import { MessageDto } from 'src/app/shared/services/BackendServices/AdministrativeCertificate/AdministrativeCertificate.dto';
import { CdCategoryMandDto } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.dto';
import { AttachmentList, PUB_MENU_ITEMS } from 'src/app/shared/services/BackendServices/Publications/Publications.dto';
import { FileParameter } from 'src/app/shared/services/BackendServices/dto-shared';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';

export interface routeInitMap { key: string; catCode: string; group: number, entryTitle: string }

@Component({
  selector: 'app-add-edit-publication',
  templateUrl: './add-edit-publication.component.html',
  styleUrls: ['./add-edit-publication.component.scss'],
  providers: [GenericFormsIsolationProvider]
})
export class AddEditPublicationComponent implements OnInit {
  @Input() row: any;
  @Input() messageDto: MessageDto = {} as MessageDto;
  @Output() rowChange: EventEmitter<any> = new EventEmitter<any>();
  @Input() fileParameters: FileParameter[] = [];
  @Input() config: ComponentConfig = {} as ComponentConfig;
  @Output() addNew: EventEmitter<void> = new EventEmitter<void>();

  formSubmited: boolean = false;
  contextMenuItems: MenuItem[] = [];
  // dialog state for menu item details
  menuDialogForm: FormGroup = this.fb.group({
    MENU_ITEM_NAME: [''],
    APPLICATION: ['']
  });
  menuDialogVisible: boolean = false;
  PublicationForm!: FormGroup;
  filtered_1_CategoryMand: CdCategoryMandDto[] = []
  dateFormat: string = 'yy-mm-dd';
  categoryTree: TreeNode[] = [];
  file: any;
  panelSizes: number[] = [25, 75];
  routeInitMaps: routeInitMap[] = [];
  foundRouteInitMap: routeInitMap = {} as routeInitMap;
  private formValueSub?: Subscription;
  formHasChanges: boolean = false;

  constructor(private router: Router, private fb: FormBuilder, private publicationsController: PublicationsController, private spinner: SpinnerService,
    private msg: MsgsService, public genericFormService: GenericFormsService, private dynamicFormController: DynamicFormController,
    public authObjectsService: AuthObjectsService, private powerBiController: PowerBiController, private appConfigService: ComponentConfigService) {

  }
  ngOnInit(): void {
    const _routeKey = routeKey(this.router.url);
    this.appConfigService.getAll().subscribe(items => {
      const cfg = getConfigByRoute(_routeKey, items || []);
      if (!cfg) return;
      this.config = cfg;
      this.genericFormService.applicationName = this.config.genericFormName || '';

      processRequestsAndPopulate(this, this.genericFormService, this.spinner).subscribe({
        next: () => {
        },
        complete: () => {
          if (this.row.MENUITEMID != 0)
            this.selectedNode = getAnyNode(this.row.MENUITEMID.toString() as string, this.tree) as any;
          if (this.selectedNode != undefined) {
            this.onNodeSelect(this.selectedNode)
            this.selectedNode.expanded = true;
          }
          this.routeInitMaps = [
            { key: 'AddNew', catCode: '108', group: 1, entryTitle: 'إضافة منشور جديد' },
            { key: 'FullPublication', catCode: '108', group: 1, entryTitle: 'تعديل المنشور' },
            { key: 'AddNewDocumentTypes', catCode: '109', group: 1, entryTitle: 'إضافة نوع وثيقة جديدة' },
            { key: 'AddNewDistricts', catCode: '109', group: 1, entryTitle: 'إضافة منطقة جديدة' },
            { key: 'AddNewPublicationTypes', catCode: '109', group: 1, entryTitle: 'إضافة نوع نشر جديد' },
          ];
          this.foundRouteInitMap = this.routeInitMaps.find(r => this.routeEndWith(r.key)) as routeInitMap;
        }
      });
    });
  }

  ngOnDestroy(): void {
    if (this.formValueSub) {
      this.formValueSub.unsubscribe();
      this.formValueSub = undefined;
    }
  }

  onFileChange(event: any) {
    this.file = []
    this.fileParameters = [];
    this.fileParameters = event
  }

  attachmentList: AttachmentList[] = [];


  onSubmitPublication() {
    if (this.PublicationForm.invalid) { return; }
    const routeInitMap: { key: string; dataCode: string; group: number }[] = [
      { key: 'AddNew', dataCode: '108', group: 1 },
      { key: 'FullPublication', dataCode: '108', group: 1 },
      { key: 'AddNewDocumentTypes', dataCode: '109', group: 1 },
      { key: 'AddNewDistricts', dataCode: '109', group: 1 },
      { key: 'AddNewPublicationTypes', dataCode: '109', group: 1 },
    ];

    const found = routeInitMap.find(r => this.routeEndWith(r.key));
    const key = found ? found.key : '';

    // Prepare common flattened payload map from form values
    const flat: Record<string, any> = {};
    const normalize = (s: string) => (s || '').toString().replace(/[^a-z0-9]/gi, '').toLowerCase();

    // Flatten top-level form controls
    Object.keys(this.PublicationForm.controls).forEach(k => {
      const val = this.PublicationForm.get(k)?.value;
      if (Array.isArray(val)) return; // Skip arrays at the top level
      flat[normalize(k)] = val;
    });

    // Process dynamic groups
    this.genericFormService.dynamicGroups.forEach(group => {
      const formArrayOrGroup = this.PublicationForm.get(group.formArrayName);

      if (formArrayOrGroup instanceof FormGroup) {
        Object.keys(formArrayOrGroup.controls).forEach(key => {
          const value = formArrayOrGroup.get(key)?.value;
          flat[normalize(key)] = value;
        });
      } else if (formArrayOrGroup instanceof FormArray) {
        formArrayOrGroup.controls.forEach((ctrl, index) => {
          if (ctrl instanceof FormGroup) {
            Object.keys(ctrl.controls).forEach(key => {
              const value = ctrl.get(key)?.value;
              flat[`${normalize(key)}|${index}`] = value; // Include index for uniqueness
            });
          }
        });
      }
    });

    // Utility function to pick values from the flattened payload
    const pick = (paramName: string, defaultValue: any = '') => {
      const target = normalize(paramName);
      if (flat[target] !== undefined) return flat[target];
      const foundKey = Object.keys(flat).find(k => k.includes(target) || target.includes(k));
      if (foundKey) return flat[foundKey];
      return defaultValue;
    };

    // call correct save method based on route

    let call$: any;

    switch (key) {
      case 'AddNew': {
        const mINI_DOC = pick('MINI_DOC', '');
        const aLL_TEXT_DOC = pick('ALL_TEXT_DOC', '');
        const rawWorking = pick('WORKING_START_DATE', '');
        const WORKING_START_DATE: Date = rawWorking ?? new Date();

        const rawDistrict = pick('DISTRICT_ID', '');
        const DISTRICT_ID: number | undefined = rawDistrict === '' ? undefined : Number(rawDistrict) || undefined;

        const rawDocType = pick('PUBLICATION_TYPE_ID', '');
        const PUBLICATION_TYPE_ID: number | undefined = rawDocType === '' ? undefined : Number(rawDocType) || undefined;

        const rawParent = pick('DOCUMENT_PARENT_ID', '');
        const DOCUMENT_PARENT_ID: string | undefined = rawParent === null ? '' : String(rawParent);
        call$ = this.publicationsController.saveDocument(0, WORKING_START_DATE, mINI_DOC, DISTRICT_ID, PUBLICATION_TYPE_ID, aLL_TEXT_DOC, this.menuItemId, DOCUMENT_PARENT_ID, '', [], this.fileParameters);
        break;
      }
      case 'AddNewDistricts': {
        const dto: any = {
          NameAr: pick('NAME', pick('DISTRICT_NAME_AR', pick('DISTRICT_NAME', ''))),
          NameEng: pick('NAME_EN', pick('DISTRICT_NAME_EN', ''))
        };
        call$ = this.publicationsController.saveDistrict(dto);
        break;
      }
      case 'AddNewPublicationTypes': {
        const dto: any = {
          NameAr: pick('NAME', pick('DOCUMENT_TYPE_NAME_AR', pick('DOCUMENT_TYPE_NAME', ''))),
          NameEng: pick('NAME_EN', pick('DOCUMENT_TYPE_NAME_EN', ''))
        };
        call$ = this.publicationsController.savePublicationType(dto);
        break;
      }
      case 'FullPublication': {
        const mINI_DOC = pick('MINI_DOC', '');
        const aLL_TEXT_DOC = pick('ALL_TEXT_DOC', '');
        const rawWorking = pick('WORKING_START_DATE', '');
        const WORKING_START_DATE: Date = rawWorking ? new Date(rawWorking) : new Date();

        const rawDistrict = pick('DISTRICT_ID', '');
        const DISTRICT_ID: number | undefined = rawDistrict === '' ? undefined : Number(rawDistrict) || undefined;

        const rawDocType = pick('PUBLICATION_TYPE_ID', '');
        const PUBLICATION_TYPE_ID: number | undefined = rawDocType === '' ? undefined : Number(rawDocType) || undefined;

        const rawParent = pick('DOCUMENT_PARENT_ID', '');
        const DOCUMENT_PARENT_ID: string | undefined = rawParent === null ? '' : String(rawParent);
        const DocumentId: number = this.row['DocumentId'];
        this.processFileParameters();
        // emit the updated row for two-way binding
        try { this.rowChange.emit(this.row); } catch (e) { }

        call$ = this.publicationsController.editDocument(DocumentId, WORKING_START_DATE, mINI_DOC, DISTRICT_ID, PUBLICATION_TYPE_ID, aLL_TEXT_DOC, this.menuItemId, DOCUMENT_PARENT_ID, 'ss', this.attachmentList, this.fileParameters);
        break;
      }

      default: {
        // fallback to saveDocument using the constructed DTO
        // call$ = this.publicationsController.saveDocument(this.createDocumentDto as any);
      }
    }
    if (!call$) {

      this.msg.msgError('لا يوجد دالة حفظ متوافقة مع المسار الحالي', 'خطأ', true);
      return;
    }
    call$.subscribe({
      next: (resp: any) => {
        this.addNew.emit();
        if (resp && resp.IsSuccess) {
          this.msg.msgSuccess('تم الحفظ بنجاح', 4000);
          this.formSubmited = true;
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

  updateForm(event: any): void {
    console.log('updateForm called with event:', event);
    if (!event) return;
    // Clean up any previous subscription to avoid leaks
    if (this.formValueSub) {
      this.formValueSub.unsubscribe();
      this.formValueSub = undefined;
    }

    // If a FormGroup instance was provided, replace the form reference
    if (event instanceof FormGroup || event?.controls) {
      this.PublicationForm = event as FormGroup;
    } else if (event?.value && this.PublicationForm instanceof FormGroup) {
      // If the payload is a plain value object, patch current form
      this.PublicationForm.patchValue(event.value);
    } else {
      return;
    }

    // Subscribe to value changes with debounce + simple distinct check to detect meaningful changes
    try {
      this.formValueSub = this.PublicationForm.valueChanges.pipe(
        debounceTime(150),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
      ).subscribe(v => this.onFormChanged(v));
    } catch (e) {
      // Fallback: subscribe without operators if anything goes wrong
      this.formValueSub = this.PublicationForm.valueChanges.subscribe(v => this.onFormChanged(v));
    }
  }

  private onFormChanged(value: any): void {
    this.formHasChanges = true;
  }

  // documentCriteria: DocumentCriteria = {} as DocumentCriteria;
  private processFileParameters() {
    if (this.fileParameters && this.fileParameters.length > 0) {
      const remainingFileParams: FileParameter[] = [];
      const toAddAttachments: AttachmentList[] = [];

      this.fileParameters.forEach(fp => {
        const hasData = fp.data !== null && fp.data !== undefined;
        // handle both string and numeric fileID safely — coerce to string to allow trim
        const hasId = fp.fileID !== null && fp.fileID !== undefined && String(fp.fileID).trim() !== '';

        if (!hasData && hasId) {
          // create a minimal AttachmentList entry from the FileParameter
          toAddAttachments.push({
            ATTACHMENT_ID: fp.fileID as any,
            FILE_NAME: fp.fileName || '',
            FILE_SIZE_BYTES: fp.originalSize || 0
          } as any);
        } else {
          remainingFileParams.push(fp);
        }
      });

      // Append only new/unique attachments to `attachmentList` (avoid duplicates)
      toAddAttachments.forEach(att => {
        const exists = this.attachmentList.some(a => String(a.ATTACHMENT_ID) === String((att as any).ATTACHMENT_ID));
        if (!exists) this.attachmentList.push(att);
      });

      // Keep only fileParameters that actually contain file data
      this.fileParameters = remainingFileParams;
    }
  }

  routeEndWith(substr: string): boolean {
    try {
      return this.router && this.router.url ? this.router.url.endsWith(substr) : false;
    } catch (e) {
      return false;
    }
  }
  menuItemId: any = 0;
  path: string = '';
  highlightTree: boolean = false;
  selectedNode: TreeNode = {} as TreeNode;
  onNodeSelect(event: any): void {
    // Get the menu item ID
    if (event.node && event.node.key) {
      this.menuItemId = event.node.key;
    } else if (event.key) {
      this.menuItemId = event.key;
    } else {
      console.warn('No menu item ID found in event');
      this.msg.msgInfo('لا يمكن تحديد معرف العنصر المحدد', 'تحذير', 'warning');
      return;
    }
    if (!this.menuItemId) {
      console.warn('No menu item ID found');
      this.msg.msgInfo('لا يمكن تحديد معرف العنصر المحدد', 'تحذير', 'warning');
      return;
    }
    // Use helper to compute path string for selected node
    this.path = this.getNodePathString(this.selectedNode);
    this.PublicationForm.get('MENUITEMID')?.patchValue(this.menuItemId);

  }

  private getNodePathString(node: TreeNode | any): string {
    const targetKey = node?.key ?? (node?.data ? String(node.data.MENU_ITEM_ID) : undefined);

    const findPath = (nodes: TreeNode[] | undefined, key: string, acc: string[] = []): string[] | null => {
      if (!nodes) return null;
      for (const n of nodes) {
        const label = n.label || (n.data && ((n.data as any).MENU_ITEM_NAME || '')) || '';
        const newAcc = [...acc, label];
        if (n.key === key || (n.data && String((n.data as any).MENU_ITEM_ID) === key)) return newAcc;
        const res = findPath(n.children, key, newAcc);
        if (res) return res;
      }
      return null;
    };

    const labels = targetKey ? (findPath(this.tree, String(targetKey)) || []) : [];
    return labels.join(' > ');
  }

  onNodeContextMenuSelect(ev: any): void {
    this.selectedNode = ev.node;
    this.onNodeSelect(ev)
    this.contextMenuItems = [
      {
        label: 'إضافة تصنيف فرعي جديد',
        icon: 'pi pi-plus',
        command: (event) => this.viewUserDetails(ev.node.data)
      },
      {
        label: 'حذف التصنيف',
        icon: 'pi pi-trash',
        command: () => this.DeleteMenuItem(),
        disabled: (this.selectedNode && Array.isArray(this.selectedNode.children) && this.selectedNode.children.length > 0) ? true : false
      }
    ];
  }
  private DeleteMenuItem(): void {
    const id = this.menuItemId;
    // Prevent deleting a node that still has children
    if (this.selectedNode && Array.isArray(this.selectedNode.children) && this.selectedNode.children.length > 0) {
      this.msg.msgError('لا يمكن حذف عنصر يحتوي على عناصر فرعية', 'تحذير', true);
      return;
    }
    this.powerBiController.excuteGenericStatmentById(35, id).subscribe({
      next: (resp: any) => {
        if (resp && resp.isSuccess) {
          this.msg.msgSuccess(resp.data as string || 'تم التنفيذ بنجاح');
          try {
            const numId = Number(id);
            // remove from pUB_MENU_ITEMS
            const idx = this.pUB_MENU_ITEMS.findIndex((item: PUB_MENU_ITEMS) => Number(item.MENU_ITEM_ID) === numId);
            if (idx !== -1) this.pUB_MENU_ITEMS.splice(idx, 1);

            // remove node from tree recursively
            const removeNodeRec = (nodes: any[]): boolean => {
              if (!nodes) return false;
              for (let i = nodes.length - 1; i >= 0; i--) {
                const n = nodes[i];
                if (String(n.key) === String(id) || (n.data && String(n.data.MENU_ITEM_ID) === String(id))) {
                  nodes.splice(i, 1);
                  return true;
                }
                if (n.children && removeNodeRec(n.children)) return true;
              }
              return false;
            };
            removeNodeRec(this.tree);

            // clear selection if it was the deleted node
            if (this.selectedNode && (String(this.selectedNode.key) === String(id) || (this.selectedNode.data && String(this.selectedNode.data.MENU_ITEM_ID) === String(id)))) {
              this.selectedNode = {} as TreeNode;
              this.menuItemId = 0;
              this.path = '';
            }
          } catch (e) {
            console.warn('Error removing deleted menu item from client state', e);
          }
        } else {
          let errr = '';
          const errors = resp?.errors;
          if (Array.isArray(errors)) errors.forEach((e: any) => errr += (e?.message || e?.Message || e?.responseMessage || e) + '<br>');
          this.msg.msgError(errr || 'هناك خطأ', 'خطأ', true);
        }
      },
      error: (error) => {
        console.error(error?.message || error);
        this.msg.msgError(error, 'هناك خطا ما', true);
      }
    });
  }

  onNodeDragStart(event: any): void {
    console.log('Tree node drag start:', event);
  }

  onNodeDragEnd(event: any): void {
    console.log('Tree node drag end:', event);
  }


  viewUserDetails(event: any): void {
    this.menuDialogForm = this.fb.group({
      MENU_ITEM_NAME: [''],
      APPLICATION: ['']
    });
    this.menuDialogVisible = true;
  }
  submitMenuDialog(): void {
    if (!this.menuDialogForm || this.menuDialogForm.invalid) {
      this.msg.msgError('الرجاء ملء الحقول المطلوبة', 'تحقق', true);
      return;
    }
    const name = this.menuDialogForm.get('MENU_ITEM_NAME')?.value || '';
    const app = this.menuDialogForm.get('APPLICATION')?.value || '';
    const id = this.menuItemId;
    const param = `${name}|${id}|${app}`;
    this.powerBiController.excuteGenericStatmentById(34, param)
      .subscribe({
        next: (resp) => {
          if (resp.isSuccess) {
            this.msg.msgSuccess(resp.data as string || 'تم التنفيذ بنجاح');
            try {
              try {
                const maxId = (this.pUB_MENU_ITEMS && this.pUB_MENU_ITEMS.length)
                  ? Math.max(...this.pUB_MENU_ITEMS.map((item: PUB_MENU_ITEMS) => Number(item.MENU_ITEM_ID) || 0))
                  : 0;
                const newMenuId = maxId + 1;
                const pub_menu: PUB_MENU_ITEMS = { MENU_ITEM_ID: newMenuId, MENU_ITEM_NAME: name, APPLICATION: app, ParentMenuItem: this.menuItemId } as PUB_MENU_ITEMS;
                this.pUB_MENU_ITEMS.push(pub_menu);
                const newNode: TreeNode = {
                  key: String(pub_menu.MENU_ITEM_ID),
                  label: name,
                  expanded: true,
                  children: []
                };
                this.selectedNode.children?.push(newNode);
              } catch (e) {
                console.warn('Failed to append new menu node to tree', e);
              }
            } catch (e) {
              console.warn('Failed to append new menu node to tree', e);
            }
          } else {
            let errr = '';
            const errors = resp.errors;
            if (Array.isArray(errors)) errors.forEach((e: any) => errr += (e?.message || e?.Message || e?.responseMessage || e) + '<br>');
            this.msg.msgError(errr || 'هناك خطأ', 'خطأ', true);
          }
        },
        error: (error) => {
          console.log(error?.message || error);
          this.msg.msgError(error, 'هناك خطا ما', true);
        },
        complete: () => {
          // close dialog on complete
          this.menuDialogVisible = false;
        }
      });
  }

  cancelMenuDialog(): void {
    this.menuDialogVisible = false;
  }
  onContextMenuItemSelected(event: any): void {
    console.log('Context menu item selected:', event);
    // If event contains an item, show brief info
    const item = event?.item || event;
    this.msg.msgInfo('تم اختيار عنصر من قائمة السياق: ' + (item?.label || item?.MENU_ITEM_NAME || ''), 'معلومات');
  }

  tree: TreeNode[] = [];
  pUB_MENU_ITEMS: PUB_MENU_ITEMS[] = [];
  handleGenericEvent(event: any) {
    if (!event?.controlFullName) return;
    const ctrlName = this.genericFormService.nameIndexes(event.controlFullName)?.name;
    if (ctrlName !== 'PUBLICATION_TYPE_ID') return;
    const selectedCtrl = this.genericFormService.GetControl(this.PublicationForm, event.controlFullName);
    const val = String(selectedCtrl?.value ?? '');
    const targetCTRL = this.genericFormService.GetControlContaining(this.PublicationForm, 'DOCUMENT_PARENT_ID');
    if (targetCTRL)
      this.genericFormService.EnableDisableControl(targetCTRL, (val === '2' || val == ''));
  }
}
