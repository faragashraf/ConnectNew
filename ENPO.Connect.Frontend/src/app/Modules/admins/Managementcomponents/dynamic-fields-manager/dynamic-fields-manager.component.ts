import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import {  takeUntil } from 'rxjs/operators';
import { GenericFormsService, selection } from 'src/app/Modules/GenericComponents/GenericForms.service';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';
import { RedisHubService } from 'src/app/shared/services/SignalRServices/Redis.service';
import { GenerateQueryService } from 'src/app/Modules/enpopower-bi/services/generate-query.service';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { forkJoin } from 'rxjs';
import { CdcategoryDto, CdCategoryMandDto, CdmendDto } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.dto';
import { DynamicFormController } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.service';

// Interface for grouped fields structure (formerly TreeNode)
export interface FieldGroup {
    data?: any;
    children?: FieldGroup[];
    leaf?: boolean;
    expanded?: boolean;
    label?: string;
    level?: number;
}

@Component({
  selector: 'app-dynamic-fields-manager',
  templateUrl: './dynamic-fields-manager.component.html',
  styleUrls: ['./dynamic-fields-manager.component.scss']
})
export class DynamicFieldsManagerComponent implements OnInit {
  private destroyed$ = new Subject<void>();
  selectedField: CdmendDto = {} as CdmendDto;
  fieldForm: FormGroup; // Form for creating/editing fields
  isEditing: boolean = false; // Flag to track if editing mode is active
  editingIndex: number | null = null; // Index of the field being edited

  appName: string = ''

  constructor(public generateQueryService: GenerateQueryService, private fb: FormBuilder,
    private dynamicFormController: DynamicFormController, private redisHubService: RedisHubService,
    private spinner: SpinnerService, private msg: MsgsService,
    public genericFormService: GenericFormsService) {
    // Initialize the form
    this.fieldForm = this.fb.group({
      cdmendSql: [null, Validators.required],
      cdmendType: ['', Validators.required],
      cdmendTxt: [''],
      cdMendLbl: ['', Validators.required],
      placeholder: [''],
      defaultValue: [''],
      cdmendTbl: this.fb.array([]),
      required: [false],
      requiredTrue: [false],
      email: [false],
      pattern: [false],
      min: [null],
      max: [null],
      minxLenght: [null],
      maxLenght: [null],
      cdmendmask: [''],
      cdmendStat: [true],
      width: [0, Validators.required],
      height: [0, Validators.required],
      isDisabledInit: [false],
      isSearchable: [false],
      applicationId: ['', Validators.required]
    });
  }
  
  groupedFields: FieldGroup[] = [];
    disableAnimations: boolean = false;

  // New properties for enhanced UI
  searchTerm: string = '';
  selectedAppFilter: string = '';
  applicationFilters: any[] = [];
  filterStatus: 'all' | 'active' | 'inactive' = 'all';
 

  // UI preference flags
  isDarkMode: boolean = false;            // toggled by user or system (prefers-color-scheme)
  compactMode: boolean = false;          // denser layout for admin-heavy screens
  highContrast: boolean = false;         // stronger contrast for accessibility
  prefersDarkMedia: MediaQueryList | null = null; // system media query reference

  cdmendDto: CdmendDto = {} as CdmendDto;
  
  // Animation Statistics
  stats = {
    apps: 0,
    types: 0,
    fields: 0,
    active: 0,
    inactive: 0
  };

  recalculateStats() {
    this.animateCount('apps', this.getApplicationsCount());
    this.animateCount('types', this.getTypesCount());
    this.animateCount('fields', this.getFieldsCount());
    this.animateCount('active', this.getActiveFieldsCount());
    this.animateCount('inactive', this.getInclusiveFieldsCount());
  }

  animateCount(prop: keyof typeof this.stats, target: number) {
      let current = 0;
      const duration = 1200; 
      const startTime = performance.now();
      const startValue = this.stats[prop];

      const step = (timestamp: number) => {
          const progress = Math.min((timestamp - startTime) / duration, 1);
          // Ease out quart
          const ease = 1 - Math.pow(1 - progress, 4);
          
          this.stats[prop] = Math.floor(startValue + (target - startValue) * ease);

          if (progress < 1) {
              requestAnimationFrame(step);
          } else {
              this.stats[prop] = target;
          }
      };
      requestAnimationFrame(step);
  }

  get cdmendTbl(): FormArray {
    return this.fieldForm.get('cdmendTbl') as FormArray;
  }
  fieldTypes = [
    { label: 'Input Text', value: 'InputText' },
    { label: 'Textarea', value: 'Textarea' },
    { label: 'Dropdown', value: 'Dropdown' },
    { label: 'Radio Button', value: 'RadioButton' },
    { label: 'Date', value: 'Date' },
    { label: 'Domain User', value: 'DomainUser' },
    { label: 'Dropdown Tree', value: 'DropdownTree' },
  ];

  implementControlSelection(cdmendTbl: any): selection[] {
    return JSON.parse(<string>cdmendTbl);
  }
  updateControlSelection(selectionArray: FormArray, item: CdmendDto) {
    const json = JSON.stringify(selectionArray.value || []);
    const current = this.selectedFieldForDialog ?? this.selectedField;
    if (current) {
      const idx = this.genericFormService.cdmendDto.findIndex(m => m.cdmendTxt === current.cdmendTxt || m.cdmendSql === current.cdmendSql);
      if (idx !== -1) {
        this.genericFormService.cdmendDto[idx].cdmendTbl = json;
        (this.genericFormService.cdmendDto[idx] as any).tbl = this.safeParseCdmendTbl(json);
      }
      // also reflect on dialog selection
      if (this.selectedFieldForDialog) {
        this.selectedFieldForDialog.cdmendTbl = json;
        (this.selectedFieldForDialog as any).tbl = this.safeParseCdmendTbl(json);
      }
      this.groupedFields = this.buildGroupedFields(this.genericFormService.cdmendDto);
    }
  }
  addNewSelection() {
    // push a new row FormGroup with expected shape { key, name }
    this.cdmendTbl.push(this.fb.group({ key: [''], name: [''] }));
    // After adding, persist the change back to the selected item in the service
    const json = JSON.stringify(this.cdmendTbl.value || []);
    const current = this.selectedFieldForDialog ?? this.selectedField;
    if (current) {
      const idx = this.genericFormService.cdmendDto.findIndex(m => m.cdmendTxt === current.cdmendTxt || m.cdmendSql === current.cdmendSql);
      if (idx !== -1) {
        this.genericFormService.cdmendDto[idx].cdmendTbl = json;
        (this.genericFormService.cdmendDto[idx] as any).tbl = this.safeParseCdmendTbl(json);
      }
      // also reflect on dialog selection
      if (this.selectedFieldForDialog) {
        this.selectedFieldForDialog.cdmendTbl = json;
        (this.selectedFieldForDialog as any).tbl = this.safeParseCdmendTbl(json);
      }
      this.groupedFields = this.buildGroupedFields(this.genericFormService.cdmendDto);
    }
  }
  ngOnInit(): void {
    this.spinner.show();

    const obsMandatoryAll$ = this.dynamicFormController.getMandatoryAll('');
    const obsMandatoryMeta$ = this.dynamicFormController.getMandatoryMetaDate('');
    const obsCategories$ = this.dynamicFormController.getAllCategories('');

    forkJoin([obsMandatoryAll$, obsMandatoryMeta$, obsCategories$])
      .pipe(
        takeUntil(this.destroyed$),
        // finalize(() => this.spinner.hide())
      )
      .subscribe({
        next: (res: any[]) => {
          // Defensive checks for response shapes
          const mandatoryAll = res[0];
          const mandatoryMeta = res[1];
          const categories = res[2];

          if (mandatoryAll?.isSuccess && mandatoryMeta?.isSuccess && categories?.isSuccess) {
            this.genericFormService.cdCategoryMandDto = mandatoryAll.data as CdCategoryMandDto[];
            const metaFields = (mandatoryMeta.data as CdmendDto[]) || [];
            this.genericFormService.cdmendDto = metaFields.map(f => ({
              ...f,
              tbl: this.safeParseCdmendTbl(f.cdmendTbl)
            }));
            this.genericFormService.cdcategoryDtos = (categories.data || []).filter((f: any) => f.catId > 100 && f.catParent == 1) as CdcategoryDto[];
            this.groupedFields = this.buildGroupedFields(this.genericFormService.cdmendDto);
            
            // Trigger animation
            this.recalculateStats();

            // Initialize application filters
            this.updateApplicationFilters();

            // Load UI preferences: dark mode, compact mode, high-contrast
            const savedDark = localStorage.getItem('dfm-dark-mode');
            if (savedDark !== null) {
              this.isDarkMode = savedDark === 'true';
            } else {
              // If user hasn't chosen, follow system preference and listen for changes
              try {
                this.prefersDarkMedia = window.matchMedia('(prefers-color-scheme: dark)');
                this.isDarkMode = this.prefersDarkMedia.matches;
                const handler = (e: MediaQueryListEvent) => {
                  // only update if user hasn't saved an explicit preference
                  const saved = localStorage.getItem('dfm-dark-mode');
                  if (saved === null) this.isDarkMode = e.matches;
                };
                this.prefersDarkMedia.addEventListener?.('change', handler);
                (this as any)._prefersDarkHandler = handler;
              } catch (e) {
                // older browsers may not support addEventListener on MediaQueryList
                try { this.prefersDarkMedia?.addListener?.(() => { this.isDarkMode = this.prefersDarkMedia?.matches ?? false; }); } catch { }
              }
            }

            const savedCompact = localStorage.getItem('dfm-compact-mode');
            if (savedCompact !== null) this.compactMode = savedCompact === 'true';

            const savedHC = localStorage.getItem('dfm-high-contrast');
            if (savedHC !== null) this.highContrast = savedHC === 'true';
          } else {
            // collect and show errors if present
            let errors = '';
            [mandatoryAll, mandatoryMeta, categories].forEach(r => {
              if (r && Array.isArray(r.errors)) {
                r.errors.forEach((e: any) => errors += (e?.message || e) + '\n');
              }
            });
            this.msg.msgError('Error', '<h5>' + (errors || 'Unknown error') + '</h5>', true);
          }
        },
        error: (error) => {
          this.msg.msgError('Error', '<h5>' + (error?.message || String(error)) + '</h5>', true);
        }
      });

    // this.getLogCaseAsync();
  }

  safeParseCdmendTbl(cdmendTblValue: any): any[] {
    if (!cdmendTblValue) return [];
    if (Array.isArray(cdmendTblValue)) return cdmendTblValue;
    if (typeof cdmendTblValue === 'string') {
      try {
        const parsed = JSON.parse(cdmendTblValue);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        console.warn('Failed to parse cdmendTbl JSON', e);
        return [];
      }
    }
    return [];
  }

  private buildGroupedFields(fields: CdmendDto[] | null | undefined): FieldGroup[] {
    if (!fields || !fields.length) return [];

    const appMap = new Map<string, Map<string, CdmendDto[]>>();

    for (const f of fields) {
      const app = (f.applicationId || 'DEFAULT') as string;
      const type = (f.cdmendType || 'Unknown') as string;

      if (!appMap.has(app)) appMap.set(app, new Map<string, CdmendDto[]>());
      const typeMap = appMap.get(app)!;
      if (!typeMap.has(type)) typeMap.set(type, []);
      typeMap.get(type)!.push(f);
    }

    const apps = Array.from(appMap.keys()).sort();

    return apps.map(app => {
      const typeMap = appMap.get(app)!;
      const types = Array.from(typeMap.keys()).sort();

      const typeNodes: FieldGroup[] = types.map(t => {
        const fieldsForType = (typeMap.get(t) || []).map(f => ({
          label: f.cdMendLbl || f.cdmendTxt || String(f.cdmendSql),
          data: f,
          leaf: true
        } as FieldGroup));

        return {
          label: t,
          data: { applicationId: app, cdmendType: t },
          expanded: false,
          children: fieldsForType
        } as FieldGroup;
      });

      return {
        label: app,
        data: { applicationId: app },
        expanded: false,
        children: typeNodes
      } as FieldGroup;
    });
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();

    // Remove prefers-color-scheme listener if attached
    if (this.prefersDarkMedia && (this as any)._prefersDarkHandler) {
      this.prefersDarkMedia.removeEventListener?.('change', (this as any)._prefersDarkHandler);
    }
  }


  // Dialog state to show field details in a modal
  displayFieldDialog: boolean = false;
  selectedFieldForDialog: CdmendDto = {} as CdmendDto;
  filtered_1_CategoryMand: CdCategoryMandDto[] = []
  /**
   * Open the dialog and populate the form with the provided field data.
   */
  openFieldDialog(field: CdmendDto): void {
    if (!field) return;
    this.selectedFieldForDialog = field;
    this.displayFieldDialog = true;
  }

  onDialogVisibleChange(visible: boolean) {
    this.displayFieldDialog = visible;
    if (!visible) {
      this.closeFieldDialog();
    }
  }

  closeFieldDialog(): void {
    this.displayFieldDialog = false;
    this.selectedFieldForDialog = {} as CdmendDto;
  }

  /**
   * Safely derive a label for an option entry in cdmendTbl.
   */
  optionLabel(opt: any): string {
    if (!opt) return '';
    if (typeof opt === 'string') return opt;
    const name = typeof opt.name === 'string' ? opt.name.trim() : '';
    if (name) return name;
    const key = typeof opt.key === 'string' ? opt.key.trim() : '';
    if (key) return key;
    const label = typeof opt.label === 'string' ? opt.label.trim() : '';
    if (label) return label;
    if (opt.value !== undefined && opt.value !== null) return String(opt.value);
    try { return JSON.stringify(opt); } catch { return String(opt); }
  }

  // Add a new field
  addField(): void {
    if (this.fieldForm.valid) {
      const newField: CdmendDto = this.fieldForm.value;

      const tblArray = this.safeParseCdmendTbl(this.fieldForm.get('cdmendTbl')?.value ?? newField.cdmendTbl ?? []);
      (newField as any).cdmendTbl = JSON.stringify(tblArray);
      (newField as any).tbl = tblArray;
      // push into service list
      this.genericFormService.cdmendDto.push(newField);

      // Also update any existing selected item matching this field (by cdmendTxt or cdmendSql)
      const matchIdx = this.genericFormService.cdmendDto.findIndex(f => f.cdmendTxt === newField.cdmendTxt || f.cdmendSql === newField.cdmendSql);
      if (matchIdx !== -1) {
        this.genericFormService.cdmendDto[matchIdx].cdmendTbl = (newField as any).cdmendTbl;
        (this.genericFormService.cdmendDto[matchIdx] as any).tbl = tblArray;
      }
      // refresh the tree view
      this.fieldForm.reset(); // Clear the form
    } else {
      console.log("this.fieldForm.valid", this.fieldForm.valid)
    }
  }


  /** Remove a selection row by index from the current cdmendTbl FormArray and persist */
  removeSelection(index: any) {
    if (index == null || index < 0 || index >= this.cdmendTbl.length) return;
    this.cdmendTbl.removeAt(index);
    // Persist updated array to service and selection
    const json = JSON.stringify(this.cdmendTbl.value || []);
    const current = this.selectedFieldForDialog ?? this.selectedField;
    if (current) {
      const idx = this.genericFormService.cdmendDto.findIndex(m => m.cdmendTxt === current.cdmendTxt || m.cdmendSql === current.cdmendSql);
      if (idx !== -1) {
        this.genericFormService.cdmendDto[idx].cdmendTbl = json;
        (this.genericFormService.cdmendDto[idx] as any).tbl = this.safeParseCdmendTbl(json);
      }
      if (this.selectedFieldForDialog) {
        this.selectedFieldForDialog.cdmendTbl = json;
        (this.selectedFieldForDialog as any).tbl = this.safeParseCdmendTbl(json);
      }
    }
  }

  // Edit an existing field
  editField(CdmendDto: CdmendDto): void {
    this.isEditing = true;
    // store the actual index in the current array so saveField can update the correct element
    const idx = this.genericFormService.cdmendDto.findIndex(f => f.cdmendSql === CdmendDto.cdmendSql || f.cdmendTxt === CdmendDto.cdmendTxt);
    this.editingIndex = idx >= 0 ? idx : null;

    this.fieldForm.patchValue(CdmendDto as CdmendDto); // Populate the form with the field's data
    this.displayFieldDialog = true;
  }

  // Save logic has been moved into GenericElementDetailsComponent; tree updates are handled via the (tree) event

  // Delete a field
  deleteField(index: number): void {
    this.genericFormService.cdmendDto = this.genericFormService.cdmendDto.filter(f => f.cdmendSql !== index)
    // this.genericFormService.cdmendDto.splice(index, 1); // Remove the field from the list
  }
  rebuildTree() {
   this.groupedFields =  this.buildGroupedFields(this.genericFormService.cdmendDto);
  }

  refreshTree() {
    this.groupedFields = this.buildGroupedFields(this.genericFormService.cdmendDto);
    this.recalculateStats();
    this.updateApplicationFilters();
  }

  // Statistics methods
  getApplicationsCount(): number {
    if (!this.groupedFields || !this.groupedFields.length) return 0;
    return this.groupedFields.length;
  }

  getTypesCount(): number {
    if (!this.groupedFields || !this.groupedFields.length) return 0;
    return this.groupedFields.reduce((count, app) => count + (app.children?.length || 0), 0);
  }

  getFieldsCount(): number {
    if (!this.genericFormService.cdmendDto) return 0;
    return this.genericFormService.cdmendDto.length;
  }

  getActiveFieldsCount(): number {
    if (!this.genericFormService.cdmendDto) return 0;
    return this.genericFormService.cdmendDto.filter(f => f.cdmendStat).length;
  }

  getInclusiveFieldsCount(): number {
    if (!this.genericFormService.cdmendDto) return 0;
    return this.genericFormService.cdmendDto.filter(f => !f.cdmendStat).length;
  }

  expandAll(): void {
    if (!this.groupedFields) return;
    this.groupedFields.forEach(app => {
      app.expanded = true;
      if (app.children) {
        app.children.forEach(type => type.expanded = true);
      }
    });
  }

  collapseAll(): void {
    if (!this.groupedFields) return;
    this.groupedFields.forEach(app => {
      app.expanded = false;
      if (app.children) {
        app.children.forEach(type => type.expanded = false);
      }
    });
  }

  // Enhanced UI methods
  showAddFieldDialog(): void {
    this.isEditing = false;
    this.editingIndex = null;
    this.fieldForm.reset();
    this.displayFieldDialog = true;
  }

  onSearch(event: any): void {
    // searchTerm is two-way bound, but we can also use event
    this.applyFilters();
  }

  onApplicationFilter(event: any): void {
    // selectedAppFilter is two-way bound
    this.applyFilters();
  }

  filterByStatus(status: 'active' | 'inactive'): void {
    // toggle off if already selected
    if (this.filterStatus === status) {
      this.filterStatus = 'all';
    } else {
      this.filterStatus = status;
    }
    this.applyFilters();
  }

  applyFilters(): void {
    if (!this.genericFormService.cdmendDto) return;

    let filtered = this.genericFormService.cdmendDto;

    // 1. App Filter
    if (this.selectedAppFilter && this.selectedAppFilter !== 'all') {
      filtered = filtered.filter(f => f.applicationId === this.selectedAppFilter);
    }

    // 2. Status Filter
    if (this.filterStatus === 'active') {
      filtered = filtered.filter(f => f.cdmendStat);
    } else if (this.filterStatus === 'inactive') {
      filtered = filtered.filter(f => !f.cdmendStat);
    }

    // 3. Search Filter
    const term = (this.searchTerm || '').trim().toLowerCase();
    if (term) {
      filtered = filtered.filter(field => 
        field.cdMendLbl?.toLowerCase().includes(term) ||
        field.cdmendTxt?.toLowerCase().includes(term) ||
        field.cdmendType?.toLowerCase().includes(term) ||
        String(field.applicationId ?? '').toLowerCase().includes(term)
      );
    }

    this.groupedFields = this.buildGroupedFields(filtered);
    
    // Auto expand if filtering drastically reduces results
    // if (term || this.filterStatus !== 'all') {
    //   this.expandAll();
    // }
  }

  exportData(): void {
    try {
      const dataToExport = this.genericFormService.cdmendDto.map(field => ({
        'Application ID': field.applicationId,
        'Field Type': field.cdmendType,
        'Field Label': field.cdMendLbl,
        'Field Name': field.cdmendTxt,
        'Required': field.required,
        'Active': field.cdmendStat,
        'Width': field.width,
        'Height': field.height
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Dynamic Fields');
      
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      saveAs(data, `dynamic-fields-${new Date().toISOString().split('T')[0]}.xlsx`);
      
      this.msg.msgSuccess('Data exported successfully!', 3000);
    } catch (error) {
      this.msg.msgError('Error', 'Failed to export data');
    }
  }

  private updateApplicationFilters(): void {
    if (!this.genericFormService.cdmendDto) return;
    
    const apps = [...new Set(this.genericFormService.cdmendDto.map(f => f.applicationId))];
    this.applicationFilters = [
      { label: 'All Applications', value: 'all' },
      ...apps.map(app => ({ label: app, value: app }))
    ];
  }



  getAppStats(applicationId: string): string {
    if (!this.genericFormService.cdmendDto) return '';
    const appFields = this.genericFormService.cdmendDto.filter(f => f.applicationId === applicationId);
    const activeCount = appFields.filter(f => f.cdmendStat).length;
    return `${activeCount}/${appFields.length} active`;
  }

  getFieldTypeClass(fieldType: string): string {
    switch (fieldType?.toLowerCase()) {
      case 'inputtext': return 'type-input';
      case 'textarea': return 'type-textarea';
      case 'dropdown': return 'type-dropdown';
      case 'radiobutton': return 'type-radio';
      case 'date': return 'type-date';
      default: return 'type-default';
    }
  }

  getAccordionAppHeader(app: any): string {
    return app.data?.applicationId || 'Unknown Application';
  }

  confirmDeleteField(field: any): void {
    // Use PrimeNG ConfirmDialog or implement custom confirmation
    if (confirm(`Are you sure you want to delete the field "${field.cdMendLbl}"?`)) {
      this.deleteField(field.cdmendSql);
    }
  }

  addFieldToGroup(groupData: any): void {
    // Set default values for new field in this group
    this.fieldForm.patchValue({
      applicationId: groupData.applicationId,
      cdmendType: groupData.cdmendType
    });
    this.showAddFieldDialog();
  }

  // UI Preference Toggles
  toggleDarkMode(): void {
    this.isDarkMode = !this.isDarkMode;
    localStorage.setItem('dfm-dark-mode', String(this.isDarkMode));
  }

  toggleCompactMode(): void {
    this.compactMode = !this.compactMode;
    localStorage.setItem('dfm-compact-mode', String(this.compactMode));
  }

  toggleHighContrast(): void {
    this.highContrast = !this.highContrast;
    localStorage.setItem('dfm-high-contrast', String(this.highContrast));
  }

}