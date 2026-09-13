import { createMockProvider } from './baseProvider';

export const airtelMoneyProvider = createMockProvider({
  id: 'airtel_money',
  name: 'Airtel Money',
  icon: 'airtel_money',
  subtext: 'Paiement instantané',
  supportsPartial: false,
  processingTime: 'Instantané',
  referencePrefix: 'AM',
  successRate: 0.9,
});
