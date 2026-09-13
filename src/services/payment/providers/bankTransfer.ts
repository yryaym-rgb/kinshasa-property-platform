import { createMockProvider } from './baseProvider';

export const bankTransferProvider = createMockProvider({
  id: 'bank',
  name: 'Virement bancaire',
  icon: 'bank',
  subtext: '1-2 jours ouvrés',
  supportsPartial: true,
  processingTime: '1-2 jours ouvrés',
  referencePrefix: 'BNK2025',
  successRate: 0.95,
});

export const cardProvider = createMockProvider({
  id: 'card',
  name: 'Carte bancaire',
  icon: 'card',
  subtext: 'Paiement instantané',
  supportsPartial: false,
  processingTime: 'Instantané',
  referencePrefix: 'CRD',
  successRate: 0.9,
});
