import { TkmendField } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.dto';

export type SummerCompanionFieldRow = {
  index: number;
  name: string;
  relation: string;
  relationOther: string;
  nationalId: string;
  age: string;
};

export function normalizeSummerFieldToken(value: string): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ]/g, '');
}

export function getSummerFieldValueByKeys(
  fields: Array<{ fildKind?: unknown; fildTxt?: unknown }> | undefined,
  keys: string[]
): string {
  if (!fields || fields.length === 0) {
    return '';
  }

  const normalizedKeys = (keys ?? []).map(key => normalizeSummerFieldToken(String(key ?? '')));
  const normalizedFields = fields.map(field => ({
    key: normalizeSummerFieldToken(String(field?.fildKind ?? '')),
    value: String(field?.fildTxt ?? '').trim()
  }));

  for (const key of normalizedKeys) {
    const matched = normalizedFields.find(field => field.key === key && field.value.length > 0);
    if (matched) {
      return matched.value;
    }
  }

  for (const key of normalizedKeys) {
    const matched = normalizedFields.find(field =>
      field.value.length > 0 &&
      (field.key.includes(key) || key.includes(field.key))
    );
    if (matched) {
      return matched.value;
    }
  }

  return '';
}

export function buildSummerCompanionsFromFields(
  fields: TkmendField[] | undefined
): SummerCompanionFieldRow[] {
  const rows = new Map<number, Omit<SummerCompanionFieldRow, 'index'> & { groupId: number }>();

  (fields ?? []).forEach((field, idx) => {
    const fieldKind = String(field?.fildKind ?? '').trim();
    const normalized = normalizeSummerFieldToken(fieldKind);
    if (!isCompanionField(normalized)) {
      return;
    }

    const fallbackGroupId = 10000 + idx;
    const instanceGroupId = Number(field?.instanceGroupId ?? 0);
    const groupId = Number.isFinite(instanceGroupId) && instanceGroupId > 0 ? Math.floor(instanceGroupId) : fallbackGroupId;

    if (!rows.has(groupId)) {
      rows.set(groupId, {
        groupId,
        name: '',
        relation: '',
        relationOther: '',
        nationalId: '',
        age: ''
      });
    }

    const row = rows.get(groupId);
    if (!row) {
      return;
    }

    const value = String(field?.fildTxt ?? '').trim();
    if (isCompanionNameField(normalized)) {
      row.name = value;
      return;
    }
    if (isCompanionRelationField(normalized)) {
      row.relation = value;
      return;
    }
    if (isCompanionRelationOtherField(normalized)) {
      row.relationOther = value;
      return;
    }
    if (isCompanionNationalIdField(normalized)) {
      row.nationalId = value;
      return;
    }
    if (isCompanionAgeField(normalized)) {
      row.age = value;
    }
  });

  return [...rows.values()]
    .sort((a, b) => a.groupId - b.groupId)
    .map((row, index) => ({
      index: index + 1,
      name: row.name,
      relation: row.relation,
      relationOther: row.relationOther,
      nationalId: row.nationalId,
      age: row.age
    }))
    .filter(row =>
      row.name.trim().length > 0 ||
      row.relation.trim().length > 0 ||
      row.relationOther.trim().length > 0 ||
      row.nationalId.trim().length > 0 ||
      row.age.trim().length > 0
    );
}

function isCompanionField(normalizedKey: string): boolean {
  return isCompanionNameField(normalizedKey)
    || isCompanionRelationField(normalizedKey)
    || isCompanionRelationOtherField(normalizedKey)
    || isCompanionNationalIdField(normalizedKey)
    || isCompanionAgeField(normalizedKey);
}

function isCompanionNameField(normalizedKey: string): boolean {
  return normalizedKey.includes('name')
    && (normalizedKey.includes('familymember') || normalizedKey.includes('companion'));
}

function isCompanionRelationField(normalizedKey: string): boolean {
  if (normalizedKey.includes('relationother')) {
    return false;
  }

  return normalizedKey.includes('relation')
    && (normalizedKey.includes('family') || normalizedKey.includes('companion'));
}

function isCompanionRelationOtherField(normalizedKey: string): boolean {
  return normalizedKey.includes('relationother')
    && (normalizedKey.includes('family') || normalizedKey.includes('companion'));
}

function isCompanionNationalIdField(normalizedKey: string): boolean {
  return (normalizedKey.includes('national') || normalizedKey.includes('nid') || normalizedKey.includes('idnumber'))
    && (normalizedKey.includes('familymember') || normalizedKey.includes('companion'));
}

function isCompanionAgeField(normalizedKey: string): boolean {
  return normalizedKey.includes('age')
    && (normalizedKey.includes('familymember') || normalizedKey.includes('companion'));
}
