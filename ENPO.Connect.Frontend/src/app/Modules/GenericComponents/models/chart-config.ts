import { ChartType } from 'chart.js';

export type ChartRowValue = string | number | boolean | null;

export interface ChartConfig {
  key: string;                 // REQUIRED unique stable key
  moduleName: string;          // REQUIRED module grouping
  name?: string;
  title?: string;
  type: ChartType;

  definition: ChartDefinition;
  labels?: Record<string, string>;

  data?: ChartData;            // OPTIONAL for future JSON-only configs

  axis?: ChartAxis;
  layout?: ChartLayout;
  appearance?: ChartAppearance;

  order?: number;
  enabled?: boolean;
  allowStatusChange?: boolean;
}

export interface ChartDefinition {
  queryId?: number;
  queryParams?: Record<string, any> | string;

  sectorField: string | string[];
  seriesField?: string;
  valueField: string | string[];
}

export interface ChartData {
  rows: Array<Record<string, ChartRowValue>>;
}

export interface ChartAxis {
  desiredTicks?: number;
  forceZeroMin?: boolean;
  min?: number;
  max?: number;
  step?: number;
  headroomMultiplier?: number;
  /** Optional primary axis id (defaults to 'y') */
  primaryAxisId?: string;
  /** Per-axis definitions keyed by axis id (e.g. y, y2) */
  axes?: Record<string, any>;
  
  /** Secondary axis specific settings */
  y2?: {
      enabled?: boolean;
      position?: 'left' | 'right';
      desiredTicks?: number;
      headroomMultiplier?: number;
      gridDrawOnChartArea?: boolean;
      unit?: string;
      label?: string;
  };

  /** Map series names (from data) to axis IDs ('y' or 'y2') */
  seriesAxisMap?: Record<string, 'y' | 'y2' | string>;
  
  /** Legacy detailed map support */
  SeriesAxisMap?: {
      [key: string]: {
          axisId: string;
          position: 'left' | 'right';
      }
  };

  /** Heuristic: auto-move small series to y2 if ratio exceeds threshold */
  autoAssignSecondaryAxis?: boolean;
  secondaryAxisHeuristic?: { 
      ratioThreshold: number; 
  };
}

export interface ChartLayout {
  height?: string;
  width?: string;
  minWidth?: number;
}

export interface ChartAppearance {
  stacked?: boolean;
  showDataLabels?: boolean;
  colors?: string[];
  colorMap?: Record<string, string>;
  pie?: {
    labelMode?: 'percent' | 'value' | 'valueAndPercent';
    position?: 'outside' | 'inside';
    minPercentToShow?: number;
    offset?: number;
  };
  legend?: { position?: 'top' | 'left' | 'right' | 'bottom' };
  tooltip?: { enabled?: boolean };
}

