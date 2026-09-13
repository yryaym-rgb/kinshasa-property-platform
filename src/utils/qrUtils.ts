import { getPropertyVerificationUrl } from '@/utils/propertyUtils';

export function buildPropertyQRContent(code: string): string {
  return JSON.stringify({
    code,
    url: getPropertyVerificationUrl(code),
    platform: 'eLoyer Kinshasa',
  });
}

export function buildReceiptQRContent(receiptCode: string, paymentRef: string): string {
  const base = import.meta.env.VITE_APP_URL ?? (typeof window !== 'undefined' ? window.location.origin : '');
  return JSON.stringify({
    receipt: receiptCode,
    reference: paymentRef,
    url: `${base}/verifier/recu/${receiptCode}`,
  });
}
