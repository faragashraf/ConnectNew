import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { MsgsService } from '../../../../shared/services/helper/msgs.service';
import { ChartConfig } from 'src/app/Modules/GenericComponents/models/chart-config';
import { ChartConfigAdminService } from 'src/app/Modules/admins/services/chart-config-admin.service';

@Component({
  selector: 'app-chart-config-manager',
  templateUrl: './chart-config-manager.component.html',
  styleUrls: ['./chart-config-manager.component.scss'],
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('300ms ease-in', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('300ms ease-out', style({ opacity: 0 }))
      ])
    ]),
    trigger('dialogAnimation', [
      transition(':enter', [
        style({ transform: 'scale(0.9)', opacity: 0 }),
        animate('200ms ease-out', style({ transform: 'scale(1)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ transform: 'scale(0.9)', opacity: 0 }))
      ])
    ])
  ]
})
export class ChartConfigManagerComponent implements OnInit {

  charts: ChartConfig[] = [];
  selectedModule: string = '';
  loading: boolean = false;
  displayDialog: boolean = false;
  chartForm!: FormGroup;
  isEditMode: boolean = false;
  modules: any[] = [
    { label: 'AdminCertificates', value: 'AdminCertificates' },
    { label: 'TM', value: 'TM' },
    { label: 'ServicesDashboard', value: 'ServicesDashboard' },
  ];
  
  chartTypes = [
    { label: 'Bar', value: 'bar' },
    { label: 'Pie', value: 'pie' },
    { label: 'Line', value: 'line' },
    { label: 'Doughnut', value: 'doughnut' },
    { label: 'Radar', value: 'radar' },
    { label: 'PolarArea', value: 'polarArea' },
    { label: 'Bubble', value: 'bubble' },
    { label: 'Scatter', value: 'scatter' }
  ];

  showAdvanced: boolean = false;

  constructor(
    private service: ChartConfigAdminService,
    private fb: FormBuilder,
    private msgsService: MsgsService
  ) { 
    this.createForm();
  }

  ngOnInit(): void {
    // Optionally load a default module if needed, or wait for user selection
  }

  createForm() {
    this.chartForm = this.fb.group({
      key: ['', Validators.required],
      moduleName: ['', Validators.required],
      title: [''],
      type: ['bar', Validators.required],
      enabled: [true],
      order: [1],
      
      // Definition
      definition: this.fb.group({
        queryId: [null],
        queryParams: [''], // Will handle JSON parsing/stringifying
        sectorField: [''],
        seriesField: [''],
        valueField: ['', Validators.required]
      }),

      // Labels (List implementation)
      labels: this.fb.array([]), 

      // Appearance
      appearance: this.fb.group({
        stacked: [false],
        showDataLabels: [false],
        colorMap: [''], // JSON string
        tooltipEnabled: [null],
        pie: this.fb.group({
          labelMode: ['percent'],
          position: ['outside'],
          minPercentToShow: [4],
          offset: [12]
        }),
        legend: this.fb.group({
            position: ['right']
        })
      }),

      // Axis
      axis: this.fb.group({
        desiredTicks: [null],
        primaryAxisId: ['y'],
        forceZeroMin: [true],
        headroomMultiplier: [null],
        seriesAxisMap: [''] // JSON string
      }),

      // Layout
      layout: this.fb.group({
        width: ['100%'],
        height: [300]
      })
    });
  }

  get labelsFormArray() {
    return this.chartForm.get('labels') as FormArray;
  }

  addLabel() {
    this.labelsFormArray.push(this.fb.group({
      key: ['', Validators.required],
      value: ['', Validators.required]
    }));
  }

  removeLabel(index: number) {
    this.labelsFormArray.removeAt(index);
  }

  onModuleChange(event: any) {
    this.selectedModule = event.value; // p-dropdown using ngModel or formControl? I'll use ngModel on the dropdown
    this.loadCharts();
  }

  loadCharts() {
    if (!this.selectedModule) return;
    this.loading = true;
    this.service.getChartsByModule(this.selectedModule).subscribe({
      next: (data: any) => {
        // Handle potential response wrappers (e.g. { result: [...] } or { value: [...] })
        if (Array.isArray(data)) {
          this.charts = data;
        } else if (data && Array.isArray(data.charts)) {
          this.charts = data.charts;
        } else if (data && Array.isArray(data.result)) {
          this.charts = data.result;
        } else if (data && Array.isArray(data.value)) {
          this.charts = data.value;
        } else if (data && Array.isArray(data.data)) {
          this.charts = data.data;
        } else {
          this.charts = [];
          console.error('Expected array of charts, but received:', data);
        }
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.charts = [];
        this.msgsService.msgError('Error', 'Failed to load charts');
      }
    });
  }

  get formDefaults() {
    return {
      key: '',
      moduleName: '',
      title: '',
      type: 'bar',
      enabled: true,
      order: 1,
      definition: {
        queryId: null,
        queryParams: '',
        sectorField: '',
        seriesField: '',
        valueField: ''
      },
      labels: [], // FormArray handled separately
      appearance: {
        stacked: false,
        showDataLabels: false,
        colorMap: '',
        tooltipEnabled: null,
        pie: {
          labelMode: 'percent',
          position: 'outside',
          minPercentToShow: 4,
          offset: 12
        },
        legend: {
            position: 'right'
        }
      },
      axis: {
        desiredTicks: null,
        primaryAxisId: 'y',
        forceZeroMin: true,
        headroomMultiplier: null,
        seriesAxisMap: '',
        axes: ''
      },
      layout: {
        width: '100%',
        height: 300
      }
    };
  }

  openNew() {
    this.isEditMode = false;
    this.showAdvanced = false;
    
    // Reset to defaults
    this.chartForm.reset(this.formDefaults);
    this.labelsFormArray.clear();

    // Set dynamic defaults
    this.chartForm.patchValue({
      moduleName: this.selectedModule,
      order: (this.charts.length > 0 ? Math.max(...this.charts.map(c => c.order || 0)) + 1 : 1)
    });

    // Enable key field
    this.chartForm.get('key')?.enable();
    
    this.displayDialog = true;
  }

  editChart(chart: ChartConfig) {
    this.isEditMode = true;
    this.showAdvanced = false;
    
    // Reset to defaults
    this.chartForm.reset(this.formDefaults);

    // Populate Labels FormArray
    this.labelsFormArray.clear();
    if (chart.labels) {
      Object.keys(chart.labels).forEach(key => {
        this.labelsFormArray.push(this.fb.group({
          key: [key, Validators.required],
          value: [chart.labels![key], Validators.required]
        }));
      });
    }

    // Map Backend Flat Appearance to Form Nested Appearance
    const backendApp: any = chart.appearance || {}; // Cast to any to handle flat props
    
    // Prioritize flat properties (LabelMode, etc) but fallback to nested if they exist (old data)
    const pieLabelMode = backendApp.labelMode || backendApp.pie?.labelMode || this.formDefaults.appearance.pie.labelMode;
    const piePosition = backendApp.position || backendApp.pie?.position || this.formDefaults.appearance.pie.position;
    const pieMinPercent = backendApp.minPercentToShow || backendApp.pie?.minPercentToShow || this.formDefaults.appearance.pie.minPercentToShow;
    const pieOffset = backendApp.offset || backendApp.pie?.offset || this.formDefaults.appearance.pie.offset;
    const legendPos = backendApp.legendPosition || backendApp.legend?.position || this.formDefaults.appearance.legend.position;
    const tooltipEnabled = backendApp.tooltipEnabled ?? backendApp.tooltip?.enabled ?? this.formDefaults.appearance.tooltipEnabled;

    const formAppearance = {
        stacked: backendApp.stacked ?? this.formDefaults.appearance.stacked,
        showDataLabels: backendApp.showDataLabels ?? this.formDefaults.appearance.showDataLabels,
        colorMap: JSON.stringify(backendApp.colorMap || {}),
        tooltipEnabled,
        pie: {
          labelMode: pieLabelMode,
          position: piePosition,
          minPercentToShow: pieMinPercent,
          offset: pieOffset
        },
        legend: {
            position: legendPos
        }
    };

    const axisConfig = this.parseAxisConfig(chart.axis ?? (chart as any).Axis);

    // Prepare data for form
    const formValue = {
      ...chart,
      definition: {
        ...chart.definition,
        sectorField: Array.isArray(chart.definition.sectorField) ? chart.definition.sectorField.join(',') : (chart.definition.sectorField || ''),
        valueField: Array.isArray(chart.definition.valueField) ? chart.definition.valueField.join(',') : chart.definition.valueField,
        queryParams: JSON.stringify(chart.definition.queryParams || {})
      },
      axis: {
        ...axisConfig,
        seriesAxisMap: this.formatJsonField(axisConfig?.seriesAxisMap ?? axisConfig?.SeriesAxisMap),
        axes: this.formatJsonField(axisConfig?.axes),
        primaryAxisId: axisConfig?.primaryAxisId || 'y'
      },
      layout: {
        ...chart.layout,
        // Normalize "270px" -> 270 for the numeric input
        height: typeof chart.layout?.height === 'string'
          ? parseFloat(chart.layout.height)
          : chart.layout?.height
      },
      appearance: formAppearance
    };

    // Remove labels from formValue
    delete (formValue as any).labels;

    this.chartForm.patchValue(formValue);
    
    // Disable key field in edit mode
    this.chartForm.get('key')?.disable();
    
    this.displayDialog = true;
  }

  deleteChart(chart: ChartConfig) {
    this.msgsService.msgConfirm('Are you sure you want to delete ' + chart.key + '?', 'Delete').then((confirmed: boolean) => {
      if (confirmed) {
        this.service.deleteChart(chart.key).subscribe({
          next: (response: any) => {
            if (response.isSuccess) {
              this.msgsService.msgSuccess('Chart Deleted', 3000);
              this.loadCharts();
            } else {
              this.msgsService.msgError('Error', response.errors?.map((e: any) => e.message).join(', ') || 'Failed to delete chart');
            }
          },
          error: (err) => {
            this.msgsService.msgError('Error', 'Failed to delete chart');
          }
        });
      }
    });
  }

  saveChart() {
    if (this.chartForm.invalid) {
      // Mark all as touched to show errors
      this.chartForm.markAllAsTouched();
      return;
    }

    const formVal = this.chartForm.getRawValue();
    
    // Transform arrays and JSON strings back to objects
    const labelsArray = formVal.labels as any[];
    const labelsObj: any = {};
    if (labelsArray) {
        labelsArray.forEach(l => {
            if (l.key && l.value) labelsObj[l.key] = l.value;
        });
    }

    const sectorFieldInput = (formVal.definition.sectorField || '').trim();
    const sectorFieldValue = sectorFieldInput
      ? sectorFieldInput.split(',').map((s: string) => s.trim()).filter((s: string) => s)
      : [];

    const config: ChartConfig = {
      ...formVal,
      definition: {
        ...formVal.definition,
        // sectorField: keep as array of strings
        sectorField: sectorFieldValue,
        // valueField: send as single string (backend expects String)
        valueField: formVal.definition.valueField,
        queryParams: this.safeJsonParse(formVal.definition.queryParams)
      },
      axis: {
        ...formVal.axis,
        seriesAxisMap: this.parseLenientJson(formVal.axis?.seriesAxisMap),
        SeriesAxisMap: this.parseLenientJson(formVal.axis?.seriesAxisMap),
        axes: this.parseLenientJson(formVal.axis?.axes),
        primaryAxisId: formVal.axis?.primaryAxisId
      },
      layout: {
        ...formVal.layout,
        // Store height as "<number>px" to match backend JSON
        height: formVal.layout?.height !== null && formVal.layout?.height !== undefined
          ? `${formVal.layout.height}px`
          : undefined
      },
      labels: labelsObj,
      appearance: {
        // Flat mapping for Backend (removing nested pie/legend objects)
        stacked: formVal.appearance.stacked,
        showDataLabels: formVal.appearance.showDataLabels,
        colorMap: this.parseLenientJson(formVal.appearance.colorMap),
        tooltipEnabled: formVal.appearance.tooltipEnabled,
        
        // Pie properties (Flattened)
        labelMode: formVal.appearance.pie?.labelMode,
        position: formVal.appearance.pie?.position, // Maps to backend 'Position'
        minPercentToShow: formVal.appearance.pie?.minPercentToShow,
        offset: formVal.appearance.pie?.offset,
        
        // Legend properties (Flattened)
        legendPosition: formVal.appearance.legend?.position // Maps to backend 'LegendPosition'
      } as any // Cast to any because TS interface still expects nested objects
    };

    // sectorField is strictly handled as string[] based on requirements

    if (this.isEditMode) {
      this.service.updateChart(config.key, config).subscribe({
        next: (response: any) => {
          if (response.isSuccess) {
            this.msgsService.msgSuccess('Chart Updated', 3000);
            this.displayDialog = false;
            this.loadCharts();
          } else {
            this.msgsService.msgError('Error', response.errors?.map((e: any) => e.message).join(', ') || 'Failed to update chart');
          }
        },
        error: (err) => {
          this.msgsService.msgError('Error', 'Failed to update chart');
        }
      });
    } else {
      this.service.createChart(config).subscribe({
        next: (response: any) => {
          if (response.isSuccess) {
            this.msgsService.msgSuccess('Chart Created', 3000);
            this.displayDialog = false;
            this.loadCharts();
          } else {
            this.msgsService.msgError('Error', response.errors?.map((e: any) => e.message).join(', ') || 'Failed to create chart');
          }
        },
        error: (err) => {
          this.msgsService.msgError('Error', 'Failed to create chart');
        }
      });
    }
  }

  safeJsonParse(jsonStr: string) {
    if (!jsonStr) return undefined;
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      return undefined;
    }
  }

  // More lenient JSON parsing to accept common user edits (single quotes, trailing commas,
  // already-object values). Returns object or undefined.
  parseLenientJson(input: any) {
    if (input === null || input === undefined) return undefined;
    if (typeof input === 'object') return input;
    if (typeof input !== 'string') return undefined;

    const raw = input.trim();
    if (!raw) return undefined;

    try {
      return JSON.parse(raw);
    } catch (e) {
      // Try simple fixes: replace single quotes with double quotes and remove trailing commas
      let s = raw.replace(/\r?\n|\r/g, ' ');
      s = s.replace(/'([^']*?)'/g, '"$1"');
      s = s.replace(/,\s*([}\]])/g, '$1');
      try {
        return JSON.parse(s);
      } catch (e2) {
        return undefined;
      }
    }
  }

  formatJsonField(value: any): string {
      if (!value) return '';
      if (typeof value === 'string') return value;
      try {
          return JSON.stringify(value, null, 2);
      } catch (e) {
          return '';
      }
  }

    parseAxisConfig(value: any): any {
      if (!value) return {};
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch (e) {
          return {};
        }
      }
      return value;
    }

  toggleAdvanced() {
    this.showAdvanced = !this.showAdvanced;
  }
}
