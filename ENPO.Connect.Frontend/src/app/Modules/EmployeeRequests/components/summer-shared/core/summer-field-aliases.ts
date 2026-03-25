export type SummerFieldAliasMap = {
  waveCode: string[];
  waveLabel: string[];
  stayMode: string[];
  familyCount: string[];
  extraCount: string[];
  proxyMode: string[];
  ownerName: string[];
  ownerFileNumber: string[];
  ownerNationalId: string[];
  ownerPhone: string[];
  ownerExtraPhone: string[];
  notes: string[];
  companionName: string[];
  companionRelation: string[];
  companionRelationOther: string[];
  companionNationalId: string[];
  companionAge: string[];
  seasonYear: string[];
  destinationId: string[];
  destinationName: string[];
};

export const SUMMER_CANONICAL_FIELD_KEYS = {
  waveCode: ['SummerCamp', 'SUM2026_WaveCode', 'WaveCode'],
  waveLabel: ['SummerCampLabel', 'SUM2026_WaveLabel', 'WaveLabel'],
  familyCount: ['FamilyCount', 'SUM2026_FamilyCount'],
  extraCount: ['Over_Count', 'SUM2026_ExtraCount', 'ExtraCount'],
  destinationId: ['SummerDestinationId', 'SUM2026_DestinationId'],
  destinationName: ['SummerDestinationName', 'SUM2026_DestinationName'],
  companionName: ['SUM2026_CompanionName', 'FamilyMember_Name', 'CompanionName'],
  companionRelation: ['SUM2026_CompanionRelation', 'FamilyRelation', 'CompanionRelation'],
  companionRelationOther: ['SUM2026_CompanionRelationOther', 'FamilyRelationOther', 'CompanionRelationOther'],
  companionNationalId: ['SUM2026_CompanionNationalId', 'FamilyMember_NationalId', 'CompanionNationalId'],
  companionAge: ['SUM2026_CompanionAge', 'FamilyMember_Age', 'CompanionAge'],
  notes: ['Description', 'SUM2026_Notes']
} as const;

const SUMMER_DEFAULT_FIELD_ALIASES: SummerFieldAliasMap = {
  waveCode: ['SummerCamp', 'WaveCode'],
  waveLabel: ['SummerCampLabel', 'WaveLabel'],
  stayMode: ['SummerStayMode', 'StayMode'],
  familyCount: ['FamilyCount'],
  extraCount: ['Over_Count', 'ExtraCount'],
  proxyMode: ['SummerProxyMode', 'ProxyMode'],
  ownerName: ['Emp_Name', 'EmployeeName', 'EmpName', 'OwnerName'],
  ownerFileNumber: ['Emp_Id', 'EmployeeFileNumber', 'FileNumber'],
  ownerNationalId: ['NationalId', 'EmployeeNationalId', 'National_ID'],
  ownerPhone: ['PhoneNumber', 'Phone', 'MobileNumber', 'Mobile', 'PhoneWhats'],
  ownerExtraPhone: ['ExtraPhoneNumber', 'SecondaryPhone', 'AlternatePhone'],
  notes: ['Description', 'Notes'],
  companionName: [...SUMMER_CANONICAL_FIELD_KEYS.companionName],
  companionRelation: [...SUMMER_CANONICAL_FIELD_KEYS.companionRelation],
  companionRelationOther: [...SUMMER_CANONICAL_FIELD_KEYS.companionRelationOther],
  companionNationalId: [...SUMMER_CANONICAL_FIELD_KEYS.companionNationalId],
  companionAge: [...SUMMER_CANONICAL_FIELD_KEYS.companionAge],
  seasonYear: ['SummerSeasonYear'],
  destinationId: ['SummerDestinationId'],
  destinationName: ['SummerDestinationName']
};

export function createDefaultSummerFieldAliases(): SummerFieldAliasMap {
  return {
    waveCode: [...SUMMER_DEFAULT_FIELD_ALIASES.waveCode],
    waveLabel: [...SUMMER_DEFAULT_FIELD_ALIASES.waveLabel],
    stayMode: [...SUMMER_DEFAULT_FIELD_ALIASES.stayMode],
    familyCount: [...SUMMER_DEFAULT_FIELD_ALIASES.familyCount],
    extraCount: [...SUMMER_DEFAULT_FIELD_ALIASES.extraCount],
    proxyMode: [...SUMMER_DEFAULT_FIELD_ALIASES.proxyMode],
    ownerName: [...SUMMER_DEFAULT_FIELD_ALIASES.ownerName],
    ownerFileNumber: [...SUMMER_DEFAULT_FIELD_ALIASES.ownerFileNumber],
    ownerNationalId: [...SUMMER_DEFAULT_FIELD_ALIASES.ownerNationalId],
    ownerPhone: [...SUMMER_DEFAULT_FIELD_ALIASES.ownerPhone],
    ownerExtraPhone: [...SUMMER_DEFAULT_FIELD_ALIASES.ownerExtraPhone],
    notes: [...SUMMER_DEFAULT_FIELD_ALIASES.notes],
    companionName: [...SUMMER_DEFAULT_FIELD_ALIASES.companionName],
    companionRelation: [...SUMMER_DEFAULT_FIELD_ALIASES.companionRelation],
    companionRelationOther: [...SUMMER_DEFAULT_FIELD_ALIASES.companionRelationOther],
    companionNationalId: [...SUMMER_DEFAULT_FIELD_ALIASES.companionNationalId],
    companionAge: [...SUMMER_DEFAULT_FIELD_ALIASES.companionAge],
    seasonYear: [...SUMMER_DEFAULT_FIELD_ALIASES.seasonYear],
    destinationId: [...SUMMER_DEFAULT_FIELD_ALIASES.destinationId],
    destinationName: [...SUMMER_DEFAULT_FIELD_ALIASES.destinationName]
  };
}
