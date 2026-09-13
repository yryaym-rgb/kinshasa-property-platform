import { formatCurrency, formatDate } from '@/lib/utils';
import { getContractTerms, getPaymentFrequencyLabel } from '@/utils/contractUtils';
import type { ContractWithRelations } from '@/services/contract/contractService';
import type { Logement } from '@/types/database.types';
import type { User } from '@/types/database.types';

export interface ContractPreviewData {
  logement?: Partial<Pick<Logement, 'code' | 'address' | 'commune' | 'type'>> | null;
  locataire?: Partial<Pick<User, 'full_name' | 'phone' | 'email' | 'address'>> | null;
  bailleur?: { full_name?: string | null; phone?: string | null; email?: string | null; tax_id?: string | null };
  dateDebut: string;
  dateFin?: string;
  loyerMensuel: number;
  chargesMensuelles?: number;
  depotGarantie?: number;
  currency: 'CDF' | 'USD';
  paymentDay: number;
  paymentFrequency?: string;
  conditionsParticulieres?: string;
}

interface ContractPreviewProps {
  data: ContractPreviewData | ContractWithRelations;
  className?: string;
}

function normalizeData(data: ContractPreviewData | ContractWithRelations): ContractPreviewData {
  if ('date_debut' in data) {
    const contract = data as ContractWithRelations;
    const terms = getContractTerms(contract);
    return {
      logement: contract.logement,
      locataire: contract.locataire,
      bailleur: {
        full_name: contract.bailleur?.user?.full_name ?? contract.bailleur?.business_name ?? undefined,
        phone: contract.bailleur?.user?.phone ?? undefined,
        email: contract.bailleur?.user?.email ?? undefined,
        tax_id: contract.bailleur?.tax_id ?? undefined,
      },
      dateDebut: contract.date_debut,
      dateFin: contract.date_fin ?? undefined,
      loyerMensuel: Number(contract.loyer_mensuel),
      chargesMensuelles: terms.chargesMensuelles,
      depotGarantie: contract.depot_garantie ? Number(contract.depot_garantie) : undefined,
      currency: contract.currency as 'CDF' | 'USD',
      paymentDay: contract.payment_day,
      paymentFrequency: terms.paymentFrequency,
      conditionsParticulieres: terms.conditionsParticulieres,
    };
  }
  return data;
}

export function ContractPreview({ data, className }: ContractPreviewProps) {
  const preview = normalizeData(data);

  return (
    <article
      className={`contract-preview mx-auto max-w-3xl rounded-lg border border-[var(--color-border)] bg-white p-8 text-sm text-gray-900 shadow-sm print:shadow-none ${className ?? ''}`}
    >
      <header className="border-b border-gray-200 pb-6 text-center">
        <h1 className="font-heading text-2xl font-bold text-[var(--color-kinshasa-blue)]">
          CONTRAT DE BAIL D&apos;HABITATION
        </h1>
        <p className="mt-2 text-gray-500">République Démocratique du Congo — Kinshasa</p>
      </header>

      <section className="mt-6">
        <h2 className="mb-3 font-heading text-lg font-semibold text-[var(--color-kinshasa-blue)]">
          1. Parties
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg bg-gray-50 p-4">
            <h3 className="font-semibold">Le Bailleur</h3>
            <p>{preview.bailleur?.full_name ?? '—'}</p>
            <p className="text-gray-600">{preview.bailleur?.phone}</p>
            {preview.bailleur?.email && <p className="text-gray-600">{preview.bailleur.email}</p>}
            {preview.bailleur?.tax_id && (
              <p className="text-gray-600">NIF : {preview.bailleur.tax_id}</p>
            )}
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <h3 className="font-semibold">Le Locataire</h3>
            <p>{preview.locataire?.full_name ?? '—'}</p>
            <p className="text-gray-600">{preview.locataire?.phone}</p>
            {preview.locataire?.email && <p className="text-gray-600">{preview.locataire.email}</p>}
          </div>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 font-heading text-lg font-semibold text-[var(--color-kinshasa-blue)]">
          2. Logement
        </h2>
        <p><strong>Code :</strong> {preview.logement?.code ?? '—'}</p>
        <p><strong>Adresse :</strong> {preview.logement?.address ?? '—'}, {preview.logement?.commune ?? ''}</p>
        <p><strong>Type :</strong> {preview.logement?.type ?? '—'}</p>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 font-heading text-lg font-semibold text-[var(--color-kinshasa-blue)]">
          3. Termes du contrat
        </h2>
        <table className="w-full border-collapse text-left">
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="py-2 font-medium">Date de début</td>
              <td className="py-2">{formatDate(preview.dateDebut)}</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-2 font-medium">Date de fin</td>
              <td className="py-2">{preview.dateFin ? formatDate(preview.dateFin) : '—'}</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-2 font-medium">Loyer mensuel</td>
              <td className="py-2 font-bold">
                {formatCurrency(preview.loyerMensuel, preview.currency)}
              </td>
            </tr>
            {preview.chargesMensuelles !== undefined && preview.chargesMensuelles > 0 && (
              <tr className="border-b border-gray-100">
                <td className="py-2 font-medium">Charges mensuelles</td>
                <td className="py-2">{formatCurrency(preview.chargesMensuelles, preview.currency)}</td>
              </tr>
            )}
            {preview.depotGarantie !== undefined && (
              <tr className="border-b border-gray-100">
                <td className="py-2 font-medium">Dépôt de garantie</td>
                <td className="py-2">{formatCurrency(preview.depotGarantie, preview.currency)}</td>
              </tr>
            )}
            <tr className="border-b border-gray-100">
              <td className="py-2 font-medium">Jour d&apos;échéance</td>
              <td className="py-2">Le {preview.paymentDay} de chaque mois</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-2 font-medium">Fréquence de paiement</td>
              <td className="py-2">
                {getPaymentFrequencyLabel(preview.paymentFrequency ?? 'mensuel')}
              </td>
            </tr>
          </tbody>
        </table>
        {preview.conditionsParticulieres && (
          <div className="mt-4 rounded-lg bg-gray-50 p-4">
            <h3 className="font-semibold">Conditions particulières</h3>
            <p className="mt-2 whitespace-pre-wrap text-gray-700">{preview.conditionsParticulieres}</p>
          </div>
        )}
      </section>

      <section className="mt-8 border-t border-gray-200 pt-6">
        <h2 className="mb-6 font-heading text-lg font-semibold text-[var(--color-kinshasa-blue)]">
          4. Signatures
        </h2>
        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <div className="h-16 border-b border-gray-400" />
            <p className="mt-2 text-center text-gray-600">Signature du Bailleur</p>
          </div>
          <div>
            <div className="h-16 border-b border-gray-400" />
            <p className="mt-2 text-center text-gray-600">Signature du Locataire</p>
          </div>
        </div>
      </section>

      <footer className="mt-8 border-t border-gray-200 pt-4 text-center text-xs text-gray-500">
        Document généré par eLoyer Kinshasa — Ce contrat est soumis aux lois en vigueur en RDC.
      </footer>
    </article>
  );
}
