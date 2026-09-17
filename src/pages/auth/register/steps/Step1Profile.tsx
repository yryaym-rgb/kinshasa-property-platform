import type { RegisterRole } from '@/lib/authStorage';
import { validate } from '@/validations/authSchemas';
import { ProfileSelector } from '@/components/auth/ProfileSelector';
import { registerProfileSchema } from '../schemas/step1.schema';

interface Step1ProfileProps {
  value: RegisterRole | null;
  onChange: (role: RegisterRole) => void;
  error?: string;
}

export function validateStep1(role: RegisterRole | null): boolean {
  return validate(registerProfileSchema, { role }).success;
}

/**
 * Step 1 — "Je suis…". Part of the initial register chunk: its three cards
 * are the page's largest visible content, so they must render on first commit.
 */
export function Step1Profile({ value, onChange, error }: Step1ProfileProps) {
  return <ProfileSelector value={value} onChange={onChange} error={error} labelledBy="register-title" />;
}
