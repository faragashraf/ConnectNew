export const SUMMER_COMPANION_NAME_MIN_PARTS = 3;

function splitNameParts(value: string): string[] {
  return value
    .split(' ')
    .map(part => part.trim())
    .filter(part => part.length > 0);
}

export function normalizeSummerCompanionName(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return '';
  }

  return splitNameParts(raw).join(' ');
}

export function countSummerCompanionNameParts(value: unknown): number {
  const normalized = normalizeSummerCompanionName(value);
  if (!normalized) {
    return 0;
  }

  return splitNameParts(normalized).length;
}

export function isValidSummerCompanionName(value: unknown): boolean {
  return countSummerCompanionNameParts(value) >= SUMMER_COMPANION_NAME_MIN_PARTS;
}
