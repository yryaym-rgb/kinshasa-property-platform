import { supabase } from '@/config/supabase';
import type { RegisterFormData, UserProfileFormData } from '@/types';
import type { InsertTables } from '@/types/database.types';

const AUTH_ERRORS: Record<string, string> = {
  invalid_credentials: 'Identifiants invalides',
  user_not_found: 'Utilisateur non trouvé',
  otp_expired: 'Le code OTP a expiré. Veuillez en demander un nouveau.',
  otp_invalid: 'Code OTP invalide',
  phone_exists: 'Ce numéro de téléphone est déjà enregistré',
  too_many_requests: 'Trop de tentatives. Veuillez réessayer plus tard.',
};

function translateError(error: { message: string; code?: string }): Error {
  const translated = AUTH_ERRORS[error.code ?? ''] ?? error.message;
  return new Error(translated);
}

export async function sendOTP(phone: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) throw translateError(error);
}

export async function verifyOTP(phone: string, token: string) {
  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: 'sms',
  });
  if (error) throw translateError(error);
  return data;
}

export async function signInWithPassword(phone: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    phone,
    password,
  });
  if (error) throw translateError(error);
  return data;
}

export async function registerUser(userData: RegisterFormData & { id: string }) {
  const profile: InsertTables<'users'> = {
    id: userData.id,
    phone: userData.phone,
    full_name: userData.fullName,
    email: userData.email ?? null,
    role: userData.role,
    commune: userData.commune ?? null,
    address: userData.address ?? null,
    kyc_status: 'pending',
    is_active: true,
  };

  const { data, error } = await supabase.from('users').insert(profile).select().single();
  if (error) throw translateError(error);

  if (userData.role === 'bailleur') {
    await supabase.from('bailleurs').insert({ user_id: userData.id });
  }

  return data;
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

  if (error) throw translateError(error);
  return updated;
}

export async function fetchUserProfile(userId: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*, bailleurs(*)')
    .eq('id', userId)
    .single();

  if (error) throw translateError(error);
  return data;
}

export async function logout(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw translateError(error);
}

export async function refreshSession() {
  const { data, error } = await supabase.auth.refreshSession();
  if (error) throw translateError(error);
  return data;
}

export async function resetPassword(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw translateError(error);
}

export async function sendPasswordResetOTP(phone: string): Promise<void> {
  await sendOTP(phone);
}
