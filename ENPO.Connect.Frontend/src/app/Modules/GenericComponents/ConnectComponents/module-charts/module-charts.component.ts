import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, interval, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ChartConfig } from 'src/app/Modules/GenericComponents/models/chart-config';
import { ChartConfigAdminService } from 'src/app/Modules/admins/services/chart-config-admin.service';
import { ComponentConfigService } from 'src/app/Modules/admins/services/component-config.service';
import { PowerBiController } from 'src/app/Modules/enpopower-bi/services/PowerBi.service';
import { ComponentConfig, getConfigByRoute, processRequestsAndPopulate, routeKey } from 'src/app/shared/models/Component.Config.model';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';
import { ChartDataService } from 'src/app/shared/services/chart-data.service';
import { GenericFormsService } from '../../GenericForms.service';

@Component({
    selector: 'app-module-charts',
    templateUrl: './module-charts.component.html',
    styleUrls: ['./module-charts.component.scss']
})
export class ModuleChartsComponent implements OnInit, OnDestroy {

    @Input() moduleName: string = 'AdminCertificates';
    configs: ChartConfig[] = [];
    config: ComponentConfig = {} as ComponentConfig;
    loading: boolean = true;

    // Loading management maps
    loadingMap = new Map<string, boolean>();
    loadedMap = new Map<string, boolean>();
    errorMap = new Map<string, string | null>();
    visibleMap = new Map<string, boolean>();
    // measured load time in seconds for each chart key
    loadingTimeMap = new Map<string, number>();
    private destroy$ = new Subject<void>();
    private autoRefreshSub: Subscription | null = null;
    autoRefreshSelection = 0; // milliseconds: 0 => off
    autoRefreshOptions = [
        { label: 'Off', value: 0 },
        { label: 'Every 30 seconds', value: 30 * 1000 },
        { label: 'Every 1 minute', value: 60 * 1000 }, 
        { label: 'Every 3 minutes', value: 3 * 60 * 1000 },
        { label: 'Every 5 minutes', value: 5 * 60 * 1000 },
        { label: 'Every 10 minutes', value: 10 * 60 * 1000 },
        { label: 'Every 15 minutes', value: 15 * 60 * 1000 },
        { label: 'Every 30 minutes', value: 30 * 60 * 1000 }
    ];

    detailsData: any[] = [];
    detailsCols: any[] = [];
    detailsColumnsFields: string[] = [];
    detailsTabs: any[] = [];
    activeTabIndex: number = 0;
    showDetails: boolean = false;
    detailsTitle: string = 'Details';
    detailsRows: number = 5;
    rowsPerPageOptions: number[] = [5, 10, 20, 50];
    totalRecords: number = 0;

    constructor(
        private chartService: ChartConfigAdminService, 
        public router: Router,
        private spinner: SpinnerService, 
        private powerBiController: PowerBiController, 
        private appConfigService: ComponentConfigService, 
        public genericFormService: GenericFormsService,
        private chartDataService: ChartDataService
    ) {
        const _route = routeKey(this.router.url);
        this.appConfigService.getAll().subscribe(items => {
            const cfg = getConfigByRoute(_route, items || []);
            if (!cfg) return;
            this.config = cfg;
            processRequestsAndPopulate(this, this.genericFormService, spinner).subscribe({
                next: () => {
                },
                complete: () => {
                    this.loadCharts();
                }
            });
        });
    }
    
    ngOnInit(): void {
        this.loading = true;
        if (!this.moduleName) {
            this.loading = false;
            return;
        }
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    loadCharts() {
        this.loading = true;
        this.chartService.getChartsByModule(this.config.genericFormName as string).subscribe({
            next: (data: any) => {
                let result: ChartConfig[] = [];
                if (data && Array.isArray(data.charts)) {
                    result = data.charts;
                } else if (data && Array.isArray(data.data)) {
                    result = data.data;
                } else if (Array.isArray(data)) {
                    result = data;
                }

                // Initial processing of configs - set rows to empty initially
                result.forEach(config => {
                    if (!config.data) {
                        config.data = { rows: [] };
                    } else {
                        // Clear rows to support lazy loading
                        config.data.rows = [];
                    }

                    // Reset maps
                    const key = this.chartKey(config);
                    this.loadingMap.set(key, false);
                    this.loadedMap.set(key, false);
                    this.errorMap.set(key, null);
                });

                this.configs = result.filter(c => c.enabled !== false);
                this.loading = false;
            },
            error: (err) => {
                console.error(err);
                this.loading = false;
            }
        });
    }

    chartKey(config: ChartConfig): string {
        return config.key || `${this.moduleName}-${config.definition.queryId}-${config.title}`;
    }

    loadChartData(config: ChartConfig) {
        const key = this.chartKey(config);

        // Guard: return if already loaded or loading
        if (this.loadedMap.get(key) || this.loadingMap.get(key)) {
            return;
        }

        // mark visible (in-viewport or user-initiated)
        this.visibleMap.set(key, true);

        this.loadingMap.set(key, true);
        this.errorMap.set(key, null);
        const queryId = config.definition.queryId || 0;
        const params = config.definition.queryParams;

        const start = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

        this.chartDataService.fetchChartData(queryId, params, key)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (rows) => {
                    const elapsed = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - start;
                    this.loadingTimeMap.set(key, Math.round((elapsed / 1000) * 100) / 100); // seconds, 2 decimals
                    // Normalization logic
                    if (config.labels) {
                        const labelToKeyMap = new Map<string, string>();
                        Object.keys(config.labels).forEach(k => {
                            const label = config.labels![k];
                            if (label) labelToKeyMap.set(label, k);
                        });

                        rows = rows.map(row => {
                            const newRow: any = {};
                            Object.keys(row).forEach(rowKey => {
                                const defKey = labelToKeyMap.get(rowKey) || rowKey;
                                newRow[defKey] = row[rowKey];
                            });
                            return newRow;
                        });
                    }

                    // assign a fresh data object to avoid 'possibly undefined' typing issues
                    config.data = { rows: rows } as any;
                    this.loadedMap.set(key, true);
                    this.loadingMap.set(key, false);
                },
                error: (err) => {
                    console.error(`Error loading chart ${key}`, err);
                    this.loadingTimeMap.set(key, -1);
                    this.errorMap.set(key, err.message || 'Failed to load data');
                    this.loadingMap.set(key, false);
                }
            });
    }

    handleRetry(config: ChartConfig) {
        const key = this.chartKey(config);
        this.loadedMap.set(key, false);
        this.loadingMap.set(key, false);
        this.errorMap.set(key, null);
        this.loadChartData(config);
    }

    refreshChart(config: ChartConfig) {
        const key = this.chartKey(config);
        // clear cache for this chart and reload
        this.chartDataService.clearCache(key);
        this.loadedMap.set(key, false);
        this.loadingMap.set(key, false);
        this.loadingTimeMap.delete(key);
        this.loadChartData(config);
    }

    refreshAll() {
        // Clear all cached entries then reload visible or previously loaded charts
        this.chartDataService.clearCache();
        this.configs.forEach(cfg => {
            const key = this.chartKey(cfg);
            if (this.visibleMap.get(key) || this.loadedMap.get(key)) {
                this.loadedMap.set(key, false);
                this.loadingMap.set(key, false);
                this.loadingTimeMap.delete(key);
                this.loadChartData(cfg);
            }
        });
    }

    onAutoRefreshChange(ms: number) {
        this.autoRefreshSelection = ms;
        if (this.autoRefreshSub) {
            this.autoRefreshSub.unsubscribe();
            this.autoRefreshSub = null;
        }
        if (ms && ms > 0) {
            this.autoRefreshSub = interval(ms).pipe(takeUntil(this.destroy$)).subscribe(() => {
                this.refreshAll();
            });
        }
    }
    

    handleChartClick(event: any, config: ChartConfig) {
        if (!event ) return;

        const def = config.definition;
        const sectorField = Array.isArray(def.sectorField) ? def.sectorField[0] : def.seriesField;
        
        const columnName = sectorField; 
        const columnsValue = event.label;

        if (!columnName) {
            console.warn('Could not determine column name for drilldown');
            return;
        }

        this.detailsTitle = `${columnsValue}`;
        const paramStr = `${columnName}|${columnsValue}`;
        
        this.spinner.show();
        this.powerBiController.getGenericDataById(32, paramStr).subscribe({
            next: (res) => {
                this.spinner.hide();
                if (res.isSuccess && res.data) {
                    const data = res.data || [];
                    const cols = data.length > 0 ? Object.keys(data[0]).map((key: any) => ({ field: key, header: key })) : [];
                    const fields = cols.map((c: any) => c.field);

                    const tab = {
                        id: new Date().getTime(),
                        title: this.detailsTitle,
                        data: data,
                        cols: cols,
                        fields: fields,
                        totalRecords: data.length || 0
                    };

                    const existingIdx = this.detailsTabs.findIndex((t: any) => t.title === tab.title);
                    if (existingIdx >= 0) {
                        this.detailsTabs[existingIdx] = tab;
                        // activate the existing tab (Charts is index 0)
                        this.activeTabIndex = existingIdx + 1;
                    } else {
                        this.detailsTabs.push(tab);
                        // Activate the newly added tab. Charts is index 0, details start at 1.
                        this.activeTabIndex = this.detailsTabs.length;
                        this.showDetails = true;
                    }
                } else {
                    console.error(res.errors);
                }
            },
            error: (err) => {
                this.spinner.hide();
                console.error(err);
            }
        });
    }

    closeDetails() {
        // remove all detail tabs and reset state
        this.detailsTabs = [];
        this.showDetails = false;
        this.activeTabIndex = 0;
        this.detailsData = [];
        this.detailsTitle = 'Details';
        this.totalRecords = 0;
        this.detailsColumnsFields = [];
    }

    onDetailsPageChange(e: any) {
        // placeholder for server-side paging if needed later
        console.debug('details page change', e);
    }

    closeTab(event: any) {
        // PrimeNG TabView onClose passes { originalEvent, index }
        const idx = event && event.index !== undefined ? event.index : null;
        if (idx === null) return;
        // index 0 is Charts panel; detail tabs start at 1
        if (idx === 0) return;
        const tabIdx = idx - 1;
        if (tabIdx >= 0 && tabIdx < this.detailsTabs.length) {
            this.detailsTabs.splice(tabIdx, 1);
            // adjust active index: if removed last tab, move back to Charts
            if (this.detailsTabs.length === 0) {
                this.activeTabIndex = 0;
            } else {
                this.activeTabIndex = Math.min(this.activeTabIndex, this.detailsTabs.length);
            }
        }
    }

}
