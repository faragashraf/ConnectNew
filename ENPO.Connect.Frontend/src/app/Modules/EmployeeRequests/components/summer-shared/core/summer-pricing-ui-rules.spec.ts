import { deriveStayModeControlPolicy } from './summer-pricing-ui-rules';

describe('summer-pricing-ui-rules', () => {
  it('locks stay mode when transportation is mandatory included (Ras El Bar pattern)', () => {
    const policy = deriveStayModeControlPolicy({
      pricingMode: 'TransportationMandatoryIncluded',
      transportationMandatory: true,
      normalizedStayMode: 'RESIDENCE_WITH_TRANSPORT'
    }, 2);

    expect(policy.disableControl).toBeTrue();
    expect(policy.normalizedStayMode).toBe('RESIDENCE_WITH_TRANSPORT');
  });

  it('keeps stay mode selectable for optional transportation mode', () => {
    const policy = deriveStayModeControlPolicy({
      pricingMode: 'AccommodationAndTransportationOptional',
      transportationMandatory: false,
      normalizedStayMode: 'RESIDENCE_ONLY'
    }, 2);

    expect(policy.disableControl).toBeFalse();
    expect(policy.normalizedStayMode).toBe('RESIDENCE_ONLY');
  });

  it('locks stay mode for destinations that have one stay mode only', () => {
    const policy = deriveStayModeControlPolicy({
      pricingMode: 'AccommodationAndTransportationOptional',
      transportationMandatory: false,
      normalizedStayMode: 'RESIDENCE_ONLY'
    }, 1);

    expect(policy.disableControl).toBeTrue();
  });
});
