import { useState } from 'react';
import { BookOpen, ChevronDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { TAX_EXPLANATIONS } from '@/types/tax';
import { cn } from '@/lib/utils';

const SECTIONS: Array<{ title: string; body: string }> = [
  { title: 'Sur quoi suis-je imposé ?', body: TAX_EXPLANATIONS.baseImposable },
  { title: 'Logements résidentiels', body: TAX_EXPLANATIONS.tauxResidentiel },
  { title: 'Locaux commerciaux', body: TAX_EXPLANATIONS.tauxCommercial },
  { title: 'Exonérations', body: TAX_EXPLANATIONS.exoneration },
  { title: 'Taxes additionnelles communales', body: TAX_EXPLANATIONS.cumul },
  { title: 'Comment l’impôt est-il prélevé ?', body: TAX_EXPLANATIONS.retenue },
  { title: 'Échéances', body: TAX_EXPLANATIONS.echeance },
];

/** "Comprendre mes impôts" — plain-French explanation, collapsed by default. */
export function UnderstandTaxesPanel({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="understand-taxes-body"
        className="flex w-full items-center justify-between px-6 py-4 text-left"
      >
        <span className="flex items-center gap-3">
          <span className="rounded-lg bg-[var(--color-accent)] p-2">
            <BookOpen className="h-5 w-5 text-[var(--color-kinshasa-blue)]" />
          </span>
          <span>
            <span className="block font-heading text-base font-semibold">Comprendre mes impôts</span>
            <span className="block text-sm text-[var(--color-muted-foreground)]">Explications simples, sans jargon fiscal</span>
          </span>
        </span>
        <ChevronDown className={cn('h-5 w-5 text-[var(--color-muted-foreground)] transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <CardContent id="understand-taxes-body" className="border-t border-[var(--color-border)] pt-4">
          <dl className="grid gap-4 sm:grid-cols-2">
            {SECTIONS.map((s) => (
              <div key={s.title}>
                <dt className="text-sm font-semibold">{s.title}</dt>
                <dd className="mt-1 text-sm text-[var(--color-muted-foreground)]">{s.body}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            Les taux et références affichés sur eLoyer sont configurés par l’administration fiscale. Certaines règles sont encore en cours de validation
            juridique et sont signalées comme telles. En cas de doute, contactez la DGI.
          </p>
        </CardContent>
      )}
    </Card>
  );
}
