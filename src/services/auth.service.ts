import { supabase } from '@/config/supabase';
import { AUTH_CONFIG } from '@/config/app.config';
import type { RegisterDraft } from '@/lib/authStorage';
import type { UserProfileFormData } from '@/types';
import type { InsertTables } from '@/types/database.types';

/* ── Errors ──────────────────────────────────────────────────── */

export type AuthErrorCode =
  | 'invalid_credentials'
  | 'otp_invalid'
  | 'otp_expired'
  | 'rate_limited'
  | 'weak_password'
  | 'same_password'
  | 'session_required'
  | 'network'
  | 'unknown';

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'AuthError';
    this.code = code;
  }
}

interface SupabaseErrorLike {
  message: string;
  code?: string;
  status?: number;
}

/**
 * Collapses Supabase error codes into a short, non-revealing set. Anything
 * that could disclose whether an account exists maps to `invalid_credentials`.
 */
function toAuthError(error: SupabaseErrorLike): AuthError {
  const code = error.code ?? '';
  if (/rate_limit|too_many/i.test(code) || error.status === 429) return new AuthError('rate_limited', error.message);
  if (code === 'otp_expired') return new AuthError('otp_expired', error.message);
  if (code === 'otp_disabled' || /invalid.*(otp|token)/i.test(code) || /token has expired or is invalid/i.test(error.message)) {
    return new AuthError('otp_invalid', error.message);
  }
  if (code === 'weak_password') return new AuthError('weak_password', error.message);
  if (code === 'same_password') return new AuthError('same_password', error.message);
  if (/invalid_credentials|user_not_found|invalid_grant|email_not_confirmed|phone_not_confirmed/i.test(code)) {
    return new AuthError('invalid_credentials', error.message);
  }
  if (/fetch|network|hors ligne|Failed to fetch/i.test(error.message)) return new AuthError('network', error.message);
  return new AuthError('unknown', error.message);
}

export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}

/* ── OTP ─────────────────────────────────────────────────────── */

export async function sendOTP(phone: string, options: { shouldCreateUser?: boolean } = {}): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: { shouldCreateUser: options.shouldCreateUser ?? false, channel: 'sms' },
  });
  if (!error) return;
  // Unknown numbers are reported like a sent code so the UI cannot be used to
  // enumerate registered phones; the verification step will simply fail.
  if (/signup|not allowed|not found/i.test(`${error.code ?? ''} ${error.message}`)) return;
  throw toAuthError(error);
}

/** Re-sends the sign-up confirmation SMS (distinct endpoint from a sign-in OTP). */
export async function resendSignUpOTP(phone: string): Promise<void> {
  const { error } = await supabase.auth.resend({ type: 'sms', phone });
  if (error && !/already|confirmed/i.test(error.message)) throw toAuthError(error);
}

export async function verifyOTP(phone: string, token: string) {
  const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
  if (error) throw toAuthError(error);
  if (!data.session) throw new AuthError('otp_invalid');
  return data;
}

/* ── Password sign-in ────────────────────────────────────────── */

export async function signInWithPassword(
  credentials: { phone: string; password: string } | { email: string; password: string },
) {
  const { data, error } = await supabase.auth.signInWithPassword(credentials);
  if (error) throw toAuthError(error);
  return data;
}

/* ── Registration ────────────────────────────────────────────── */

/**
 * Creates the auth user (phone + password) and triggers the confirmation SMS.
 * Profile data is carried in `user_metadata` and written to `users` only once
 * the phone has been verified (see `completeRegistration`).
 */
export async function signUpWithPhone(input: { phone: string; password: string; fullName: string; role: string }): Promise<void> {
  const { error } = await supabase.auth.signUp({
    phone: input.phone,
    password: input.password,
    options: { channel: 'sms', data: { full_name: input.fullName, role: input.role } },
  });
  if (!error) return;
  // Existing accounts must look identical to new ones from the outside.
  if (/already|exists/i.test(`${error.code ?? ''} ${error.message}`)) return;
  throw toAuthError(error);
}

export async function completeRegistration(userId: string, draft: RegisterDraft) {
  if (!draft.role) throw new AuthError('unknown', 'role manquant');

  const profile: InsertTables<'users'> = {
    id: userId,
    phone: `+243${draft.phone}`,
    full_name: draft.fullName.trim(),
    email: draft.email.trim() || null,
    role: draft.role,
    commune: draft.commune || null,
    address: draft.address.trim() || null,
    kyc_status: 'pending',
    is_active: true,
  };

  const { data, error } = await supabase.from('users').upsert(profile, { onConflict: 'id' }).select().single();
  if (error) throw toAuthError(error);

  if (draft.role === 'bailleur' || draft.role === 'agence') {
    const { error: bailleurError } = await supabase.from('bailleurs').upsert({ user_id: userId }, { onConflict: 'user_id' });
    if (bailleurError && !/duplicate|unique/i.test(bailleurError.message)) throw toAuthError(bailleurError);
  }

  return data;
}

/** Uploads the identity document; failures are non-fatal for the sign-up itself. */
export async function uploadKycDocument(userId: string, file: File): Promise<string | null> {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
  const path = `${userId}/identity-${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from(AUTH_CONFIG.kycBucket).upload(path, file, { upsert: true, contentType: file.type });
  if (error) return null;

  await supabase
    .from('users')
    .update({ kyc_status: 'submitted', kyc_documents: [{ type: 'identity', path, uploaded_at: new Date().toISOString() }] })
    .eq('id', userId);

  return path;
}

/** Attaches an email to the account; Supabase sends the verification link. */
export async function requestEmailVerification(email: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ email });
  if (error && !/already|exists/i.test(error.message)) throw toAuthError(error);
}

/* ── Password reset ──────────────────────────────────────────── */

export async function resetPasswordByEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  // Unknown addresses look like success — never confirm whether an account exists.
  if (error && !/not found|user/i.test(`${error.code ?? ''} ${error.message}`)) throw toAuthError(error);
}

export async function updatePassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw toAuthError(error);
}

/* ── Profile & session ───────────────────────────────────────── */

export async function fetchUserProfile(userId: string) {
  const { data, error } = await supabase.from('users').select('*, bailleurs(*)').eq('id', userId).single();
  if (error) throw toAuthError(error);
  const { bailleurs, ...user } = data;
  return {
    ...user,
    bailleur: Array.isArray(bailleurs) ? (bailleurs[0] ?? null) : (bailleurs ?? null),
  };
}

export async function updateProfile(userId: string, data: UserProfileFormData) {
  const { data: updated, error } = await supabase
    .from('users')
    .update({
      full_name: data.fullName,
      email: data.email ?? null,
      commune: data.commune ?? null,
      address: data.address ?? null,
      avatar_url: data.avatarUrl ?? null,
    })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw toAuthError(error);
  return updated;
}

export async function logout(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw toAuthError(error);
}

export async function refreshSession() {
  const { data, error } = await supabase.auth.refreshSession();
  if (error) throw toAuthError(error);
  return data;
}
