/**
 * Module 5 — landlord tax dashboard ("Ma fiscalité").
 *
 * Verifies the page loads live data from the fiscal engine RPCs
 * (`get_bailleur_tax_summary`, `get_compliance_breakdown`) and the `impots`
 * table: KPIs, compliance gauge, deadlines and the obligations history.
 */

import { expect, test, type Locator, type Page } from '@playwright/test';
import { IDS } from './support/fixtures';
import { installMockSupabase, realConsoleErrors } from './support/mockSupabase';

/** DataTable renders a <table> on md+ and one card per row below; both carry the same cells. */
function historyRows(page: Page, dashboard: Locator): Locator {
  const mobile = (page.viewportSize()?.width ?? 1280) < 768;
  return mobile
    ? dashboard.locator('.md\\:hidden > div.rounded-lg')
    : dashboard.getByRole('table').last().locator('tbody').getByRole('row');
}

test.describe('Tableau de bord fiscal (bailleur)', () => {
  test('affiche les KPI, le score de conformité, les échéances et l’historique', async ({ page }) => {
    const backend = await installMockSupabase(page, { role: 'bailleur' });

    await page.goto('/bailleur/fiscalite');

    const dashboard = page.getByTestId('tax-dashboard');
    await expect(dashboard).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ma fiscalité' })).toBeVisible();

    // KPIs from get_bailleur_tax_summary (3 × 85 000 computed, 1 paid, 2 due, 1 overdue).
    await expect(dashboard.getByRole('heading', { name: 'Impôts calculés' })).toBeVisible();
    await expect(dashboard.getByText(/255\s?000/).first()).toBeVisible();
    await expect(dashboard.getByRole('heading', { name: 'Impôts réglés' })).toBeVisible();
    await expect(dashboard.getByRole('heading', { name: 'Reste dû' })).toBeVisible();
    await expect(dashboard.getByText(/170\s?000/).first()).toBeVisible();
    await expect(dashboard.getByText(/dont .*85\s?000.* en retard/)).toBeVisible();
    await expect(dashboard.getByRole('heading', { name: 'Base imposable' })).toBeVisible();

    // Compliance gauge + components from get_compliance_breakdown.
    const compliance = dashboard.getByTestId('compliance-card');
    await expect(compliance.getByText('Score de conformité')).toBeVisible();
    await expect(compliance.getByText('82', { exact: true })).toBeVisible();
    await expect(compliance.getByText('Ponctualité des loyers')).toBeVisible();
    await expect(compliance.getByText('30/35')).toBeVisible();
    await expect(compliance.getByText('Impôts réglés', { exact: true })).toBeVisible();
    await expect(compliance.getByText('17/25')).toBeVisible();

    // Obligations chart + deadlines.
    await expect(dashboard.getByText('Obligations en cours')).toBeVisible();
    await expect(dashboard.getByText('Total dû')).toBeVisible();
    await expect(dashboard.getByText('KIN-GOM-0042').first()).toBeVisible();

    // History table: one row per impôt, with status badges.
    const rows = historyRows(page, dashboard);
    await expect(rows).toHaveCount(3);
    await expect(rows.filter({ hasText: 'Calculé' })).toHaveCount(1);
    await expect(rows.filter({ hasText: 'En retard' })).toHaveCount(1);
    await expect(rows.filter({ hasText: /Payé/ })).toHaveCount(1);
    await expect(rows.first().getByText('KIN-GOM-0042')).toBeVisible();

    // The certificate export is available once the summary is loaded.
    await expect(dashboard.getByTestId('download-certificate')).toBeEnabled();

    // "Comprendre mes impôts" panel.
    await expect(dashboard.getByText(/Comprendre mes impôts/)).toBeVisible();

    // Data was requested for the signed-in landlord only.
    const summaryCalls = backend.rpcCalls.filter((c) => c.name === 'get_bailleur_tax_summary');
    expect(summaryCalls.length).toBeGreaterThanOrEqual(1);
    expect(summaryCalls[0]!.args.p_bailleur_id).toBe(IDS.bailleur);
    const complianceCalls = backend.rpcCalls.filter((c) => c.name === 'get_compliance_breakdown');
    expect(complianceCalls.length).toBeGreaterThanOrEqual(1);
    expect(complianceCalls[0]!.args.p_bailleur_id).toBe(IDS.bailleur);

    expect(realConsoleErrors(backend)).toEqual([]);
  });

  test('navigue vers le détail d’une obligation et vers le simulateur', async ({ page }) => {
    const backend = await installMockSupabase(page, { role: 'bailleur' });

    await page.goto('/bailleur/fiscalite');
    await expect(page.getByTestId('tax-dashboard')).toBeVisible();

    // Row click → detail page with the audited calculation breakdown.
    await historyRows(page, page.getByTestId('tax-dashboard')).filter({ hasText: 'En retard' }).click();
    await expect(page).toHaveURL(new RegExp(`/bailleur/fiscalite/${IDS.impotFeb}$`));
    const detail = page.getByTestId('tax-detail');
    await expect(detail).toBeVisible();
    await expect(detail.getByRole('heading', { name: /Impôt — période/ })).toBeVisible();
    await expect(detail.getByText('Montant de l’impôt')).toBeVisible();
    await expect(detail.getByText(/85\s?000/).first()).toBeVisible();
    await expect(detail.getByText('Détail du calcul')).toBeVisible();
    await expect(detail.getByText('Impôt sur revenus locatifs — résidentiel').first()).toBeVisible();
    await expect(detail.getByText(/Référence légale/)).toBeVisible();
    await expect(detail.getByText('Moteur fiscal v1.0.0', { exact: false })).toBeVisible();

    // Back to the dashboard, then to the simulator.
    await page.goBack();
    await expect(page.getByTestId('tax-dashboard')).toBeVisible();
    await page.getByRole('link', { name: /Simulateur/ }).first().click();
    await expect(page).toHaveURL(/\/bailleur\/fiscalite\/simulateur$/);
    await expect(page.getByTestId('tax-simulator')).toBeVisible();

    expect(realConsoleErrors(backend)).toEqual([]);
  });
});
