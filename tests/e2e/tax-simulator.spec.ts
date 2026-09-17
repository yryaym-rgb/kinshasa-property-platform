/**
 * Module 5 — "what-if" tax simulator for landlords.
 *
 * The simulator calls the fiscal engine (`tax-calculate` in simulation mode)
 * for the base scenario and four rent variations, then lists the matching
 * rules (`regles_fiscales_applicables`) with their legal references.
 */

import { expect, test, type Page } from '@playwright/test';
import { installMockSupabase, realConsoleErrors } from './support/mockSupabase';

async function pickOption(page: Page, triggerLabel: string, optionLabel: string, search = false) {
  await page.getByRole('combobox', { name: triggerLabel }).click();
  const listbox = page.getByRole('listbox');
  if (search) await listbox.getByRole('textbox', { name: 'Rechercher...' }).fill(optionLabel);
  await listbox.getByRole('option', { name: optionLabel, exact: true }).click();
}

test.describe('Simulateur fiscal (bailleur)', () => {
  test('produit un résultat : impôt, scénarios, règles appliquées et références légales', async ({ page }) => {
    const backend = await installMockSupabase(page, { role: 'bailleur' });

    await page.goto('/bailleur/fiscalite/simulateur');
    const simulator = page.getByTestId('tax-simulator');
    await expect(simulator).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Simulateur fiscal' })).toBeVisible();

    const run = simulator.getByTestId('run-simulation');
    await expect(run).toBeDisabled();
    await expect(simulator.getByTestId('export-simulation')).toBeDisabled();

    // Inputs: type (default Appartement), commune, rent.
    await pickOption(page, 'Commune', 'Gombe', true);
    const rent = page.getByRole('textbox', { name: 'Loyer mensuel envisagé (CDF)' });
    await rent.fill('850000');
    await rent.blur();

    // Instant local estimate before the engine runs.
    await expect(simulator.getByText('Estimation rapide (avant simulation)')).toBeVisible();
    await expect(simulator.getByText(/85\s?000/).first()).toBeVisible();

    await expect(run).toBeEnabled();
    await run.click();

    // Engine result.
    const result = simulator.getByTestId('simulation-result');
    await expect(result).toBeVisible();
    await expect(result.getByText('Impôt mensuel estimé')).toBeVisible();
    await expect(result.getByText(/85\s?000/).first()).toBeVisible();
    await expect(result.getByText(/taux effectif 10 %/)).toBeVisible();
    await expect(result.getByText('Impôt annuel estimé')).toBeVisible();
    await expect(result.getByText(/1\s?020\s?000/)).toBeVisible();

    // Scenarios: −25 %, −10 %, reference, +10 %, +25 %.
    await expect(simulator.getByText('Scénarios de loyer')).toBeVisible();
    for (const label of ['Loyer −25 %', 'Loyer −10 %', 'Référence', 'Loyer +10 %', 'Loyer +25 %']) {
      await expect(simulator.getByRole('cell', { name: label, exact: true })).toBeVisible();
    }
    await expect(simulator.getByRole('cell', { name: /^63\s?750/ })).toBeVisible(); // 637 500 × 10 %
    await expect(simulator.getByRole('cell', { name: /^106\s?250/ })).toBeVisible(); // 1 062 500 × 10 %

    // Applied rules and legal references (placeholders flagged as pending validation).
    await expect(simulator.getByText('Règles appliquées et références légales')).toBeVisible();
    await expect(simulator.getByText(/Moteur fiscal v1\.0\.0/)).toBeVisible();
    await expect(simulator.getByText('Impôt sur revenus locatifs — résidentiel').first()).toBeVisible();
    await expect(simulator.getByText('Impôt sur revenus locatifs — taux par défaut').first()).toBeVisible();
    await expect(simulator.getByText(/en attente de validation/)).toBeVisible();
    await expect(simulator.getByText(/Code des impôts RDC/).first()).toBeVisible();

    await expect(simulator.getByTestId('export-simulation')).toBeEnabled();

    // Engine contract: 1 base + 4 scenarios, all in simulation mode; only the base is persisted.
    const calls = backend.callsTo('tax-calculate');
    expect(calls).toHaveLength(5);
    expect(calls.every((c) => c.body.simulation === true)).toBe(true);
    expect(calls.filter((c) => c.body.persist !== false)).toHaveLength(1);
    expect(calls.map((c) => Number(c.body.montantBrut)).sort((a, b) => a - b)).toEqual([637500, 765000, 850000, 935000, 1062500]);
    expect(calls[0]!.body.typeLogement).toBe('Appartement');
    expect(calls[0]!.body.commune).toBe('Gombe');
    expect(calls[0]!.body.typeContribuable).toBe('personne_physique');

    const rules = backend.rpcCalls.filter((c) => c.name === 'regles_fiscales_applicables');
    expect(rules).toHaveLength(1);
    expect(rules[0]!.args.p_type_logement).toBe('Appartement');
    expect(rules[0]!.args.p_commune).toBe('Gombe');
    expect(Number(rules[0]!.args.p_montant)).toBe(850000);

    expect(realConsoleErrors(backend)).toEqual([]);
  });

  test('applique le taux commercial et signale l’exonération micro-loyer', async ({ page }) => {
    const backend = await installMockSupabase(page, { role: 'bailleur' });

    await page.goto('/bailleur/fiscalite/simulateur');
    const simulator = page.getByTestId('tax-simulator');

    await pickOption(page, 'Type de logement', 'Bureau');
    await pickOption(page, 'Commune', 'Gombe', true);
    const rent = page.getByRole('textbox', { name: 'Loyer mensuel envisagé (CDF)' });
    await rent.fill('1200000');
    await simulator.getByTestId('run-simulation').click();

    const result = simulator.getByTestId('simulation-result');
    await expect(result.getByText(/180\s?000/).first()).toBeVisible();
    await expect(result.getByText(/taux effectif 15 %/)).toBeVisible();
    await expect(simulator.getByText('Impôt sur revenus locatifs — commercial').first()).toBeVisible();

    // Micro-rent → exemption.
    await rent.fill('40000');
    await simulator.getByTestId('run-simulation').click();
    await expect(result.getByText('Exonéré', { exact: true })).toBeVisible();
    await expect(simulator.getByText(/Loyer inférieur au seuil minimum imposable/).first()).toBeVisible();

    expect(backend.callsTo('tax-calculate')).toHaveLength(10);
    expect(realConsoleErrors(backend)).toEqual([]);
  });
});
