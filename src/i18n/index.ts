import { useCallback } from 'react';
import { useUIStore } from '@/stores/ui.store';
import { fr, type MessageKey } from './locales/fr';

export type Language = 'fr' | 'en' | 'ln' | 'sw';

export const LANGUAGES: ReadonlyArray<{ code: Language; short: string; label: string }> = [
  { code: 'fr', short: 'FR', label: 'Français' },
  { code: 'en', short: 'EN', label: 'English' },
  { code: 'ln', short: 'LN', label: 'Lingala' },
  { code: 'sw', short: 'SW', label: 'Swahili' },
];

export type { MessageKey };
export type TranslateVars = Record<string, string | number>;
export type Translate = (key: MessageKey, vars?: TranslateVars) => string;

type Catalogue = Partial<Record<MessageKey, string>>;

// Only French ships in the bundle; other catalogues are fetched on demand.
const catalogues: Partial<Record<Language, Catalogue>> = { fr };

const loaders: Partial<Record<Language, () => Promise<Catalogue>>> = {
  en: () => import('./locales/en').then((m) => m.en),
  // Lingala and Swahili catalogues are not yet authored; they fall back to French.
};

export async function loadLocale(lang: Language): Promise<void> {
  if (catalogues[lang]) return;
  const loader = loaders[lang];
  catalogues[lang] = loader ? await loader() : {};
}

function interpolate(template: string, vars?: TranslateVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}

export function translate(lang: Language, key: MessageKey, vars?: TranslateVars): string {
  const template = catalogues[lang]?.[key] ?? fr[key];
  return interpolate(template, vars);
}

/** Returns a `t()` bound to the active UI language. */
export function useT(): Translate {
  const language = useUIStore((s) => s.language);
  return useCallback<Translate>((key, vars) => translate(language, key, vars), [language]);
}

/** Non-hook accessor for code that runs outside React (services, validators). */
export function t(key: MessageKey, vars?: TranslateVars): string {
  return translate(useUIStore.getState().language, key, vars);
}
