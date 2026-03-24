import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import Chart from 'chart.js/auto';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { ChartConfig, ChartLayout } from '../../models/chart-config';

@Component({
    selector: 'app-generic-chart', 
    templateUrl: './generic-chart.component.html',
    styleUrls: ['./generic-chart.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class GenericChartComponent implements OnInit, OnChanges {

    @Input() config!: ChartConfig;
    @Input() loading: boolean = false;
    @Input() loaded: boolean = false;
    @Input() loadingTime?: number;
    // toggle to show/hide the raw data table for this chart
    public showDataTable: boolean = false;
    @Output() chartClick = new EventEmitter<any>();

    public containerMinWidth: number = 560;
    public containerHeight: string = '150px';
    public containerWidthStyle: string | undefined;

    public chartData: any;
    public chartOptions: any;
    public plugins: any[] = [];

    private tagBg2Map: { [key: string]: string } = {
        primary: 'hsla(207, 100%, 50%, 0.466)',
        secondary: 'hsla(0, 0%, 0%, 0.467)',
        info: 'hsla(187, 100%, 50%, 0.466)',
        warning: 'hsla(45, 100%, 50%, 0.466)',
        danger: 'hsla(354, 100%, 50%, 0.288)',
        success: 'hsla(122, 100%, 50%, 0.466)'
    };

        private enNumberFormat = new Intl.NumberFormat('en-US');

    private defaultColors: string[] = [
        '#00ec00ff', '#00ac2bff', '#37f5f5ff', '#ff0000ff', '#acc236', '#166a8f', '#00a950', '#58595b'
    ];

    constructor() { 
        this.plugins = [{
            id: 'outer-lines',
            afterDraw: (chart: any) => {
                if (chart.config.type !== 'pie' && chart.config.type !== 'doughnut') {
                    return;
                }
                const ctx = chart.ctx;
                
                // Only draw if labels are 'outside' style (layout padding check or option check)
                // We assume default is outside unless configured otherwise
                
                ctx.save();
                ctx.strokeStyle = '#999';
                ctx.lineWidth = 1;
                
                const meta = chart.getDatasetMeta(0);
                const dataset = chart.data.datasets[0];
                const total = dataset.data.reduce((a: any, b: any) => a + Number(b), 0);

                meta.data.forEach((element: any, index: number) => {
                    if (element.hidden) return;
                    
                    const value = dataset.data[index];
                    const percent = (value / total) * 100;
                    if (percent < 3) return; // Skip small slices

                    const { x, y } = element.tooltipPosition();
                    const outerRadius = element.outerRadius;
                    const angle = (element.startAngle + element.endAngle) / 2;
                    
                    // Start at edge
                    const startX = element.x + Math.cos(angle) * outerRadius;
                    const startY = element.y + Math.sin(angle) * outerRadius;
                    
                    // End near label (offset ~12-16px)
                    const lineLen = 12;
                    const endX = element.x + Math.cos(angle) * (outerRadius + lineLen);
                    const endY = element.y + Math.sin(angle) * (outerRadius + lineLen);
                    
                    ctx.beginPath();
                    ctx.moveTo(startX, startY);
                    ctx.lineTo(endX, endY);
                    ctx.stroke();
                });
                ctx.restore();
            }
        }];
    }

    ngOnInit(): void {
        // Register standard plugin if imported
        try {
            if (ChartDataLabels) {
                Chart.register(ChartDataLabels);
            }
        } catch (e) {
            console.warn('Failed to register ChartDataLabels plugin', e);
        }
    }

    ngOnChanges(changes: SimpleChanges): void {
        // Process ONLY when config is available
        if (this.config) {
            this.processConfig();
        }
    }

    public get chartType(): string {
        return this.config?.type || 'bar';
    }

    public get title(): string | undefined {
        return this.config?.title;
    }

    public get canvasWidth(): number | string {
        // Allow overriding via config.appearance or config.layout
        // Assuming config.appearance is 'any' based on usage in createPieOptions
        const layout = this.config?.layout as ChartLayout;
        return layout?.width  || '';
    }

    public get canvasHeight(): number | string {
        const layout = this.config?.layout as ChartLayout;
        return layout?.height?.toString() || '170px';
    }

    public get hasData(): boolean {
        return this.chartData && this.chartData.labels && this.chartData.labels.length > 0;
    }

    private processConfig() {
        if (this.config.enabled === false) {
            this.chartData = null;
            this.chartOptions = null;
            return;
        }

        const type = this.config.type || 'bar';
        const isPie = type === 'pie' || type === 'doughnut';

        if (isPie) {
             this.buildPieChart();
        } else {
             this.buildBarLineChart();
        }

        this.updateDimensions();
    }

    private buildPieChart() {
        let dataRows = (this.config.data && this.config.data.rows) ? this.config.data.rows : [];
        const def = this.config.definition;
        
        const seriesField = def.seriesField; 
        const labelField = seriesField || (Array.isArray(def.sectorField) ? def.sectorField[0] : def.sectorField);
        const valueField = Array.isArray(def.valueField) ? def.valueField[0] : def.valueField;

        if (!labelField || !valueField) {
            console.warn('Pie chart requires seriesField (categories) and valueField (values).');
            return;
        }

        const aggregation = new Map<string, number>();
        const labelSet = new Set<string>();

        dataRows.forEach(row => {
            const label = String(row[labelField] ?? 'Unknown');
            const val = Number(row[valueField] ?? 0);
            if (!isNaN(val)) {
                const current = aggregation.get(label) || 0;
                aggregation.set(label, current + val);
                labelSet.add(label);
            }
        });

        const labels = Array.from(labelSet);
        const aggregatedPoints = labels.map(l => ({ label: l, value: aggregation.get(l) || 0 }));
        
        // Filter out zero values
        const nonZeroPoints = aggregatedPoints.filter(p => p.value > 0);
        
        const finalLabels = nonZeroPoints.map(p => p.label);
        const dataPoints = nonZeroPoints.map(p => p.value);
        
        const bgColors = finalLabels.map((l, i) => this.resolveColor(l, i));

        this.chartData = {
            labels: finalLabels,
            datasets: [{
                data: dataPoints,
                backgroundColor: bgColors,
                borderColor: '#ffffff',
                borderWidth: 1
            }]
        };

        this.chartOptions = this.createPieOptions(dataPoints);
    }
    
    private buildBarLineChart() {
        let dataRows = (this.config.data && this.config.data.rows) ? this.config.data.rows : [];
        const def = this.config.definition;
        const appearance = this.config.appearance || {};

        const sectorFields = Array.isArray(def.sectorField) ? def.sectorField : [def.sectorField];
        const valueFields = Array.isArray(def.valueField) ? def.valueField : [def.valueField];
        const seriesField = def.seriesField;

        const getSectorKey = (row: any) => {
            return sectorFields
                .map(f => row[f])
                .filter(v => v !== null && v !== undefined)
                .join(' - ');
        };

        const uniqueSectorKeys = Array.from(new Set(dataRows.map(r => getSectorKey(r))));
        
        // Pre-calculate sums for each sector to filter out zero columns
        const sectorSums = new Map<string, number>();
        uniqueSectorKeys.forEach(sectorKey => {
            let sum = 0;
            const sectorRows = dataRows.filter(r => getSectorKey(r) === sectorKey);
            sectorRows.forEach(row => {
                valueFields.forEach(vField => {
                    sum += Number(row[vField] ?? 0);
                });
            });
            sectorSums.set(sectorKey, sum);
        });

        // Filter out sectors where the total sum is 0
        const filteredSectorKeys = uniqueSectorKeys.filter(key => (sectorSums.get(key) || 0) !== 0);
        const labels = filteredSectorKeys;

        let datasets: any[] = [];

        if (seriesField) {
            const uniqueSeries = Array.from(new Set(dataRows.map(r => String(r[seriesField] ?? ''))));

            uniqueSeries.forEach((seriesVal, sIdx) => {
                valueFields.forEach(vField => {
                    const dataPoints = filteredSectorKeys.map(sectorKey => {
                        const row = dataRows.find(r => getSectorKey(r) === sectorKey && String(r[seriesField] ?? '') === seriesVal);
                        return row ? Number(row[vField] ?? 0) : 0;
                    });

                    const label = valueFields.length > 1 ? `${seriesVal} - ${vField}` : seriesVal;
                    const color = this.resolveColor(seriesVal, sIdx);

                    // map series to axis if configured
                    const seriesAxisMap = this.getSafeSeriesAxisMap();
                    let axisId = this.resolveAxisId(seriesVal, seriesAxisMap) || 'y';

                    // If auto assignment is requested and no explicit mapping
                    const axisConfig = this.getAxisConfig();
                    if (axisConfig.autoAssignSecondaryAxis && axisId === 'y') {
                        // We will calculate max during first pass but we are doing it per series here.
                        // We need to defer axis assignment or do a pre-scan? 
                        // Pre-scan is safer.
                    }

                    datasets.push({
                        label: label,
                        data: dataPoints,
                        backgroundColor: color,
                        borderColor: color,
                        borderWidth: 1,
                        fill: false,
                        yAxisID: axisId
                    });
                });
            });

            // Filter out datasets (series) whose total is zero so they don't appear in legend
            datasets = datasets.filter(ds => Array.isArray(ds.data) && ds.data.some((v: any) => typeof v === 'number' && !isNaN(v) && v !== 0));

            // Heuristic Check: Auto-assign secondary axis if enabled
            // Only if we have multiple datasets and autoAssign is true
            const axisConfig = this.getAxisConfig();
            if (axisConfig.autoAssignSecondaryAxis && datasets.length >= 2) {
                let maxVals = datasets.map(ds => {
                    let m = 0;
                    if (Array.isArray(ds.data)) ds.data.forEach((v: number) => { if (!isNaN(v)) m = Math.max(m, v); });
                    return { ds, max: m };
                });
                
                // Find largest max
                const globalMax = Math.max(...maxVals.map(x => x.max));
                const ratioThreshold = (axisConfig.secondaryAxisHeuristic && axisConfig.secondaryAxisHeuristic.ratioThreshold) || 50;

                // Move small datasets to y2
                maxVals.forEach(item => {
                    // Check if ratio (Large / Small) > threshold
                    // Avoid division by zero
                    if (item.max > 0 && (globalMax / item.max) >= ratioThreshold) {
                         // Only move if not already explicitly mapped? 
                         // Check explicit map - if explicit says 'y', keep 'y'.
                         const seriesName = item.ds.label; // Simplified check
                         const map = this.getSafeSeriesAxisMap();
                         // If NO explicit mapping found for this series, apply heuristic
                         if (!map || (!map[seriesName] && !this.resolveAxisId(seriesName, map, true))) {
                             item.ds.yAxisID = 'y2';
                         }
                    }
                });
            }

        } else {
             valueFields.forEach((vField, vIdx) => {
                const dataPoints = filteredSectorKeys.map(sectorKey => {
                    const row = dataRows.find(r => getSectorKey(r) === sectorKey);
                    return row ? Number(row[vField] ?? 0) : 0;
                });
                
                const bgColors = filteredSectorKeys.map((sKey, i) => {
                     const mapped = this.resolveColor(sKey, -1);
                     if (mapped !== this.defaultColors[0]) return mapped; 
                     return this.defaultColors[i % this.defaultColors.length];
                });
                
                const useArrayColors = filteredSectorKeys.some((k, i) => this.resolveColor(k, -1) !== this.defaultColors[0]);
                const baseColor = this.resolveColor(vField, vIdx);

                // map value field to axis if configured (no series)
                const seriesAxisMap = this.getSafeSeriesAxisMap();
                const axisId = this.resolveAxisId(vField, seriesAxisMap);

                datasets.push({
                    label: vField,
                    data: dataPoints,
                    backgroundColor: useArrayColors ? bgColors : baseColor,
                    borderColor: useArrayColors ? bgColors : baseColor,
                    borderWidth: 1,
                    fill: false,
                    yAxisID: axisId
                });
            });
        }

        this.chartData = {
            labels: labels,
            datasets: datasets
        };

        this.chartOptions = this.createDefaultOptions();
        this.applyAxisRules(datasets);
    }


    private updateDimensions() {
        const layout = this.config.layout || {};
        this.containerHeight = layout.height || '150px';
        this.containerWidthStyle = layout.width;
        
        if (layout.minWidth !== undefined) {
             this.containerMinWidth = layout.minWidth;
        } else {
             const labelCount = this.chartData?.labels?.length || 0; 
             this.containerMinWidth = Math.max(560, (labelCount / 2) * 36 + 220);
        }
    }

    private createPieOptions(data: number[]): any {
        const appearance = this.config.appearance as any || {};
        const pieOpts = appearance.pie || appearance;
        const total = data.reduce((a, b) => a + b, 0);

        return {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: 30 // Ensure space for outside labels
            },
            plugins: {
                legend: { 
                    position: appearance.legend?.position || appearance.legendPosition || 'right',
                    labels: {
                        usePointStyle: true
                    }
                },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        label: (context: any) => {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const formattedValue = typeof value === 'number' ? this.enNumberFormat.format(value) : value;
                            const pct = total > 0 ? ((value / total) * 100).toFixed(1) + '%' : '0%';
                            return `${label}: ${formattedValue} (${pct})`;
                        }
                    }
                },
                datalabels: {
                    // Use 'auto' to prevent overlapping. 
                    display: (context: any) => {
                        if (appearance.showDataLabels === false) return false;
                        
                        const value = context.dataset.data[context.dataIndex];
                        const pct = total > 0 ? (value / total * 100) : 0;
                        // Default threshold 3% to reduce clutter, unless valid data
                        const minPct = pieOpts.minPercentToShow ?? 3;
                        
                        if (pct < minPct) return false;
                        return 'auto';
                    },
                    formatter: (value: number, ctx: any) => {
                        const labelMode = pieOpts.labelMode || 'percent';
                        const pct = total > 0 ? (value / total * 100) : 0;
                        const pctStr = pct.toFixed(1).replace(/\.0$/, '') + '%';
                        const formattedValue = typeof value === 'number' ? this.enNumberFormat.format(value) : value;

                        if (labelMode === 'value') return formattedValue;
                        if (labelMode === 'valueAndPercent') return `${formattedValue} (${pctStr})`;
                        return pctStr;
                    },
                    color: '#000',
                    // Removed solid background to look cleaner
                    textStrokeColor: '#ffffff',
                    textStrokeWidth: 3,
                    anchor: pieOpts.position === 'inside' ? 'center' : 'end',
                    align: pieOpts.position === 'inside' ? 'center' : 'end',
                    offset: pieOpts.offset ?? (pieOpts.position === 'outside' ? 12 : 12), // Default to 12 if not customized
                    clamp: true,
                    clip: false,
                    font: {
                        weight: 'bold',
                        size: 11
                    }
                }
            }
        };
    }

    private createDefaultOptions(): any {
        const appearance = this.config.appearance as any || {};
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    position: appearance.legend?.position || appearance.legendPosition || 'top', 
                    display: true
                },
                tooltip: {
                    callbacks: {
                        label: (context: any) => {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            try {
                                const datasetIndex = context.datasetIndex;
                                const dataIndex = context.dataIndex;
                                const chart = context.chart || context.chartInstance;
                                const ds = chart && chart.data && chart.data.datasets && chart.data.datasets[datasetIndex];
                                const rawVal = ds && ds._rawData && ds._rawData[dataIndex];
                                const displayVal = rawVal !== undefined && rawVal !== null ? rawVal : (context.parsed && context.parsed.y !== null ? context.parsed.y : null);
                                if (displayVal !== null) {
                                    label += (typeof displayVal === 'number') ? this.enNumberFormat.format(displayVal) : displayVal;
                                }
                            } catch (e) {
                                if (context.parsed && context.parsed.y !== null) {
                                    label += this.enNumberFormat.format(context.parsed.y);
                                }
                            }
                            return label;
                        }
                    }
                },
                datalabels: {
                    display: (context: any) => {
                        if (appearance.showDataLabels === false) return false;
                        // Avoid overlap
                        return 'auto';
                    },
                    align: 'top', // Move label to top of point/bar
                    anchor: 'end',
                    offset: 4,    // Push it slightly away
                    clip: false, 
                    color: appearance.labelColor || '#555',
                    // Use text stroke for readability instead of box
                    textStrokeColor: '#ffffff',
                    textStrokeWidth: 3,
                    formatter: (value: any, ctx: any) => {
                        return (value !== 0 && value !== null && value !== undefined)
                            ? (typeof value === 'number' ? this.enNumberFormat.format(value) : value)
                            : '';
                    },
                    font: {
                        weight: 'bold'
                    }
                }
            },
            scales: {
                x: { stacked: !!appearance.stacked },
                y: { 
                    stacked: !!appearance.stacked,
                    ticks: {
                        callback: (value: any, index: any, ticks: any) => {
                             if (typeof value === 'number') {
                                 return this.enNumberFormat.format(value);
                             }
                             return value;
                        }
                    }
                }
            },
            onClick: (evt: any, elements: any[]) => {
                // this.chartClick.emit(evt);
            }
        };
    }

    private getAxisConfig(): any {
        const axis = (this.config as any)?.axis || (this.config as any)?.Axis || {};
        if (typeof axis === 'string') {
            try {
                return JSON.parse(axis);
            } catch (e) {
                console.warn('Failed to parse axis config', e);
                return {};
            }
        }
        return axis;
    }

    private getSafeSeriesAxisMap(): any {
        const axis = this.getAxisConfig() || {};
        // Try camelCase then PascalCase
        let map = axis.seriesAxisMap || axis.SeriesAxisMap;
        
        if (!map) return {};
        
        if (typeof map === 'string') {
            try { 
                return JSON.parse(map); 
            } catch (e) { 
                console.warn('Failed to parse seriesAxisMap', e);
                return {}; 
            }
        }
        return map;
    }

    // Helper to normalize keys for comparison (removes all whitespace and special chars)
    private normalizeKey(key: string): string {
        if (!key) return '';
        // Remove all whitespace (\s), zero-width spaces, ltr/rtl marks, control chars
        return key.toString().replace(/[\s​-‍﻿؜‎‏]/g, '');
    }

    private resolveAxisId(rawSeriesName: string, map: any, strict: boolean = false): string | null {
        if (!map) return strict ? null : 'y';
        const raw = rawSeriesName;
        const normalized = this.normalizeKey(raw);
        
        // 1. Exact match
        if (map[raw]?.axisId) return map[raw].axisId;
        // Generic string mapping check (e.g. "Failed": "y2")
        if (typeof map[raw] === 'string') return map[raw];
        
        // 2. Normalized match (check against normalized keys in map)
        const mapKeys = Object.keys(map);
        const match = mapKeys.find(k => this.normalizeKey(k) === normalized);
        if (match) {
            if (map[match]?.axisId) return map[match].axisId;
            if (typeof map[match] === 'string') return map[match];
        }
        
        return strict ? null : 'y';
    }

    private applyAxisRules(datasets: any[]) {
        const axis = this.getAxisConfig() || {};
        const options = this.chartOptions;
        
        if (this.config.type === 'pie' || this.config.type === 'doughnut') return;

        // Preserve existing X axis definition if it exists
        const existingX = options.scales?.x || { stacked: !!this.config.appearance?.stacked };
        options.scales = {
            x: existingX
        };

        // seriesAxisMap allows mapping series names (or value fields) to axis definitions
        const seriesAxisMap = this.getSafeSeriesAxisMap();

        // Allow per-axis definitions via `axis.axes` or top-level axis.<id>
        let axisDefs: any = {};
        if (axis && axis.axes && typeof axis.axes === 'object') {
            axisDefs = { ...axis.axes };
        }

        // Merge any top-level named axis objects (e.g. axis.y2 = { ... })
        Object.keys(axis).forEach(k => {
            if (['seriesAxisMap', 'SeriesAxisMap', 'headroomMultiplier', 'max', 'forceZeroMin', 'step', 'desiredTicks', 'axis', 'Axis', 'secondaryAxisHeuristic', 'autoAssignSecondaryAxis', 'primaryAxisId'].includes(k)) return;
            try {
                if (k && typeof axis[k] === 'object') {
                    axisDefs[k] = axisDefs[k] || axis[k];
                }
            } catch (e) {
                // ignore
            }
        });

        // determine primary axis id (default 'y')
        const primaryAxisId = axis.primaryAxisId || 'y';

        // collect axisIds referenced (include main 'y' always)
        const axisIds = new Set<string>();
        axisIds.add(primaryAxisId);
        Object.keys(seriesAxisMap).forEach(k => {
            const def = seriesAxisMap[k];
            if (typeof def === 'string') {
                 axisIds.add(def);
            } else if (def && def.axisId) {
                 axisIds.add(def.axisId);
            }
        });
        Object.keys(axisDefs).forEach(a => axisIds.add(a));

        // Build scales for each axis id
        axisIds.forEach(aid => {
            const perAxis = axisDefs[aid] || {};

            // prefer explicit position in per-axis config, otherwise use series map or defaults
            let pos = perAxis.position || ((aid === 'y') ? 'left' : 'right');
            const mapKeys = Object.keys(seriesAxisMap);
            const keyForAxis = mapKeys.find(k => seriesAxisMap[k]?.axisId === aid);
            if (keyForAxis && seriesAxisMap[keyForAxis].position) {
                pos = seriesAxisMap[keyForAxis].position;
            }

            const stacked = (perAxis.stacked !== undefined) ? perAxis.stacked : !!this.config.appearance?.stacked;
            
            // Grid logic: support gridDrawOnChartArea (flat) or grid.drawOnChartArea
            let drawOnChartArea = (aid === primaryAxisId);
            if (perAxis.gridDrawOnChartArea !== undefined) {
                drawOnChartArea = perAxis.gridDrawOnChartArea;
            } else if (perAxis.grid && perAxis.grid.drawOnChartArea !== undefined) {
                drawOnChartArea = perAxis.grid.drawOnChartArea;
            }

            const grid = { ...(perAxis.grid || {}), drawOnChartArea };

            options.scales[aid] = {
                type: perAxis.type || 'linear',
                display: perAxis.display !== false,
                position: pos,
                stacked: stacked,
                grid: grid,
                ticks: {
                    callback: (value: any) => {
                        if (typeof value === 'number') return this.enNumberFormat.format(value);
                        return value;
                    }
                },
                title: perAxis.unit ? { display: true, text: perAxis.unit } : undefined
            };
        });

        // Pre-calculate max values per axis and group by unit for synchronization
        const axisRawMax = new Map<string, number>();
        const unitGroups: { [unit: string]: string[] } = {};

        axisIds.forEach(aid => {
            const perAxis = axisDefs[aid] || {};
            if (perAxis.unit) {
                if (!unitGroups[perAxis.unit]) unitGroups[perAxis.unit] = [];
                unitGroups[perAxis.unit].push(aid);
            }

            let m = 0;
            datasets.forEach(ds => {
                const target = ds.yAxisID || 'y';
                if (target !== aid) return;
                const d = ds._rawData || ds.data; 
                if (Array.isArray(d)) {
                    d.forEach((v: number) => {
                        if (typeof v === 'number' && !isNaN(v)) m = Math.max(m, v);
                    });
                }
            });
            axisRawMax.set(aid, m);
        });

        // For each axis, compute headroom, scaling and ticks
        axisIds.forEach(aid => {
            const perAxis = axisDefs[aid] || {};

            // Local max for this axis
            const rawMax = axisRawMax.get(aid) || 0;
            // determine hasData: true if rawMax > 0 OR if any dataset assigned to this axis has >0 items (even if all zeros?)
            // Actually rawMax > 0 is good enough to know if we need to scale up. 
            // If all zeros, max is 0, automatic chart handling is fine.
            const hasData = rawMax > 0 || (datasets.some(ds => (ds.yAxisID || 'y') === aid && ds.data && ds.data.length > 0));

            // Determine headroom
            // Default headroom to 0.2 if not specified to ensure auto-scaling looks good (user requirement)
            const headroom = (perAxis.headroomMultiplier !== undefined) ? perAxis.headroomMultiplier : (axis.headroomMultiplier !== undefined ? axis.headroomMultiplier : 0.2);

            // Auto-scaling (Visual Fit - 'plotScale') logic
            // Use primaryAxisId raw max for comparison
            const primaryRawMax = axisRawMax.get(primaryAxisId) || 0;
            const perAxisAuto = (perAxis.autoScale !== undefined) ? perAxis.autoScale : axis.autoScale;
            let plotScale = (perAxis.plotScale !== undefined) ? perAxis.plotScale : 1;
            
            if (perAxisAuto && aid !== primaryAxisId && rawMax > 0 && primaryRawMax > 0) {
                plotScale = primaryRawMax / rawMax;
            }

            // Apply plotScale to datasets
            datasets.forEach(ds => {
                const target = ds.yAxisID || 'y';
                if (target !== aid) return;
                if (!ds._rawData) ds._rawData = Array.isArray(ds.data) ? ds.data.slice() : [];
                if (plotScale !== 1) {
                    ds.data = ds._rawData.map((v: any) => (typeof v === 'number' ? v * plotScale : v));
                } else if (ds._rawData && ds._rawData.length > 0) {
                    // restore
                    ds.data = ds._rawData.slice();
                }
            });

            // Synchronized Max Logic
            let effectiveMax = rawMax;
            if (perAxis.unit && unitGroups[perAxis.unit].length > 1) {
                unitGroups[perAxis.unit].forEach(otherAid => {
                    effectiveMax = Math.max(effectiveMax, axisRawMax.get(otherAid) || 0);
                });
            }

            // Resolve max value
            const explicitMax = (perAxis.max !== undefined) ? perAxis.max : (
                (axis.max !== undefined && (aid === primaryAxisId || hasData)) ? axis.max : undefined
            );

            if (explicitMax !== undefined) {
                 options.scales[aid].max = explicitMax;
            } else if (headroom && effectiveMax > 0) {
                // If plotScale was used (visual fit), we typically rely on primary axis scale or let chart handle it.
                // If plotScale is 1 (normal scaling), we apply our sync/headroom logic.
                if (plotScale === 1) {
                    const calculatedMax = Math.ceil(effectiveMax * (1 + headroom));
                    // use suggestedMax so Chart.js can pick nice round numbers
                    options.scales[aid].suggestedMax = calculatedMax;
                }
            }

            const forceZeroMin = (perAxis.forceZeroMin !== undefined) ? perAxis.forceZeroMin : axis.forceZeroMin;
            if (forceZeroMin) {
                options.scales[aid].beginAtZero = true;
                if (options.scales[aid].min === undefined) options.scales[aid].min = (perAxis.min !== undefined) ? perAxis.min : 0;
            }

            const step = (perAxis.step !== undefined) ? perAxis.step : axis.step;
            if (step) {
                options.scales[aid].ticks = options.scales[aid].ticks || {};
                options.scales[aid].ticks.stepSize = step;
            }

            const desiredTicks = (perAxis.desiredTicks !== undefined) ? perAxis.desiredTicks : axis.desiredTicks;
            if (desiredTicks) {
                options.scales[aid].ticks = options.scales[aid].ticks || {};
                options.scales[aid].ticks.maxTicksLimit = desiredTicks;
            }
        });
    }

    private resolveColor(key: string, index: number): string {
        const map = this.config.appearance?.colorMap;
        const colors = this.config.appearance?.colors || this.defaultColors;

        if (map && map[key]) {
            return this.tagBg2Map[map[key]] || map[key];
        }
        if (index < 0) return colors[0];
        return colors[index % colors.length];
    }
    
    public get formattedLoadTime(): string | null {
        if (this.loadingTime === undefined || this.loadingTime === null) return null;
        if (this.loadingTime < 0) return 'خطأ';
        // show with 2 decimals for <1s, otherwise 1 decimal
        if (this.loadingTime < 1) return `${this.loadingTime.toFixed(2)}s`;
        return `${this.loadingTime.toFixed(1)}s`;
    }

    toggleDataTable() {
        this.showDataTable = !this.showDataTable;
    }

    public get tableHeaders(): string[] {
        try {
            const rows = this.config?.data?.rows || [];
            if (!rows || rows.length === 0) return [];
            return Object.keys(rows[0]);
        } catch (e) {
            return [];
        }
    }

    public get tableRows(): any[] {
        const rows = this.config?.data?.rows || [];
        // limit to 50 rows to avoid huge renders
        return Array.isArray(rows) ? rows.slice(0, 50) : [];
    }

    formatCell(value: any): string {
        if (value === null || value === undefined) return '';
        if (typeof value === 'number') return value.toLocaleString();
        return String(value);
    }

    public get totalRowsCount(): number {
        try {
            const rows = this.config && this.config.data && this.config.data.rows;
            return Array.isArray(rows) ? rows.length : 0;
        } catch (e) {
            return 0;
        }
    }

    public get axisSeriesMappings(): Array<{ axisId: string; position: string; series: string[] }> {
        const map = this.getSafeSeriesAxisMap();
        const grouped: { [axisId: string]: { axisId: string; position: string; series: string[] } } = {};

        Object.keys(map).forEach(seriesName => {
            const def = map[seriesName] || {};
            const axisId = def.axisId || 'y';
            const position = def.position || (axisId === 'y' ? 'left' : 'right');
            if (!grouped[axisId]) grouped[axisId] = { axisId, position, series: [] };
            grouped[axisId].series.push(seriesName);
        });

        return Object.keys(grouped).map(k => grouped[k]);
    }
        // onChartClick to emit? 
    onChartClick(event: any) {
        // PrimeNG sends { originalEvent, element, dataset }
        // Attempt to resolve label/value/dataset info
        let label: any = null;
        let value: any = null;
        let datasetLabel: any = null;

        if (event.dataset && event.dataset.length > 0) {
            const index = event.element.index;
            const datasetIndex = event.dataset[index].datasetIndex;

            if (this.chartData && this.chartData.labels) {
                label = this.chartData.labels[index];
            }

            if (this.chartData && this.chartData.datasets && this.chartData.datasets[datasetIndex]) {
                value = this.chartData.datasets[datasetIndex].data[index];
                datasetLabel = this.chartData.datasets[datasetIndex].label;
            }
        }
        
        this.chartClick.emit({ originalEvent: event, label, value, datasetLabel, config: this.config });
    }
}
