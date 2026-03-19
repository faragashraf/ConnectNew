import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';
import { BehaviorSubject, Observable, Subject, combineLatest, of } from 'rxjs';
import { catchError, map, shareReplay, switchMap, tap, finalize, takeUntil } from 'rxjs/operators';
import { TreeNode } from 'primeng/api';
import { PowerBiController } from 'src/app/shared/services/BackendServices/PowerBi/PowerBi.service';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';
import { CdCategoryMandDto, CdcategoryDto, CdmendDto } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.dto';
import { ComponentConfig, populateTreeGeneric } from 'src/app/shared/models/Component.Config.model';
import { GenericFormsService, GenericFormsIsolationProvider } from 'src/app/Modules/GenericComponents/GenericForms.service';

export const CRUD_IDS = {
  Applications: 'Admin Cer',
  Groups: 4,
  Categories: 0,
  Fields: 0,
  HierarchyRows: 0,
  CategoryMand: 0
};

interface ApplicationRow {
  ApplicationID: number | string;
  ApplicationName: string;
  IsActive?: boolean;
}

interface GroupRow {
  GroupID: number;
  GroupName: string;
  GroupDescription?: string;
  GroupWithInRow?: number;
  IsExtendable?: boolean;
}

interface AppHierarchyRow {
  applicationID?: number | string;
  applicationName?: string;
  isActive?: boolean;
  catId?: number;
  catName?: string;
  catParent?: number;
  catStatus?: string;
  mendSQL?: string;
  mendCategory?: number;
  mendGroup?: number;
  mendField?: string;
  mendStat?: number;
  groupID?: number;
  groupName?: string;
  groupDescription?: string;
  groupWithInRow?: number;
  isExtendable?: boolean;
  cdmendTxt?: string;
  cdmendLbl?: string;
  cdmendSql?: string;
  cdmendType?: string;
  cdmendStat?: number;
  required?: boolean;
  email?: boolean;
  pattern?: boolean;
  min?: number;
  max?: number;
  minxLenght?: number;
  maxLenght?: number;
  width?: number;
  height?: number;
  placeholder?: string;
  defaultValue?: string;
  [k: string]: any;
}

interface HierarchyIndex {
  groupsByCategory: Map<number, GroupRow[]>;
  rowsByCategory: Map<number, AppHierarchyRow[]>;
  rowsByCategoryGroup: Map<string, AppHierarchyRow[]>;
}

interface HierarchyState {
  applications: ApplicationRow[];
  categories: CdcategoryDto[];
  groups: GroupRow[];
  fields: CdmendDto[];
  links: CdCategoryMandDto[];
  rows: AppHierarchyRow[];
  index: HierarchyIndex;
}

@Component({
  selector: 'app-application-generic-manager',
  templateUrl: './application-generic-manager.component.html',
  styleUrls: ['./application-generic-manager.component.scss'],
  providers: [GenericFormsIsolationProvider],
  animations: [
    trigger('fadeSlide', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(8px)' }),
        animate('220ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('180ms ease-in', style({ opacity: 0, transform: 'translateY(-6px)' }))
      ])
    ]),
    trigger('staggerList', [
      transition('* <=> *', [
        query(':enter', [
          style({ opacity: 0, transform: 'translateY(6px)' }),
          stagger('40ms', [animate('260ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))])
        ], { optional: true })
      ])
    ])
  ]
})
export class ApplicationGenericManagerComponent implements OnInit, OnDestroy {

  private destroy$ = new Subject<void>();
  private missingCrudIds = new Set<number>();

  private selectedApplication$ = new BehaviorSubject<ApplicationRow | null>(null);
  public selectedCategory$ = new BehaviorSubject<CdcategoryDto | null>(null);
  public selectedGroup$ = new BehaviorSubject<GroupRow | null>(null);
  public selectedField$ = new BehaviorSubject<CdmendDto | null>(null);
  public onlyActiveLinks$ = new BehaviorSubject<boolean>(false);

  public loadingApps$ = new BehaviorSubject<boolean>(false);
  public loadingGroups$ = new BehaviorSubject<boolean>(false);
  public loadingCategories$ = new BehaviorSubject<boolean>(false);
  public loadingFields$ = new BehaviorSubject<boolean>(false);
  public loadingHierarchy$ = new BehaviorSubject<boolean>(false);

  private hierarchyState$ = new BehaviorSubject<HierarchyState>({
    applications: [],
    categories: [],
    groups: [],
    fields: [],
    links: [],
    rows: [],
    index: {
      groupsByCategory: new Map(),
      rowsByCategory: new Map(),
      rowsByCategoryGroup: new Map()
    }
  });

  hierarchy$: Observable<HierarchyState> = this.hierarchyState$.asObservable().pipe(shareReplay(1));

  applications$: Observable<ApplicationRow[]> = of([]);
  groups$: Observable<GroupRow[]> = of([]);
  categories$: Observable<CdcategoryDto[]> = of([]);
  fields$: Observable<CdmendDto[]> = of([]);
  hierarchyRows$: Observable<AppHierarchyRow[]> = of([]);
  hierarchyIndex$: Observable<HierarchyIndex> = of({
    groupsByCategory: new Map(),
    rowsByCategory: new Map(),
    rowsByCategoryGroup: new Map()
  });

  filteredGroups$: Observable<GroupRow[]> = of([]);
  filteredHierarchyRows$: Observable<AppHierarchyRow[]> = of([]);
  formDetailsReady$: Observable<boolean> = of(false);

  activeTabIndex = 0;

  appDialogVisible = false;
  groupDialogVisible = false;
  categoryDialogVisible = false;
  fieldDialogVisible = false;
  detailsDialogVisible = false;

  editingApplication: ApplicationRow | null = null;
  editingGroup: GroupRow | null = null;
  editingCategory: CdcategoryDto | null = null;
  editingField: CdmendDto | null = null;

  appForm: FormGroup;
  groupForm: FormGroup;
  categoryForm: FormGroup;
  fieldForm: FormGroup;

  appCols: string[] = [];
  groupCols: string[] = [];
  categoryCols: string[] = [];
  fieldCols: string[] = [];

  categoryTree: TreeNode[] = [];
  formDetailsMessage: any = {} as any;
  formDetailsConfig: ComponentConfig = new ComponentConfig({
    isNew: true,
    formDisplayOption: 'tabs',
    fieldsConfiguration: {
      isDivDisabled: true,
      dateFormat: 'yy/mm/dd',
      showTime: false,
      timeOnly: false,
      maxDate: new Date(),
      useDefaultRadioView: true,
      isNotRequired: false
    }
  });

  constructor(
    private fb: FormBuilder,
    private powerBi: PowerBiController,
    private msg: MsgsService,
    private spinner: SpinnerService,
    public genericFormService: GenericFormsService
  ) {
    this.appForm = this.fb.group({
      appName: ['', Validators.required],
      appCode: [''],
      isActive: [true]
    });
    this.groupForm = this.fb.group({
      groupName: ['', Validators.required],
      groupOrder: [0]
    });
    this.categoryForm = this.fb.group({
      categoryName: ['', Validators.required],
      categoryCode: ['']
    });
    this.fieldForm = this.fb.group({
      cdmendTxt: ['', Validators.required],
      cdMendLbl: ['', Validators.required],
      cdmendType: ['text'],
      required: [false]
    });
  }

  ngOnInit(): void {
    console.debug('ApplicationGenericManagerComponent.ngOnInit - starting');
    // First param is predefined-statement id. Second param is positional values separated by '|' (e.g. 15|20|14).
    this.applications$ = this.deferLoad(this.loadingApps$, () =>
      this.callList(1000, this.encodeParams(["0"]))
    ).pipe(
      map(rows => this.normalizeHierarchyRows(rows)),
      tap(rows => {
        const state = this.buildHierarchyState(rows);
        this.hierarchyState$.next(state);
        this.appCols = state.applications.length ? Object.keys(state.applications[0]) : [];
        this.groupCols = state.groups.length ? Object.keys(state.groups[0]) : [];
        this.categoryCols = state.categories.length ? Object.keys(state.categories[0]) : [];
        this.fieldCols = state.fields.length ? Object.keys(state.fields[0]) : [];
      }),
      map(rows => this.normalizeApplications(rows)),
      shareReplay(1)
    );

    // Debug subscription to ensure the pipeline executes and to log emissions.
    this.applications$.pipe(
      tap(rows => console.debug('applications$ emitted rows:', (rows || []).length)),
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {},
      error: err => console.error('applications$ subscription error', err)
    });

    this.groups$ = this.hierarchy$.pipe(
      map(state => state.groups),
      shareReplay(1)
    );

    this.categories$ = combineLatest([this.hierarchy$, this.selectedApplication$]).pipe(
      map(([state, app]) => {
        if (!app) return [];
        return state.categories.filter(c => String(c.applicationId) === String(app.ApplicationID));
      }),
      shareReplay(1)
    );

    this.fields$ = combineLatest([this.hierarchy$, this.selectedApplication$]).pipe(
      map(([state, app]) => {
        if (!app) return [];
        return state.fields.filter(f => String(f.applicationId) === String(app.ApplicationID));
      }),
      shareReplay(1)
    );

    this.hierarchyRows$ = combineLatest([this.hierarchy$, this.selectedApplication$]).pipe(
      map(([state, app]) => {
        if (!app) return [];
        return state.rows.filter(r => String(r.applicationID) === String(app.ApplicationID));
      }),
      shareReplay(1)
    );

    this.hierarchyIndex$ = this.hierarchy$.pipe(
      map(state => state.index),
      shareReplay(1)
    );

    this.filteredGroups$ = combineLatest([this.hierarchyIndex$, this.selectedCategory$, this.onlyActiveLinks$]).pipe(
      map(([index, cat, onlyActive]) => {
        if (!cat?.catId) return [];
        const base = index.groupsByCategory.get(cat.catId) || [];
        if (!onlyActive) return base;
        const activeRows = index.rowsByCategory.get(cat.catId) || [];
        const activeGroupIds = new Set(activeRows.filter(r => r.mendStat === 1).map(r => r.groupID));
        return base.filter(g => activeGroupIds.has(g.GroupID));
      })
    );

    this.filteredHierarchyRows$ = combineLatest([
      this.hierarchyRows$, this.selectedCategory$, this.selectedGroup$, this.onlyActiveLinks$
    ]).pipe(
      map(([rows, cat, grp, onlyActive]) => {
        if (!cat?.catId) return [];
        let filtered = rows.filter(r => r.catId === cat.catId);
        if (grp?.GroupID) filtered = filtered.filter(r => r.groupID === grp.GroupID);
        if (onlyActive) filtered = filtered.filter(r => r.mendStat === 1);
        return filtered;
      })
    );

    this.formDetailsReady$ = combineLatest([
      this.selectedApplication$, this.selectedCategory$, this.hierarchyRows$, this.categories$, this.fields$
    ]).pipe(
      map(([app, cat, rows, categories, fields]) => {
        if (!app || !cat) return false;
        this.buildFormDetailsModel(app, cat, rows, categories, fields);
        return true;
      })
    );
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Selection handlers
  selectApplication(row: ApplicationRow | any) {
    const parsed = row?.data ?? row;
    if (!parsed) return;
    this.selectedApplication$.next(parsed);
    this.selectedCategory$.next(null);
    this.selectedGroup$.next(null);
    this.selectedField$.next(null);
    this.setActiveTab(1);
  }

  private setActiveTab(index: number): void {
    this.blurActiveElementInHiddenPanel(index);
    this.activeTabIndex = index;
  }

  private blurActiveElementInHiddenPanel(nextVisibleIndex: number): void {
    try {
      const active = document.activeElement as HTMLElement | null;
      if (!active) return;
      const panels = Array.from(document.querySelectorAll('.p-tabview-panel')) as HTMLElement[];
      panels.forEach((panel, idx) => {
        const willBeHidden = idx !== nextVisibleIndex;
        if (willBeHidden && panel.contains(active)) {
          try { active.blur(); } catch (e) { /* ignore */ }
        }
      });
    } catch (err) {
      console.warn('blurActiveElementInHiddenPanel failed', err);
    }
  }

  selectCategory(row: CdcategoryDto | any) {
    const parsed = row?.data ?? row;
    this.selectedCategory$.next(parsed ?? null);
    this.selectedGroup$.next(null);
    this.selectedField$.next(null);
  }

  selectGroup(row: GroupRow | any) {
    const parsed = row?.data ?? row;
    this.selectedGroup$.next(parsed ?? null);
  }

  selectField(row: CdmendDto | any) {
    const parsed = row?.data ?? row;
    this.selectedField$.next(parsed ?? null);
  }

  // UI helpers
  isTabsDisabled(): Observable<boolean> {
    return this.selectedApplication$.pipe(map(v => v == null));
  }

  get breadcrumb$(): Observable<string> {
    return combineLatest([this.selectedApplication$, this.selectedCategory$, this.selectedGroup$]).pipe(
      map(([app, cat, grp]) => {
        const parts: string[] = [];
        if (app) parts.push(`Application: ${app.ApplicationName}`);
        if (cat) parts.push(`Category: ${cat.catName}`);
        if (grp) parts.push(`Group: ${grp.GroupName}`);
        return parts.join(' → ');
      })
    );
  }

  // CRUD actions
  saveApplication(): void {
    if (this.appForm.invalid) return;
    const payload = {
      applicationID: this.editingApplication?.ApplicationID ?? null,
      appName: this.appForm.value.appName,
      appCode: this.appForm.value.appCode,
      isActive: this.appForm.value.isActive
    };
    // this.executeAction(CRUD_IDS.Applications, payload, 'Application saved').subscribe(res => {
    //   if (!res?.isSuccess) return;
    //   this.appDialogVisible = false;
    //   this.appForm.reset({ appName: '', appCode: '', isActive: true });
    //   this.editingApplication = null;
    // });
  }

  saveGroup(): void {
    if (this.groupForm.invalid) return;
    const payload = {
      groupID: this.editingGroup?.GroupID ?? null,
      groupName: this.groupForm.value.groupName,
      groupOrder: this.groupForm.value.groupOrder
    };
    this.executeAction(CRUD_IDS.Groups, payload, 'Group saved').subscribe(res => {
      if (!res?.isSuccess) return;
      this.groupDialogVisible = false;
      this.groupForm.reset({ groupName: '', groupOrder: 0 });
      this.editingGroup = null;
    });
  }

  saveCategory(): void {
    if (this.categoryForm.invalid) return;
    const app = this.selectedApplication$.value;
    if (!app) { this.msg.msgInfo('Select Application first'); return; }
    const payload = {
      catId: this.editingCategory?.catId ?? null,
      categoryName: this.categoryForm.value.categoryName,
      applicationID: app.ApplicationID
    };
    this.executeAction(CRUD_IDS.Categories, payload, 'Category saved').subscribe(res => {
      if (!res?.isSuccess) return;
      this.categoryDialogVisible = false;
      this.categoryForm.reset({ categoryName: '', categoryCode: '' });
      this.editingCategory = null;
    });
  }

  saveField(): void {
    if (this.fieldForm.invalid) return;
    const app = this.selectedApplication$.value;
    if (!app) { this.msg.msgInfo('Select Application first'); return; }
    const raw = this.fieldForm.getRawValue();
    const payload = {
      cdmendTxt: raw.cdmendTxt,
      cdMendLbl: raw.cdMendLbl,
      cdmendType: raw.cdmendType,
      applicationID: app.ApplicationID
    };
    this.executeAction(CRUD_IDS.Fields, payload, 'Field saved').subscribe(res => {
      if (!res?.isSuccess) return;
      this.fieldDialogVisible = false;
      this.fieldForm.reset({ cdmendTxt: '', cdMendLbl: '', cdmendType: 'text', required: false });
      this.fieldForm.get('cdmendTxt')?.enable();
      this.editingField = null;
    });
  }

  editApplication(row: ApplicationRow): void {
    this.editingApplication = row;
    this.appForm.patchValue({
      appName: row.ApplicationName,
      appCode: '',
      isActive: row.IsActive ?? true
    });
    this.appDialogVisible = true;
  }

  editGroup(row: GroupRow): void {
    this.editingGroup = row;
    this.groupForm.patchValue({
      groupName: row.GroupName,
      groupOrder: 0
    });
    this.groupDialogVisible = true;
  }

  editCategory(row: CdcategoryDto): void {
    this.editingCategory = row;
    this.categoryForm.patchValue({
      categoryName: row.catName,
      categoryCode: row.catMend
    });
    this.categoryDialogVisible = true;
  }

  editField(row: CdmendDto): void {
    this.editingField = row;
    this.fieldForm.patchValue({
      cdmendTxt: row.cdmendTxt,
      cdMendLbl: row.cdMendLbl,
      cdmendType: row.cdmendType,
      required: row.required
    });
    this.fieldForm.get('cdmendTxt')?.disable();
    this.fieldDialogVisible = true;
  }

  deleteApplication(row: ApplicationRow): void {
    if (!row?.ApplicationID) return;
    // this.executeAction(CRUD_IDS.Applications.toString(), { applicationID: row.ApplicationID }, 'Application deleted')
    //   .subscribe();
  }

  deleteGroup(row: GroupRow): void {
    if (!row?.GroupID) return;
    this.executeAction(CRUD_IDS.Groups, { groupID: row.GroupID }, 'Group deleted')
      .subscribe();
  }

  deleteCategory(row: CdcategoryDto): void {
    if (!row?.catId) return;
    this.executeAction(CRUD_IDS.Categories, { catId: row.catId }, 'Category deleted')
      .subscribe();
  }

  deleteField(row: CdmendDto): void {
    if (!row?.cdmendTxt) return;
    this.executeAction(CRUD_IDS.Fields, { cdmendTxt: row.cdmendTxt }, 'Field deleted')
      .subscribe();
  }

  addLink(): void {
    const app = this.selectedApplication$.value;
    const cat = this.selectedCategory$.value;
    const grp = this.selectedGroup$.value;
    const fld = this.selectedField$.value;
    if (!app) { this.msg.msgInfo('Select Application first'); return; }
    if (!cat) { this.msg.msgInfo('Select Category first'); return; }
    if (!grp) { this.msg.msgInfo('Select Group first'); return; }
    if (!fld) { this.msg.msgInfo('Select Field first'); return; }
    const payload = {
      mendCategory: cat.catId,
      mendGroup: grp.GroupID,
      mendField: fld.cdmendTxt,
      applicationID: app.ApplicationID
    };
    this.executeAction(CRUD_IDS.CategoryMand, payload, 'Link created').subscribe();
  }

  deleteLink(mendSQL?: string): void {
    if (!mendSQL) return;
    const payload = { mendSQL };
    this.executeAction(CRUD_IDS.CategoryMand, payload, 'Link deleted').subscribe();
  }

  toggleLinkActive(mendSQL?: string, currentState?: number): void {
    if (!mendSQL) return;
    const newState = currentState === 1 ? 0 : 1;
    const payload = { mendSQL, mendStat: newState };
    this.executeAction(CRUD_IDS.CategoryMand, payload, 'Link updated').subscribe();
  }

  openDetails(event: any): void {
    const row = event?.data ?? event;
    const app = this.selectedApplication$.value;
    const cat = this.selectedCategory$.value;
    if (!app || !cat) return;
    this.formDetailsConfig.selectedNodeKey = String(cat.catId);
    this.detailsDialogVisible = true;
    this.buildFormDetailsModel(app, cat, [row], this.genericFormService.cdcategoryDtos, this.genericFormService.cdmendDto);
  }

  // Helpers
  // First param is predefined-statement id. Second param is positional values separated by '|' (e.g. 15|20|14).
  private callList(selectStatementId: number, encodedParams: string): Observable<any[]> {
    if (!selectStatementId || selectStatementId === 0) {
      this.notifyCrudMissing(selectStatementId);
      return of([]);
    }
    return this.powerBi.getGenericDataById(selectStatementId, encodedParams).pipe(
      tap((r: any) => console.debug('callList response', selectStatementId, encodedParams, r)),
      map((r: any) => r?.data ?? []),
      catchError((err) => {
        console.error('callList error', selectStatementId, encodedParams, err);
        this.msg.msgError('Error', 'تعذر تحميل البيانات');
        return of([]);
      })
    );
  }

  private encodeParams(values: Array<string | number | boolean | null | undefined>): string {
    return values.map(v => v === null || v === undefined ? '' : String(v)).join('|');
  }

  private deferLoad(flag: BehaviorSubject<boolean>, call: () => Observable<any[]>): Observable<any[]> {
    flag.next(true);
    return call().pipe(finalize(() => flag.next(false)));
  }

  private executeAction(id: number, payload: any, successMsg: string): Observable<any> {
    if (!id || id === 0) {
      this.notifyCrudMissing(id);
      return of(null);
    }
    this.spinner.show();
    const params = JSON.stringify(payload);
    return this.powerBi.excuteGenericStatmentById(id, params).pipe(
      tap((res: any) => {
        this.spinner.hide();
        if (res?.isSuccess) this.msg.msgSuccess(successMsg);
        else this.msg.msgError('Error', res?.errors?.[0]?.message ?? 'Operation failed');
      }),
      catchError(() => {
        this.spinner.hide();
        this.msg.msgError('Error', 'تعذر تنفيذ العملية');
        return of(null);
      })
    );
  }

  private notifyCrudMissing(id: number): void {
    if (!id || id === 0) {
      if (!this.missingCrudIds.has(0)) {
        this.missingCrudIds.add(0);
        this.msg.msgInfo('CRUD ID is not configured yet');
      }
      return;
    }
    if (this.missingCrudIds.has(id)) return;
    this.missingCrudIds.add(id);
    this.msg.msgInfo('CRUD ID is not configured yet');
  }

  private normalizeApplications(rows: AppHierarchyRow[]): ApplicationRow[] {
    const mapApps = new Map<number | string, ApplicationRow>();
    (rows || []).forEach(r => {
      if (!r.applicationID) return;
      if (!mapApps.has(r.applicationID)) {
        mapApps.set(r.applicationID, {
          ApplicationID: r.applicationID,
          ApplicationName: r.applicationName || `App ${r.applicationID}`,
          IsActive: r.isActive
        });
      }
    });
    return Array.from(mapApps.values()).sort((a, b) => (a.ApplicationName || '').localeCompare(b.ApplicationName || ''));
  }

  private normalizeGroups(rows: any[]): GroupRow[] {
    return (rows || []).map(r => ({
      GroupID: r.GroupID ?? r.groupID ?? r.groupId,
      GroupName: r.GroupName ?? r.groupName,
      GroupDescription: r.GroupDescription ?? r.groupDescription,
      GroupWithInRow: r.GroupWithInRow ?? r.groupWithInRow,
      IsExtendable: r.IsExtendable ?? r.isExtendable
    })).sort((a, b) => (a.GroupID ?? 0) - (b.GroupID ?? 0));
  }

  private normalizeCategories(rows: any[]): CdcategoryDto[] {
    return (rows || []).map(r => ({
      catId: r.CatId ?? r.catId,
      catParent: r.CatParent ?? r.catParent,
      catName: r.CatName ?? r.catName,
      catMend: r.CatMend ?? r.catMend,
      catWorkFlow: r.CatWorkFlow ?? r.catWorkFlow,
      catSms: r.CatSms ?? r.catSms,
      catMailNotification: r.CatMailNotification ?? r.catMailNotification,
      to: r.To ?? r.to,
      cc: r.Cc ?? r.cc,
      applicationId: r.ApplicationID ?? r.applicationId
    } as CdcategoryDto)).sort((a, b) => (a.catName || '').localeCompare(b.catName || ''));
  }

  private normalizeFields(rows: any[]): CdmendDto[] {
    return (rows || []).map(r => ({
      cdmendSql: r.CDMendSQL ?? r.cdmendSql,
      cdmendType: r.CDMendType ?? r.cdmendType,
      cdmendTxt: r.CDMendTxt ?? r.cdmendTxt,
      cdMendLbl: r.CDMendLbl ?? r.cdMendLbl,
      placeholder: r.Placeholder ?? r.placeholder,
      defaultValue: r.DefaultValue ?? r.defaultValue,
      cdmendTbl: r.CDMendTbl ?? r.cdmendTbl,
      cdmendDatatype: r.CDMendDatatype ?? r.cdmendDatatype,
      required: r.Required ?? r.required,
      requiredTrue: r.RequiredTrue ?? r.requiredTrue,
      email: r.Email ?? r.email,
      pattern: r.Pattern ?? r.pattern,
      min: r.Min ?? r.min,
      max: r.Max ?? r.max,
      minxLenght: r.MinxLenght ?? r.minxLenght,
      maxLenght: r.MaxLenght ?? r.maxLenght,
      cdmendmask: r.CDMendmask ?? r.cdmendmask,
      cdmendStat: r.CDMendStat ?? r.cdmendStat,
      width: r.Width ?? r.width,
      height: r.Height ?? r.height,
      isDisabledInit: r.IsDisabledInit ?? r.isDisabledInit,
      isSearchable: r.IsSearchable ?? r.isSearchable,
      applicationId: r.ApplicationID ?? r.applicationId
    } as CdmendDto)).sort((a, b) => {
      const lblA = (a.cdMendLbl || '').toString();
      const lblB = (b.cdMendLbl || '').toString();
      return lblA.localeCompare(lblB) || (a.cdmendTxt || '').localeCompare(b.cdmendTxt || '');
    });
  }

  private normalizeHierarchyRows(rows: any[]): AppHierarchyRow[] {
    return (rows || []).map(r => ({
      applicationID: r.applicationID ?? r.ApplicationID,
      applicationName: r.applicationName ?? r.ApplicationName,
      isActive: r.isActive ?? r.IsActive,
      catId: r.catId ?? r.CatId ?? r.mendCategory,
      catName: r.catName ?? r.CatName ?? r.categoryName,
      catParent: r.catParent ?? r.CatParent,
      catStatus: r.catStatus ?? r.CatStatus,
      mendSQL: r.mendSQL ?? r.MendSQL,
      mendCategory: r.mendCategory ?? r.MendCategory,
      mendGroup: r.mendGroup ?? r.MendGroup,
      mendField: r.mendField ?? r.MendField,
      mendStat: r.mendStat ?? r.MendStat,
      groupID: r.groupID ?? r.GroupID,
      groupName: r.groupName ?? r.GroupName,
      groupDescription: r.groupDescription ?? r.GroupDescription,
      groupWithInRow: r.groupWithInRow ?? r.GroupWithInRow,
      isExtendable: r.isExtendable ?? r.IsExtendable,
      cdmendTxt: r.cdmendTxt ?? r.CDMendTxt,
      cdmendLbl: r.cdmendLbl ?? r.CDMendLbl,
      cdmendSql: r.cdmendSql ?? r.CDMendSQL,
      cdmendType: r.cdmendType ?? r.CDMendType,
      cdmendStat: r.cdmendStat ?? r.CDMendStat,
      required: r.Required ?? r.required,
      email: r.Email ?? r.email,
      pattern: r.Pattern ?? r.pattern,
      min: r.Min ?? r.min,
      max: r.Max ?? r.max,
      minxLenght: r.MinxLenght ?? r.minxLenght,
      maxLenght: r.MaxLenght ?? r.maxLenght,
      width: r.Width ?? r.width,
      height: r.Height ?? r.height,
      placeholder: r.Placeholder ?? r.placeholder,
      defaultValue: r.DefaultValue ?? r.defaultValue,
      ...r
    }));
  }

  private buildHierarchyState(rows: AppHierarchyRow[]): HierarchyState {
    const applicationsMap = new Map<number | string, ApplicationRow>();
    const categoriesMap = new Map<number, CdcategoryDto>();
    const groupsMap = new Map<number, GroupRow>();
    const fieldsMap = new Map<string, CdmendDto>();
    const linksMap = new Map<string, CdCategoryMandDto>();

    rows.forEach(r => {
      if (r.applicationID) {
        if (!applicationsMap.has(r.applicationID)) {
          applicationsMap.set(r.applicationID, {
            ApplicationID: r.applicationID,
            ApplicationName: r.applicationName || `App ${r.applicationID}`,
            IsActive: r.isActive
          });
        }
      }

      if (r.catId) {
        if (!categoriesMap.has(r.catId)) {
          categoriesMap.set(r.catId, {
            catId: r.catId,
            catParent: r.catParent as any,
            catName: r.catName as any,
            catMend: null as any,
            catWorkFlow: 0 as any,
            catSms: false as any,
            catMailNotification: false as any,
            to: null as any,
            cc: null as any,
            applicationId: String(r.applicationID)
          } as CdcategoryDto);
        }
      }

      if (r.groupID) {
        if (!groupsMap.has(r.groupID)) {
          groupsMap.set(r.groupID, {
            GroupID: r.groupID,
            GroupName: r.groupName || `Group ${r.groupID}`,
            GroupDescription: r.groupDescription,
            GroupWithInRow: r.groupWithInRow,
            IsExtendable: r.isExtendable
          });
        }
      }

      if (r.cdmendTxt) {
        const key = `${r.applicationID}::${r.cdmendTxt}`;
        if (!fieldsMap.has(key)) {
          fieldsMap.set(key, {
            cdmendSql: Number(r.cdmendSql || 0),
            cdmendType: r.cdmendType as any,
            cdmendTxt: r.cdmendTxt,
            cdMendLbl: r.cdmendLbl,
            placeholder: r.placeholder as any,
            defaultValue: r.defaultValue as any,
            cdmendTbl: null as any,
            cdmendDatatype: null as any,
            required: r.required as any,
            requiredTrue: null as any,
            email: r.email as any,
            pattern: r.pattern as any,
            min: r.min as any,
            max: r.max as any,
            minxLenght: r.minxLenght as any,
            maxLenght: r.maxLenght as any,
            cdmendmask: null as any,
            cdmendStat: r.cdmendStat as any,
            width: r.width as any,
            height: r.height as any,
            isDisabledInit: false,
            isSearchable: false,
            applicationId: String(r.applicationID)
          } as CdmendDto);
        }
      }

      if (r.mendSQL) {
        if (!linksMap.has(r.mendSQL)) {
          linksMap.set(r.mendSQL, {
            mendSql: Number(r.mendSQL || 0),
            mendCategory: Number(r.mendCategory || 0),
            mendField: r.mendField as any,
            mendStat: (r.mendStat as any) ?? false,
            mendGroup: Number(r.mendGroup || 0),
            applicationId: String(r.applicationID),
            groupName: r.groupName,
            isExtendable: r.isExtendable,
            groupWithInRow: r.groupWithInRow
          } as CdCategoryMandDto);
        }
      }
    });

    const applications = Array.from(applicationsMap.values()).sort((a, b) => (a.ApplicationName || '').localeCompare(b.ApplicationName || ''));
    const categories = Array.from(categoriesMap.values()).sort((a, b) => (a.catName || '').localeCompare(b.catName || ''));
    const groups = Array.from(groupsMap.values()).sort((a, b) => (a.GroupID ?? 0) - (b.GroupID ?? 0));
    const fields = Array.from(fieldsMap.values()).sort((a, b) => {
      const lblA = (a.cdMendLbl || '').toString();
      const lblB = (b.cdMendLbl || '').toString();
      return lblA.localeCompare(lblB) || (a.cdmendTxt || '').localeCompare(b.cdmendTxt || '');
    });
    const links = Array.from(linksMap.values());

    const index = this.buildHierarchyIndex(rows);

    return { applications, categories, groups, fields, links, rows, index };
  }

  private buildHierarchyIndex(rows: AppHierarchyRow[]): HierarchyIndex {
    const groupsByCategory = new Map<number, GroupRow[]>();
    const rowsByCategory = new Map<number, AppHierarchyRow[]>();
    const rowsByCategoryGroup = new Map<string, AppHierarchyRow[]>();

    const groupMapByCat = new Map<number, Map<number, GroupRow>>();

    rows.forEach(r => {
      if (!r.catId) return;
      const catId = r.catId;
      const groupId = r.groupID || 0;

      if (!rowsByCategory.has(catId)) rowsByCategory.set(catId, []);
      rowsByCategory.get(catId)?.push(r);

      if (groupId) {
        if (!groupMapByCat.has(catId)) groupMapByCat.set(catId, new Map());
        if (!groupMapByCat.get(catId)?.has(groupId)) {
          groupMapByCat.get(catId)?.set(groupId, {
            GroupID: groupId,
            GroupName: r.groupName || `Group ${groupId}`,
            GroupDescription: r.groupDescription,
            GroupWithInRow: r.groupWithInRow,
            IsExtendable: r.isExtendable
          });
        }
        const key = `${catId}::${groupId}`;
        if (!rowsByCategoryGroup.has(key)) rowsByCategoryGroup.set(key, []);
        rowsByCategoryGroup.get(key)?.push(r);
      }
    });

    groupMapByCat.forEach((mapVal, catId) => {
      groupsByCategory.set(catId, Array.from(mapVal.values()).sort((a, b) => (a.GroupID ?? 0) - (b.GroupID ?? 0)));
    });

    return { groupsByCategory, rowsByCategory, rowsByCategoryGroup };
  }

  private buildFormDetailsModel(
    app: ApplicationRow | null,
    cat: CdcategoryDto | null,
    rows: AppHierarchyRow[],
    categories: CdcategoryDto[],
    fields: CdmendDto[]
  ): void {
    if (!app || !cat) return;

    this.formDetailsConfig.selectedNodeKey = String(cat.catId);

    const appId = app.ApplicationID;

    // categories
    const appCats = (categories || []).filter(c => String(c.applicationId) === String(appId));
    this.genericFormService.cdcategoryDtos = appCats;
    this.genericFormService.filteredCdcategoryDtos = appCats;

    // fields
    const fieldMap = new Map<string, CdmendDto>();
    (fields || []).forEach(f => {
      const key = `${appId}::${f.cdmendTxt}`;
      fieldMap.set(key, f);
    });
    rows.forEach(r => {
      const key = `${appId}::${r.cdmendTxt}`;
      if (!fieldMap.has(key) && r.cdmendTxt) {
        fieldMap.set(key, {
          cdmendSql: Number(r.cdmendSql || 0),
          cdmendType: r.cdmendType as any,
          cdmendTxt: r.cdmendTxt,
          cdMendLbl: r.cdmendLbl,
          placeholder: r.placeholder as any,
          defaultValue: r.defaultValue as any,
          cdmendTbl: null as any,
          cdmendDatatype: null as any,
          required: r.required as any,
          requiredTrue: null as any,
          email: r.email as any,
          pattern: r.pattern as any,
          min: r.min as any,
          max: r.max as any,
          minxLenght: r.minxLenght as any,
          maxLenght: r.maxLenght as any,
          cdmendmask: null as any,
          cdmendStat: r.cdmendStat as any,
          width: r.width as any,
          height: r.height as any,
          isDisabledInit: false,
          isSearchable: false,
          applicationId: String(appId)
        } as CdmendDto);
      }
    });
    this.genericFormService.cdmendDto = Array.from(fieldMap.values());

    // mapping links
    const links: CdCategoryMandDto[] = rows
      .filter(r => r.mendCategory === cat.catId)
      .map(r => ({
        mendSql: Number(r.mendSQL || 0),
        mendCategory: Number(r.mendCategory || 0),
        mendField: r.mendField as any,
        mendStat: (r.mendStat as any) ?? false,
        mendGroup: Number(r.mendGroup || 0),
        applicationId: String(appId),
        groupName: r.groupName,
        isExtendable: r.isExtendable,
        groupWithInRow: r.groupWithInRow
      } as CdCategoryMandDto));

    this.genericFormService.cdCategoryMandDto = links;
    this.genericFormService.filteredCdcategoryDtos = appCats;

    // organize groups for form-details
    this.genericFormService.organizeFieldsByGroups(links);

    // category tree for form-details
    populateTreeGeneric(appCats, 'catId', 'catParent', 'catName', this.categoryTree, false, true);
  }
}
