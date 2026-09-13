import { createMockProvider } from './baseProvider';

export const orangeMoneyProvider = createMockProvider({
  id: 'orange_money',
  name: 'Orange Money',
  icon: 'orange_money',
  subtext: 'Paiement instantané',
  supportsPartial: false,
  processingTime: 'Instantané',
  referencePrefix: 'OM',
  successRate: 0.9,
});
