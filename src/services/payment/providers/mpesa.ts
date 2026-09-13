import { createMockProvider } from './baseProvider';

export const mpesaProvider = createMockProvider({
  id: 'mpesa',
  name: 'M-Pesa',
  icon: 'mpesa',
  subtext: 'Paiement instantané',
  supportsPartial: false,
  processingTime: 'Instantané',
  referencePrefix: 'MPE',
  successRate: 0.9,
});
