import { useT } from '@/i18n';
import { FacebookIcon, GoogleIcon } from '@/components/landing/icons';
import { AuthButton } from './primitives';

type Provider = 'google' | 'facebook';

interface SocialLoginButtonProps {
  provider: Provider;
  onClick?: () => void;
  /** Providers are not enabled on the Supabase project yet; render disabled with a "coming soon" hint. */
  comingSoon?: boolean;
}

/**
 * Reserved for the upcoming Google / Facebook OAuth providers. Not rendered by
 * the current pages; wire it into LoginPage once the providers are configured.
 */
export function SocialLoginButton({ provider, onClick, comingSoon = true }: SocialLoginButtonProps) {
  const t = useT();
  const label = provider === 'google' ? t('social.google') : t('social.facebook');

  return (
    <AuthButton
      variant="outline"
      onClick={onClick}
      disabled={comingSoon}
      icon={provider === 'google' ? <GoogleIcon size={20} /> : <FacebookIcon size={20} className="text-[#1877F2]" />}
      aria-label={comingSoon ? `${label} — ${t('social.soon')}` : label}
    >
      {label}
      {comingSoon ? <span className="ml-auto text-[11px] font-semibold uppercase tracking-[1px] text-drc-gray-500">{t('social.soon')}</span> : null}
    </AuthButton>
  );
}
