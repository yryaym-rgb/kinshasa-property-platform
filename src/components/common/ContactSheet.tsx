import { Phone, MessageCircle, X } from 'lucide-react';
import { formatPhone } from '@/lib/utils';

interface ContactSheetProps {
  open: boolean;
  onClose: () => void;
  name: string;
  phone: string;
}

export function ContactSheet({ open, onClose, name, phone }: ContactSheetProps) {
  if (!open) return null;

  const normalized = phone.replace(/\s/g, '');
  const waNumber = normalized.replace('+', '');

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-md rounded-t-2xl bg-[var(--color-card)] p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">Contacter {name}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-[var(--color-muted)]" aria-label="Fermer">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-sm text-[var(--color-muted-foreground)]">{formatPhone(phone)}</p>
        <div className="grid grid-cols-3 gap-3">
          <a
            href={`tel:${normalized}`}
            className="flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-xl border border-[var(--color-border)] p-3 text-sm hover:bg-[var(--color-muted)]"
          >
            <Phone className="h-5 w-5 text-[var(--color-kinshasa-blue)]" />
            Appeler
          </a>
          <a
            href={`sms:${normalized}`}
            className="flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-xl border border-[var(--color-border)] p-3 text-sm hover:bg-[var(--color-muted)]"
          >
            <MessageCircle className="h-5 w-5 text-[var(--color-kinshasa-blue)]" />
            SMS
          </a>
          <a
            href={`https://wa.me/${waNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-xl border border-[var(--color-border)] p-3 text-sm hover:bg-[var(--color-muted)]"
          >
            <MessageCircle className="h-5 w-5 text-green-600" />
            WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
