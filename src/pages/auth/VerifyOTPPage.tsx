import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Shield, Lock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { OTP_CONFIG } from '@/config/app.config';
import { ROUTES } from '@/config/routes';
import { toastError } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';

export function VerifyOTPPage() {
  const [searchParams] = useSearchParams();
  const phone = searchParams.get('phone') ?? '';
  const { verifyOTPCode, loginWithOTP, loading } = useAuth();
  const [digits, setDigits] = useState<string[]>(Array(OTP_CONFIG.length).fill(''));
  const [countdown, setCountdown] = useState<number>(OTP_CONFIG.resendDelaySeconds);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const submitOTP = useCallback(async (code: string) => {
    if (!phone) {
      toastError('Numéro de téléphone manquant');
      return;
    }
    try {
      await verifyOTPCode(phone, code);
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Code invalide');
      setDigits(Array(OTP_CONFIG.length).fill(''));
      inputRefs.current[0]?.focus();
    }
  }, [phone, verifyOTPCode]);

  useEffect(() => {
    const code = digits.join('');
    if (code.length === OTP_CONFIG.length && digits.every(Boolean)) {
      void submitOTP(code);
    }
  }, [digits, submitOTP]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...digits];
    newDigits[index] = value.slice(-1);
    setDigits(newDigits);
    if (value && index < OTP_CONFIG.length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_CONFIG.length);
    const newDigits = [...digits];
    pasted.split('').forEach((char, i) => { newDigits[i] = char; });
    setDigits(newDigits);
  };

  const handleResend = async () => {
    if (countdown > 0 || !phone) return;
    try {
      await loginWithOTP(phone);
      setCountdown(OTP_CONFIG.resendDelaySeconds);
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Erreur de renvoi');
    }
  };

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="animate-fade-in text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-accent)]">
        <Shield className="h-8 w-8 text-[var(--color-primary)]" />
      </div>

      <h1 className="font-heading text-2xl font-bold">Vérification OTP</h1>
      <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
        Entrez le code à 6 chiffres envoyé au{' '}
        <span className="font-medium text-[var(--color-foreground)]">{phone}</span>
      </p>

      <div className="mt-8 flex justify-center gap-2" onPaste={handlePaste}>
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => { inputRefs.current[index] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            className={cn(
              'h-12 w-10 rounded-lg border-2 text-center text-lg font-bold',
              'border-[var(--color-input)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]',
              digit && 'border-[var(--color-primary)]',
            )}
            aria-label={`Chiffre ${index + 1}`}
            autoFocus={index === 0}
          />
        ))}
      </div>

      <Button
        className="mt-6 w-full"
        loading={loading}
        onClick={() => void submitOTP(digits.join(''))}
        disabled={digits.some((d) => !d)}
      >
        Vérifier
      </Button>

      <p className="mt-4 text-sm text-[var(--color-muted-foreground)]">
        {countdown > 0 ? (
          <>Renvoyer le code ({formatCountdown(countdown)})</>
        ) : (
          <button
            type="button"
            onClick={() => void handleResend()}
            className="font-medium text-[var(--color-primary)] hover:underline"
          >
            Renvoyer le code
          </button>
        )}
      </p>

      <div className="mt-8 flex items-center justify-center gap-2 text-xs text-[var(--color-muted-foreground)]">
        <Lock className="h-4 w-4" />
        <span>Authentification sécurisée à deux facteurs</span>
      </div>

      <Link to={ROUTES.LOGIN} className="mt-4 inline-block text-sm text-[var(--color-primary)] hover:underline">
        Retour à la connexion
      </Link>
    </div>
  );
}
