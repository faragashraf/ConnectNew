import { environment } from 'src/environments/environment';

type SummerFeatureEnvironmentConfig = {
  seasonYear?: number;
  dynamicApplicationId?: string;
  destinationCatalogKey?: string;
  pdfReferenceTitle?: string;
};

function normalizeSeasonYear(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function normalizeNonEmptyString(value: unknown, fallback: string): string {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text : fallback;
}

const envSummerConfig = (environment as { summerFeature?: SummerFeatureEnvironmentConfig }).summerFeature ?? {};

export const SUMMER_DEFAULT_SEASON_YEAR = normalizeSeasonYear(envSummerConfig.seasonYear, 2026);
export const SUMMER_DYNAMIC_APPLICATION_ID = normalizeNonEmptyString(envSummerConfig.dynamicApplicationId, 'SUM2026DYN');
export const SUMMER_DESTINATION_CATALOG_KEY = normalizeNonEmptyString(envSummerConfig.destinationCatalogKey, 'SUM2026_DestinationCatalog');
export const SUMMER_PDF_REFERENCE_TITLE_DEFAULT = normalizeNonEmptyString(
  envSummerConfig.pdfReferenceTitle,
  `مواعيد الافواج موسم صيف ${SUMMER_DEFAULT_SEASON_YEAR}.pdf`
);

export const SUMMER_FEATURE_ROUTES = {
  workspace: 'SummerRequests',
  workspaceEdit: 'SummerRequests/edit/:id',
  adminConsole: 'SummerRequestsManagement',
  unitFreezeList: 'resorts/unit-freeze',
  unitFreezeCreate: 'resorts/unit-freeze/create',
  unitFreezeDetails: 'resorts/unit-freeze/:id',
  dashboard: 'Chart'
} as const;
