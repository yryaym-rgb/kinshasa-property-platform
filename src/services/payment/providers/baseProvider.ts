import { sleep } from '@/lib/utils';
import type {
  PaymentInitParams,
  PaymentInitResult,
  PaymentProvider,
  PaymentProviderId,
  PaymentVerifyResult,
} from '../types';

const FAILURE_REASONS = ['insufficient_funds', 'user_cancelled', 'timeout', 'provider_error'];

export function createMockProvider(config: {
  id: PaymentProviderId;
  name: string;
  icon: string;
  subtext: string;
  supportsPartial: boolean;
  processingTime: string;
  referencePrefix: string;
  successRate: number;
}): PaymentProvider {
  const pendingTransactions = new Map<string, { createdAt: number; willSucceed: boolean }>();

  function generateReference(): string {
    const num = Math.floor(1000000000 + Math.random() * 9000000000);
    return `${config.referencePrefix}${num}`;
  }

  return {
    id: config.id,
    name: config.name,
    icon: config.icon,
    subtext: config.subtext,
    supportsPartial: config.supportsPartial,
    processingTime: config.processingTime,

    async initiate(_params: PaymentInitParams): Promise<PaymentInitResult> {
      await sleep(1500 + Math.random() * 1000);
      const providerTransactionId = generateReference();
      const willSucceed = Math.random() < config.successRate;
      pendingTransactions.set(providerTransactionId, {
        createdAt: Date.now(),
        willSucceed,
      });
      return {
        providerTransactionId,
        status: 'processing',
        message: `Demande envoyée à ${config.name}`,
      };
    },

    async verify(transactionId: string): Promise<PaymentVerifyResult> {
      await sleep(800 + Math.random() * 400);
      const tx = pendingTransactions.get(transactionId);
      if (!tx) {
        return { status: 'failed', failureReason: 'provider_error' };
      }
      const elapsed = Date.now() - tx.createdAt;
      if (elapsed < 2000) {
        return { status: 'processing' };
      }
      if (tx.willSucceed) {
        pendingTransactions.delete(transactionId);
        return {
          status: 'success',
          providerReference: transactionId,
          paidAt: new Date().toISOString(),
        };
      }
      pendingTransactions.delete(transactionId);
      const reason = FAILURE_REASONS[Math.floor(Math.random() * FAILURE_REASONS.length)];
      return { status: 'failed', failureReason: reason };
    },

    async cancel(transactionId: string): Promise<void> {
      pendingTransactions.delete(transactionId);
    },
  };
}
