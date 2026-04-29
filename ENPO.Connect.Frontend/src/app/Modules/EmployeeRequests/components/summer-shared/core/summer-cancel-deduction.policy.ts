export type SummerCancelDeductionLookupInput = {
  categoryId?: number | null;
  destinationSlug?: string | null;
  destinationName?: string | null;
};

type SummerCancelDeductionRule = {
  amount: number;
  categoryIds: number[];
  slugs: string[];
  nameTokens: string[];
};

const SUMMER_CANCEL_DEDUCTION_RULES: SummerCancelDeductionRule[] = [
  {
    amount: 300,
    categoryIds: [148, 149],
    slugs: ['RAS_EL_BAR', 'PORT_FOUAD', 'PORT_SAID'],
    nameTokens: ['رأسالبر', 'بورفؤاد', 'بورسعيد', 'raselbar', 'portfouad', 'portsaid']
  },
  {
    amount: 500,
    categoryIds: [147],
    slugs: ['MATROUH'],
    nameTokens: ['مرسىمطروح', 'مطروح', 'matrouh']
  }
];

function normalizeToken(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]/g, '');
}

export function resolveSummerCancelDeductionAmount(input: SummerCancelDeductionLookupInput): number | null {
  const categoryId = Number(input?.categoryId ?? 0);
  const normalizedSlug = normalizeToken(input?.destinationSlug ?? '');
  const normalizedName = normalizeToken(input?.destinationName ?? '');

  const byCategory = SUMMER_CANCEL_DEDUCTION_RULES.find(rule => rule.categoryIds.includes(categoryId));
  if (byCategory) {
    return byCategory.amount;
  }

  const bySlug = SUMMER_CANCEL_DEDUCTION_RULES.find(rule =>
    rule.slugs.some(slug => normalizeToken(slug) === normalizedSlug)
  );
  if (bySlug) {
    return bySlug.amount;
  }

  const byName = SUMMER_CANCEL_DEDUCTION_RULES.find(rule =>
    rule.nameTokens.some(token => token === normalizedName)
  );
  if (byName) {
    return byName.amount;
  }

  return null;
}

export function buildSummerCancelDeductionMessage(amount: number): string {
  return `عند الاعتذار عن هذا الحجز يتم خصم ${amount} جنيه من مبلغ الحجز.`;
}
