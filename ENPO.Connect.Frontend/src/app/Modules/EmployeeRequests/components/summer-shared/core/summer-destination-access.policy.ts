import { SummerDestinationConfig } from '../../summer-requests-workspace/summer-requests-workspace.config';

export const SUMMER_DESTINATION_ACCESS_DENIED_MESSAGE = 'غير مسموح لك بالتسجيل على هذا المصيف';

const SUMMER_DESTINATION_IDS = {
  MATROUH: 147,
  RAS_EL_BAR: 148,
  PORT_FOUAD: 149
} as const;

type DestinationAccessKey = 'MATROUH' | 'RAS_EL_BAR' | 'PORT_FOUAD' | 'OTHER';

function normalizeArabicLookup(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .toLowerCase();
}

function normalizeLatinLookup(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function resolveDestinationAccessKey(
  destination: Pick<SummerDestinationConfig, 'categoryId' | 'slug' | 'name'> | null | undefined
): DestinationAccessKey {
  const categoryId = Number(destination?.categoryId ?? 0);
  if (categoryId === SUMMER_DESTINATION_IDS.MATROUH) {
    return 'MATROUH';
  }

  if (categoryId === SUMMER_DESTINATION_IDS.RAS_EL_BAR) {
    return 'RAS_EL_BAR';
  }

  if (categoryId === SUMMER_DESTINATION_IDS.PORT_FOUAD) {
    return 'PORT_FOUAD';
  }

  const normalizedSlug = normalizeLatinLookup(destination?.slug);
  if (normalizedSlug === 'MATROUH' || normalizedSlug === 'MERSAMATROUH' || normalizedSlug === 'MERSAMATROH') {
    return 'MATROUH';
  }

  if (normalizedSlug === 'RASELBAR') {
    return 'RAS_EL_BAR';
  }

  if (normalizedSlug === 'PORTFOUAD') {
    return 'PORT_FOUAD';
  }

  const normalizedName = normalizeArabicLookup(destination?.name);
  if (normalizedName.includes('مرسي مطروح')) {
    return 'MATROUH';
  }

  if (normalizedName.includes('راس البر')) {
    return 'RAS_EL_BAR';
  }

  if (normalizedName.includes('بور فواد')) {
    return 'PORT_FOUAD';
  }

  return 'OTHER';
}

export function isSummerDestinationAdminOnly(
  destination: Pick<SummerDestinationConfig, 'categoryId' | 'slug' | 'name'> | null | undefined
): boolean {
  const key = resolveDestinationAccessKey(destination);
  return key === 'MATROUH' || key === 'RAS_EL_BAR';
}

export function canRegisterForSummerDestination(
  destination: Pick<SummerDestinationConfig, 'categoryId' | 'slug' | 'name'> | null | undefined,
  hasSummerAdminPermission: boolean
): boolean {
  if (!destination) {
    return false;
  }

  if (isSummerDestinationAdminOnly(destination)) {
    return hasSummerAdminPermission;
  }

  return true;
}

export function filterSummerDestinationsForBooking(
  destinations: SummerDestinationConfig[] | null | undefined,
  hasSummerAdminPermission: boolean
): SummerDestinationConfig[] {
  if (!Array.isArray(destinations) || destinations.length === 0) {
    return [];
  }

  return destinations.filter(destination => canRegisterForSummerDestination(destination, hasSummerAdminPermission));
}
