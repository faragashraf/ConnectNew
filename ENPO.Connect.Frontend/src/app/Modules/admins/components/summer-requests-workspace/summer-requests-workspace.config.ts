export interface SummerWaveDefinition {
  code: string;
  startsAtLabel: string;
}

export interface SummerStayModeDefinition {
  code: 'RESIDENCE_ONLY' | 'RESIDENCE_WITH_TRANSPORT';
  label: string;
}

export interface SummerApartmentDefinition {
  familyCount: number;
  apartments: number;
}

export interface SummerDestinationConfig {
  categoryId: number;
  slug: 'MATROUH' | 'RAS_EL_BAR' | 'PORT_FOUAD';
  name: string;
  stayModes: SummerStayModeDefinition[];
  familyOptions: number[];
  maxExtraMembers: number;
  apartments: SummerApartmentDefinition[];
  waves: SummerWaveDefinition[];
}

const sharedPdfWaves: SummerWaveDefinition[] = [
  { code: 'W01', startsAtLabel: 'الفوج الأول - الأحد 7/6/2026' },
  { code: 'W02', startsAtLabel: 'الفوج الثاني - الأحد 11/6/2026' },
  { code: 'W03', startsAtLabel: 'الفوج الثالث - الأحد 21/6/2026' },
  { code: 'W04', startsAtLabel: 'الفوج الرابع - الأحد 22/6/2026' },
  { code: 'W05', startsAtLabel: 'الفوج الخامس - الأحد 5/7/2026' },
  { code: 'W06', startsAtLabel: 'الفوج السادس - الأحد 12/7/2026' },
  { code: 'W07', startsAtLabel: 'الفوج السابع - الأحد 11/7/2026' },
  { code: 'W08', startsAtLabel: 'الفوج الثامن - الأحد 26/7/2026' },
  { code: 'W09', startsAtLabel: 'الفوج التاسع - الأحد 2/2/2026' },
  { code: 'W10', startsAtLabel: 'الفوج العاشر - الأحد 1/2/2026' },
  { code: 'W11', startsAtLabel: 'الفوج الحادي عشر - الأحد 16/2/2026' },
  { code: 'W12', startsAtLabel: 'الفوج الثاني عشر - الأحد 22/2/2026' },
  { code: 'W13', startsAtLabel: 'الفوج الثالث عشر - الأحد 20/2/2026' },
  { code: 'W14', startsAtLabel: 'الفوج الرابع عشر - الأحد 6/1/2026' },
  { code: 'W15', startsAtLabel: 'الفوج الخامس عشر - الأحد 12/1/2026' },
  { code: 'W16', startsAtLabel: 'الفوج السادس عشر - الأحد 20/1/2026' }
];

const matrouhPdfWaves: SummerWaveDefinition[] = [
  { code: 'W01', startsAtLabel: 'الفوج الأول - الخميس 1/6/2026' },
  { code: 'W02', startsAtLabel: 'الفوج الثاني - الخميس 11/6/2026' },
  { code: 'W03', startsAtLabel: 'الفوج الثالث - الخميس 12/6/2026' },
  { code: 'W04', startsAtLabel: 'الفوج الرابع - الخميس 25/6/2026' },
  { code: 'W05', startsAtLabel: 'الفوج الخامس - الخميس 2/7/2026' },
  { code: 'W06', startsAtLabel: 'الفوج السادس - الخميس 1/7/2026' },
  { code: 'W07', startsAtLabel: 'الفوج السابع - الخميس 16/7/2026' },
  { code: 'W08', startsAtLabel: 'الفوج الثامن - الخميس 22/7/2026' },
  { code: 'W09', startsAtLabel: 'الفوج التاسع - الخميس 20/7/2026' },
  { code: 'W10', startsAtLabel: 'الفوج العاشر - الخميس 6/2/2026' },
  { code: 'W11', startsAtLabel: 'الفوج الحادي عشر - الخميس 12/2/2026' },
  { code: 'W12', startsAtLabel: 'الفوج الثاني عشر - الخميس 20/2/2026' },
  { code: 'W13', startsAtLabel: 'الفوج الثالث عشر - الخميس 27/2/2026' },
  { code: 'W14', startsAtLabel: 'الفوج الرابع عشر - الخميس 2/1/2026' },
  { code: 'W15', startsAtLabel: 'الفوج الخامس عشر - الخميس 10/1/2026' },
  { code: 'W16', startsAtLabel: 'الفوج السادس عشر - الخميس 17/1/2026' }
];

export const SUMMER_DESTINATIONS_2026: SummerDestinationConfig[] = [
  {
    categoryId: 147,
    slug: 'MATROUH',
    name: 'مرسى مطروح',
    stayModes: [
      { code: 'RESIDENCE_ONLY', label: 'إقامة فقط' },
      { code: 'RESIDENCE_WITH_TRANSPORT', label: 'إقامة وانتقالات' }
    ],
    familyOptions: [5, 6, 8, 9],
    maxExtraMembers: 2,
    apartments: [
      { familyCount: 5, apartments: 5 },
      { familyCount: 6, apartments: 5 },
      { familyCount: 8, apartments: 8 },
      { familyCount: 9, apartments: 5 }
    ],
    waves: matrouhPdfWaves
  },
  {
    categoryId: 148,
    slug: 'RAS_EL_BAR',
    name: 'رأس البر',
    stayModes: [
      { code: 'RESIDENCE_WITH_TRANSPORT', label: 'إقامة وانتقالات (إجباري)' }
    ],
    familyOptions: [2, 4, 6],
    maxExtraMembers: 1,
    apartments: [
      { familyCount: 2, apartments: 2 },
      { familyCount: 4, apartments: 6 },
      { familyCount: 6, apartments: 2 }
    ],
    waves: sharedPdfWaves
  },
  {
    categoryId: 149,
    slug: 'PORT_FOUAD',
    name: 'بور فؤاد',
    stayModes: [
      { code: 'RESIDENCE_ONLY', label: 'إقامة فقط' },
      { code: 'RESIDENCE_WITH_TRANSPORT', label: 'إقامة وانتقالات' }
    ],
    familyOptions: [4, 6, 7],
    maxExtraMembers: 2,
    apartments: [
      { familyCount: 4, apartments: 24 },
      { familyCount: 6, apartments: 23 },
      { familyCount: 7, apartments: 24 }
    ],
    waves: sharedPdfWaves
  }
];

export const SUMMER_SEASON_YEAR = 2026;
export const SUMMER_PDF_REFERENCE_TITLE = 'مواعيد الافواج موسم صيف 2026.pdf';
