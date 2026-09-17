import { describe, expect, it, vi } from 'vitest';

// The service module creates a Supabase client at import time; the pure helpers
// under test never touch it.
vi.mock('@/config/supabase', () => ({ supabase: {} }));

const { buildForecast, estimateBreakdown, isCommercialType, PLATFORM_FEE_RATE } = await import('@/services/tax/taxService');
const { complianceLevelFromScore } = await import('@/types/tax');

describe('estimateBreakdown (payment wizard estimate)', () => {
  it('matches the seed example: 850 000 CDF rent, 10 % tax, 2 % platform fee, 1.5 % mobile money', () => {
    const b = estimateBreakdown({ rentAmount: 850_000, paymentMethod: 'mobile_money' });
    expect(b.taxAmount).toBe(85_000);
    expect(b.platformFee).toBe(17_000);
    expect(b.mobileMoneyFee).toBe(12_750);
    expect(b.total).toBe(850_000 + 85_000 + 17_000 + 12_750);
    expect(b.estimated).toBe(true);
    expect(b.platformFeeRate).toBe(PLATFORM_FEE_RATE);
  });

  it('uses the provider catalogue fee when given', () => {
    const b = estimateBreakdown({ rentAmount: 100_000, providerFeePercentage: 2.5, providerFeeFixed: 200 });
    expect(b.mobileMoneyFeeRate).toBe(0.025);
    expect(b.mobileMoneyFee).toBe(2_500 + 200);
  });

  it('never produces negative or fractional CDF amounts', () => {
    const b = estimateBreakdown({ rentAmount: -5, paymentMethod: 'card' });
    expect(b.rentAmount).toBe(0);
    expect(b.total).toBe(0);
    const c = estimateBreakdown({ rentAmount: 33_333, taxRate: 0.15 });
    expect(Number.isInteger(c.taxAmount)).toBe(true);
  });

  it('knows which property types are commercial', () => {
    expect(isCommercialType('Bureau')).toBe(true);
    expect(isCommercialType('Magasin')).toBe(true);
    expect(isCommercialType('Appartement')).toBe(false);
  });
});

describe('buildForecast (explainable projection)', () => {
  const history = Array.from({ length: 24 }, (_, i) => ({
    month: `${2024 + Math.floor((i + 9) / 12)}-${String(((i + 9) % 12) + 1).padStart(2, '0')}`,
    impots: 1_000_000 + i * 50_000,
    loyers: 10_000_000 + i * 500_000,
    paiements: 100 + i,
    nouveauxContrats: 5,
  }));
  const factors = { registeredProperties: 500, activeContracts: 400, averageRent: 300_000, complianceRate: 80 };

  it('projects the requested number of consecutive months after the last history point', () => {
    const f = buildForecast(history, 12, factors);
    expect(f.projection).toHaveLength(12);
    expect(f.projection[0]?.month).toBe('2026-10');
    expect(f.projection[11]?.month).toBe('2027-09');
  });

  it('keeps pessimistic ≤ lower-ish ≤ base ≤ optimistic and a growing confidence band', () => {
    const f = buildForecast(history, 6, factors);
    for (const p of f.projection) {
      expect(p.pessimistic).toBeLessThanOrEqual(p.base);
      expect(p.optimistic).toBeGreaterThanOrEqual(p.base);
      expect(p.lower).toBeLessThanOrEqual(p.base);
      expect(p.upper).toBeGreaterThanOrEqual(p.base);
    }
    const bands = f.projection.map((p) => p.upper - p.lower);
    for (let i = 1; i < bands.length; i++) expect(bands[i]).toBeGreaterThanOrEqual(bands[i - 1]!);
  });

  it('follows the historical trend', () => {
    const f = buildForecast(history, 3, factors);
    const last = history[history.length - 1]!.impots;
    // Upward trend of 50k/month, blended 70/30 with the 12-month average and scaled by compliance → close to last value.
    expect(f.projection[0]!.base).toBeGreaterThan(last * 0.8);
    expect(f.projection[0]!.base).toBeLessThan(last * 1.2);
    expect(f.factors.monthlyGrowthRate).toBeGreaterThan(0);
    expect(f.factors.averageMonthlyTax).toBe(Math.round(history.slice(-12).reduce((a, h) => a + h.impots, 0) / 12));
  });

  it('totals are the sums of the projection', () => {
    const f = buildForecast(history, 12, factors);
    expect(f.totals.base).toBe(f.projection.reduce((a, p) => a + p.base, 0));
    expect(f.totals.optimistic).toBe(f.projection.reduce((a, p) => a + p.optimistic, 0));
    expect(f.totals.pessimistic).toBe(f.projection.reduce((a, p) => a + p.pessimistic, 0));
  });

  it('degrades gracefully with little or no history', () => {
    expect(buildForecast([], 6, factors).projection.every((p) => p.base === 0)).toBe(true);
    const one = buildForecast([history[0]!], 3, factors);
    expect(one.projection).toHaveLength(3);
    expect(one.projection[0]!.base).toBeGreaterThan(0);
  });
});

describe('compliance levels', () => {
  it('uses the SQL thresholds 90 / 75 / 50', () => {
    expect(complianceLevelFromScore(95)).toBe('excellent');
    expect(complianceLevelFromScore(90)).toBe('excellent');
    expect(complianceLevelFromScore(80)).toBe('good');
    expect(complianceLevelFromScore(60)).toBe('warning');
    expect(complianceLevelFromScore(10)).toBe('critical');
  });
});
