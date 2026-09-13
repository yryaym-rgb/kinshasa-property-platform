import type { PaymentProvider, PaymentProviderId } from '../types';
import { orangeMoneyProvider } from './orangeMoney';
import { mpesaProvider } from './mpesa';
import { airtelMoneyProvider } from './airtelMoney';
import { bankTransferProvider, cardProvider } from './bankTransfer';

export const paymentProviders: Record<PaymentProviderId, PaymentProvider> = {
  orange_money: orangeMoneyProvider,
  mpesa: mpesaProvider,
  airtel_money: airtelMoneyProvider,
  card: cardProvider,
  bank: bankTransferProvider,
};

export function getProvider(id: PaymentProviderId): PaymentProvider {
  return paymentProviders[id];
}

export function getAllProviders(): PaymentProvider[] {
  return Object.values(paymentProviders);
}
