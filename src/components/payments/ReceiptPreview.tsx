import { QRCodeSVG } from 'qrcode.react';
import { buildReceiptQRContent } from '@/utils/qrUtils';
import { formatCDF } from '@/lib/utils';
import { formatReceiptDate } from '@/utils/dateUtils';
import type { TaxCalculationResult } from '@/services/tax/taxService';

export interface ReceiptPreviewData {
  code: string;
  issuedAt: string;
  tenantName: string;
  propertyLabel: string;
  breakdown: TaxCalculationResult;
  paymentMethod: string;
  providerReference?: string;
  paymentReference?: string;
}

interface ReceiptPreviewProps {
  data: ReceiptPreviewData;
  showQr?: boolean;
  className?: string;
}

export function ReceiptPreview({ data, showQr = true, className }: ReceiptPreviewProps) {
  const qrContent = buildReceiptQRContent(data.code, data.paymentReference ?? data.code);

  return (
    <div className={`rounded-xl border-2 border-dashed border-[var(--color-border)] bg-white p-6 text-[var(--color-foreground)] ${className ?? ''}`}>
      <div className="mb-4 text-center">
        <p className="font-heading text-lg font-bold text-[var(--color-kinshasa-blue)]">eLoyer Kinshasa</p>
        <p className="text-xs text-[var(--color-muted-foreground)]">République Démocratique du Congo</p>
      </div>

      <div className="mb-4 space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-[var(--color-muted-foreground)]">N° reçu</span>
          <span className="font-mono font-medium">{data.code}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--color-muted-foreground)]">Date</span>
          <span>{formatReceiptDate(data.issuedAt)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--color-muted-foreground)]">Locataire</span>
          <span>{data.tenantName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--color-muted-foreground)]">Logement</span>
          <span className="text-right">{data.propertyLabel}</span>
        </div>
      </div>

      <table className="mb-4 w-full text-sm">
        <tbody>
          <tr className="border-b border-[var(--color-border)]">
            <td className="py-1.5 text-[var(--color-muted-foreground)]">Loyer</td>
            <td className="py-1.5 text-right">{formatCDF(data.breakdown.rentAmount)}</td>
          </tr>
          <tr className="border-b border-[var(--color-border)]">
            <td className="py-1.5 text-[var(--color-muted-foreground)]">Impôt ({(data.breakdown.taxRate * 100).toFixed(0)}%)</td>
            <td className="py-1.5 text-right">{formatCDF(data.breakdown.taxAmount)}</td>
          </tr>
          <tr className="border-b border-[var(--color-border)]">
            <td className="py-1.5 text-[var(--color-muted-foreground)]">Frais plateforme ({(data.breakdown.platformFeeRate * 100).toFixed(0)}%)</td>
            <td className="py-1.5 text-right">{formatCDF(data.breakdown.platformFee)}</td>
          </tr>
          {data.breakdown.mobileMoneyFee > 0 && (
            <tr className="border-b border-[var(--color-border)]">
              <td className="py-1.5 text-[var(--color-muted-foreground)]">Frais Mobile Money</td>
              <td className="py-1.5 text-right">{formatCDF(data.breakdown.mobileMoneyFee)}</td>
            </tr>
          )}
          <tr>
            <td className="py-2 font-bold">Total</td>
            <td className="py-2 text-right font-bold">{formatCDF(data.breakdown.total)}</td>
          </tr>
        </tbody>
      </table>

      <div className="mb-4 space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-[var(--color-muted-foreground)]">Moyen de paiement</span>
          <span>{data.paymentMethod}</span>
        </div>
        {data.providerReference && (
          <div className="flex justify-between">
            <span className="text-[var(--color-muted-foreground)]">Référence</span>
            <span className="font-mono text-xs">{data.providerReference}</span>
          </div>
        )}
      </div>

      {showQr && (
        <div className="flex flex-col items-center gap-2">
          <QRCodeSVG value={qrContent} size={120} level="M" />
          <p className="text-center text-xs text-[var(--color-muted-foreground)]">
            Vérifiez l&apos;authenticité du reçu. Scannez le QR code.
          </p>
        </div>
      )}
    </div>
  );
}
