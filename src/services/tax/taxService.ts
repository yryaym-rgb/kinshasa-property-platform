export interface TaxCalculationInput {
  rentAmount: number;
  paymentMethod?: 'mobile_money' | 'card' | 'bank';
  commune?: string;
  propertyType?: string;
}

export interface TaxCalculationResult {
  rentAmount: number;
  taxRate: number;
  taxAmount: number;
  platformFeeRate: number;
  platformFee: number;
  mobileMoneyFeeRate: number;
  mobileMoneyFee: number;
  total: number;
}

const PLATFORM_FEE_RATE = 0.02;
const MOBILE_MONEY_FEE_RATE = 0.015;
const DEFAULT_TAX_RATE = 0.10;

export const taxService = {
  calculateTax(input: TaxCalculationInput): TaxCalculationResult {
    const rentAmount = input.rentAmount;
    const effectiveTaxRate = DEFAULT_TAX_RATE;
    const taxAmount = Math.round(rentAmount * effectiveTaxRate);
    const platformFee = Math.round(rentAmount * PLATFORM_FEE_RATE);
    const mobileMoneyFee =
      input.paymentMethod === 'mobile_money'
        ? Math.round(rentAmount * MOBILE_MONEY_FEE_RATE)
        : 0;

    const total = rentAmount + taxAmount + platformFee + mobileMoneyFee;

    return {
      rentAmount,
      taxRate: effectiveTaxRate,
      taxAmount,
      platformFeeRate: PLATFORM_FEE_RATE,
      platformFee,
      mobileMoneyFeeRate: MOBILE_MONEY_FEE_RATE,
      mobileMoneyFee,
      total,
    };
  },
};
