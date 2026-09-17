import { useT } from '@/i18n';
import type { Step } from '../wizard';

type Block = 'field' | 'field-help' | 'meter' | 'drop' | 'checks';

// Mirrors each step's field order so the real form lands on the same rows.
const LAYOUT: Record<Exclude<Step, 1>, readonly Block[]> = {
  2: ['field', 'field-help', 'field-help', 'field', 'field', 'drop'],
  3: ['field', 'meter', 'field', 'field-help', 'checks'],
};

function Bar({ width, height = 14 }: { width: string; height?: number }) {
  return <span className="auth-skel__bar" style={{ width, height }} />;
}

function Field({ help }: { help?: boolean }) {
  return (
    <div className="auth-skel__field">
      <span className="auth-skel__line">
        <Bar width="38%" />
      </span>
      <span className="auth-skel__control" />
      {help ? (
        <span className="auth-skel__line auth-skel__line--help">
          <Bar width="72%" height={12} />
        </span>
      ) : null}
    </div>
  );
}

/**
 * Suspense fallback for the lazy wizard steps: a quiet shimmer laid out like
 * the incoming form so the card keeps its height and nothing jumps.
 */
export function StepSkeleton({ step }: { step: Exclude<Step, 1> }) {
  const t = useT();

  return (
    <div className="auth-skel" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{t('common.loading')}</span>
      {LAYOUT[step].map((block, i) => {
        switch (block) {
          case 'field':
            return <Field key={i} />;
          case 'field-help':
            return <Field key={i} help />;
          case 'meter':
            return (
              <div key={i} className="auth-skel__meter" aria-hidden="true">
                <span className="auth-skel__bars">
                  <span className="auth-skel__bar" />
                  <span className="auth-skel__bar" />
                  <span className="auth-skel__bar" />
                </span>
                <Bar width="46%" height={12} />
                <span className="auth-skel__rules">
                  <Bar width="80%" height={12} />
                  <Bar width="70%" height={12} />
                  <Bar width="75%" height={12} />
                  <Bar width="65%" height={12} />
                </span>
              </div>
            );
          case 'drop':
            return (
              <div key={i} className="auth-skel__field">
                <span className="auth-skel__line">
                  <Bar width="44%" />
                </span>
                <span className="auth-skel__drop" />
                <span className="auth-skel__line auth-skel__line--help">
                  <Bar width="64%" height={12} />
                </span>
              </div>
            );
          case 'checks':
            return (
              <div key={i} className="auth-skel__checks" aria-hidden="true">
                <span className="auth-skel__check">
                  <span className="auth-skel__box" />
                  <span className="auth-skel__lines">
                    <Bar width="92%" height={12} />
                    <Bar width="60%" height={12} />
                  </span>
                </span>
                <span className="auth-skel__check">
                  <span className="auth-skel__box" />
                  <span className="auth-skel__lines">
                    <Bar width="70%" height={12} />
                  </span>
                </span>
              </div>
            );
        }
      })}
    </div>
  );
}
