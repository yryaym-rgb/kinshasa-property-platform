import { Info } from 'lucide-react';
import { formatCDF } from '@/lib/utils';
import type { TaxCalculationResult } from '@/services/tax/taxService';
import { cn } from '@/lib/utils';

interface PaymentSummaryProps {
  breakdown: TaxCalculationResult;
  showMobileMoneyFee?: boolean;
  className?: string;
  totalClassName?: string;
}

function LineItem({
  label,
  amount,
  tooltip,
  bold,
}: {
  label: string;
  amount: number;
  tooltip?: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className={cn('flex items-center gap-1 text-sm', bold && 'font-semibold')}>
        {label}
        {tooltip && (
          <span title={tooltip} className="text-[var(--color-muted-foreground)]">
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        )}
      </span>
      <span className={cn('text-sm', bold && 'font-semibold')}>{formatCDF(amount)}</span>
    </div>
  );
}

export function PaymentSummary({
  breakdown,
  showMobileMoneyFee = true,
  className,
  totalClassName,
}: PaymentSummaryProps) {
  return (
    <div className={cn('space-y-1 rounded-lg border border-[var(--color-border)] p-4', className)}>
      <LineItem
        label="Loyer brut"
        amount={breakdown.rentAmount}
        tooltip="Montant du loyer mensuel convenu dans le contrat"
      />
      <LineItem
        label={`Impôt (${(breakdown.taxRate * 100).toFixed(0)}%)`}
        amount={breakdown.taxAmount}
        tooltip="Impôt sur le revenu locatif selon la réglementation de Kinshasa"
      />
      <LineItem
        label={`Frais plateforme (${(breakdown.platformFeeRate * 100).toFixed(0)}%)`}
        amount={breakdown.platformFee}
        tooltip="Frais de service eLoyer pour la gestion et la traçabilité"
      />
      {showMobileMoneyFee && breakdown.mobileMoneyFee > 0 && (
        <LineItem
          label={`Frais Mobile Money (${(breakdown.mobileMoneyFeeRate * 100).toFixed(1)}%)`}
          amount={breakdown.mobileMoneyFee}
          tooltip="Frais de transaction du fournisseur Mobile Money"
        />
      )}
      <div className="my-2 border-t border-[var(--color-border)]" />
      <div className="flex items-center justify-between">
        <span className="font-semibold">Total à payer</span>
        <span className={cn('text-xl font-bold text-[var(--color-kinshasa-gold)]', totalClassName)}>
          {formatCDF(breakdown.total)}
        </span>
      </div>
    </div>
  );
}
