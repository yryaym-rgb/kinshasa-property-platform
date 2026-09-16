import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useUIStore } from '@/stores/ui.store';
import { LANGUAGES, loadLocale, useT, type Language } from '@/i18n';
import { CheckIcon, ChevronDownIcon, DRCFlag } from '@/components/landing/icons';

/**
 * Dependency-free WAI-ARIA menu button for the auth surface (same keyboard
 * contract as the landing navbar's menu, without framer-motion so the auth
 * bundle stays small).
 */
export function LanguageSwitcher() {
  const t = useT();
  const language = useUIStore((s) => s.language);
  const setLanguage = useUIStore((s) => s.setLanguage);
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const current = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0]!;

  const openMenu = () => {
    setFocusIndex(Math.max(0, LANGUAGES.findIndex((l) => l.code === current.code)));
    setOpen(true);
  };

  const closeMenu = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) buttonRef.current?.focus();
  };

  useEffect(() => {
    if (open) itemRefs.current[focusIndex]?.focus();
  }, [open, focusIndex]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const choose = async (code: Language) => {
    await loadLocale(code);
    setLanguage(code);
    closeMenu();
  };

  const onMenuKeyDown = (e: ReactKeyboardEvent<HTMLUListElement>) => {
    const last = LANGUAGES.length - 1;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusIndex((i) => (i >= last ? 0 : i + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusIndex((i) => (i <= 0 ? last : i - 1));
        break;
      case 'Home':
        e.preventDefault();
        setFocusIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setFocusIndex(last);
        break;
      case 'Escape':
        e.preventDefault();
        closeMenu();
        break;
      case 'Tab':
        closeMenu(false);
        break;
    }
  };

  return (
    <div ref={rootRef} className="auth-lang">
      <button
        ref={buttonRef}
        type="button"
        className="auth-lang__btn"
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            openMenu();
            if (e.key === 'ArrowUp') setFocusIndex(LANGUAGES.length - 1);
          }
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`${t('common.language')} : ${current.label}`}
      >
        <DRCFlag width={20} title={t('common.language')} />
        <span aria-hidden="true">{current.short}</span>
        <ChevronDownIcon size={14} />
      </button>

      {open ? (
        <ul id={menuId} role="menu" aria-label={t('common.chooseLanguage')} className="auth-lang__menu" onKeyDown={onMenuKeyDown}>
          {LANGUAGES.map((lang, i) => (
            <li key={lang.code} role="none">
              <button
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={lang.code === current.code}
                tabIndex={i === focusIndex ? 0 : -1}
                className="auth-lang__item"
                onMouseEnter={() => setFocusIndex(i)}
                onClick={() => void choose(lang.code)}
              >
                <span>
                  <span className="auth-lang__code">{lang.short}</span>
                  {lang.label}
                </span>
                {lang.code === current.code ? <CheckIcon size={16} /> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
