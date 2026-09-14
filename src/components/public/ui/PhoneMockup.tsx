import { FileText, CreditCard, Receipt } from 'lucide-react';

export function PhoneMockup() {
  return (
    <div
      className="relative z-10 mx-auto w-[260px] mockup-shadow"
      role="img"
      aria-label="Aperçu de l'application mobile eLoyer Kinshasa"
    >
      <div className="overflow-hidden rounded-[2rem] border-[3px] border-[#1a1a1a] bg-white">
        {/* Notch */}
        <div className="relative bg-[#1a1a1a] px-4 pb-1 pt-2">
          <div className="mx-auto h-5 w-24 rounded-full bg-black" />
        </div>

        {/* Screen content */}
        <div className="bg-[#f8fafc] p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-heading text-xs font-bold text-[var(--navy-900)]">
              <span className="text-[var(--brand-gold)]">e</span>Loyer Kinshasa
            </span>
            <div className="h-6 w-6 rounded-full bg-[var(--blue-light)]" />
          </div>

          <p className="mb-3 text-xs text-[var(--text-secondary)]">Bonjour, Jean Dupont</p>

          <div className="mb-3 overflow-hidden rounded-lg bg-white shadow-sm">
            <div className="h-20 bg-gradient-to-br from-[var(--blue-primary)] to-[var(--navy-800)]" />
            <div className="p-3">
              <p className="text-[10px] text-[var(--text-muted)]">Appartement Gombe</p>
              <p className="font-heading text-xl font-bold text-[var(--navy-900)]">750 000 FC</p>
            </div>
          </div>

          <button
            type="button"
            className="mb-4 w-full rounded-lg bg-[var(--brand-gold)] py-2.5 text-xs font-bold text-[var(--navy-900)]"
            tabIndex={-1}
          >
            Payer mon loyer
          </button>

          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: FileText, label: 'Mes contrats' },
              { icon: CreditCard, label: 'Mes paiements' },
              { icon: Receipt, label: 'Mes reçus' },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-1 rounded-lg bg-white p-2 shadow-sm"
              >
                <Icon className="h-3.5 w-3.5 text-[var(--blue-primary)]" aria-hidden="true" />
                <span className="text-[8px] text-center text-[var(--text-secondary)]">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Home indicator */}
        <div className="flex justify-center bg-white py-2">
          <div className="h-1 w-16 rounded-full bg-gray-300" />
        </div>
      </div>
    </div>
  );
}
