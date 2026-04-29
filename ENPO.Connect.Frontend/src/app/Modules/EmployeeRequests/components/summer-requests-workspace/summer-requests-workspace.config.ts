import {
  SUMMER_DEFAULT_SEASON_YEAR,
  SUMMER_PDF_REFERENCE_TITLE_DEFAULT
} from '../summer-shared/core/summer-feature.config';

export interface SummerWaveDefinition {
  code: string;
  startsAtLabel: string;
  startsAtIso?: string;
}

export interface SummerStayModeDefinition {
  code: string;
  label: string;
}

export interface SummerApartmentDefinition {
  familyCount: number;
  apartments: number;
}

export interface SummerDestinationConfig {
  categoryId: number;
  slug: string;
  name: string;
  stayModes: SummerStayModeDefinition[];
  familyOptions: number[];
  maxExtraMembers: number;
  apartments: SummerApartmentDefinition[];
  waves: SummerWaveDefinition[];
}

export interface SummerDestinationCatalogPayload {
  seasonYear?: number;
  destinations?: SummerDestinationConfig[];
}

export const SUMMER_SEASON_YEAR = SUMMER_DEFAULT_SEASON_YEAR;
export const SUMMER_PDF_REFERENCE_TITLE = SUMMER_PDF_REFERENCE_TITLE_DEFAULT;

function normalizeWaveOrder(code: string): number {
  const digits = String(code ?? '')
    .trim()
    .replace(/[^0-9]/g, '');
  const parsed = Number(digits);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : Number.MAX_SAFE_INTEGER;
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeArabicLookup(value: string): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .toLowerCase();
}

function normalizeLatinLookup(value: string): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function normalizeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function distinctNumbers(values: number[]): number[] {
  return [...new Set(values.filter(item => Number.isFinite(item) && item > 0))]
    .sort((a, b) => a - b);
}

function resolveMaxExtraMembersOverride(
  categoryId: number,
  slug: string,
  name: string,
  configuredMax: number
): number {
  const normalizedSlug = normalizeText(slug).toUpperCase();
  const normalizedName = normalizeArabicLookup(name);
  const latinSlug = normalizeLatinLookup(slug);
  const latinName = normalizeLatinLookup(name);

  // Business correction: Ras El Bar must allow at most 1 extra member.
  const isRasElBar =
    categoryId === 148
    || normalizedSlug === 'RAS_EL_BAR'
    || latinSlug === 'RASELBAR'
    || latinName === 'RASELBAR'
    || normalizedName.includes('راس البر');

  if (isRasElBar) {
    return 1;
  }

  return configuredMax;
}

export function parseSummerDestinationCatalog(
  rawCatalog: unknown,
  seasonYear: number
): SummerDestinationConfig[] {
  const payload: SummerDestinationCatalogPayload | null = Array.isArray(rawCatalog)
    ? { destinations: rawCatalog as SummerDestinationConfig[] }
    : (rawCatalog && typeof rawCatalog === 'object' ? rawCatalog as SummerDestinationCatalogPayload : null);

  if (!payload) {
    return [];
  }

  const payloadSeasonYear = normalizeNumber(payload.seasonYear, 0);
  if (payloadSeasonYear > 0 && seasonYear > 0 && payloadSeasonYear !== seasonYear) {
    return [];
  }

  const sourceDestinations = Array.isArray(payload.destinations) ? payload.destinations : [];
  const uniqueByCategory = new Map<number, SummerDestinationConfig>();

  sourceDestinations.forEach(item => {
    const categoryId = normalizeNumber(item?.categoryId, 0);
    if (categoryId <= 0) {
      return;
    }

    const apartments = (Array.isArray(item?.apartments) ? item.apartments : [])
      .map(apartment => ({
        familyCount: normalizeNumber(apartment?.familyCount, 0),
        apartments: normalizeNumber(apartment?.apartments, 0)
      }))
      .filter(apartment => apartment.familyCount > 0 && apartment.apartments > 0)
      .sort((a, b) => a.familyCount - b.familyCount);

    const familyOptions = distinctNumbers([
      ...(Array.isArray(item?.familyOptions) ? item.familyOptions : []).map(value => normalizeNumber(value, 0)),
      ...apartments.map(apartment => apartment.familyCount)
    ]);

    const stayModes = (Array.isArray(item?.stayModes) ? item.stayModes : [])
      .map(mode => ({
        code: normalizeText(mode?.code),
        label: normalizeText(mode?.label)
      }))
      .filter(mode => mode.code.length > 0);

    const waves = (Array.isArray(item?.waves) ? item.waves : [])
      .map(wave => ({
        code: normalizeText(wave?.code),
        startsAtLabel: normalizeText(wave?.startsAtLabel),
        startsAtIso: normalizeText(wave?.startsAtIso)
      }))
      .filter(wave => wave.code.length > 0)
      .sort((a, b) => normalizeWaveOrder(a.code) - normalizeWaveOrder(b.code));

    const configuredMaxExtra = Math.max(0, normalizeNumber(item?.maxExtraMembers, 0));
    const maxExtraMembers = resolveMaxExtraMembersOverride(
      categoryId,
      normalizeText(item?.slug),
      normalizeText(item?.name),
      configuredMaxExtra
    );

    uniqueByCategory.set(categoryId, {
      categoryId,
      slug: normalizeText(item?.slug),
      name: normalizeText(item?.name),
      maxExtraMembers,
      stayModes,
      apartments,
      familyOptions,
      waves
    });
  });

  return [...uniqueByCategory.values()].sort((a, b) => a.categoryId - b.categoryId);
}
