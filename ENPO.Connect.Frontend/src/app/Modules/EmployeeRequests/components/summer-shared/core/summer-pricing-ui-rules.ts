export type SummerPricingQuoteUiInput = {
  pricingMode?: string | null;
  transportationMandatory?: boolean | null;
  normalizedStayMode?: string | null;
};

export type SummerStayModeControlPolicy = {
  normalizedStayMode: string;
  disableControl: boolean;
};

export function deriveStayModeControlPolicy(
  quote: SummerPricingQuoteUiInput | null | undefined,
  stayModesCount: number
): SummerStayModeControlPolicy {
  const normalizedStayMode = String(quote?.normalizedStayMode ?? '').trim();
  const pricingMode = String(quote?.pricingMode ?? '').trim();
  const transportationMandatory = Boolean(quote?.transportationMandatory);
  const destinationHasSingleMode = Number(stayModesCount ?? 0) <= 1;

  return {
    normalizedStayMode,
    disableControl: destinationHasSingleMode
      || transportationMandatory
      || pricingMode === 'TransportationMandatoryIncluded'
  };
}
