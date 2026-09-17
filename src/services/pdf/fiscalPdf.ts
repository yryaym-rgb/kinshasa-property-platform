/**
 * Client-side PDF exports for the fiscal module (simulation, attestation,
 * forecast report). jsPDF is loaded lazily so the dashboards do not pay for it
 * until the user actually clicks "Exporter".
 */

import { APP_CONFIG } from '@/config/app.config';
import { formatCDF, formatDate, formatDateTime } from '@/lib/utils';
import type { Forecast, SimulationResult, TaxHistoryRow, TaxSummary } from '@/types/tax';

type JsPdf = import('jspdf').jsPDF;

async function createDoc(): Promise<{ doc: JsPdf; autoTable: typeof import('jspdf-autotable').default }> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  return { doc, autoTable };
}

function header(doc: JsPdf, title: string, subtitle?: string) {
  doc.setFillColor(0, 51, 160);
  doc.rect(0, 0, 210, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(APP_CONFIG.name, 14, 10);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Plateforme de gestion locative et fiscale — Kinshasa, RDC', 14, 16);
  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(title, 14, 32);
  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    doc.text(subtitle, 14, 38);
    doc.setTextColor(20, 20, 20);
  }
}

function footer(doc: JsPdf, note: string) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(note, 14, 290, { maxWidth: 150 });
    doc.text(`Page ${i} / ${pages}`, 196, 290, { align: 'right' });
  }
}

function pct(fraction: number): string {
  return `${(fraction * 100).toLocaleString('fr-CD', { maximumFractionDigits: 2 })} %`;
}

export const fiscalPdf = {
  /** "What-if" simulation with scenarios, breakdown and legal references. */
  async exportSimulation(result: SimulationResult): Promise<void> {
    const { doc, autoTable } = await createDoc();
    header(doc, 'Simulation fiscale — impôt sur les revenus locatifs', `Générée le ${formatDateTime(result.computedAt)}`);

    autoTable(doc, {
      startY: 44,
      theme: 'plain',
      styles: { fontSize: 10 },
      body: [
        ['Type de logement', result.input.typeLogement],
        ['Commune', result.input.commune],
        ['Loyer mensuel brut', formatCDF(result.input.montantBrut)],
        ['Type de contribuable', result.input.typeContribuable === 'personne_morale' ? 'Personne morale' : 'Personne physique'],
        ['Base imposable', formatCDF(result.base.baseImposable)],
        ['Taux effectif', pct(result.base.tauxEffectif)],
        ['Impôt mensuel estimé', formatCDF(result.base.montantImpot)],
        ['Impôt annuel estimé', formatCDF(result.base.montantImpot * 12)],
      ],
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } },
    });

    let y = (doc as JsPdf & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 100;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Détail du calcul', 14, y + 10);
    autoTable(doc, {
      startY: y + 13,
      head: [['#', 'Règle', 'Type', 'Taux', 'Base', 'Montant', 'Référence légale']],
      body: result.base.detail.map((l) => [
        String(l.ordre),
        l.regleNom,
        l.type,
        l.montantFixe !== null ? formatCDF(l.montantFixe) : l.taux !== null ? pct(l.taux) : '—',
        formatCDF(l.base),
        formatCDF(l.montant),
        `${l.referenceLegale}${l.articleLoi ? ` — ${l.articleLoi}` : ''}`,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [0, 51, 160] },
    });

    y = (doc as JsPdf & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 40;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Scénarios', 14, y + 10);
    autoTable(doc, {
      startY: y + 13,
      head: [['Scénario', 'Loyer', 'Impôt mensuel', 'Taux effectif', 'Impôt annuel']],
      body: [
        ['Référence', formatCDF(result.input.montantBrut), formatCDF(result.base.montantImpot), pct(result.base.tauxEffectif), formatCDF(result.base.montantImpot * 12)],
        ...result.scenarios.map((s) => [s.label, formatCDF(s.montantBrut), formatCDF(s.result.montantImpot), pct(s.result.tauxEffectif), formatCDF(s.result.montantImpot * 12)]),
      ],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [0, 51, 160] },
    });

    if (result.base.references.length > 0) {
      y = (doc as JsPdf & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 40;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Références légales', 14, y + 10);
      autoTable(doc, {
        startY: y + 13,
        head: [['Règle', 'Référence', 'Article', 'Statut']],
        body: result.base.references.map((r) => [r.ruleName, r.reference, r.article ?? '—', r.pendingValidation ? 'En attente de validation DGI' : 'Validée']),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [0, 51, 160] },
      });
    }

    footer(
      doc,
      'Simulation indicative fondée sur les règles fiscales configurées à la date d’édition. Elle ne constitue ni une déclaration ni un avis d’imposition. Les règles marquées "à valider" doivent être confirmées par la DGI.',
    );
    doc.save(`simulation-fiscale-${result.input.commune.toLowerCase()}-${result.computedAt.slice(0, 10)}.pdf`);
  },

  /** Landlord attestation: summary + list of obligations for a period. */
  async exportTaxCertificate(params: { landlordName: string; summary: TaxSummary; history: TaxHistoryRow[] }): Promise<void> {
    const { doc, autoTable } = await createDoc();
    const periodLabel = params.summary.periode || 'toutes périodes';
    header(doc, 'Attestation de situation fiscale', `${params.landlordName} — période : ${periodLabel} — éditée le ${formatDate(new Date())}`);

    autoTable(doc, {
      startY: 44,
      theme: 'plain',
      styles: { fontSize: 10 },
      body: [
        ['Base imposable cumulée', formatCDF(params.summary.baseImposable)],
        ['Impôts calculés', formatCDF(params.summary.totalCalcule)],
        ['Impôts réglés', formatCDF(params.summary.totalPaye)],
        ['Reste dû', formatCDF(params.summary.totalDu)],
        ['Dont en retard', formatCDF(params.summary.totalEnRetard)],
        ['Obligations', `${params.summary.nbPayees} réglée(s) sur ${params.summary.nbObligations}`],
      ],
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } },
    });

    const y = (doc as JsPdf & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 100;
    autoTable(doc, {
      startY: y + 8,
      head: [['Période', 'Logement', 'Base', 'Taux', 'Impôt', 'Statut', 'Référence']],
      body: params.history.map((h) => [
        h.periode,
        h.logementCode ?? '—',
        formatCDF(Number(h.base_imposable ?? 0)),
        pct(Number(h.taux)),
        formatCDF(Number(h.montant)),
        h.status,
        h.reference_legale ?? '—',
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [0, 51, 160] },
    });

    footer(doc, 'Document généré automatiquement par eLoyer à partir des calculs du moteur fiscal. Il récapitule les obligations enregistrées sur la plateforme et ne se substitue pas à une attestation officielle de la DGI.');
    doc.save(`attestation-fiscale-${periodLabel.replace(/\s+/g, '-')}.pdf`);
  },

  /** DGI forecast report. */
  async exportForecast(forecast: Forecast, months: number): Promise<void> {
    const { doc, autoTable } = await createDoc();
    header(doc, `Prévisions de recettes fiscales — ${months} mois`, `Rapport généré le ${formatDateTime(forecast.generatedAt)}`);

    autoTable(doc, {
      startY: 44,
      theme: 'plain',
      styles: { fontSize: 10 },
      body: [
        ['Logements enregistrés', String(forecast.factors.registeredProperties)],
        ['Contrats actifs', String(forecast.factors.activeContracts)],
        ['Loyer moyen', formatCDF(forecast.factors.averageRent)],
        ['Taux de conformité', pct(forecast.factors.complianceRate / 100)],
        ['Croissance mensuelle observée', pct(forecast.factors.monthlyGrowthRate)],
        ['Impôt mensuel moyen (historique)', formatCDF(forecast.factors.averageMonthlyTax)],
        ['Total scénario pessimiste', formatCDF(forecast.totals.pessimistic)],
        ['Total scénario de base', formatCDF(forecast.totals.base)],
        ['Total scénario optimiste', formatCDF(forecast.totals.optimistic)],
      ],
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 70 } },
    });

    const y = (doc as JsPdf & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 100;
    autoTable(doc, {
      startY: y + 8,
      head: [['Mois', 'Pessimiste', 'Base', 'Optimiste', 'IC 80 % bas', 'IC 80 % haut']],
      body: forecast.projection.map((p) => [p.month, formatCDF(p.pessimistic), formatCDF(p.base), formatCDF(p.optimistic), formatCDF(p.lower), formatCDF(p.upper)]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [0, 51, 160] },
    });

    footer(doc, 'Projection statistique fondée sur l’historique des impôts collectés via eLoyer, le parc enregistré et le taux de conformité. À usage de pilotage interne.');
    doc.save(`previsions-recettes-${forecast.generatedAt.slice(0, 10)}.pdf`);
  },
};
