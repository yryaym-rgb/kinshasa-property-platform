import { expect, test as base, type Page } from '@playwright/test';
import { SupabaseMock } from './supabase-mock';

export const AUTH_PATHS = ['/', '/login', '/register', '/verify', '/forgot-password', '/reset-password'];

export interface ConsoleIssue {
  url: string;
  text: string;
}

interface Fixtures {
  supabase: SupabaseMock;
  /** Console errors and uncaught exceptions raised while an auth/public page was showing. */
  authConsoleIssues: ConsoleIssue[];
}

/**
 * Every test gets a fresh in-memory Supabase and a console-error collector.
 * The suite asserts that no auth page produced a console error.
 */
export const test = base.extend<Fixtures>({
  supabase: async ({ page }, provide) => {
    const mock = new SupabaseMock();
    await mock.install(page);
    await provide(mock);
  },
  authConsoleIssues: async ({ page }, provide) => {
    const issues: ConsoleIssue[] = [];
    const onAuthPage = () => AUTH_PATHS.includes(new URL(page.url()).pathname.replace(/\/+$/, '') || '/');
    page.on('console', (message) => {
      if (message.type() === 'error' && onAuthPage()) issues.push({ url: page.url(), text: message.text() });
    });
    page.on('pageerror', (error) => {
      if (onAuthPage()) issues.push({ url: page.url(), text: error.message });
    });
    await provide(issues);
    expect(issues, 'console errors on auth pages').toEqual([]);
  },
});

export { expect };

/* ── Test data ────────────────────────────────────────────────── */

export const STRONG_PASSWORD = 'Kinshasa#2026!Loyer';
export const WEAK_PASSWORD = 'abc123';

export interface Applicant {
  role: 'bailleur' | 'locataire';
  fullName: string;
  /** Nine national digits, e.g. "812345678". */
  phone: string;
  email: string;
  commune: string;
}

export const BAILLEUR: Applicant = {
  role: 'bailleur',
  fullName: 'Jean-Pierre Mukendi',
  phone: '812345678',
  email: 'jp.mukendi@example.cd',
  commune: 'Gombe',
};

export const LOCATAIRE: Applicant = {
  role: 'locataire',
  fullName: 'Marie Kabila',
  phone: '998765432',
  email: '',
  commune: 'Lingwala',
};

export const e164 = (digits: string) => `+243${digits}`;

/* ── Page helpers ─────────────────────────────────────────────── */

const ROLE_LABEL: Record<Applicant['role'], string> = { bailleur: 'Bailleur', locataire: 'Locataire' };

/** A 1×1 PNG, enough for the identity-document dropzone. */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

export const registerHeading = (page: Page) => page.getByRole('heading', { level: 1 });

export async function openRegisterFromLanding(page: Page, isMobile: boolean) {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: /Chaque logement/ })).toBeVisible();
  if (isMobile) await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await page.getByRole('link', { name: 'Créer un compte', exact: true }).first().click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(registerHeading(page)).toHaveText('Je suis…');
}

export async function completeStep1(page: Page, role: Applicant['role']) {
  await page.getByRole('radio', { name: new RegExp(`^${ROLE_LABEL[role]}`) }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(registerHeading(page)).toHaveText('Vos informations personnelles');
}

export async function fillStep2(page: Page, applicant: Applicant, options: { document?: boolean } = {}) {
  await page.locator('#register-fullName').fill(applicant.fullName);
  await page.locator('#register-phone').fill(applicant.phone);
  if (applicant.email) await page.locator('#register-email').fill(applicant.email);
  await page.locator('#register-commune').selectOption(applicant.commune);
  if (options.document ?? applicant.role === 'bailleur') {
    await page.locator('input[type="file"]').setInputFiles({ name: 'carte-identite.png', mimeType: 'image/png', buffer: TINY_PNG });
  }
}

export async function completeStep2(page: Page, applicant: Applicant) {
  await fillStep2(page, applicant);
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(registerHeading(page)).toHaveText('Sécurisez votre compte');
}

export async function fillStep3(page: Page, password: string, confirm = password) {
  await page.locator('#register-password').fill(password);
  await page.locator('#register-confirm').fill(confirm);
  // The native checkbox is visually hidden; users tap the styled box (the label
  // text also holds the CGU links, so the box is the only safe pointer target).
  await page.locator('label[for="register-acceptTerms"] .auth-check__box').click();
  await expect(page.locator('#register-acceptTerms')).toBeChecked();
}

export const submitRegistration = (page: Page) => page.getByRole('button', { name: 'Créer mon compte' }).click();

export async function expectOtpPage(page: Page, phone: string) {
  await expect(page).toHaveURL(new RegExp(`/verify\\?phone=${encodeURIComponent(e164(phone)).replace(/\+/g, '\\+')}`));
  await expect(registerHeading(page)).toHaveText('Vérifiez votre numéro');
}

export async function enterOtp(page: Page, code: string) {
  await page.getByRole('textbox', { name: 'Chiffre 1 sur 6' }).click();
  await page.keyboard.type(code, { delay: 20 });
}

export const dashboardPath: Record<Applicant['role'], RegExp> = {
  bailleur: /\/bailleur\/tableau-de-bord$/,
  locataire: /\/locataire\/tableau-de-bord$/,
};

export async function expectDashboard(page: Page, applicant: Applicant) {
  await expect(page).toHaveURL(dashboardPath[applicant.role], { timeout: 15_000 });
  const firstName = applicant.fullName.split(' ')[0]!;
  await expect(page.getByRole('heading', { level: 1, name: new RegExp(firstName) })).toBeVisible({ timeout: 15_000 });
}

export async function logout(page: Page) {
  // The account menu trigger is named by the user's initials/full name, so target it structurally.
  await page.locator('header button[aria-haspopup="true"]').last().click();
  await page.getByRole('button', { name: 'Déconnexion' }).click();
  await expect(page).toHaveURL(/\/login$/);
}

export async function loginWithPhone(page: Page, phone: string, password: string) {
  await page.goto('/login');
  await expect(registerHeading(page)).toHaveText('Se connecter');
  await page.locator('#login-phone').fill(phone);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
}

/** Runs the three registration steps for `applicant` and lands on the OTP page. */
export async function registerToOtp(page: Page, applicant: Applicant, isMobile: boolean, password = STRONG_PASSWORD) {
  await openRegisterFromLanding(page, isMobile);
  await completeStep1(page, applicant.role);
  await completeStep2(page, applicant);
  await fillStep3(page, password);
  await submitRegistration(page);
  await expectOtpPage(page, applicant.phone);
}
