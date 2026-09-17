import { AlertTriangle, Scale } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { formatCDF } from '@/lib/utils';
import type { CalculationDetail, LegalReference } from '@/types/tax';

const STEP_LABELS: Record<CalculationDetail['type'], { label: string; variant: 'success' | 'info' | 'warning' | 'neutral' }> = {
  exoneration: { label: 'Exonération', variant: 'success' },
  taux_base: { label: 'Taux de base', variant: 'info' },
  surtaxe: { label: 'Taxe additionnelle', variant: 'warning' },
  aucune_regle: { label: 'Aucune règle', variant: 'neutral' },
};

function formatRate(taux: number | null): string {
  if (taux === null) return '—';
  return `${(taux * 100).toLocaleString('fr-CD', { maximumFractionDigits: 2 })} %`;
}

interface TaxBreakdownTableProps {
  detail: CalculationDetail[];
  references?: LegalReference[];
  baseImposable: number;
  montantImpot: number;
  compact?: boolean;
}

/** Line-by-line view of a fiscal engine calculation, with legal references. */
export function TaxBreakdownTable({ detail, references, baseImposable, montantImpot, compact }: TaxBreakdownTableProps) {
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-muted)] text-left text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Règle</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2 text-right">Taux</th>
              <th className="px-3 py-2 text-right">Base</th>
              <th className="px-3 py-2 text-right">Montant</th>
              {!compact && <th className="px-3 py-2 text-right">Cumul</th>}
            </tr>
          </thead>
          <tbody>
            {detail.length === 0 && (
              <tr>
                <td colSpan={compact ? 6 : 7} className="px-3 py-4 text-center text-[var(--color-muted-foreground)]">
                  Aucun détail de calcul disponible.
                </td>
              </tr>
            )}
            {detail.map((line) => {
              const step = STEP_LABELS[line.type] ?? STEP_LABELS.aucune_regle;
              return (
                <tr key={`${line.ordre}-${line.regleId ?? line.regleNom}`} className="border-t border-[var(--color-border)]">
                  <td className="px-3 py-2 text-[var(--color-muted-foreground)]">{line.ordre}</td>
                  <td className="px-3 py-2">
                    <p className="font-medium">{line.regleNom}</p>
                    {!compact && line.description && <p className="text-xs text-[var(--color-muted-foreground)]">{line.description}</p>}
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--color-muted-foreground)]">
                      <Scale className="h-3 w-3" />
                      {line.referenceLegale}
                      {line.articleLoi ? ` — ${line.articleLoi}` : ''}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={step.variant}>{step.label}</Badge>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{line.montantFixe !== null ? formatCDF(line.montantFixe) : formatRate(line.taux)}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatCDF(line.base)}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">{formatCDF(line.montant)}</td>
                  {!compact && <td className="px-3 py-2 text-right font-mono">{formatCDF(line.cumul)}</td>}
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-[var(--color-border)] bg-[var(--color-muted)]/50">
            <tr>
              <td colSpan={compact ? 4 : 5} className="px-3 py-2 text-right text-xs uppercase text-[var(--color-muted-foreground)]">
                Base imposable {formatCDF(baseImposable)}
              </td>
              <td colSpan={compact ? 2 : 2} className="px-3 py-2 text-right font-heading text-base font-bold">
                {formatCDF(montantImpot)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {references && references.length > 0 && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3 text-sm">
          <p className="mb-2 flex items-center gap-2 font-medium">
            <Scale className="h-4 w-4 text-[var(--color-kinshasa-blue)]" /> Références légales
          </p>
          <ul className="space-y-1">
            {references.map((ref) => (
              <li key={ref.ruleId} className="flex flex-wrap items-center gap-2 text-[var(--color-muted-foreground)]">
                <span className="font-medium text-[var(--color-foreground)]">{ref.ruleName}</span>
                <span>— {ref.reference}{ref.article ? `, ${ref.article}` : ''}</span>
                {ref.pendingValidation && (
                  <Badge variant="warning" className="gap-1">
                    <AlertTriangle className="h-3 w-3" /> À valider par la DGI
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
