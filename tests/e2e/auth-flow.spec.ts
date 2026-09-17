import {
  BAILLEUR,
  LOCATAIRE,
  STRONG_PASSWORD,
  WEAK_PASSWORD,
  completeStep1,
  completeStep2,
  e164,
  enterOtp,
  expect,
  expectDashboard,
  expectOtpPage,
  fillStep2,
  fillStep3,
  loginWithPhone,
  logout,
  openRegisterFromLanding,
  registerToOtp,
  registerHeading,
  submitRegistration,
  test,
  type Applicant,
} from './support/fixtures';
import { OTP_CODE } from './support/supabase-mock';

/* ── Happy path: landing → register → OTP → dashboard → refresh → logout → login ── */

for (const applicant of [BAILLEUR, LOCATAIRE]) {
  test.describe(`${applicant.role} — full flow`, () => {
    test('landing → register (3 steps) → OTP → dashboard → refresh → logout → login', async ({ page, supabase, isMobile, authConsoleIssues }) => {
      await test.step('1. Landing → "Créer un compte" → Register step 1', async () => {
        await openRegisterFromLanding(page, isMobile);
      });

      await test.step(`2. Select "${applicant.role}" → Step 2`, async () => {
        await completeStep1(page, applicant.role);
      });

      await test.step('3. Fill info with valid DRC phone → Step 3', async () => {
        await completeStep2(page, applicant);
      });

      await test.step('4. Set strong password → Submit → OTP page', async () => {
        await fillStep3(page, STRONG_PASSWORD);
        await expect(page.getByText('Les mots de passe correspondent')).toBeVisible();
        await submitRegistration(page);
        await expectOtpPage(page, applicant.phone);
        expect(supabase.users.get(e164(applicant.phone))?.confirmed).toBe(false);
      });

      await test.step('5. Enter correct OTP → Redirect to dashboard', async () => {
        await enterOtp(page, OTP_CODE);
        await expect(page.getByText('Numéro vérifié')).toBeVisible();
        await expectDashboard(page, applicant);
        expect(supabase.users.get(e164(applicant.phone))?.confirmed).toBe(true);
        const profile = [...supabase.profiles.values()].find((p) => p.phone === e164(applicant.phone));
        expect(profile).toMatchObject({ role: applicant.role, full_name: applicant.fullName, commune: applicant.commune });
        if (applicant.role === 'bailleur') {
          expect(profile?.kyc_status, 'identity document uploaded').toBe('submitted');
          expect(supabase.calls.some((c) => c.method === 'POST' && c.path.startsWith('/rest/v1/bailleurs'))).toBe(true);
        }
      });

      await test.step('6. Refresh dashboard → still logged in', async () => {
        await page.reload();
        await expectDashboard(page, applicant);
      });

      await test.step('7. Logout → back to public site', async () => {
        await logout(page);
        expect(supabase.calls.some((c) => c.path.startsWith('/auth/v1/logout'))).toBe(true);
        // The session is gone: a protected URL bounces back to /login.
        await page.goto(applicant.role === 'bailleur' ? '/bailleur/tableau-de-bord' : '/locataire/tableau-de-bord');
        await expect(page).toHaveURL(/\/login$/);
      });

      await test.step('8. Login with same credentials → works', async () => {
        await loginWithPhone(page, applicant.phone, STRONG_PASSWORD);
        await expectDashboard(page, applicant);
      });

      expect(authConsoleIssues).toEqual([]);
    });
  });
}

/* ── Error cases ─────────────────────────────────────────────────── */

test.describe('register — validation', () => {
  test('invalid phone format is rejected on step 2', async ({ page, isMobile }) => {
    await openRegisterFromLanding(page, isMobile);
    await completeStep1(page, LOCATAIRE.role);

    for (const bad of ['12345', '712345678', '0812345']) {
      await fillStep2(page, { ...LOCATAIRE, phone: bad });
      await page.getByRole('button', { name: 'Continuer' }).click();
      await expect(registerHeading(page)).toHaveText('Vos informations personnelles');
      await expect(page.getByText('Entrez un numéro mobile congolais valide (9 chiffres).')).toBeVisible();
      await expect(page.locator('#register-phone')).toBeFocused();
    }

    // A landline-looking prefix normalises but still fails; a valid mobile passes.
    await fillStep2(page, LOCATAIRE);
    await page.getByRole('button', { name: 'Continuer' }).click();
    await expect(registerHeading(page)).toHaveText('Sécurisez votre compte');
  });

  test('weak password is rejected on step 3', async ({ page, isMobile, supabase }) => {
    await openRegisterFromLanding(page, isMobile);
    await completeStep1(page, LOCATAIRE.role);
    await completeStep2(page, LOCATAIRE);

    await fillStep3(page, WEAK_PASSWORD);
    await expect(page.getByText(/faible/i).first()).toBeVisible();
    await submitRegistration(page);

    await expect(registerHeading(page)).toHaveText('Sécurisez votre compte');
    await expect(page.getByText('Votre mot de passe doit contenir au moins 8 caractères.')).toBeVisible();
    await expect(page.locator('#register-password')).toBeFocused();
    expect(supabase.calls.filter((c) => c.path.startsWith('/auth/v1/signup'))).toHaveLength(0);
  });

  test('mismatched password confirmation is rejected on step 3', async ({ page, isMobile, supabase }) => {
    await openRegisterFromLanding(page, isMobile);
    await completeStep1(page, LOCATAIRE.role);
    await completeStep2(page, LOCATAIRE);

    await fillStep3(page, STRONG_PASSWORD, `${STRONG_PASSWORD}x`);
    await submitRegistration(page);

    await expect(registerHeading(page)).toHaveText('Sécurisez votre compte');
    await expect(page.getByText('Les mots de passe ne correspondent pas.')).toBeVisible();
    await expect(page.locator('#register-confirm')).toBeFocused();
    expect(supabase.calls.filter((c) => c.path.startsWith('/auth/v1/signup'))).toHaveLength(0);
  });
});

test.describe('OTP — error handling', () => {
  test('wrong OTP: 3 attempts, then the verifier locks and asks for a new code', async ({ page, isMobile, supabase }) => {
    await registerToOtp(page, LOCATAIRE, isMobile);

    await enterOtp(page, '000000');
    await expect(page.getByText('Code incorrect. Il vous reste 2 tentative(s).')).toBeVisible();
    await enterOtp(page, '111111');
    await expect(page.getByText('Code incorrect. Il vous reste 1 tentative(s).')).toBeVisible();
    await enterOtp(page, '222222');
    await expect(page.getByText(/Trop de tentatives\. Demandez un nouveau code\./).first()).toBeVisible();

    // Locked: the inputs are disabled and even the right code is not sent.
    const verifyCalls = supabase.calls.filter((c) => c.path.startsWith('/auth/v1/verify')).length;
    expect(verifyCalls).toBe(3);
    await expect(page.getByRole('textbox', { name: 'Chiffre 1 sur 6' })).toBeDisabled();
    expect(supabase.users.get(e164(LOCATAIRE.phone))?.confirmed).toBe(false);
  });

  test('expired OTP (after 5 min): rejected, a fresh code can be requested and works', async ({ page, isMobile, supabase }) => {
    await page.clock.install();
    await registerToOtp(page, LOCATAIRE, isMobile);

    // Five minutes pass: GoTrue now rejects the original code as expired and the resend cooldown is over.
    // (`runFor`, not `fastForward`: the cooldown is a chained 1 s setTimeout that must tick every second.)
    supabase.expireOtps = true;
    await page.clock.runFor('05:01');

    await enterOtp(page, OTP_CODE);
    await expect(page.getByText(/Code incorrect/)).toBeVisible();
    expect(supabase.users.get(e164(LOCATAIRE.phone))?.confirmed).toBe(false);

    const resend = page.getByRole('button', { name: 'Renvoyer le code' });
    await expect(resend).toBeEnabled();
    await resend.click();
    await expect(page.getByText('Un nouveau code a été envoyé.')).toBeVisible();
    expect(supabase.calls.some((c) => c.path.startsWith('/auth/v1/resend'))).toBe(true);

    await enterOtp(page, OTP_CODE);
    await expect(page.getByText('Numéro vérifié')).toBeVisible();
    await page.clock.runFor(1500);
    await expectDashboard(page, LOCATAIRE);
  });
});

test.describe('register — duplicates', () => {
  test('duplicate phone: sign-up looks identical to a new account (no enumeration), code never verifies', async ({ page, isMobile, supabase }) => {
    supabase.seed({ phone: e164(BAILLEUR.phone), password: 'Existing#Pass1234', fullName: 'Compte Existant', role: 'bailleur' });

    await registerToOtp(page, BAILLEUR, isMobile);
    // GoTrue answered 422 user_already_exists; the UI moved on to /verify as for anyone else.
    expect(supabase.calls.some((c) => c.path.startsWith('/auth/v1/signup'))).toBe(true);

    await enterOtp(page, OTP_CODE);
    await expect(page.getByText(/Code incorrect/)).toBeVisible();
    // The pre-existing account is untouched.
    expect(supabase.users.get(e164(BAILLEUR.phone))?.password).toBe('Existing#Pass1234');
    expect(supabase.profiles.size).toBe(1);
  });

  test('duplicate email: the account is created, the e-mail is not attached (no enumeration)', async ({ page, isMobile, supabase }) => {
    supabase.seed({ phone: e164('899999999'), password: 'Other#Pass1234', email: BAILLEUR.email, fullName: 'Autre Bailleur', role: 'bailleur' });

    await registerToOtp(page, BAILLEUR, isMobile);
    await enterOtp(page, OTP_CODE);
    await expectDashboard(page, BAILLEUR);

    const owner = supabase.userByEmail(BAILLEUR.email);
    expect(owner?.phone, 'e-mail still belongs to the original account').toBe(e164('899999999'));
    const created = supabase.users.get(e164(BAILLEUR.phone));
    expect(created?.confirmed).toBe(true);
    expect(created?.email, 'duplicate e-mail was not attached to the new account').toBeNull();
    expect(supabase.calls.some((c) => c.method === 'PUT' && c.path.startsWith('/auth/v1/user'))).toBe(true);
  });
});

test.describe('login — errors', () => {
  const existing: Applicant = { ...LOCATAIRE, phone: '817777777' };

  test('wrong password shows a generic error and counts an attempt', async ({ page, supabase }) => {
    supabase.seed({ phone: e164(existing.phone), password: STRONG_PASSWORD, fullName: existing.fullName, role: 'locataire' });

    await loginWithPhone(page, existing.phone, 'Wrong#Password1');
    await expect(page.getByText(/Identifiants incorrects/)).toBeVisible();
    await expect(page.getByText('Il vous reste 4 tentative(s).')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('invalid phone format is rejected before any request', async ({ page, supabase }) => {
    await loginWithPhone(page, '12345', STRONG_PASSWORD);
    await expect(page.getByText('Entrez un numéro mobile congolais valide (9 chiffres).')).toBeVisible();
    expect(supabase.calls.filter((c) => c.path.startsWith('/auth/v1/token'))).toHaveLength(0);
  });
});
