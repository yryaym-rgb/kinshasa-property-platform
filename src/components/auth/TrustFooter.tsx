import { Link } from 'react-router-dom';
import { useT } from '@/i18n';
import { KINSHASA_LOGO_SRC } from '@/components/landing/primitives/KinshasaLogo';
import { LockIcon } from '@/components/landing/icons';

/** Security reassurance + institutional signature shown under every auth card. */
export function TrustFooter() {
  const t = useT();

  return (
    <footer className="auth-trust">
      <p className="auth-trust__row">
        <LockIcon size={14} aria-hidden="true" />
        <span>{t('common.secure')}</span>
      </p>
      <p className="auth-trust__row">
        <img src={KINSHASA_LOGO_SRC} alt="" width={20} height={20} loading="lazy" decoding="async" />
        <span>{t('common.city')}</span>
        <span className="auth-trust__sep" aria-hidden="true">
          ·
        </span>
        <Link to="/conditions">{t('common.terms')}</Link>
        <span className="auth-trust__sep" aria-hidden="true">
          ·
        </span>
        <Link to="/confidentialite">{t('common.privacy')}</Link>
      </p>
    </footer>
  );
}
