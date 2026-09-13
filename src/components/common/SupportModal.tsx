import { useState } from 'react';
import { Headphones, X, Phone, Mail, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface SupportModalProps {
  open: boolean;
  onClose: () => void;
}

export function SupportModal({ open, onClose }: SupportModalProps) {
  const [message, setMessage] = useState('');

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    window.open(
      `mailto:support@eloyer.cd?subject=Demande%20d'assistance&body=${encodeURIComponent(message)}`,
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="support-title">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-md rounded-t-2xl bg-[var(--color-card)] p-6 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Headphones className="h-5 w-5 text-[var(--color-kinshasa-blue)]" />
            <h2 id="support-title" className="font-heading text-lg font-semibold">Support eLoyer</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-[var(--color-muted)]" aria-label="Fermer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 space-y-2 text-sm">
          <a href="tel:+243900000000" className="flex items-center gap-2 text-[var(--color-kinshasa-blue)] hover:underline">
            <Phone className="h-4 w-4" /> +243 900 000 000
          </a>
          <a href="mailto:support@eloyer.cd" className="flex items-center gap-2 text-[var(--color-kinshasa-blue)] hover:underline">
            <Mail className="h-4 w-4" /> support@eloyer.cd
          </a>
          <a href="https://wa.me/243900000000" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[var(--color-kinshasa-blue)] hover:underline">
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Décrivez votre problème..."
            rows={4}
            className="w-full rounded-lg border border-[var(--color-border)] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
            required
          />
          <Button type="submit" className="w-full">Envoyer</Button>
        </form>
      </div>
    </div>
  );
}

export function useSupportModal() {
  const [open, setOpen] = useState(false);
  return {
    open,
    openSupport: () => setOpen(true),
    closeSupport: () => setOpen(false),
  };
}
